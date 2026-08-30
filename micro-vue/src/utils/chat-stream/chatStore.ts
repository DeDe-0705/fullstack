import { reactive, computed, type ComputedRef } from 'vue';
import { Stream } from './Stream';
import { Scheduler } from './scheduler';
import type {
  AskPayload,
  MessageItem,
  Session,
  SessionSnapshot,
  StreamFetcher,
} from './types';

const STORAGE_KEY = 'chat-sessions-v1';
/** 全局并发上限：与浏览器 HTTP/1.1 单域名 6 连接对齐 */
const MAX_CONCURRENT_STREAMS = 6;

/**
 * 全局聊天调度 store。
 *
 * 设计要点：
 *  - 所有会话的流集中管理，以 sessionId 为键，彼此独立；
 *  - 组件与流之间没有订阅关系：流写入的是 session 的响应式状态，
 *    组件读取同一份状态，Vue 的响应式系统天然完成同步；
 *  - 切换会话只移动 currentId 指针，不触碰任何流；
 *  - 页面卸载（pagehide / 页面被冻结）时统一中断并持久化。
 */
export class ChatStore {
  /** 全部会话（含各自的流实例）。reactive 保证 UI 同步。 */
  readonly sessions = reactive(new Map<number, Session>());

  /** 当前展示会话 id。组件只消费 currentSession，不关心流在不在跑。 */
  currentId: number | null = null;

  readonly currentSession: ComputedRef<Session | null> = computed(() =>
    this.currentId === null ? null : this.sessions.get(this.currentId) ?? null
  );

  /** 全局信号量调度器：任何时刻最多 6 路流在跑 */
  private readonly scheduler = new Scheduler(MAX_CONCURRENT_STREAMS);

  /**
   * 会话内串行：每个会话一条 promise 链。
   * 同一 session 的多次 ask 依次链接，保证消息顺序且只占用一个全局名额。
   */
  private readonly sessionChains = new Map<number, Promise<void>>();

  /** 会话级取消标记：abort 时置位，调度循环据此跳过排队任务 */
  private readonly sessionCancelled = new Map<number, boolean>();

  /** 会话当前排队任务的取消函数（拿到名额后移除） */
  private readonly cancelHooks = new Map<number, () => void>();

  constructor(
    private readonly fetcher: StreamFetcher,
    options: { restore?: boolean } = {}
  ) {
    if (options.restore !== false) this.restore();
    this.bindLifecycle();
  }

  // ---------- 会话管理 ----------

  createSession(title = '新会话'): Session {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const session = reactive({
      id,
      status: 'idle',
      messageList: [],
      meta: { title, createdAt: Date.now(), updatedAt: Date.now() },
    } as unknown as Session);
    // stream 持有 session 响应式引用，直接落数据
    session.stream = new Stream(session, this.fetcher, () => this.persist());
    this.sessions.set(id, session);
    this.currentId = id;
    this.persist();
    return session;
  }

  /** 切换会话：仅移动指针，进行中的流继续后台运行。 */
  switchTo(id: number): void {
    if (!this.sessions.has(id)) return;
    this.currentId = id;
  }

  // ---------- 流调度 ----------

  /**
   * 向指定会话发起问答（缺省为当前会话）。
   *
   * 两级调度：
   *  1. 会话内串行 —— 挂到该会话 promise 链尾，同会话消息严格有序；
   *  2. 全局并发 6 —— 链上每个任务执行前先 acquire 信号量，
   *     超额则排队（session 呈现 queued 状态）。
   */
  ask(payload: AskPayload, sessionId?: number): Promise<void> {
    const session = this.resolve(sessionId);
    const prev = this.sessionChains.get(session.id) ?? Promise.resolve();

    const task = async (): Promise<void> => {
      // 新一轮问答开始，复位取消标记（上一轮 abort 不影响后续提问）
      this.sessionCancelled.set(session.id, false);

      // 排队语义从链挂接时就生效，用户能立刻看到"等待中"
      session.status = 'queued';
      session.meta.updatedAt = Date.now();

      const { ready, cancel } = this.scheduler.acquire();
      this.cancelHooks.set(session.id, cancel);
      await ready;
      this.cancelHooks.delete(session.id);

      // 等待期间被 abort / 页面卸载：直接放弃，不占用名额
      if (this.sessionCancelled.get(session.id)) {
        this.scheduler.release();
        return;
      }

      try {
        await session.stream.ask(payload);
      } finally {
        this.scheduler.release();
        this.persist();
      }
    };

    // 链式串行：本任务等上一任务结束；错误不阻断后续任务
    const chain = prev.then(task, task);
    this.sessionChains.set(
      session.id,
      chain.catch(() => {})
    );
    return chain;
  }

