# Node.js 与 NestJS

> 你简历写了全栈经验（NestJS + Spring Boot），面试官可能不会深问后端，但基础概念和核心设计思想要能讲清楚。本文聚焦前端面试中可能被问到的话题。

---

## 一、Node.js 核心基础

### 1.1 Node.js 事件循环 — 与浏览器的区别

Node.js 的事件循环和浏览器**不是同一个东西**：

| | 浏览器 | Node.js |
|------|--------|---------|
| 宏任务阶段 | 单队列，取一个执行 | **6 个阶段**，每个阶段有独立队列 |
| 微任务执行时机 | 每个宏任务之后清空全部微任务 | 每个阶段切换时清空微任务 |
| 特殊优先级 | 无 | process.nextTick 优先级最高，高于 Promise.then |

**Node.js Event Loop 六个阶段：**

```
   ┌───────────────────────┐
   │       timers          │ → setTimeout、setInterval 回调
   ├───────────────────────┤
   │   pending callbacks   │ → 系统操作回调（如 TCP 错误）
   ├───────────────────────┤
   │    idle, prepare      │ → 内部使用
   ├───────────────────────┤
   │        poll           │ → 获取新的 I/O 事件（核心阶段）
   ├───────────────────────┤
   │        check          │ → setImmediate 回调
   ├───────────────────────┤
   │    close callbacks    │ → socket.on('close') 等
   └───────────────────────┘
         ↑ 循环 ↑
```

**面试必问优先级：** `process.nextTick` > `Promise.then` > `setTimeout/setImmediate`

```js
// Node.js 经典输出题
setTimeout(() => console.log('timeout'), 0)
setImmediate(() => console.log('immediate'))
process.nextTick(() => console.log('nextTick'))
Promise.resolve().then(() => console.log('promise'))

// 输出：nextTick → promise → timeout → immediate
// 或：   nextTick → promise → immediate → timeout
// (setTimeout 和 setImmediate 顺序不确定，取决于执行时机)
```

#### 深入：setTimeout(0) vs setImmediate 到底差在哪？

**先纠正一个误区**：`setTimeout > setImmediate` 不是铁律，两者没有固定先后，取决于代码运行在事件循环的哪个阶段。

**为什么主模块里顺序不确定？** `setTimeout(fn, 0)` 的 `0` 会被强制 clamp 成 **≥1ms**。事件循环启动后先进 timers 阶段检查：若此刻距进程启动已过 1ms，则 setTimeout 先执行；否则跳过 timers 直接去 check 阶段跑 setImmediate——所以是"环境/时序的产物"，官方文档明确说 non-deterministic。

**但放进 I/O 回调里，顺序必然反转：**

```js
const fs = require('fs')
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0)
  setImmediate(() => console.log('immediate'))
})
// 输出（100% 确定）：immediate → timeout
```

原因在 poll 阶段的职责：poll 负责「执行 I/O 回调 + 计算阻塞时长等待新 I/O」。I/O 回调在 poll 阶段执行，poll 结束后**按循环方向直接进入 check 阶段**（不是回头去 timers），所以：

- 回调里注册的 `setImmediate` → 进 check 队列，一出门就到，立刻执行
- 回调里注册的 `setTimeout(0)` → 进 timers 队列，但 timers 在"上一站"，要绕一整圈才轮到

**两者语义对比：**

| | `setTimeout(fn, 0)` | `setImmediate(fn)` |
|---|---|---|
| 真实延迟 | `0` 被 clamp 成 ≥1ms | 无额外延迟 |
| 语义 | "至少 1ms 后执行" | "当前 poll 结束后尽快执行" |
| 所属阶段 | timers | check |

`setImmediate` 的诞生动机就是社区嫌弃 `setTimeout(fn, 0)` 语义不准确（有 1ms 最小值），需要一个"让出当前 tick、尽快继续"的精确表达。

**生产里的两个典型用途：**

```js
// 1. 分片处理大任务，别饿死其他请求
async function batchProcess(items) {
  for (let i = 0; i < items.length; i++) {
    process(items[i])
    if (i % 1000 === 999) {
      await new Promise(resolve => setImmediate(resolve)) // 主动让出
    }
  }
}

// 2. 递归展开，避免调用栈溢出（RangeError）
function walk(node) {
  doWork(node)
  if (node.next) setImmediate(() => walk(node.next)) // 下一轮循环再继续，栈每轮清空
}
```

