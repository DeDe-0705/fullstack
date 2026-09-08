import { createContext } from "react"

export async function asyncPool<T> (
  limit: number,
  tasks: Array<() => Promise<T>>,
): Promise<PromiseSettledResult<T>[]> {
  const results: Promise<PromiseSettledResult<T>>[] = []
  const executing = new Set<Promise<PromiseSettledResult<T>>>()

  for (const task of tasks) {
    // 把每个任务包装成「永不 reject」，失败也作为 settled 结果返回
    const p = Promise.resolve()
      .then(task)
      .then(
        (value) => ({ status: 'fulfilled', value }) as PromiseFulfilledResult<T>,
        (reason) => ({ status: 'rejected', reason }) as PromiseRejectedResult,
      )

    results.push(p)
    executing.add(p)
    p.finally(() => executing.delete(p)) // p 永不 reject，这里不再有 unhandledRejection

    if (executing.size >= limit) {
      await Promise.race(executing) // 现在 race 只会在「有任务完成」时 resolve
    }
  }

  return Promise.all(results) // results 全是 fulfilled，这里一定 resolve
}

export interface UserConfig {
  name: string
  description: string
}

export const userConfigContext = createContext<UserConfig | null>(null)


export function lazyLoadImages () {
  const images = document.querySelectorAll('img[data-src]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        img.src = img.dataset.src ?? ''
        img.removeAttribute('data-src')
        observer.unobserve(img)
      }
    })
  }, { rootMargin: '100px' })
  images.forEach(img => observer.observe(img))
}


export class Person {
  public name: string
  private queue: Promise<void> = Promise.resolve()
  constructor(name: string) {
    this.name = name
  }
  sayHi () {
    this.queue = this.queue.then(() => {
      console.log(`Hi, I'm ${this.name}`)
    })
    return this
  }
  sleep (time: number) {
    this.queue = this.queue.then(() => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(`${this.name} slept for ${time} seconds`)
          resolve()
        }, time * 1000)
      })
    })
    return this
  }
  eat () {
    this.queue = this.queue.then(() => {
      console.log(`${this.name} is eating`)
    })
    return this
  }
}