async function asyncPool(limit: number, tasks: any[]) {
  const results: Promise<any>[] = []
  const executing = new Set()

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

const p = Promise.resolve(1)
console.log(p)
const res = await p
console.log(res)