#### process.nextTick 的坑：饿死事件循环

`nextTick` 队列在「当前调用栈清空后、进入下一阶段前」处理，且**每个阶段之间都会先清空 nextTick 队列**，优先级高于 Promise 微任务。

坑：在 nextTick 回调里递归调用 nextTick，队列永远清不空，事件循环走不到 I/O 阶段，进程看起来"卡死"。生产里禁止 nextTick 递归 nextTick。

### 1.2 CommonJS 模块系统

```js
// a.js — 导出
module.exports = { name: 'Alice' }
exports.age = 25  // exports 是 module.exports 的引用

// ❌ 这会断开引用！exports = { x: 1 } 无效

// b.js — 导入
const a = require('./a')  // 同步加载，值的拷贝
```

**面试点：** `exports` 只是 `module.exports` 的引用，直接给 `exports` 赋新值无效。要确保导出正确，用 `module.exports`。

### 1.3 Stream 流 — 面试加分概念

```js
// Stream 适合处理大文件 — 不用一次性加载到内存
const fs = require('fs')

// ❌ 差：大文件一次性读取，内存爆炸
const data = fs.readFileSync('/path/to/huge-file.mp4')

// ✅ 好：流式读取，内存占用恒定
const readStream = fs.createReadStream('/path/to/huge-file.mp4')
const writeStream = fs.createWriteStream('/path/to/output.mp4')
readStream.pipe(writeStream)  // 边读边写，不占内存
```

**四种 Stream 类型：** Readable / Writable / Duplex / Transform

#### 背压（backpressure）— 读快写慢怎么办

读流快、写流慢时，数据会在写流内部堆积。可写流内部有缓冲区，容量上限是 `highWaterMark`（默认 16KB）。

**核心机制：**

1. `write(chunk)` 返回 `false`：表示"这个 chunk 我收下了，但内部缓冲区已满，别再塞了"。注意不是写失败、数据没丢，只是缓冲区满了。
2. 忽略返回值继续无脑读：读流源源不断产出，写不出去，chunk 全堆在写流缓冲区 → **内存无限增长 → OOM 崩溃**（不是主线程阻塞，是内存暴涨）。
3. `drain` 事件：缓冲区被排空时触发。`write()` 返回 false 后，应 `pause()` 暂停读流，等 `drain` 再 `resume()` 恢复。

**手写背压处理：**

```js
rs.on('data', (chunk) => {
  const canContinue = ws.write(chunk)
  if (!canContinue) {
    rs.pause()                          // 写满了，暂停读
    ws.once('drain', () => rs.resume()) // 排空了，恢复读
  }
})
```

**`pipe()` 内部已自动做背压**：`write()` 返回 false 就自动暂停源流，`drain` 时自动恢复。所以 `rs.pipe(ws)` 比自己写 `data + write` 更安全。

**本质**：背压 = 让「生产速度」匹配「消费速度」，避免缓冲区无界增长。这个思想在限流 / 队列 / 削峰里会反复出现（呼应后面的 Redis、消息队列）。

### 1.4 Node.js 线程模型：单线程还是多线程？

先说结论：**Node.js 不是「纯单线程」，而是「单线程的 JS 主线程 + 多层多线程」**。面试常见的「Node 是单线程」是个不严谨的说法，准确表述是「**开发者写的 JS 代码在单个主线程上串行执行**」。

一句话拆解（腾讯云 2026-04 文章的结论，很适合写进设计文档）：

> 单线程事件循环负责执行 JS 与调度回调；阻塞型/计算型的底层工作由内核异步能力与 libuv 线程池承担；需要 JS 真并行时，引入 worker_threads（或多进程 cluster）把计算摊到多个核心。

#### 四层线程模型

| 层 | 说明 | 是否跑 JS |
| --- | --- | --- |
| JS 主线程（Event Loop） | 执行 JS 代码、调度回调、单线程 | ✅ |
| libuv 线程池 | 默认 4 线程，处理阻塞 I/O 与计算（fs / crypto / DNS / zlib / 压缩） | ❌ 跑 C/C++ |
| V8 内部线程 | GC 垃圾回收、JIT 编译 | ❌ |
| worker_threads / cluster | 真正的 JS 并行 | ✅ |

