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

## 三、实战：你在理想汽车怎么用的

### 3.1 出入预约后台管理 — NestJS 架构

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

> "在出入预约项目中，我用 NestJS 搭建了后端。核心设计是模块化——auth 模块负责 JWT 签发和鉴权守卫，reservation 模块负责预约单的 CRUD。通过全局 Guard 统一拦截需要鉴权的接口，通过全局 Interceptor 统一包装响应格式 `{code, data, message}`。前后端通过 OpenAPI/Swagger 自动生成 TypeScript 类型定义，前端直接用生成好的 interface 和 API 调用函数，减少了手写类型和接口文档的维护成本。"

---

## 四、面试速查

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
