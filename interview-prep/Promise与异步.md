# Promise 与异步

## 一、核心概念

### 三种状态（不可逆）

```
pending --resolve()--> fulfilled --> .then() 回调入微任务队列
   |
   +--reject()----> rejected  --> .catch() 回调入微任务队列
```

- executor 是同步执行！new Promise(fn) 里的 fn 立即运行
- .then/.catch 的回调才是异步（微任务）
- 状态一旦变更不可逆

### 事件循环：宏任务与微任务的消费顺序（面试必考）

```
执行一个宏任务（当前 script / setTimeout 回调 / 事件回调）
  → 清空微任务队列（每个微任务执行中产生的微任务继续入队尾，直到空）
  → 渲染机会（浏览器按需渲染，不一定每轮都有）
  → 取下一个宏任务
```

**经典输出题：**

```js
console.log('script start');
setTimeout(() => console.log('setTimeout'), 0);
Promise.resolve().then(() => console.log('promise1'))
  .then(() => console.log('promise2'));
console.log('script end');
// script start → script end → promise1 → promise2 → setTimeout
```

要点：
- 微任务队列在**当前宏任务结束后一次性清空**，promise1 执行时新产生的 promise2 继续入队，中间**不会插入宏任务**。
- `setTimeout(fn, 0)` 不是 0ms：最早也是**下一个宏任务**（当前宏任务 + 微任务清空后）。
- 浏览器最小延迟钳制（clamping）：**嵌套第 5 层及以上**的定时器最小 4ms；**后台标签页**最小 1000ms。
- 定时器**从调用 setTimeout 那一刻开始计时**，到点后回调只是**入队**，不是立即执行。

### 链式调用

```js
fetch("/api")
  .then(res => res.json())     // 返回 Promise
  .then(data => data.id)       // 返回普通值，自动 Promise.resolve 包装
  .then(id => fetch("/api/"+id))
  .catch(err => console.error(err))  // 捕获前面任一环节
  .finally(() => console.log("结束"));
```

.then() 返回新 Promise；普通返回值自动包装；catch 只捕获前面的错误。

### 面试题：链式调用 + 异步任务队列（sleep）

**题目**：实现 `Person`，支持 `person.sayHi().sleep(5).eat()`，按顺序输出
`hello, i am jack` →(等 5 秒)→ `wake up` → `eat！`。

**为什么不能同步 sleep**：JS 单线程，同步阻塞（如 `while(Date.now()-t<5000)`）会**卡死事件循环**，必须用异步队列 + `setTimeout` 制造真实等待。

**解法一（推荐 · Promise 链队列）**

```js
class Person {
  constructor(name) {
    this.name = name;
    this.queue = Promise.resolve(); // 任务链起点
  }
  sayHi() {
    this.queue = this.queue.then(() => console.log(`hello, i am ${this.name}`));
    return this; // 链式调用的前提
  }
  sleep(seconds) {
    this.queue = this.queue.then(() => new Promise(resolve =>
      setTimeout(() => { console.log('wake up'); resolve(); }, seconds * 1000)
    ));
    return this;
  }
  eat() {
    this.queue = this.queue.then(() => console.log('eat！'));
    return this;
  }
}
```

关键点：
- `this.queue = this.queue.then(...)` 就是在链尾挂任务，**天然串行，无需独立启动器**。
- 每个方法 `return this` 是链式调用的前提。
- `sleep` 用一个真正 pending 的 Promise + `setTimeout` 制造"等待 5 秒"。

**解法二（数组队列 + async 消费器）**

```js
class Person {
  constructor(name) {
    this.name = name;
    this._tasks = [];
    this._running = false;
  }
  _push(fn) { this._tasks.push(fn); this._kick(); }
  async _kick() {
    if (this._running) return;      // 守卫：防止重复消费导致乱序
    this._running = true;
    while (this._tasks.length) await this._tasks.shift()();
    this._running = false;
  }
  sayHi() { this._push(() => console.log(`hello, i am ${this.name}`)); return this; }
  eat()   { this._push(() => console.log('eat！')); return this; }
  sleep(seconds) {
    this._push(() => new Promise(resolve =>
      setTimeout(() => { console.log('wake up'); resolve(); }, seconds * 1000)
    ));
    return this;
  }
}
```