#### 网络 I/O vs 文件 I/O：异步的两种实现（易混）

Node 的"异步"不是靠"另开线程跑你的 JS"，而是 **非阻塞 I/O + 事件通知**。但 I/O 分两类，实现方式完全不同：

| 类型 | 谁在干 | 是否占线程池 |
| --- | --- | --- |
| 网络 I/O（socket / HTTP / TCP / UDP） | 操作系统内核的非阻塞多路复用（Linux epoll / macOS kqueue / Windows IOCP） | ❌ 不占 |
| 文件 I/O（fs）、DNS、crypto、zlib | libuv 线程池（默认 4 线程），用线程阻塞等待模拟异步 | ✅ 占 |

- **网络 I/O 不占线程池**：内核帮你监听所有 socket，有数据就绪就通知 libuv，libuv 再安排回调进事件循环。一个 JS 主线程就能同时监听数万连接——这是 Node 高并发的真正来源。
- **文件 I/O 走线程池**：普通文件磁盘 I/O 没有可靠的内核非阻塞接口（epoll 也管不了磁盘文件），所以 libuv 用线程池模拟异步；默认只有 4 线程，文件操作多了会排队变慢。

一句话：**你的 JS 永远只在主线程串行执行；"等待 I/O"这个动作发生在内核（网络）或线程池（文件/计算），就绪后由事件循环把回调调回主线程。**

#### 同步 I/O vs 异步 I/O：主线程从不等待

- **同步 I/O（`fs.readFileSync`）**：主线程**阻塞等待**直到 I/O 完成，期间整个事件循环被卡死，其他请求全部排队——这是要避免的。
- **异步 I/O（`fs.readFile`）**：主线程发起后**立刻返回，不等待**，继续执行后续代码、处理其他事件；I/O 完成后回调才被塞回事件循环执行。

**`await` 不是阻塞**：`await` 的语义是「把当前函数挂起（暂停）、让出主线程」，主线程转去跑别的任务；I/O 完成后函数再从 `await` 处恢复往下走。即 **挂起 + 让出 + 恢复**，不是"主线程停在那儿等"。

一句话：**JS 主线程永远在"干活"，从不等待 I/O；所谓异步，就是把"等待"甩给内核/线程池，主线程继续跑，结果就绪后通过回调回到主线程接着处理。**

#### 关键点

1. **libuv 线程池默认 4 个**，环境变量 `UV_THREADPOOL_SIZE` 可调（最大 128）。它处理的是 `fs.readFile`（非 O_DIRECT）、`crypto.pbkdf2/scrypt`、`zlib`、DNS 解析等会阻塞的底层操作——这些是 C/C++ 代码，不是 JS。
2. **线程池 ≠ worker_threads**：线程池是 libuv 管理的固定线程，只能跑底层 C/C++，**不能执行你的 JS**；worker_threads 是独立线程，每个 worker 拥有**完整的 V8 isolate + 自己的事件循环 + libuv loop**，能真正并行跑 JS。
3. **worker_threads vs cluster**：worker 是同一进程内的线程，可用 `SharedArrayBuffer` 共享内存或 `postMessage` 传值；cluster 是多进程，master fork 多个子进程，通过 IPC 通信，跨核心扩展并发。

```js
// worker_threads：CPU 密集任务并行（fib 递归）
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')

if (isMainThread) {
  // 主线程：4 个 worker 并行算
  for (let i = 0; i < 4; i++) {
    new Worker(__filename, { workerData: { n: 40 } })
      .on('message', (r) => console.log('fib =', r))
  }
} else {
  const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2))
  parentPort.postMessage(fib(workerData.n))
}
```

```js
// cluster：多进程利用多核，每个核一个 worker
const cluster = require('cluster')
const http = require('http')
const os = require('os')

if (cluster.isMaster) {
  for (let i = 0; i < os.cpus().length; i++) cluster.fork()
  cluster.on('exit', (worker) => cluster.fork()) // 挂了自动重启
} else {
  http.createServer((req, res) => res.end('pid=' + process.pid)).listen(3000)
}
```

