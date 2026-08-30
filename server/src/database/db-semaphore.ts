// 数据库并发池（信号量）：限制同时打到 MySQL 的查询并发数。
// 为什么需要：Redis 挂了或缓存大面积失效时，回源流量会瞬间全部打到 DB；
// 连接池只限制"物理连接数"，不限制"排队等待的请求数"——信号量在应用层挡住洪峰，
// 超出容量的请求排队，等太久直接快速失败，避免雪崩式堆积。
export class DbConcurrencyLimitError extends Error {
  constructor() {
    super('数据库繁忙，请稍后重试');
    this.name = 'DbConcurrencyLimitError';
  }
}

export class DbSemaphore {
  private running = 0;
  // 等待队列：存 resolve，拿到名额后唤醒
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly max: number,
    private readonly waitTimeoutMs: number,
  ) {}

  // 模板方法：包住一段 DB 操作，自动申请/释放名额
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    // 排队等待，超时快速失败（比无限堆积强：客户端早点收到 503 还能重试）
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.queue.indexOf(wake);
        if (index >= 0) this.queue.splice(index, 1);
        reject(new DbConcurrencyLimitError());
      }, this.waitTimeoutMs);
      const wake = () => {
        clearTimeout(timer);
        this.running++;
        resolve();
      };
      this.queue.push(wake);
      if (this.queue.length === 1 || this.queue.length % 10 === 0) {
        console.warn(`[DbSemaphore] 并发已满(${this.max})，排队中: ${this.queue.length}`);
      }
    });
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    next?.(); // 有排队的就唤醒一个补上名额
  }

  // 暴露观测指标：可接到健康检查或日志中间件
  stats(): { running: number; queued: number; max: number } {
    return { running: this.running, queued: this.queue.length, max: this.max };
  }
}
