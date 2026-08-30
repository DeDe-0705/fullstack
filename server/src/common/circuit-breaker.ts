/**
 * 熔断器：依赖持续故障时「短路」请求，不再真正调用下游。
 *
 * 状态机：CLOSED(正常) → 连续失败达阈值 → OPEN(熔断，直接拒绝)
 *   → 冷却结束 → HALF_OPEN(放行探针) → 成功回 CLOSED / 失败回 OPEN
 *
 * 与限流、降级的分工：
 * - 限流（DbSemaphore）：预防过载，正常时也限制并发
 * - 熔断（本类）：发现下游病了，暂停调用给它恢复时间，省掉每次等待失败的开销
 * - 降级（try/catch 兜底）：下游挂了之后的替代行为（回源 DB / 返回 503）
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 10_000,
  ) {}

  /** 调用前询问：熔断中返回 false，调用方走降级逻辑 */
  canPass(): boolean {
    if (this.state === 'CLOSED') return true;
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      // 冷却结束进入半开：放行请求当探针，结果决定回 CLOSED 还是重新 OPEN
      this.state = 'HALF_OPEN';
      console.warn(`[CircuitBreaker:${this.name}] 冷却结束，进入半开试探`);
      return true;
    }
    return false;
  }

  onSuccess(): void {
    if (this.state !== 'CLOSED') {
      console.warn(`[CircuitBreaker:${this.name}] 探针成功，熔断关闭`);
    }
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  onFailure(): void {
    this.consecutiveFailures += 1;
    // 半开状态下失败一次就重新熔断；关闭状态下要连续到达阈值
    if (
      this.state === 'HALF_OPEN' ||
      this.consecutiveFailures >= this.failureThreshold
    ) {
      if (this.state !== 'OPEN') {
        console.warn(
          `[CircuitBreaker:${this.name}] 连续失败 ${this.consecutiveFailures} 次，熔断打开 ${this.cooldownMs}ms`,
        );
      }
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