#### 选型口诀

- **I/O 密集**：async/await + 事件循环即可，单线程够用（大部分 Web 服务属于这类）。
- **CPU 密集**（图像处理、大 JSON 解析、加解密）：用 worker_threads，把长任务移出主事件循环。
- **多核横向扩展**：cluster，或部署到 K8s 时用多副本 + resources limits（呼应字节面经「如何利用多核」）。

---

## 二、NestJS 核心概念

### 2.1 NestJS 是什么？— 一句话面试回答

> "NestJS 是一个基于 TypeScript 的 Node.js 服务端框架，核心设计灵感来自 Angular——依赖注入、模块化、装饰器。底层默认用 Express，也可以切 Fastify。和前端最大的相通点是：**它也讲究分层架构（Controller → Service → Repository），和 Vue/React 的组件化思想异曲同工。**"

### 2.2 分层架构（图）

```
┌──────────────────────────────────────┐
│              Module                   │  ← 功能模块（用户模块、订单模块）
│  ┌────────────────────────────────┐  │
│  │         Controller             │  │  ← 路由层：接收请求、返回响应
│  │   @Get() @Post() @Param()      │  │
│  ├────────────────────────────────┤  │
│  │          Service               │  │  ← 业务逻辑层：处理数据
│  │   @Injectable()                │  │
│  ├────────────────────────────────┤  │
│  │     Repository / ORM           │  │  ← 数据层：操作数据库
│  │   TypeORM / Prisma              │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Guards → Interceptors → Pipes │  │  ← 横切层：鉴权、日志、校验
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 2.3 依赖注入（DI）— 面试核心

```ts
// user.service.ts
@Injectable()                          // ← 标记为可注入
export class UserService {
  getUsers() { return ['Alice', 'Bob'] }
}

// user.controller.ts
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService  // ← 自动注入！
  ) {}

  @Get()
  findAll() {
    return this.userService.getUsers()
  }
}

// user.module.ts
@Module({
  controllers: [UserController],
  providers: [UserService],           // ← 注册：告诉 NestJS "这个可由 IOC 管理"
})
export class UserModule {}
```

**面试话术：** "NestJS 的依赖注入是它的核心设计——通过 `@Injectable()` 和 `@Module()` 的 providers 声明，IOC 容器自动管理实例化和依赖关系。这和 Vue 的 provide/inject、React 的 Context 思路是一样的，解决的都是"怎么让不同层级的模块拿到共享依赖"的问题。"

### 2.4 装饰器速查

| 装饰器 | 作用 | 示例 |
|--------|------|------|
| `@Module()` | 定义模块 | `@Module({ controllers, providers })` |
| `@Controller('path')` | 定义路由控制器 | `@Controller('users')` |
| `@Get/POST/PUT/Delete()` | 定义路由方法 | `@Get(':id')` |
| `@Injectable()` | 标记为可注入 | `@Injectable()` |
| `@Param()` / `@Query()` / `@Body()` | 提取请求参数 | `@Body() createDto: CreateUserDto` |
| `@UseGuards()` | 路由守卫 | `@UseGuards(AuthGuard)` |
| `@UseInterceptors()` | 拦截器 | `@UseInterceptors(LoggingInterceptor)` |
| `@UsePipes()` | 数据管道/校验 | `@UsePipes(ValidationPipe)` |

### 2.5 横切关注点 — 守卫、拦截器、管道、过滤器

这是 NestJS 最精妙的设计，也是面试能展示理解深度的点：

```
请求进来 →
  Middleware    → 中间件（日志、CORS 处理）
  Guard         → 守卫（鉴权：有权限吗？）
  Interceptor   → 拦截器-前（日志、缓存检查）
  Pipe          → 管道（参数校验和转换）
  Controller    → 路由处理
  Interceptor   → 拦截器-后（包装响应）
  ExceptionFilter → 异常过滤器（统一错误格式）
