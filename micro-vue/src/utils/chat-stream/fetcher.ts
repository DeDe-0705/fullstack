import type { StreamFetcher } from './types';

/**
 * 流式接口适配器示例（真实项目替换为业务接口）。
 *
 * 这里假设后端直接返回 text/plain 或 SSE 裸流；
 * 若为 SSE 协议，需在进入 consume 前按 event 解析 data 行。
 */
export const chatFetcher: StreamFetcher = async (payload, signal) => {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`请求失败: ${res.status}`);
  }
  return res.body;
};
