// 构造函数类型：既可调用（apply 模拟 new 时用），又带 prototype。
// 手写题侧重逻辑，这里用结构化类型避免 any，同时绕开 TS「构造签名拿不到 apply」的坑。
type Constructor = {
  (...args: unknown[]): unknown
  prototype: object
}

// 手写 new：等价于 new Fn(...args)
export function myNew<T> (Fn: Constructor, ...args: unknown[]): T {
  // 1. 创建新对象，并让它的 __proto__ 指向 Fn.prototype
  const obj = Object.create(Fn.prototype) as T
  // 2. 以 obj 为 this 执行构造函数
  const result = Fn.apply(obj, args) as T
  // 3. 构造函数若返回对象（含数组/函数），就采用它；否则返回新对象
  return result instanceof Object ? result : obj
}

// 手写 instanceof：判断 Constructor.prototype 是否在 instance 的原型链上
export function myInstanceof (instance: object, Constructor: Constructor): boolean {
  let proto: object | null = Object.getPrototypeOf(instance)
  const prototype = Constructor.prototype

  // 沿实例的 __proto__ 链向上找，直到 null
  while (proto) {
    if (proto === prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}


export function debounce (fn: Function, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (...args: unknown[]) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
    }, delay)
  } as unknown as Function
}

export function throttle (fn: Function, delay: number) {
  let lastTime = 0;
  return function (...args: unknown[]) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      fn(...args)
      lastTime = now
    }
  }
}

export function deepClone<T> (obj: T, map = new WeakMap()): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (map.has(obj)) return map.get(obj) as T

  const cloneObj = Array.isArray(obj) ? [] : {}
  map.set(obj, cloneObj)
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloneObj[key] = deepClone(obj[key], map)
    }
  }

  return cloneObj as T
}


export class schedule {
  private excute: Set<Promise<any>> = new Set()
  private limit: number = 0;
  constructor(limit: number) {
    this.limit = limit
  }
  async add (fn: Function) {
    while (this.excute.size >= this.limit) {
      await Promise.race(this.excute)
    }
    const p = Promise.resolve().then(fn).catch(err => console.log(err))
    this.excute.add(p)
    p.finally(() => this.excute.delete(p))
  }
}

export function flatten (arr: any[], depth = 1) {
  if (depth === 0) return arr
  return arr.reduce((prev, cur) => {
    return prev.concat(Array.isArray(cur) ? flatten(cur, depth - 1) : cur)
  }, [])
}