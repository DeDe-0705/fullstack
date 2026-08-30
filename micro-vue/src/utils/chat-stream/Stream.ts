import type {
  AskPayload,
  MessageItem,
  Session,
  StreamFetcher,
} from './types';

let seq = 0;
const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/**
 * 单个会话的流式回答实例。
 *
 * 职责：
 *  1. 发起问答（fetch 流式接口），逐块读取响应；
 *  2. 把增量内容直接写入所属 Session 的 messageList（响应式状态），
 *     组件渲染层只读这份状态，不与流发生订阅关系；
 *  3. 生命周期自控：运行中不受"切换会话"影响，仅由全局 store
 *     调度中断 / 暂停，或由页面卸载事件触发提前中断。
 *
 * 实例直接持有 session 的响应式引用（Vue 中为 reactive 对象），
 * 因此写入即更新 UI（前提是该会话正被渲染；未被渲染时仅是数据写入）。
 */
export class Stream {
  /** 当前是否正在流式回答 */
  running = false;

  private abortController: AbortController | null = null;
  /** 当前正在写入的 assistant 消息，中断时用于标记完成 */
  private pendingMessage: MessageItem | null = null;

  constructor(
    private readonly session: Session,
    private readonly fetcher: StreamFetcher,
    /** 中断 / 完成 / 出错时通知全局 store（用于持久化等调度） */
    private readonly onSettled?: (sessionId: number) => void
  ) {}

  /** 发起一轮问答。同一时刻只允许一个流在跑。 */
  async ask(payload: AskPayload): Promise<void> {
    if (this.running) {
      throw new Error(
        `[Stream] session ${this.session.id} 已有进行中的回答`
      );
    }

    this.pushMessage({ role: 'user', content: payload.question, done: true });
    const assistantMsg = this.pushMessage({
      role: 'assistant',
      content: '',
      done: false,
    });

    this.running = true;
    this.pendingMessage = assistantMsg;
    this.session.status = 'active';
    this.abortController = new AbortController();

    try {
      const stream = await this.fetcher(payload, this.abortController.signal);
      await this.consume(stream, assistantMsg);
      this.session.status = 'done';
    } catch (err) {
      if (this.isAbort(err)) {
        // 中断语义：保留已收到的残文，不视为错误
        this.session.status = 'done';
      } else {
        assistantMsg.error = err instanceof Error ? err.message : String(err);
        this.session.status = 'error';
      }
    } finally {
      assistantMsg.done = true;
      this.running = false;
      this.pendingMessage = null;
      this.abortController = null;
      this.touch();
      this.onSettled?.(this.session.id);
    }
  }

  /** 中断当前流（保留已收到的内容）。无进行中的流时为空操作。 */
  abort(): void {
    this.abortController?.abort();
  }

  private async consume(
    stream: ReadableStream<Uint8Array>,
    target: MessageItem
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          target.content += decoder.decode(value, { stream: true });
          this.touch();
        }
      }
      target.content += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }

  private pushMessage(
    partial: Pick<MessageItem, 'role' | 'content' | 'done'>
  ): MessageItem {
    const msg: MessageItem = {
      id: nextId(partial.role),
      createdAt: Date.now(),
      ...partial,
    };
    this.session.messageList.push(msg);
    this.touch();
    return msg;
  }

  private touch(): void {
    this.session.meta.updatedAt = Date.now();
  }

  private isAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'AbortError';
  }
}