→ 响应返回
```

| | 作用 | 示例 |
|------|------|------|
| **Guard** | "能进来吗？" — 鉴权 | `AuthGuard` → 验证 JWT Token |
| **Pipe** | "数据对吗？" — 校验/转换 | `ValidationPipe` → `class-validator` 校验 |
| **Interceptor** | "前后加点东西" — AOP | `TransformInterceptor` → 统一包装 `{code, data}` |
| **ExceptionFilter** | "出错了统一处理" | `HttpExceptionFilter` → 格式化错误响应 |

### 2.6 NestJS vs Express 对比

| | Express | NestJS |
|------|---------|--------|
| 架构 | 无约束，自由组织 | **分层架构**，Controller/Service/Module 强制分离 |
| DI | 无内置 | **IOC 容器**，自动注入 |
| TypeScript | 可选 | **一等公民**，装饰器深度集成 |
| 测试 | 需自己搭建 | Jest 开箱即用，Module 级测试 |
| 学习曲线 | 低 | 中高（Angular 风格） |
| 适用场景 | 小型 API、中间件 | **企业级大型应用** |

**面试话术：** "选 NestJS 主要是看中它的分层架构和依赖注入，团队多人协作时代码组织更清晰。而且它的装饰器风格和 Angular 很像，前后端风格统一降低了全栈成本。"

---

## 三、没有上线经验的面试口径（2026-08-17 补充）

### 3.1 定位：demo 经验怎么讲才不扣分

只有 demo 经验不等于不能写简历。关键是不夸大、不心虚，把话说成：

> "NestJS 我写过完整的全栈 demo，还没有生产级上线经验。我能讲清它的分层架构（Module / Controller / Service）、依赖注入和 AOP 组件（Guard / Pipe / Interceptor / ExceptionFilter），也实际处理过 DTO 校验、JWT 鉴权、统一响应这些常见问题。生产环境的高并发、监控告警、灰度发布我没有实战，但理解它们的解决思路。"

这样回答的好处：**主动划定边界**，面试官反而不会往生产级深水区死磕；同时展示了原理理解。

### 3.2 Demo 项目怎么介绍

一个 NestJS demo 项目至少要有这些部分，才经得起追问：

```
src/
├── modules/
│   ├── auth/                  ← JWT 登录鉴权
│   └── users/                 ← 用户 CRUD
├── common/
│   ├── guards/                ← AuthGuard
│   ├── pipes/                 ← ValidationPipe
│   ├── interceptors/          ← 统一响应包装
│   └── filters/               ← 统一异常处理
└── main.ts                    ← 全局注册
```

**介绍框架：**
- 项目：基于 NestJS + TypeORM + MySQL 的 demo
- 我负责：模块划分、DTO 校验、JWT 鉴权、统一响应与异常
- 为什么这样设计：分层解耦、横切关注点统一、Swagger 生成前端类型
- 踩过的坑：CORS、参数校验、JWT 过期、数据库唯一约束

### 3.3 NestJS 入门十问（demo 级别）

1. **NestJS 是什么？和 Express 什么关系？** 基于 TypeScript 的企业级 Node 框架，底层默认 Express，可切 Fastify；Nest 提供分层、DI、AOP，Express 只管路由和中间件。
2. **Module / Controller / Service 分别干什么？** Module 组织代码边界；Controller 收请求、返响应，不含业务逻辑；Service 写业务逻辑，可被注入。
3. **依赖注入（DI）是什么？** 通过 `@Injectable()` + providers 注册，IOC 容器自动实例化并注入依赖，测试时用 mock 替换；类比 Vue 的 provide/inject、React 的 Context。
4. **Guard / Pipe / Interceptor / ExceptionFilter 各管什么？** Guard=能进来吗（鉴权）；Pipe=数据对吗（校验/转换）；Interceptor=前后加点东西（日志、响应包装）；ExceptionFilter=出错了统一处理。
5. **一次请求的完整生命周期？** Middleware → Guard → Interceptor（前）→ Pipe → Controller → Service → Interceptor（后）→ ExceptionFilter（异常时）→ 返回。
6. **DTO 为什么用 class 而不是 interface？** class 在运行时保留类型元数据，配合 `class-validator` 的装饰器做校验；interface 编译后消失。
7. **JWT 鉴权怎么做？** 登录签发 token → Guard 里验证 `Authorization` → 解析 payload 挂到 request；过期返回 401，需要刷新再签新 token。
8. **TypeORM/Prisma 和 SQL 的关系？** ORM 把表映射成实体类/模型，提供类型安全和 CRUD API，底层仍是 SQL；复杂查询可以直接写 SQL。
9. **为什么选 NestJS 而不是 Express？** 团队协作下代码组织更清晰：分层 + DI + AOP 强约束，TS 一等支持；Express 自由但容易风格混乱。
10. **没有生产经验怎么答？** 用 3.1 的诚实话术，不写"熟悉 NestJS 生产部署"，只写"了解 + 全栈 demo 经验"。

### 3.4 Node.js 入门五问（demo 级别）

1. **Node.js 为什么适合做后端？** 非阻塞 I/O + 事件驱动，单线程能扛高并发 I/O；但 CPU 密集任务会阻塞事件循环。
2. **事件循环和浏览器有什么区别？** Node 分 6 个阶段（timers → pending → idle/prepare → poll → check → close），每阶段切换时清微任务；`process.nextTick` 优先级高于 `Promise.then`。
3. **CommonJS 和 ESM 区别？** CJS 用 `require` / `module.exports`，同步加载；ESM 用 `import` / `export`，静态分析 + 异步加载，现代 Node 默认优先 ESM。
4. **Stream 是什么？** 大文件流式读写，内存占用恒定，适合文件上传、日志处理；类型有 Readable / Writable / Duplex / Transform。
5. **Node 单线程遇到 CPU 密集怎么办？** 拆成 worker_threads 或 cluster，把长任务移出主事件循环。

---

## 四、实战：你在理想汽车怎么用的

### 3.1 学习示例：出入预约业务 × NestJS 架构

> 说明：出入预约真实后端是 Spring Boot + Kafka + MySQL + Eureka；这里用 NestJS 演示同类后台的分层架构，便于理解后端通用设计。

```
出入预约后端架构：