  /**
   * 中断指定会话（缺省为当前会话）。
   *  - 运行中的流：经 AbortController 中断，保留残文；
   *  - 排队中的任务：置取消标记，被调度器唤醒后直接跳过。
   */
  abort(sessionId?: number): void {
    const session = this.resolve(sessionId);
    this.sessionCancelled.set(session.id, true);
    // 还在排队的任务：直接取消其 acquire 等待，无需等名额
    this.cancelHooks.get(session.id)?.();
    session.stream.abort();
    if (session.status === 'queued') {
      session.status = 'done';
      session.meta.updatedAt = Date.now();
    }
    this.persist();
  }

  /** 中断全部会话：取消排队任务 + 中断运行中的流。 */
  abortAll(): void {
    this.sessions.forEach((s: Session) => {
      this.sessionCancelled.set(s.id, true);
      s.stream.abort();
      if (s.status === 'queued') s.status = 'done';
    });
    this.scheduler.drainQueue();
    this.persist();
  }

  // ---------- 持久化 ----------

  /** 落盘全部会话快照（不含 stream 实例，无法序列化）。 */
  persist(): void {
    const snapshots: SessionSnapshot[] = [...this.sessions.values()].map(
      ({ id, status, messageList, meta }: Session) => ({
        id,
        status,
        // 深拷贝，断开响应式引用
        messageList: messageList.map((m: MessageItem) => ({ ...m })),
        meta: { ...meta },
      })
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
    } catch {
      // 存储超限等情况静默失败，不影响主流程
    }
  }

  /**
   * 恢复历史会话。
   * 注意：刷新前的流无法跨刷新存活，active 状态统一降级为 done，
   * 保留已收到的残文。真正的断点续传需要服务端支持（如 SSE 的
   * Last-Event-ID 或 offset 机制）。
   */
  private restore(): void {
    let snapshots: SessionSnapshot[];
    try {
      snapshots = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return;
    }
    for (const snap of snapshots) {
      const session = reactive({
        ...snap,
        // 中断 / 未完成的流恢复后一律视为已结束（queued 同理）
        status:
          snap.status === 'active' || snap.status === 'queued'
            ? 'done'
            : snap.status,
        messageList: snap.messageList.map((m: MessageItem) =>
          m.done ? m : { ...m, done: true }
        ),
      } as unknown as Session);
      session.stream = new Stream(session, this.fetcher, () => this.persist());
      this.sessions.set(session.id, session);
    }
    const last = [...this.sessions.keys()].pop();
    this.currentId = last ?? null;
  }

  // ---------- 页面生命周期 ----------

  /**
   * pagehide 比 beforeunload 更可靠（覆盖移动端页面冻结场景）：
   * 统一中断所有进行中的流并立即落盘。
   */
  private bindLifecycle(): void {
    const handleLeave = () => {
      this.sessions.forEach((s: Session) => {
        this.sessionCancelled.set(s.id, true);
        if (s.stream.running) s.stream.abort();
        // 排队中的会话不能留着 queued 落盘，否则恢复后成"幽灵排队"
        if (s.status === 'queued') s.status = 'done';
      });
      this.scheduler.drainQueue();
      this.persist();
    };
    window.addEventListener('pagehide', handleLeave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleLeave();
    });
  }

  // ---------- 工具 ----------

  private resolve(sessionId?: number): Session {
    const id = sessionId ?? this.currentId;
    const session = id === null ? undefined : this.sessions.get(id);
    if (!session) throw new Error(`[ChatStore] 会话不存在: ${id}`);
    return session;
  }
}