优点：能拿到队列本身、可扩展并发/取消；缺点：要 `_running` 守卫防重复消费。

**微任务时机（追问点）**：`sayHi` 的打印被包在 `.then` 里，是**微任务**。所以 `p.sayHi(); console.log('after')` 的顺序是 `after` → `hello`（先同步后微任务）。若要求"`sayHi` 同步立即打印"，需把打印放到 `.then` 外、只让 `sleep` 这类异步进队列。

**边界**：任务 reject 会截断后续链，可 `.catch` 兜底；每次 `new Person` 队列互相独立。

### new Promise 的正确使用场景 — Promisify（回调转 Promise）

**`new Promise` 的根本用途**：将回调/事件风格的异步 API 包装成 Promise，解决回调地狱。

```js
// 规则：executor 同步执行，它的任务是"注册回调"
// 不要用来包装已经返回 Promise 的 API（如 fetch）

// 1. 定时器转 Promise
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
await delay(1000)

// 2. 图片加载 — 事件监听转 Promise
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src  // 设置 src 开始加载
  })
}

// 3. IndexedDB — 回调 API 转 Promise
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ❌ 反面教材：包装已经返回 Promise 的 API（多余）
// new Promise(async resolve => resolve(await fetch('/api'))) — 别这么写
```

### 三种"传函数"的调用时机对比

```js
const fn = () => console.log('hello')

Promise.resolve(fn)        // fn 是值 → 不调用 → 返回 Promise {<fulfilled>: fn}
Promise.resolve().then(fn) // fn 是回调  → 微任务异步调用 → 打印 'hello'
new Promise(fn)            // fn 是 executor → 同步立即调用 → 打印 'hello'
```

| 写法 | fn 是否调用 | 调用时机 |
|------|:--:|------|
| `Promise.resolve(fn)` | ❌ 当作值 | — |
| `Promise.resolve().then(fn)` | ✅ 微任务 | 异步 |
| `new Promise(fn)` | ✅ executor | 同步 |

### await 的"拆值"行为

```js
const p = Promise.resolve(1)
console.log(p)         // Promise {<fulfilled>: 1}  ← 对象
const res = await p
console.log(res)       // 1                        ← await 拆出里面的值
```

`await` 的作用：等 Promise settled → 取出值。一路穿透所有 `.then` 直到链末端。

---

## 二、静态方法对比

| 方法 | 行为 |
|------|------|
| `Promise.resolve(v)` | 返回 fulfilled Promise。**作用：将任何值（Promise 或普通值）统一包装为 Promise**。如果 v 已经是 Promise，直接返回同一个引用；如果是普通值，包装成 `Promise.resolve(42)` |
| `Promise.reject(e)` | 返回 rejected Promise |
| Promise.all(ps) | 全部成功才成功，一个失败立即失败 |
| Promise.allSettled(ps) | 等全部结束，不论成败 |
| Promise.race(ps) | 第一个 settled 的作为结果 |
| Promise.any(ps) | 第一个 fulfilled 的作为结果，全失败才 reject（AggregateError） |

### Promise.all 失败行为细节（追问高频）

- 任一失败 → **立即 reject，不等最慢的**；以第一个失败原因为准。
- 其他请求**不会被取消**（`fetch` 默认不可取消，要取消必须 `AbortController`），只是结果被丢弃。
- 入参是可迭代对象，传空数组立即 resolve 空数组。

**"一个失败也要渲染成功部分"的反射模式（不用 allSettled 的思路）：**

```js
const results = await Promise.all([
  fetchUser().catch(() => ({ ok: false })),
  fetchOrders().catch(() => ({ ok: false })),
  fetchConfig().catch(() => ({ ok: false })),
])
// 每个请求被改造成"绝不 reject"，Promise.all 不会提前失败；按 ok 标记渲染
```

`allSettled` 细节：永远等全部结束、不 reject；每项 `{ status: 'fulfilled', value }` 或 `{ status: 'rejected', reason }`；结果顺序与入参一致。

### race vs any 实战场景

```js
// race：超时控制 — 请求和超时赛跑，谁先完成用谁
const data = await Promise.race([
  fetch('/api/data'),
  new Promise((_, reject) => setTimeout(() => reject(new Error('超时')), 5000))
])

// any：多路冗余 — 同资源部署多个 CDN，取最快的
const res = await Promise.any([
  fetch('https://cdn1.example.com/file'),
  fetch('https://cdn2.example.com/file'),
  fetch('https://cdn3.example.com/file'),
])
```

