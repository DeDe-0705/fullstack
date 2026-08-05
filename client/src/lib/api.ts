export const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const error = new Error(
      `API error: ${res.status} ${res.statusText}`,
    ) as Error & { status?: number }
    // 附带状态码，方便调用方区分 404/409/500 等业务语义
    error.status = res.status
    throw error
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}
