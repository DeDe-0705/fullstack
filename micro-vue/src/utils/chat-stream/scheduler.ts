/**
 * 信号量调度器：限制全局并发数（本方案上限 6）。
 *
 * 语义：
 *  - acquire 有空位立即通过；否则挂起，按 FIFO 顺序等待；
 *  - release 优先把名额直接交接给最早等待者，避免惊群与计数抖动；
 *  - cancel 可移除仍在等待的 waiter（执行中的不可取消，由 Stream.abort 负责）。
 */
export class Scheduler {
  private available: number;
  /** 等待队列：每项是一个可唤醒的 waiter */
  private waiters: Array<{
    wake: () => void;
    cancelled: boolean;
  }> = [];

  constructor(private readonly max: number) {
    this.available = max;
  }

  /** 获取一个名额。返回的函数用于取消排队（未拿到名额前有效）。 */
  acquire(): { ready: Promise<void>; cancel: () => void } {
    if (this.available > 0) {
      this.available--;
      return { ready: Promise.resolve(), cancel: () => {} };
    }
    let cancelFn: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      const waiter = {
        wake: resolve,
        cancelled: false,
      };
      this.waiters.push(waiter);
      cancelFn = () => {
        waiter.cancelled = true;
        // 直接 resolve，由调用方检查 cancelled 标记后放弃执行
        resolve();
      };
    });
    return { ready, cancel: cancelFn };
  }

  /** 释放一个名额，唤醒队首未取消的等待者。 */
  release(): void {
    // 跳过已被取消的 waiter，找到第一个仍有效者
    while (this.waiters.length > 0) {
      const next = this.waiters.shift();
      if (next && !next.cancelled) {
        next.wake();
        return;
      }
    }
    // 无人等待，名额归还池子
    if (this.available < this.max) this.available++;
  }

  /** 当前运行中任务数（观测/调试用） */
  get runningCount(): number {
    return this.max - this.available - this.aliveWaiters;
  }

  /** 排队中任务数 */
  get queuedCount(): number {
    return this.aliveWaiters;
  }

  private get aliveWaiters(): number {
    return this.waiters.filter((w) => !w.cancelled).length;
  }

  /** 清空等待队列（页面卸载时调用），所有排队任务被放行并由调用方丢弃 */
  drainQueue(): void {
    for (const w of this.waiters) {
      if (!w.cancelled) {
        w.cancelled = true;
        w.wake();
      }
    }
    this.waiters = [];
  }
}