src/
├── modules/
│   ├── auth/              ← 鉴权模块
│   │   ├── auth.controller.ts   → POST /auth/login
│   │   ├── auth.service.ts      → JWT 签发/验证/刷新
│   │   └── auth.module.ts
│   └── reservation/       ← 预约管理模块
│       ├── reservation.controller.ts → CRUD 接口
│       ├── reservation.service.ts    → 业务逻辑
│       ├── dto/                       → create-reservation.dto.ts
│       └── reservation.module.ts
├── common/
│   ├── guards/auth.guard.ts        ← JWT 鉴权守卫
│   ├── filters/http-exception.filter.ts ← 统一异常处理
│   ├── interceptors/transform.interceptor.ts ← 统一响应包装
│   └── pipes/validation.pipe.ts    ← 参数校验
└── main.ts                ← 应用入口，注册全局管道/过滤器
```

### 3.2 面试话术

> "出入预约真实后端是 Spring Boot，但它和 NestJS 的分层思想一致：模块化拆分、统一响应、鉴权拦截、Swagger/OpenAPI 生成前端类型。用 NestJS 实现同类后台时，核心设计是模块化——auth 模块负责 JWT 签发和鉴权守卫，reservation 模块负责预约单的 CRUD；全局 Guard 统一拦截需要鉴权的接口，全局 Interceptor 统一包装响应格式 `{code, data, message}`。前后端通过 OpenAPI/Swagger 自动生成 TypeScript 类型定义，前端直接用生成好的 interface 和 API 调用函数，减少手写类型和接口文档的维护成本。"

---

## 五、面试速查

| 问题 | 要点 |
|------|------|
| Node.js Event Loop vs 浏览器？ | Node 分 6 个阶段；process.nextTick > Promise.then |
| CommonJS 模块机制？ | 同步加载，值的拷贝。exports 只是 module.exports 的引用 |
| NestJS 核心设计？ | 模块化 + 依赖注入 + 装饰器，源于 Angular |
| Guard / Interceptor / Pipe 区别？ | Guard=鉴权(能进吗)；Pipe=校验(数据对吗)；Interceptor=AOP(前后加点东西) |
| NestJS 为什么选它？ | 分层架构清晰、DI 解耦、TS 一等支持、团队协作友好 |
| 你项目中怎么用的？ | 见 3.2 话术模板 |
| Node.js Stream 有什么用？ | 大文件流式处理，不占内存 |
| process.nextTick vs Promise.then？ | nextTick 优先级最高，在本轮事件循环立即执行 |