---

## 三、手写 Promise（简化版）

```js
class MyPromise {
  constructor(executor) {
    this.state = "pending";
    this.value = undefined;
    this.callbacks = [];

    const resolve = (val) => {
      if (this.state !== "pending") return;
      this.state = "fulfilled";
      this.value = val;
      this.callbacks.forEach(cb => cb.onFulfilled(val));
    };
    const reject = (err) => {
      if (this.state !== "pending") return;
      this.state = "rejected";
      this.value = err;
      this.callbacks.forEach(cb => cb.onRejected(err));
    };

    try { executor(resolve, reject); } catch (e) { reject(e); }
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const handle = () => {
        try {
          const cb = this.state === "fulfilled" ? onFulfilled : onRejected;
          if (!cb) {
            (this.state === "fulfilled" ? resolve : reject)(this.value);
            return;
          }
          const result = cb(this.value);
          result instanceof MyPromise
            ? result.then(resolve, reject)
            : resolve(result);
        } catch (e) { reject(e); }
      };

      if (this.state === "pending") {
        this.callbacks.push({ onFulfilled: () => handle(), onRejected: () => handle() });
      } else {
        setTimeout(handle, 0); // 模拟微任务异步
      }
    });
  }

  catch(onRejected) { return this.then(null, onRejected); }
}
```

### 面试追问
- **then 回调为何异步？** 保证不在本轮事件循环执行（Promise A+ 规范）
- **then 为何返回新 Promise？** 实现链式调用，每个 then 独立管理状态
- **值穿透：** Promise.resolve(1).then().then(v => log(v)) -> 打印 1

### 手写 Promise.all

```js
Promise._all = function(promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let count = 0;
    promises.forEach((p, i) => {
      Promise.resolve(p).then(v => {
        results[i] = v;
        if (++count === promises.length) resolve(results);
      }, reject);
    });
  });
};
```

---

## 四、async / await

**本质：** Generator + Promise 自动执行器的语法糖。await 相当于 yield。

**精确语义（术语容易被追问）：**

- **async 函数体同步执行到第一个 await**：`async1()` 被调用时，第一个 `console.log` 立即执行；调用 `await async2()` 时，`async2()` 的函数体也是同步执行的。
- `await` 不是"把后面的函数用 Promise 包装"：它先**同步求值**后面的表达式拿到结果；只有结果不是 Promise 时，才用 `Promise.resolve()` 包装成 Promise。
- `await 普通值` 的后续代码**照样是微任务**，不会同步继续执行。"普通函数同步、fetch 等待"的二分法是错的。
- 执行到 `await` 时，当前 async 函数**立即返回让出执行权**，后续代码等价于 `.then` 回调注册为微任务；等被 await 的 Promise resolve、当前宏任务结束时恢复。

```js
async function fetchData() {
  const data = await fetch("/api");  // 暂停，等 Promise fulfilled
  const json = await data.json();    // 恢复后继续
  return json;                       // 自动包装为 Promise
}
```

### 常见坑

**串行 vs 并行：**
```js
// 串行：耗时为 sum（不好）
const a = await fetch("/a");
const b = await fetch("/b");

// 并行：耗时为 max（好）
const [a, b] = await Promise.all([fetch("/a"), fetch("/b")]);
```

**forEach 里 await 没用 — 为什么？**

```js
// ❌ forEach：三个 sleep 同时启动，100ms 后一起打印
// done 立即执行——forEach 不等 async 回调
async function test() {
  const arr = [1, 2, 3]
  arr.forEach(async (n) => {
    await sleep(100)
    console.log(n)
  })
  console.log('done')
}
// 输出：done → (100ms后) 1 2 3 同时打印

// ✅ for...of：串行，一个等完再下一个
async function test2() {
  for (const n of [1, 2, 3]) {
    await sleep(100)
    console.log(n)
  }
  console.log('done')
}
// 输出：100ms→1, 200ms→2, 300ms→3, 300ms→done

// 根因：forEach(callback) 中 callback 的返回值被忽略
// 即使 callback 是 async（返回 Promise），forEach 也不会 await 它
```

