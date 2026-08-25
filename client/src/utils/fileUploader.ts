import { BASE_URL, DEMO_TOKEN } from "../lib/api"
import { asyncPool } from "./index"

// ===== 大文件分片上传（断点续传 / 秒传） =====
//
// 服务端待实现接口（TODO）：
//   1. POST /api/upload/check   入参 UploadCheckParams → 返回 CheckUploadedResult
//      作用：按 fileHash 查询已上传分片下标；文件已完整则返回 uploaded=true + fileUrl（秒传）
//   2. POST /api/upload/chunk   FormData：file(Blob) / fileHash / index / totalChunks
//      作用：接收并保存单个分片（按 fileHash 分目录、按 index 命名落盘）
//   3. POST /api/upload/merge   入参 UploadMergeParams → 返回 MergeChunksResult
//      作用：校验分片完整性，按 index 顺序合并，返回最终可访问的 fileUrl

/** 单个分片 */
export interface UploadChunk {
  index: number
  blob: Blob
  /** 分片在源文件中的字节区间 [start, end) */
  start: number
  end: number
  size: number
}

export interface UploadProgress {
  uploadedChunks: number
  totalChunks: number
  percent: number
}

export interface UploadResult {
  fileHash: string
  fileUrl: string
  /** 是否命中秒传（服务端已存在完整文件，本次未真正上传） */
  instant: boolean
}

export interface FileUploaderCallbacks {
  onProgress?: (progress: UploadProgress) => void
  onChunkSuccess?: (index: number) => void
  onChunkError?: (index: number, error: Error, attempt: number) => void
  /** 计算文件指纹的进度；当前只在计算前后回调 0/100（增量哈希见 computeHash TODO） */
  onHashProgress?: (percent: number) => void
  onSuccess?: (result: UploadResult) => void
  onError?: (error: Error) => void
}

export interface FileUploaderOptions {
  chunkSize?: number
  concurrency?: number
  maxRetries?: number
  /** 重试退避基础间隔(ms)，第 n 次重试等待 retryDelay * n */
  retryDelay?: number
  /** 单个分片请求超时(ms) */
  timeout?: number
  callbacks?: FileUploaderCallbacks
}

// ---- 服务端接口契约（与顶部 TODO 一一对应） ----
export interface UploadCheckParams {
  fileHash: string
  fileName: string
  fileSize: number
  totalChunks: number
}

export interface CheckUploadedResult {
  uploadedIndexes: number[]
  uploaded: boolean
  fileUrl?: string
}

export interface UploadMergeParams {
  fileHash: string
  fileName: string
  fileSize: number
  totalChunks: number
}

export interface MergeChunksResult {
  fileUrl: string
}

// ---- 内部工具 ----
interface ApiResponse<T> {
  code: number
  data: T
  message: string
  trace_id: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export class UploadCanceledError extends Error {
  constructor() {
    super("上传已取消")
    this.name = "UploadCanceledError"
  }
}

// 用法：
//   const uploader = new FileUploader({ concurrency: 3, callbacks: { onProgress } })
//   const { fileUrl } = await uploader.upload(file)  // 期间可 uploader.pause() / resume() / cancel()
export class FileUploader {
  private readonly chunkSize: number
  private readonly concurrency: number
  private readonly maxRetries: number
  private readonly retryDelay: number
  private readonly timeout: number
  private readonly callbacks: FileUploaderCallbacks

  private uploadedChunks = new Set<number>()
  private paused = false
  private pausedPromise: Promise<void> | null = null
  private resumePaused: (() => void) | null = null
  private abortController: AbortController | null = null

  constructor(options: FileUploaderOptions = {}) {
    this.chunkSize = options.chunkSize ?? 5 * 1024 * 1024
    this.concurrency = options.concurrency ?? 3
    this.maxRetries = options.maxRetries ?? 3
    this.retryDelay = options.retryDelay ?? 500
    this.timeout = options.timeout ?? 30_000
    this.callbacks = options.callbacks ?? {}
  }

  async upload(file: File): Promise<UploadResult> {
    if (!file || file.size === 0) {
      throw new Error("文件不能为空")
    }

    // 复位会话状态，允许同一实例复用（同一时刻只能传一个文件）
    this.abortController = new AbortController()
    this.paused = false
    this.pausedPromise = null
    this.resumePaused = null
    this.uploadedChunks.clear()

    const signal = this.abortController.signal

    try {
      // 1) 文件指纹：秒传 / 断点续传的唯一标识
      this.callbacks.onHashProgress?.(0)
      const fileHash = await this.computeHash(file)
      this.callbacks.onHashProgress?.(100)

      const chunks = this.createChunks(file)
      const totalChunks = chunks.length

      // 2) 查询已上传分片（秒传 / 断点续传）
      const checked = await this.checkUploaded({
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
      })
      this.uploadedChunks = new Set(checked.uploadedIndexes)
      this.reportProgress(totalChunks)

      // 秒传：服务端已有完整文件
      if (checked.uploaded) {
        const result: UploadResult = { fileHash, fileUrl: checked.fileUrl ?? "", instant: true }
        this.callbacks.onSuccess?.(result)
        return result
      }

      // 3) 并发上传缺失分片（内部带重试、暂停、取消）
      const pendingChunks = chunks.filter((chunk) => !this.uploadedChunks.has(chunk.index))
      const settled = await asyncPool(
        this.concurrency,
        pendingChunks.map(
          (chunk) => async () => {
            await this.waitIfPausedOrCancelled(signal)
            await this.uploadChunkWithRetry(chunk, fileHash, totalChunks, signal)
            this.uploadedChunks.add(chunk.index)
            this.reportProgress(totalChunks)
          },
        ),
      )

      // 4) 取消优先：取消时抛专用错误，而不是当成普通失败
      if (signal.aborted) {
        throw new UploadCanceledError()
      }

      // 5) 重试耗尽仍未成功的分片 → 整体失败
      const rejected = settled.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      )
      if (rejected.length > 0) {
        throw toError(rejected[0].reason)
      }

      // 6) 通知服务端合并分片，返回最终文件地址
      const merged = await this.mergeChunks({
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
      })

      const result: UploadResult = { fileHash, fileUrl: merged.fileUrl, instant: false }
      this.callbacks.onSuccess?.(result)
      return result
    } catch (error) {
      const err = toError(error)
      this.callbacks.onError?.(err)
      throw err
    }
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
    this.resumePaused?.()
    this.resumePaused = null
    this.pausedPromise = null
  }

