import { createContext } from "react"

export async function asyncPool<T>(
  limit: number,
  tasks: Array<() => Promise<T>>,
): Promise<T[]> {
  const results: Promise<T>[] = []
  const executing = new Set<Promise<T>>()

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task())
    results.push(p)
    executing.add(p)
    p.finally(() => executing.delete(p))

    if (executing.size >= limit) {
      await Promise.race(executing)  // 等池里最快的完成，补下一个
    }
  }

  return Promise.all(results)
}

export interface UserConfig {
  name: string
  description: string
}

export const userConfigContext = createContext<UserConfig | null>  (null)