### 并发控制 — asyncPool 实现

```js
// 场景：100 个文件上传，最多同时 3 个
async function asyncPool(limit, tasks) {
  const results = []
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

// 使用：同时最多 3 个上传
const results = await asyncPool(3, files.map(f => () => upload(f)))
```

**为什么是 `Promise.resolve().then(() => task())` 而不是其他写法？**

```js
// 核心：tasks 里存的是函数（不是 Promise）
const tasks = files.map(f => () => upload(f))  // () => Promise

// ❌ 写法1：task 是函数，resolve 只把它当值传，upload 根本没被调用
const p = Promise.resolve(task)

// ❌ 写法2：task() 在 new Promise executor 中同步执行 → 并发控制废了
const p = new Promise(resolve => resolve(task()))

// ✅ 唯一正确写法：.then 里调用 task() — 调用 + 异步化一步到位
const p = Promise.resolve().then(() => task())
```

| 写法 | task 是否被调用 | 调用是否异步 | 结果 |
|------|:--:|:--:|------|
| `Promise.resolve(task)` | ❌ | — | 无效 |
| `new Promise(r => r(task()))` | ✅ | ❌ 同步 | 并发控制失效 |
| `Promise.resolve().then(()=>task())` | ✅ | ✅ 微任务 | ✅ |

### asyncPool 执行机制详解 — 排队 + 放行 调度模型

```js
async function asyncPool(limit, tasks) {
  // ...
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task())  // ← 排队：task 进入微任务队列
    executing.add(p)                                // ← 同步：p 加入池子
    p.finally(() => executing.delete(p))            // ← 同步：注册清理

    if (executing.size >= limit) {
      await Promise.race(executing)  // ← 放行：交出主线程，微任务开始执行
    }
  }
  return Promise.all(results)  // ← 兜底：等最后一轮全部完成
}
```

**核心调度模型：**

```
for 循环（排队）            await 闸门（放行）
.then(task) → 微任务排队     Promise.race → 交出主线程
executing.add → 入池        微任务队列开始消化
.finally → 注册清理         task1、task2、...开始跑

for 循环 = 调度器（shceduler）
await    = 限流阀（throttle）
```

**为什么没有竞态条件？** 微任务不在同步代码中执行。for 循环跑完一轮（`executing.add` + `if check`）后遇到 await 才让出主线程，此时积压在微任务队列里的 task 才开始跑。task 不可能在 `add` 和 `check` 之间完成。

**`Promise.all(results)` 的作用：兜底。** 循环结束后 results 里存了所有 p。如果全部已完成 → all 立刻返回结果数组；如果有还在跑的 → all 等最后一个完成再返回。不会丢结果。

### async/await 错误处理注意事项

```js
// ⚠️ try-catch 只能捕获 await 之后的 Promise reject
try { await Promise.reject('err') } catch (e) { /* ✅ 捕获到 */ }

// ❌ 没 await → try-catch 捕获不到
try { Promise.reject('err') } catch (e) { /* 白写了 */ }

// ✅ 此时要用 .catch
Promise.reject('err').catch(e => { /* ✅ 捕获到 */ })

// ⚠️ 没有任何 .catch 或 await+try-catch → 触发 unhandledrejection
// Node.js 中直接导致进程崩溃
```

---

## 五、速查

| 问题 | 要点 |
|------|------|
| Promise 状态？ | pending/fulfilled/rejected，不可逆 |
| executor 何时执行？ | 同步执行 |
| all vs allSettled vs race vs any | all全成功/一失即败；allSettled等全部；race第一settled；any第一成功 |
| async/await 原理？ | Generator + 自动执行器 |
| await 后代码何时执行？ | 相当于 .then 回调，进微任务 |
| forEach+await 有效？ | 无效。forEach 忽略 async callback 的返回值，用 for...of |
| race vs any 场景 | race=超时控制；any=多路冗余取最快 |
| 并发控制（限同时N个） | Promise.race + 补位：塞满N个→谁跑完补下一个 |
| async/await 错误处理 | try-catch 只对 await 有效；没 await 的 Promise 得 .catch |
| reject 没捕获会怎样 | unhandledrejection 事件；Node.js 进程崩溃 |