  cancel(): void {
    // abort 会中止在途请求；同时唤醒可能正在「暂停等待」的任务，让它们进入取消分支
    this.abortController?.abort()
    this.resumePaused?.()
    this.resumePaused = null
    this.pausedPromise = null
  }

  private createChunks(file: File): UploadChunk[] {
    const chunks: UploadChunk[] = []
    let start = 0
    while (start < file.size) {
      const end = Math.min(start + this.chunkSize, file.size)
      chunks.push({
        index: chunks.length,
        blob: file.slice(start, end),
        start,
        end,
        size: end - start,
      })
      start = end
    }
    return chunks
  }

  private async computeHash(file: File): Promise<string> {
    // TODO: 超大文件建议改用增量哈希（如 spark-md5）分片计算，避免整文件一次性读入内存
    const buffer = await file.arrayBuffer()
    const digest = await crypto.subtle.digest("SHA-256", buffer)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }

  private async waitIfPausedOrCancelled(signal: AbortSignal): Promise<void> {
    while (this.paused && !signal.aborted) {
      if (!this.pausedPromise) {
        this.pausedPromise = new Promise<void>((resolve) => {
          this.resumePaused = resolve
        })
      }
      await this.pausedPromise
    }
    if (signal.aborted) {
      throw new UploadCanceledError()
    }
  }

  private async uploadChunkWithRetry(
    chunk: UploadChunk,
    fileHash: string,
    totalChunks: number,
    signal: AbortSignal,
  ): Promise<void> {
    let lastError: unknown = null
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.uploadChunk(chunk, fileHash, totalChunks, signal)
        this.callbacks.onChunkSuccess?.(chunk.index)
        return
      } catch (error) {
        lastError = error
        this.callbacks.onChunkError?.(chunk.index, toError(error), attempt)
        if (signal.aborted) break
        if (attempt < this.maxRetries) {
          await sleep(this.retryDelay * attempt) // 线性退避，避免瞬时洪泛
        }
      }
    }
    throw toError(lastError)
  }

  private async uploadChunk(
    chunk: UploadChunk,
    fileHash: string,
    totalChunks: number,
    signal: AbortSignal,
  ): Promise<void> {
    // 每个分片单独一个 controller：既能响应整体 cancel，又能独立超时
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal.addEventListener("abort", onAbort, { once: true })
    const timer = setTimeout(
      () => controller.abort(new DOMException("分片上传超时", "TimeoutError")),
      this.timeout,
    )

    const formData = new FormData()
    formData.append("file", chunk.blob)
    formData.append("fileHash", fileHash)
    formData.append("index", String(chunk.index))
    formData.append("totalChunks", String(totalChunks))

    try {
      // TODO(server): 实现 POST /api/upload/chunk
      await this.postForm<void>("/upload/chunk", formData, controller.signal)
    } finally {
      clearTimeout(timer)
      signal.removeEventListener("abort", onAbort)
    }
  }

  private reportProgress(totalChunks: number): void {
    const percent = totalChunks === 0 ? 0 : (this.uploadedChunks.size / totalChunks) * 100
    this.callbacks.onProgress?.({
      uploadedChunks: this.uploadedChunks.size,
      totalChunks,
      percent,
    })
  }

  private async checkUploaded(params: UploadCheckParams): Promise<CheckUploadedResult> {
    // TODO(server): 实现 POST /api/upload/check
    return this.postJson<CheckUploadedResult>("/upload/check", params)
  }

  private async mergeChunks(params: UploadMergeParams): Promise<MergeChunksResult> {
    // TODO(server): 实现 POST /api/upload/merge
    return this.postJson<MergeChunksResult>("/upload/merge", params)
  }

  private async postJson<T>(path: string, data: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEMO_TOKEN}`,
      },
      body: JSON.stringify(data),
      signal,
    })
    return this.parseResponse<T>(res)
  }

  private async postForm<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    // 不要手动设置 Content-Type，浏览器会自动带上 multipart/form-data 的 boundary
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DEMO_TOKEN}` },
      body: formData,
      signal,
    })
    return this.parseResponse<T>(res)
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const error = new Error(`请求失败：${res.status} ${res.statusText}`) as Error & {
        status?: number
      }
      error.status = res.status
      throw error
    }
    const payload = (await res.json()) as ApiResponse<T>
    if (payload.code !== 0) {
      const error = new Error(payload.message) as Error & { traceId?: string }
      error.traceId = payload.trace_id
      throw error
    }
    return payload.data
  }
}
