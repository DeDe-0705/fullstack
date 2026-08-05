# NestJS 面试考点大全（2026 大厂版）

> 面向德德的「高级前端 + 全栈」定位：面试官考 NestJS 不是考 API 背诵，而是考**架构思想**——依赖注入、AOP、模块化、工程化思维。本文结合 2025–2026 最新趋势（NestJS 11、Express 5 / Fastify 5、Prisma / Drizzle、微服务 gRPC、OpenTelemetry、AI 工程化）整理，覆盖基础、原理、场景题、系统设计四个层级。
>
> 本地对照：工作区 `server/` 就是 NestJS 11 + TypeORM + Zod + MCP 的实战项目，面试时可以直接用它当素材。

---

## 0. 面试定位：为什么前端也要被考 NestJS

2025–2026 年大厂前端岗位明显「全栈化」「AI 工程化」：

- 简历写「NestJS + 全栈经验」，面试官默认你不只是会用，而是能讲清**为什么这么分层、出问题怎么排查、高并发怎么扛**。
- 前端被考后端，通常不是考手写 Express，而是考：**DI 容器、请求生命周期、AOP 组件、数据库事务、认证授权、微服务通信**——这些概念和 Vue 的 provide/inject、React 的 Context、前端中间件思想能互相类比。
- 面试官常见追问：「你写的 NestJS 和 Express 有什么区别？」「Guard 和 Middleware 谁先执行？」「为什么 DTO 用 class 不用 interface？」「高并发下注册接口怎么防重复？」

**一句话定位（背下来）：**

> 「NestJS 是建立在 Node.js 之上的企业级 TypeScript 框架，通过模块化、依赖注入、装饰器和 AOP 组件（中间件/守卫/管道/拦截器/异常过滤器）提供强约束的分层架构。底层默认 Express，可切换 Fastify。它解决的是团队协作下『代码组织』和『横切关注点』的问题，而不是单纯的路由性能问题。」

---

## 1. 2026 年技术趋势速览（先讲趋势，再讲考点）

面试官越来越喜欢先问「你了解 NestJS 最新版本吗」，答出趋势是加分项：

| 趋势 | 2026 年要点 | 面试怎么答 |
|---|---|---|
| **NestJS 11.x** | 官方主版本（当前 11.1.x）；支持 Express 5 与 Fastify 5 双平台；ESM 一等公民；CLI 提供 SWC / Vite 构建加速 | 「NestJS 11 完成了对 Express 5 和 Fastify 5 的适配，ESM 支持更完整，构建可用 SWC/Vite 加速，微服务传输层还新增了 `unwrap()` 直接访问底层客户端的能力」 |
| **Node.js 24 LTS** | 2026 年当前 LTS 主线；内置 fetch / WebSocket、`node:test`、`--watch`、`--env-file`、原生 TS type stripping | 「Node 24 原生支持直接跑 TS 文件（type stripping）、内置测试器和 watch 模式，很多轻量脚本可以不再依赖 tsx/nodemon」 |
| **ORM 三强格局** | TypeORM（老牌、Nest 官方集成）、Prisma 6（类型安全、schema 驱动）、Drizzle（贴近 SQL、serverless 友好、2026 增长明显） | 「TypeORM 与 Nest 结合最成熟；Prisma 类型体验最好；Drizzle 轻量且贴近 SQL，适合对性能敏感的团队」 |
| **微服务** | gRPC + Protobuf + Kafka/RabbitMQ 成为内部服务通信主流；NestJS 11 自动跨传输传播 trace ID | 「内部服务用 gRPC 拿强契约和高性能，跨团队异步事件走 Kafka/RabbitMQ，配合 OpenTelemetry 做全链路追踪」 |
| **全栈类型安全** | OpenAPI 代码生成、tRPC、Monorepo 共享类型 | 「NestJS 用 Swagger/OpenAPI 生成前端类型与请求客户端，避免前后端契约漂移」 |
| **运行时竞争** | Bun/Deno/Hono 性能更强，但企业仍选 NestJS | 「Bun/Hono 启动快、性能高，但 NestJS 的模块化 + DI + AOP 在大团队、复杂业务下可维护性更强；2026 年两者并存而非替代」 |
| **AI 工程化** | NestJS 被广泛用作 LLM 网关 / Agent 后端 / MCP Server | 「我用 NestJS 做过 AI 应用后端，模块化地管理 LLM 调用、工具注册和 MCP 协议，横切关注点用 AOP 统一处理」 |

**来源参考：**

- NestJS 官方 Releases：<https://github.com/nestjs/nest/releases>（v11.1.x，2025–2026 持续更新）
- TypeScript 生态 2026 全景：<https://www.youngju.dev/blog/culture/2026-05-16-typescript-ecosystem-bun-deno-hono-elysia-nestjs-effect-trpc-drizzle-prisma-zod-vitest-2026-deep-dive.en>
- Node.js 24 LTS 变化：<https://www.pkgpulse.com/guides/nodejs-22-vs-nodejs-24-2026>
- NestJS 微服务 + gRPC 2026 指南：<https://sharpskill.dev/en/blog/node-nestjs/nestjs-microservices-grpc-architecture>
- NestJS 高频面试题（2026-04）：<https://www.yuque.com/guluguluwater-qkq0t/qbbqks/xkg7la1ifd1oy331>
- NestJS 生产场景面试题集：<https://fridolph.github.io/FE-prepare-interview/面试官问/18nestjs/intro.html>

---

## 2. 核心基础必考

### 2.1 NestJS 是什么？和 Express 什么关系？

**答题结构：分层框架 + 默认 Express + 可切 Fastify + 提供架构能力。**

```ts
// 默认：底层是 Express
const app = await NestFactory.create(AppModule);

// 可选：换 Fastify，吞吐量更高
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
```

面试追问：

- **NestJS 和 Express 是竞争关系吗？** 不是，Nest 是构建在 HTTP 平台之上的抽象层（适配器模式），Express 是其中一个平台。
- **为什么不用原生 Express？** Express 自由但无约束，团队越大越容易出现「每个人的写法都不一样」；Nest 通过分层、DI、AOP 强制统一。
- **Express 5 变化？** 异步错误处理更友好、路由语法调整、`req.query` 是 getter；NestJS 11 已适配。

### 2.2 三大基本概念：Module / Controller / Service

| 概念 | 职责 | 类比 |
|---|---|---|
| Module | 组织代码边界，声明 controller / provider / imports / exports | 前端里的「模块 / 路由分组」 |
| Controller | 接收 HTTP 请求、调用 Service、返回响应，**不含业务逻辑** | 组件里的「事件处理层」 |
| Service（Provider） | 业务逻辑、数据访问，可被任意层注入 | 组合式 API 里的「逻辑封装」 |

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

**面试必问：Controller 里能写业务逻辑吗？**

> 可以但不推荐。Controller 只做「路由分发 + 参数提取 + 返回响应」；业务规则放 Service，数据访问放 Repository/ORM 层。这样单测时可以直接测 Service，不需要起 HTTP。

### 2.3 依赖注入（DI）原理 —— 最高频考点

**完整回答分四步：**

1. **装饰器收集元数据**：`@Injectable()` 通过 `reflect-metadata` 把类的设计时类型（构造函数参数类型）写入元数据。
2. **容器（IoC Container）管理实例**：Nest 启动时扫描模块的 providers，按依赖图实例化并缓存（默认单例）。
3. **构造函数注入**：`constructor(private readonly userService: UserService)`，容器根据类型自动传入实例。
4. **好处**：解耦、可替换、易测试（测试时用 mock provider 替换真实依赖）。

```ts
// 1. 标记可注入
@Injectable()
export class UserService {}

// 2. 模块注册（告诉容器：这个类归我管）
@Module({
  providers: [UserService],
  exports: [UserService], // 导出给其他模块用
})
export class UsersModule {}
```

**Provider 的四种注册方式（高频追问）：**

```ts
@Module({
  providers: [
    UserService,                                  // useClass 简写
    { provide: UserService, useClass: UserService },
    { provide: 'CONFIG', useValue: { key: 'x' } }, // 值注入
    {
      provide: 'DYNAMIC',
      useFactory: (config: ConfigService) => new Dynamic(config.get('x')),
      inject: [ConfigService],                      // 工厂依赖
    },
    { provide: 'ALIAS', useExisting: UserService }, // 别名
  ],
})
export class AppModule {}
```

追问：

- **为什么要有 `useFactory`？** 需要异步初始化 / 依赖配置 / 每次创建不同实例时使用，比如数据库连接池、Redis 客户端。
- **字符串 token 有什么坑？** 容易拼错且无类型检查，推荐用 `Symbol` 或直接传类；需要时配合 `@Inject('TOKEN')`。
- **NestJS DI 和 Vue 的 provide/inject、React Context 的区别？** 本质都是「依赖由外部提供，而非内部创建」；差异在作用域：Vue/React 是组件树作用域，NestJS 是模块 + 全局容器作用域，且是编译期元数据 + 运行期容器，能力更强（工厂、别名、作用域）。

### 2.4 Provider 作用域（Scope）

| 作用域 | 行为 | 适用 | 注意 |
|---|---|---|---|
| `DEFAULT`（默认） | 单例，应用生命周期内一个实例 | 绝大多数 Service | 无状态服务 |
| `REQUEST` | 每个请求一个实例 | 需要请求上下文（如多租户 tenant id） | **性能差**：每次请求都要实例化，且单例 provider 不能直接注入 REQUEST scope provider |
| `TRANSIENT` | 每次注入新建实例 | 无状态工具类、有状态短生命周期对象 | 内存开销 |

```ts
@Injectable({ scope: Scope.REQUEST })
export class TenantService {
  constructor(@Inject(REQUEST) private readonly req: Request) {}
}
```

**高频追问：REQUEST scope 有什么性能问题？怎么避免？**

> 每个请求都会创建新实例，且会导致依赖它的单例 provider 无法正常注入（Nest 会报错或退化为每次创建）。解法：尽量不用 REQUEST scope，需要请求上下文时用 `AsyncLocalStorage` 保存 request context，或在中间件里把 tenant/user 塞到 `request` 上再用 `@Req()` 取。

### 2.5 生命周期钩子与启动流程

```ts
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // 模块初始化完成：连接 Redis、预热缓存
  }
  async onModuleDestroy() {
    // 模块销毁：关闭连接
  }
}

// AppModule 层面
export class AppModule implements OnApplicationBootstrap, OnApplicationShutdown {
  onApplicationBootstrap() {} // 应用启动完成
  onApplicationShutdown() {}  // 应用关闭（需 app.enableShutdownHooks()）
}
```

**启动流程（NestFactory.create 做了什么）：**

1. 创建容器，扫描 `AppModule` 及其 imports，构建**模块依赖图**；
2. 解析 providers 的依赖并实例化（默认单例懒加载？**注意：默认是应用启动时立即实例化**，除非配置 lazy）；
3. 执行生命周期钩子（onModuleInit → onApplicationBootstrap）；
4. 创建 HTTP 适配器并监听端口（`app.listen(3000)`）。

追问：

- **优雅退出怎么做？** `app.enableShutdownHooks()` + `OnApplicationShutdown`，Kubernetes 发 SIGTERM 时先停流量、再关连接池、最后退出。
- **懒加载模块？** Nest 提供 `LazyModuleLoader`，启动时按需加载，减少冷启动时间。

### 2.6 装饰器速查表

| 装饰器 | 作用 |
|---|---|
| `@Module({ imports, controllers, providers, exports })` | 定义模块 |
| `@Controller('path')` / `@Get()` `@Post()` `@Put()` `@Delete()` | 路由 |
| `@Injectable()` | 标记可注入 |
| `@Injectable({ scope: Scope.REQUEST })` | 作用域 |
| `@Body()` `@Query()` `@Param()` `@Headers()` `@Req()` `@Res()` | 参数提取 |
| `@UseGuards()` `@UseInterceptors()` `@UsePipes()` `@UseFilters()` | 绑定 AOP 组件 |
| `@SetMetadata('roles', ['admin'])` | 自定义元数据（配 Reflector 用） |
| `@Global()` | 全局模块 |
| `@Catch()` `@MessagePattern()` `@EventPattern()` | 异常捕获 / 微服务模式 |

---

## 3. AOP 五件套：请求生命周期（重点中的重点）

### 3.1 一次请求的完整顺序

```
请求进来
  → Middleware 中间件（全局/模块级，拿到原始 req/res）
  → Guard 守卫（能不能进来？鉴权/角色）
  → Interceptor 拦截器（before：日志、缓存、包装）
  → Pipe 管道（参数校验、转换）
  → Controller 路由处理
  → Service 业务逻辑
  → Interceptor 拦截器（after：响应包装、超时统计）
  → ExceptionFilter 异常过滤器（出错时统一格式化）
  → 响应返回
```

### 3.2 Middleware（中间件）

- 执行时机：进入 Guard 之前，在原生 Express/Fastify 层面执行。
- 场景：日志、CORS、请求体解析、静态资源、IP 黑白名单。
- **拿不到装饰器元数据**，也**不感知 Controller 方法**。

```ts
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${Date.now() - start}ms`);
    });
    next();
  }
}
```

### 3.3 Guard（守卫）

- 职责：**授权（Authorization）**，回答「这个请求能不能进来」。
- 实现 `CanActivate`，返回 `true` 放行 / `false` 拒绝（Nest 自动返回 403）。
- 可以绑定到方法、Controller、全局。

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;
    try {
      request.user = await this.jwtService.verifyAsync(token);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 3.4 Interceptor（拦截器）

- 职责：**AOP 切面**，在 Controller 前后执行，基于 RxJS 的 `Observable`。
- 场景：统一响应包装 `{ code, data, message }`、日志、缓存、超时控制、重试。

```ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({ code: 0, message: 'success', data })),
      catchError((err) => throwError(() => err)),
    );
  }
}
```

**为什么用 RxJS？** 因为响应可能是异步流（Promise、Observable、stream），RxJS 可以统一处理「继续/中断/重试/超时」，比中间件更强大。

### 3.5 Pipe（管道）

- 职责：**校验 + 转换**，在数据进入 Controller 之前执行。
- 场景：`ValidationPipe`、`ParseIntPipe`、`ParseUUIDPipe`、自定义管道。
- 内置管道失败时返回 400。

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.service.findOne(id); // id 已被转成 number
}
```

### 3.6 ExceptionFilter（异常过滤器）

- 职责：捕获未处理异常，统一错误响应格式。
- 内置：`HttpException`、`BadRequestException`、`NotFoundException` 等。

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    response.status(status).json({
      code: status,
      message: exception instanceof HttpException ? exception.getResponse() : 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 3.7 高频对比追问

| 对比 | 结论 |
|---|---|
| Middleware vs Guard | Middleware 在 Guard 前执行；Middleware 拿不到路由元数据，Guard 通过 `ExecutionContext` 能拿到 `@SetMetadata` 的信息 |
| Middleware vs Interceptor | Middleware 操作原生 req/res，Interceptor 操作 RxJS 流、能拿到 Controller 返回值，还能中断/重试 |
| Guard vs Pipe | Guard 管「能不能进」，Pipe 管「参数对不对」；Guard 先执行 |
| Pipe vs Interceptor | Pipe 只处理进入 Controller 前的参数；Interceptor 前后都能干预 |
| 全局 vs 局部绑定 | `app.useGlobalGuards()` 全局、`@UseGuards()` 局部；局部优先级更高 |

**自定义参数装饰器（高频手写题）：**

```ts
// 从 request.user 提取当前用户
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);

// 使用
@Get('profile')
profile(@CurrentUser() user: UserEntity) {
  return user;
}
```

---

## 4. 数据校验与 DTO

### 4.1 为什么用 Class 而不是 Interface 定义 DTO？（必考）

> Interface 是 TS 编译期概念，运行时不存在；而 `class-validator` 的校验装饰器（`@IsString()`、`@IsEmail()`）需要**运行时元数据**，只有 class 能提供。同时 class 配合 `class-transformer` 能完成类型转换，还能被 Swagger 识别自动生成文档。

```ts
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
```

### 4.2 ValidationPipe 的关键配置

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,                // 自动剔除 DTO 之外的字段（防 mass assignment）
    forbidNonWhitelisted: true,     // 有额外字段直接报 400
    transform: true,                // 自动把 JSON 转成 class 实例，支持类型转换
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

追问：

- **`whitelist: true` 解决了什么安全问题？** 防止客户端传 `role: 'admin'` 等 DTO 未声明字段被写入数据库（mass assignment）。
- **`transform: true` 有什么副作用？** 会自动做隐式类型转换（字符串 `"123"` → number），严格接口可能想关掉，改用 `@Type(() => Number)` 显式转换。

### 4.3 自定义 Pipe

```ts
@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException('id 必须是正整数');
    }
    return parsed;
  }
}
```

---

## 5. 数据库与 ORM

### 5.1 选型对比（2026 版）

| 维度 | TypeORM | Prisma 6 | Drizzle |
|---|---|---|---|
| 与 Nest 集成 | 官方 `@nestjs/typeorm`，最顺滑 | `PrismaService` 自己封装，也很常见 | 社区方案（`@nest-native/drizzle` 等） |
| 建模方式 | 实体类 + 装饰器 | schema.prisma + 代码生成 | 代码定义 schema（贴近 SQL） |
| 类型安全 | 一般（需自己维护类型） | 强（生成类型） | 强（TS 推断） |
| 迁移 | `typeorm migration:generate` | `prisma migrate` | `drizzle-kit` |
| 性能 / 运行时开销 | 中等 | 较重（query engine） | 轻，无黑盒 |
| 适合场景 | 老项目、与 Nest 深度绑定 | 类型优先、需要优秀 DX | 高性能、serverless、喜欢写 SQL |

**面试话术：**

> 「我的项目用 TypeORM（本地 server 就是），因为它和 NestJS 集成最成熟、实体装饰器和 Nest 风格统一。2026 年我关注 Prisma 和 Drizzle：Prisma 类型安全体验最好，Drizzle 更轻、更适合 serverless；如果新项目对性能和包体敏感，我会选 Drizzle，否则 Prisma 或 TypeORM 都稳。」

### 5.2 事务

```ts
// TypeORM：QueryRunner 手动控制
async transfer(fromId: number, toId: number, amount: number) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.manager.decrement(User, { id: fromId }, { balance: amount });
    await queryRunner.manager.increment(User, { id: toId }, { balance: amount });
    await queryRunner.commitTransaction();
  } catch (e) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}
```

追问：

- **事务的隔离级别有哪几种？** READ UNCOMMITTED / READ COMMITTED / REPEATABLE READ / SERIALIZABLE；默认 MySQL 是 REPEATABLE READ。
- **事务里能不能做外部调用？** 尽量避免：长事务会持锁，外部 HTTP/消息调用会让事务时间不可控。

### 5.3 连接池

- 默认 TypeORM 有连接池（`poolSize`，默认 10 左右），Prisma 也有连接池。
- **连接池泄漏**：事务里忘记 `release()`/`disconnect()`，导致连接耗尽。
- 面试题：「数据库连接池满了怎么办？」答：查慢 SQL、查泄漏（事务未关闭）、扩连接数、加读副本、加缓存。

### 5.4 并发问题：先查后插（必考场景）

```ts
async register(dto: CreateUserDto) {
  // 应用层查重（体验好，但不是并发安全的）
  const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
  if (existing) throw new BadRequestException('用户已存在');

  // 数据库唯一索引兜底（真正的并发防线）
  return this.prisma.user.create({ data: dto });
}
```

**满分回答：**

> 两个请求同时查库都发现用户不存在，然后都插入，会造成重复注册。「先查后插」在应用层只能提升体验，真正的防线是数据库唯一索引。插入时捕获唯一约束冲突错误，转成友好的 400。更进一步，可以用数据库事务 + 锁（`SELECT ... FOR UPDATE` 或乐观锁 version 字段），或者把「创建用户」做成幂等操作（客户端传 requestId + 唯一约束）。

### 5.5 N+1 查询

**问题**：查 100 个订单，又各查一次关联用户 = 101 条 SQL。

**解法**：TypeORM `relations`/`leftJoinAndSelect` 一次 join；或先查订单再 `IN` 批量查用户；Prisma `include`；手写 SQL 时注意索引。

### 5.6 数据脱敏、软删除、迁移

- **脱敏**：Service 返回前剔除 `password` 等字段（`Omit` + 解构），或用 `@Exclude()` + `ClassSerializerInterceptor`。
- **软删除**：TypeORM `@DeleteDateColumn()`，查询自动过滤。
- **迁移**：开发/生产都要用 migration 而不是 `synchronize: true`（生产禁 synchronize）。

---

## 6. 认证与授权

### 6.1 JWT 完整流程（必考）

```
1. 用户 POST /auth/login 提交账号密码
2. Service 用 bcrypt 比对密码哈希
3. 验证通过 → 生成 accessToken（payload: userId, role, exp）
4. 客户端保存 token（httpOnly cookie 或 Authorization: Bearer）
5. 后续请求 → JwtAuthGuard 验证签名、解析 payload
6. 通过后把 user 挂到 request 上，@CurrentUser() 取用
```

```ts
// 签发
const token = await this.jwtService.signAsync(
  { sub: user.id, role: user.role },
  { expiresIn: '15m' },
);
```

追问：

- **JWT 能不能注销？** 无状态 JWT 天然不能主动吊销，需要黑名单（Redis 存 revoked jti）或缩短有效期。
- **token 放哪安全？** httpOnly + Secure Cookie 比 localStorage 更抗 XSS；但 cookie 要防 CSRF，localStorage 要防 XSS，二选一看场景。
- **JWT 和 Session 的区别？** JWT 无状态、适合分布式/微服务；Session 有状态、可随时注销，适合单体 + 内存/Redis。

### 6.2 Passport 集成

- `@nestjs/passport` + `passport-jwt` / `passport-local`；
- 核心是 Strategy：`validate(payload)` 返回的对象会挂到 `request.user`；
- `AuthGuard('jwt')` 一键启用策略。

### 6.3 RBAC 权限控制（高频手写）

```ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest();
    return required.some((role) => user.roles?.includes(role));
  }
}
```

**权限码设计（加分项）：** 用 `模块:资源:操作` 格式，如 `user:profile:update`、`order:create`，而不是单纯 role 字符串。角色挂权限码集合，Guard 里比对 `user.permissions`。

### 6.4 刷新令牌（Refresh Token）

- accessToken 短（15m），refreshToken 长（7d/30d）；
- refreshToken 存数据库/Redis，刷新时**旋转**（旧 token 作废，防重放）；
- 刷新接口做「refresh token 复用检测」：检测到旧 token 再次使用，直接吊销整条会话。

### 6.5 OAuth2 / SSO

- 大厂内部都是 SSO（OAuth2/OIDC），Nest 侧主要是：`passport-oauth2`、授权码模式、回调换取 token、前端拿 code 换 token。
- 面试点：**授权码模式为什么安全？** code 是一次性的，且通过后端换取 token，避免 token 暴露在浏览器。

---

## 7. 模块与架构设计

### 7.1 动态模块（Dynamic Module）

用于「带配置的模块」，如数据库、Redis、第三方 SDK。

```ts
@Module({})
export class DatabaseModule {
  static forRoot(options: DbOptions): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [
        { provide: 'DB_OPTIONS', useValue: options },
        DatabaseService,
      ],
      exports: [DatabaseService],
    };
  }
}

// 使用
@Module({
  imports: [DatabaseModule.forRoot({ host: 'localhost' })],
})
export class AppModule {}
```

追问：

- **`forRoot` vs `forFeature`？** `forRoot` 在根模块配置一次（连接、全局配置）；`forFeature` 在功能模块里注册实体/仓库（如 TypeORM 的 `TypeOrmModule.forFeature([User])`）。
- **`registerAsync` 是干嘛的？** 配置需要异步获取（读 `.env`、调配置中心）时用 `forRootAsync` + `useFactory`。

### 7.2 全局模块

```ts
@Global()
@Module({ providers: [ConfigService], exports: [ConfigService] })
export class SharedModule {}
```

全局模块只导一次，适合 Config、Logger、Redis 等基础设施。**别滥用**，会影响模块边界的可读性。

### 7.3 循环依赖

```ts
// A 模块依赖 B，B 依赖 A
@Module({
  imports: [forwardRef(() => BModule)],
})
export class AModule {}
```

**更推荐的做法**：不是用 forwardRef 绕过去，而是**重构依赖方向**——把公共逻辑抽到第三个模块，或改成事件驱动（A 发事件，B 监听），或通过数据库/消息队列解耦。

### 7.4 模块边界 / DDD

- 一个模块一个「业务聚合」：UserModule、OrderModule；
- 跨模块依赖通过 exports 暴露服务，而不是直接引用内部实现；
- 微服务场景下每个 bounded context（限界上下文）一个服务，有自己的数据库。

### 7.5 CQRS（加分项）

- Command（写）/ Query（读）分离，Event（事件）驱动；
- Nest 提供 `@nestjs/cqrs`：`CommandBus` / `QueryBus` / `EventBus`；
- 适合复杂业务（订单、支付、审批流），读模型可以单独优化（缓存、读库）。

**面试话术：** 「简单 CRUD 不需要 CQRS，复杂度上来了（状态流转多、读写模型差异大、要审计/事件溯源）才引入，避免过度设计。」

### 7.6 Monorepo

- Nest CLI 支持 workspace：`nest g app` / `nest g lib`；
- 共享库（DTO、类型、工具）放 lib，多个 app 复用；
- 结合 pnpm workspace（你工作区就是 pnpm）管理依赖。

---

## 8. 微服务与消息队列

### 8.1 什么时候拆微服务？

**反面答案**：一开始就拆微服务，或者把「服务间直接 HTTP 调用」叫微服务。

**正面答案**：

- 团队/业务边界清晰、独立部署需求强；
- 不同服务扩展性要求不同（订单 vs 图片处理）；
- 需要独立技术栈或隔离故障域。

**警惕分布式单体**：服务边界画错、共享数据库，比单体还差。

### 8.2 传输层对比

| 传输 | 特点 | 适用 |
|---|---|---|
| TCP | Nest 内置默认，简单 | 内部小服务、学习 |
| Redis | Pub/Sub，轻量 | 轻量事件广播 |
| NATS | 云原生、JetStream 持久化 | 中等规模事件 |
| RabbitMQ | AMQP、可靠、死信队列 | 企业级任务/事件 |
| Kafka | 高吞吐、分区、持久化、重放 | 大数据量事件流、日志 |
| gRPC | Protobuf 强契约、HTTP/2、双向流 | 内部同步 RPC（2026 热点） |

### 8.3 `@MessagePattern` vs `@EventPattern`

| | MessagePattern | EventPattern |
|---|---|---|
| 模式 | 请求-响应（同步等结果） | 事件（fire-and-forget，不等结果） |
| 场景 | 查用户、校验 token | 发通知、记审计日志、订单创建后扣库存 |
| 返回值 | 序列化回给调用方 | 返回值被丢弃 |

```ts
@Controller()
export class OrdersController {
  @MessagePattern('order.create')          // 同步调用
  async createOrder(@Payload() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @EventPattern('order.shipped')           // 异步事件
  async onShipped(@Payload() data: { orderId: string }) {
    await this.ordersService.markAsShipped(data.orderId);
  }
}
```

### 8.4 gRPC（2026 面试热点）

**为什么 2026 年爱考 gRPC？** 大厂内部服务通信从 JSON over HTTP 转向 Protobuf 强契约 + HTTP/2，性能更高、契约更严格。

核心要点：

- `.proto` 文件定义 service 和 message，是**单一事实来源**；
- `@GrpcMethod('UsersService', 'FindOne')` 绑定 RPC 方法；
- 服务端流：返回 `Observable`，每个值是一帧流；
- 双向流：`@GrpcStreamCall()`，拿到 `ServerDuplexStream` 手动读写；
- Hybrid 应用：同一个 Nest 实例既跑 HTTP 又跑 gRPC（`connectMicroservice`）；
- NestJS 11：传输层新增 `unwrap()`，可以直接拿到底层客户端实例调原生能力；trace ID 自动跨传输传播。

```ts
// hybrid：同一进程同时暴露 REST 和 gRPC
const app = await NestFactory.create(AppModule);
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.GRPC,
  options: { package: 'users', protoPath: join(__dirname, 'proto/users.proto') },
});
await app.startAllMicroservices();
await app.listen(3000);
```

**面试追问：gRPC 什么时候该用，什么时候别用？**

> 内部服务间同步调用、对性能/契约要求高时用 gRPC（Protobuf 比 JSON 小、序列化快、HTTP/2 多路复用）。浏览器端/公网 API/第三方对接继续用 REST/GraphQL，因为浏览器 HTTP/2 受限、gRPC-Web 生态弱、JSON 可读性和调试性更好。

### 8.5 可靠性四件套（必考）

1. **超时（timeout）**：每个 RPC 都要有 deadline，否则一个慢服务拖垮全链路；
2. **重试（retry）**：只对幂等操作重试（读操作安全，创建订单不能无脑重试），指数退避 + 抖动（jitter）防雪崩；
3. **熔断（circuit breaker）**：连续失败 N 次打开熔断，半开探测恢复，可用 `opossum`；
4. **幂等**：消息处理端用业务唯一键（orderId/eventId）去重，DB 加唯一索引。

```ts
const user = await firstValueFrom(
  this.usersService.findOne({ id }).pipe(
    timeout(3000),
    retry({ count: 2, delay: (_, n) => timer(1000 * n + Math.random() * 100) }),
  ),
);
```

**消息可靠性追问：**

- 消息丢失怎么办？ → 生产端确认（acks）、消费端手动 ack + 失败重投、死信队列。
- 重复消费怎么办？ → 幂等设计（唯一键 + 去重表）。
- 订单创建后要发 Kafka 事件，怎么保证本地事务和发消息一致？ → **Transactional Outbox**：事务里先写 outbox 表，后台任务/CDC 再发消息；或 Saga 模式。

### 8.6 可观测性（2026 趋势）

- NestJS 11 自动在 Kafka/RabbitMQ/gRPC 传输间传播 trace ID；
- 接入 OpenTelemetry：请求开始创建 span，跨服务透传 `traceparent`；
- 日志统一 JSON 格式 + traceId，方便全链路检索；
- 指标：Prometheus + `@nestjs/terminus` 健康检查 / `/metrics`。

---

## 9. 性能与高并发

### 9.1 Fastify vs Express

| | Express | Fastify |
|---|---|---|
| 性能 | 基准较低 | 约 2 倍吞吐（官方 benchmark） |
| JSON Schema 校验 | 无 | 内置 schema 校验 |
| 插件生态 | 最大 | 好但略少 |
| Nest 集成 | 默认 | `FastifyAdapter` |

**面试话术：** 「默认 Express 是因为生态最大；压测发现瓶颈在路由层时，换 Fastify 适配器约能提升 20%+ 的 CPU 密集吞吐。I/O 密集场景差距不明显，瓶颈通常在数据库，别指望换框架解决。」

### 9.2 缓存

```ts
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        store: await redisStore({ socket: { host: config.get('REDIS_HOST') } }),
        ttl: 60,
      }),
      inject: [ConfigService],
    }),
  ],
})
```

面试要点：

- 缓存策略：`Cache-Aside`（先读缓存，miss 读库回填）、`Write-Through`、`Write-Behind`；
- 缓存三大问题：**穿透**（查不存在的数据，布隆过滤器/空值缓存）、**击穿**（热点 key 过期，互斥锁/逻辑过期）、**雪崩**（大批 key 同时过期，过期时间加随机值）；
- 缓存一致性：更新 DB 后删缓存（Cache Aside），比先更新缓存更稳；要求高的用 binlog/CDC 订阅。

### 9.3 限流

```ts
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 100 }, // 每分钟 100 次
    ]),
  ],
})
```

面试要点：

- 限流算法：固定窗口、滑动窗口、令牌桶、漏桶；分布式用 Redis + Lua 保证原子性；
- 网关层限流（Nginx） + 应用层限流（Throttler） + 业务层限流三层配合；
- 对登录接口、验证码接口单独收紧。

### 9.4 懒加载模块

```ts
const lazy = await this.lazyModuleLoader.load(() => ReportsModule);
```

减少启动时模块图大小，冷启动更快；适合低频功能（报表、管理后台）。

### 9.5 多进程与集群

- Node 单线程，多核机器用 `cluster` 或 PM2 cluster 模式跑多进程；
- 有状态的东西（session、内存缓存）要放 Redis 等外部存储，否则多进程不一致；
- 容器化 + K8s 时用多副本而不是进程内 cluster（k8s 管副本，进程数由实例数决定）。

### 9.6 Serverless

- `@nestjs/platform-serverless` / `serverless-adapter` 可跑 Lambda/FC；
- 注意：冷启动、连接池复用（Lambda 容器复用）、无状态要求；
- 适合 BFF、低频 API、AI 回调，不适合长连接/重计算。

### 9.7 常见性能坑（自查清单）

- 误用 `REQUEST` scope 导致每次请求都实例化；
- 同步阻塞（`readFileSync`、CPU 密集无 worker）；
- 数据库连接池泄漏 / 事务过长；
- N+1 查询；
- 未分页的大列表返回；
- 日志打全量 body；
- 串行 await 可以并行的请求；
- 未加缓存/索引。

---

## 10. 测试

### 10.1 单元测试（TestingModule）

```ts
describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo }, // mock 仓库
      ],
    }).compile();
    service = moduleRef.get(UserService);
  });

  it('should create user', async () => {
    expect(await service.create(dto)).toEqual({ id: 1 });
  });
});
```

要点：

- **只测自己这一层**：Service 测业务逻辑，Repository/DB 用 mock；
- 全局管道/过滤器测试时用 `APP_PIPE` 等 token 注入；
- 覆盖边界：校验失败、异常路径、并发。

### 10.2 E2E 测试（Supertest）

```ts
const app = await createApp();
await request(app.getHttpServer())
  .post('/users/register')
  .send({ email: 'a@b.com', password: '123456' })
  .expect(201);
```

E2E 要起真实模块（或测试数据库），验证「请求 → 校验 → 业务 → 响应」整条链路。

### 10.3 2026 趋势：Jest vs Vitest

- Nest 默认 Jest；Vitest 因 SWC/esbuild 提速成为新项目热门；
- 面试话术：「Nest 官方默认 Jest 生态成熟；如果追求速度或和前端 Vite 项目统一，可以用 Vitest，SWC 加持下单测快很多。关键是测试分层和覆盖率，工具是次要的。」

---

## 11. 安全

| 威胁 | NestJS 对策 |
|---|---|
| XSS | 输出编码、CSP、httpOnly Cookie；不把用户输入直接当 HTML 渲染 |
| CSRF | 同源校验（SameSite Cookie）、CSRF Token（cookie 方案必做） |
| SQL 注入 | 禁止字符串拼 SQL；用 ORM 参数化 / `query('?')` 占位符 |
| Mass Assignment | DTO `whitelist: true` + 禁止客户端传敏感字段 |
| 密码泄露 | bcrypt/argon2 哈希 + 盐，永不返回密码字段 |
| JWT 泄露 | 短有效期 + refresh 旋转 + Redis 黑名单 |
| 暴力破解 | 登录限流、验证码、失败锁定 |
| 安全头 | `@nestjs/helmet`（HSTS、X-Frame-Options、CSP） |
| 依赖漏洞 | `pnpm audit`、SCA 扫描、及时升级 |
| 敏感信息 | 不把密钥写代码里，用环境变量/配置中心 + schema 校验 |

**纵深防御话术：** 「安全不是单点，而是分层：输入校验 + 参数化查询 + 鉴权守卫 + 输出编码 + 限流 + 审计日志 + 依赖扫描，每层各防一类问题。」

---

## 12. 部署与运维

### 12.1 Docker 多阶段构建

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
CMD ["node", "dist/main"]
```

要点：生产镜像只装生产依赖、只复制 dist；K8s 就绪探针打 `/health`。

### 12.2 PM2 / Nginx

- PM2：`pm2 start dist/main.js -i max`（cluster 模式）、`pm2 reload` 零停机；
- Nginx：反向代理、静态资源、SSL 终止、限流、gzip；
- 应用内不要自己处理 HTTPS 证书（Nginx/网关做）。

### 12.3 健康检查

```ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    @InjectConnection() private db: Connection,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.query('SELECT 1'),   // 数据库探活
      // Redis、外部依赖
    ]);
  }
}
```

K8s：`livenessProbe`（进程活着）+ `readinessProbe`（依赖就绪，失败摘流量）。

### 12.4 日志与追踪

- 统一 JSON 日志，带 `traceId` / `spanId` / `userId`；
- 请求级 trace 用中间件/拦截器生成，微服务间透传；
- 接入 OpenTelemetry + Jaeger/Tempo/阿里云链路追踪。

### 12.5 配置管理

```ts
// 多环境 + schema 校验
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
  validationSchema: Joi.object({
    DB_HOST: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
  }),
});
```

要点：配置中心（Apollo/Nacos/云 SSM）用于动态配置；密钥分级管理。

---

## 13. 全栈协作（前端视角加分项）

### 13.1 OpenAPI / Swagger 生成前端类型

```ts
const config = new DocumentBuilder()
  .setTitle('Vibe API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

前端侧：`openapi-typescript` 生成类型 + `openapi-fetch` / `@hey-api/client-fetch` 生成客户端。

**面试话术：** 「后端用 DTO + Swagger 装饰器生成 OpenAPI 文档，前端用 openapi-typescript 在 CI 里生成类型和请求客户端。接口变了类型立刻编译报错，彻底消灭前后端契约漂移。」

### 13.2 Monorepo 共享类型

`apps/api` + `apps/web` + `packages/contracts`（共享 DTO 类型），Nest 的 DTO 类导出给前端用（只当类型，不引运行时校验依赖，或用 `zod`/`valibot` 双端共享 schema）。

### 13.3 WebSocket 实时推送

- `@nestjs/websockets` + `@nestjs/platform-socket.io`；
- `@WebSocketGateway({ namespace, cors })`、`@SubscribeMessage('event')`；
- 鉴权：`WsGuard` 或 `WsMiddleware` 校验 token（握手时 query/header 传 token）；
- 业务场景：IM、实时协作、任务进度推送。

### 13.4 GraphQL

- `@nestjs/graphql` + Apollo/Mercurius，`@ObjectType()` / `@Resolver()` / `@Query()`；
- 优点：按需取字段、类型 Schema 即契约；
- 缺点：缓存复杂、N+1 风险（DataLoader）、性能调优难；
- 2026 趋势：GraphQL 在 BFF 层仍有位置，但内部服务更倾向 gRPC，前端简单场景 REST/OpenAPI 够用。

### 13.5 NestJS vs Next.js / tRPC 怎么选？

| 场景 | 推荐 |
|---|---|
| 大厂独立后端、多端复用、团队大 | NestJS（架构约束、可维护性） |
| 前端主导的轻量全栈、快速迭代 | Next.js API Routes / Route Handlers |
| 前后端同仓、极致类型安全、小团队 | tRPC（免 codegen） |
| 边缘函数 / 高性能轻量 API | Hono（Cloudflare Workers、Bun） |

**面试话术：** 「NestJS 是『企业后端』思维：模块、DI、AOP、微服务、测试都是为长期维护和多人协作设计。Next.js/tRPC 是『前端全栈』思维：快、类型爽，但架构约束弱、重业务下容易乱。选型看团队规模和业务复杂度。」

---

## 14. 场景题与系统设计题

### 14.1 高并发用户注册/下单防重

**考察点**：并发、幂等、数据库约束。

回答：

1. 应用层查重（体验）；
2. 数据库唯一索引（底线）；
3. 捕获唯一冲突转友好错误；
4. 进阶：客户端幂等键 `Idempotency-Key` + 去重表（唯一键），或 Redis SETNX 防重；
5. 下单类还要考虑库存扣减：乐观锁（`version` 或 `stock > 0` 条件更新）。

### 14.2 多租户

**方案**：

- 独立库（隔离最好、成本高）；
- 共享库独立 schema（PostgreSQL）；
- 共享表 + tenant_id（成本低，风险是漏加条件）；
- Nest 实现：REQUEST scope 的 `TenantService` 或 AsyncLocalStorage，Repository 层自动拼 tenant 条件；
- 漏加租户过滤 = 数据越权，要有强制检查机制（如自动注入 tenant 条件、测试覆盖）。

### 14.3 接口限流设计

回答结构：

1. 网关层：Nginx `limit_req`、API 网关（按用户/App/IP）；
2. 应用层：`@nestjs/throttler`（TTL+limit），自定义 key 生成器（userId + 路由）；
3. 分布式：Redis + Lua 原子计数（滑动窗口/令牌桶）；
4. 超限响应：429 + `Retry-After`；
5. 业务层：登录/验证码单独低阈值。

### 14.4 订单超时自动关闭

**方案对比**：

- 定时任务扫表：简单但延迟不可控、扫表压力大；
- 延迟队列：BullMQ `delayed` job（Redis），到期自动出队处理（2026 主流）；
- RabbitMQ 死信队列（TTL + DLX）；
- 时间轮/Redisson（Java 侧常用，Node 用 BullMQ 即可）。

```ts
// BullMQ 延迟任务
await this.orderQueue.add('close-order', { orderId }, {
  delay: 30 * 60 * 1000, // 30 分钟后执行
  attempts: 3,
  removeOnComplete: true,
});
```

处理时要**二次校验订单状态**（可能已支付），保证幂等。

### 14.5 大文件分片上传

回答要点：

- 前端分片（如 5MB/片），并发上传；
- 后端：先初始化上传（拿 uploadId），每片带 `uploadId + index + hash` 上传，全部传完调合并；
- 断点续传：查询已上传分片列表；
- 秒传：先传文件 hash，服务端查重直接标记完成；
- 校验：每片 hash 校验、合并后整体校验；
- 存储：本地临时目录 / OSS 分片接口 / MinIO。

### 14.6 分布式事务

**两大模式：**

- **Saga**：每个服务本地事务 + 补偿事务（订单失败 → 回滚库存/退款）。编排式（一个 orchestrator）或 choreography（事件链）。
- **Transactional Outbox**：业务表和 outbox 表同库同事务，后台进程/CDC 把 outbox 记录发到 MQ，消费方幂等处理。

**面试话术：** 「分布式事务没有银弹。优先通过事件驱动 + 最终一致性 + 幂等消费解决；必须强一致（扣款）才考虑 2PC/Saga，且 Saga 要设计好补偿。Outbox 解决『本地事务和发消息不一致』。」

### 14.7 API 网关 / BFF

- 统一鉴权、限流、路由、协议转换（REST→gRPC）；
- BFF 给前端聚合接口（一个页面一个请求拿全数据）；
- NestJS 可以自己写 BFF/网关层，也可以接 KONG/APISIX/云网关。

---

## 15. 高频问题速查表（背完再上考场）

| 问题 | 一句话答案 |
|---|---|
| NestJS 是什么？ | 基于 TS 的企业级 Node 框架，模块化 + DI + AOP，底层默认 Express |
| 和 Express 的区别？ | Nest 是架构层抽象，提供分层、DI、装饰器、横切关注点 |
| DI 怎么实现？ | 装饰器收集元数据 → 容器按依赖图实例化 → 构造函数注入 |
| Provider 注册方式？ | useClass / useValue / useFactory / useExisting |
| 三种作用域？ | DEFAULT 单例 / REQUEST 每请求 / TRANSIENT 每次注入 |
| 生命周期钩子？ | onModuleInit、onApplicationBootstrap、onModuleDestroy、onApplicationShutdown |
| 请求生命周期顺序？ | Middleware → Guard → Interceptor(前) → Pipe → Controller → Service → Interceptor(后) → Filter |
| Guard 和 Middleware 区别？ | Guard 在后、能拿元数据、管授权；Middleware 在前、操作原生 req/res |
| Pipe 作用？ | 校验 + 转换，进入 Controller 前执行 |
| Interceptor 为什么用 RxJS？ | 统一处理异步流、可中断/重试/超时/包装响应 |
| 为什么 DTO 用 class？ | 运行时元数据 + 校验装饰器 + Swagger 识别 |
| whitelist 有什么用？ | 剔除未声明字段，防 mass assignment |
| JWT 流程？ | 登录签发 → 客户端携带 → Guard 验证 → user 挂 request |
| refresh token 怎么设计？ | 短 access + 长 refresh、旋转、Redis 可吊销、复用检测 |
| RBAC 怎么做？ | @SetMetadata + Reflector + Guard，权限码 `模块:资源:操作` |
| 动态模块？ | 静态方法返回 DynamicModule，forRoot/forFeature/registerAsync |
| 循环依赖？ | forwardRef，但更推荐重构依赖方向/事件解耦 |
| MessagePattern vs EventPattern？ | 同步请求-响应 vs 异步 fire-and-forget |
| gRPC 优点？ | Protobuf 强契约、HTTP/2、双向流，适合内部服务 |
| 消息可靠性？ | 超时 + 幂等重试 + 熔断 + 死信 + outbox |
| 缓存穿透/击穿/雪崩？ | 布隆过滤器/空值缓存；互斥锁/逻辑过期；随机过期时间 |
| 分布式限流？ | Redis + Lua 原子计数，滑动窗口/令牌桶 |
| 事务隔离级别？ | 读未提交/读已提交/可重复读/串行化 |
| 先查后插并发问题？ | 唯一索引兜底 + 幂等键 + 捕获冲突 |
| 单元测试 vs E2E？ | TestingModule 单测 Service；supertest 全链路 |
| Nest 怎么跑多进程？ | PM2 cluster / K8s 多副本，有状态放 Redis |
| 健康检查？ | @nestjs/terminus + readinessProbe |
| 前后端类型共享？ | OpenAPI codegen 或 Monorepo 共享 contracts |

---

## 16. 面试官追问套路 + 答题话术

### 套路一：从「用法」追到「原理」

> 「你用过 Guard 吧？**为什么 Nest 能在 Guard 里拿到方法上的 @Roles 元数据？**」

答：`@SetMetadata` 本质是 `Reflect.defineMetadata(handler)`，`Reflector` 通过 `Reflect.getMetadata` 读取，所以 Guard 能拿到 Controller/方法级元数据——这就是装饰器 + 反射在框架里的具体应用。

### 套路二：从「会写」追到「为什么」

> 「DTO 用 class 我能理解，**那 transform: true 到底转了什么？**」

答：把普通 JSON 对象 `plainToInstance` 成 DTO class 实例，同时按属性类型做转换（string → number、Date），这样 Controller 里拿到的就是类型安全的对象，而不是 `any`。

### 套路三：从「单机」追到「分布式」

> 「你的限流在单机上没问题，**多副本部署后呢？**」

答：每副本独立计数会放大限额，需要 Redis 集中计数；用 Lua 保证「读-判断-写」原子性；还要考虑时钟偏差，所以用 TTL 而不是绝对时间戳。

### 套路四：从「实现」追到「取舍」

> 「既然 gRPC 性能好，**为什么公网 API 不用 gRPC？**」

答：浏览器原生不支持 HTTP/2 gRPC，需要 gRPC-Web 代理且调试工具弱；公网 API 面向第三方，JSON + OpenAPI 生态最通用；gRPC 的强契约优势在内部服务间才最大化。

### 套路五：从「功能」追到「运维」

> 「你写完接口，**怎么知道它线上挂了？**」

答：健康检查探针 + 日志 traceId + 指标（QPS/错误率/延迟分位数）+ 告警；Nest 侧统一在拦截器统计耗时、异常过滤器记错误日志。

---

## 17. 备考建议

### 优先级（按面试权重）

1. **AOP 五件套 + 请求生命周期**（必问，必须能画图、能写代码）；
2. **DI 原理 + Provider 注册 + 作用域**（必问）；
3. **DTO/ValidationPipe + 数据库并发场景**（高频场景题）；
4. **JWT/RBAC**（必问）；
5. **动态模块/全局模块/循环依赖**（中高频）；
6. **微服务：Message/EventPattern、gRPC、消息可靠性**（高级岗位加分重点）；
7. **性能：缓存、限流、Fastify、集群**（追问热点）；
8. **测试 + 部署 + 可观测性**（体现工程化成熟度）。

### 怎么准备

- 把 `server/` 项目按本文考点自查：哪些用了、哪些没用，能讲出「为什么用/为什么不用」；
- 每个考点准备一个「项目里真实例子 + 一个手写 demo」；
- 高频题用 STAR 结构：场景 → 方案 → 实现 → 取舍；
- 面试完把盲区补回专题文档，不留尾巴。

### 参考资料

- NestJS 官方文档：<https://docs.nestjs.com>
- NestJS 官方 Releases：<https://github.com/nestjs/nest/releases>
- NestJS 微服务 gRPC 2026 指南：<https://sharpskill.dev/en/blog/node-nestjs/nestjs-microservices-grpc-architecture>
- TypeScript 生态 2026：<https://www.youngju.dev/blog/culture/2026-05-16-typescript-ecosystem-bun-deno-hono-elysia-nestjs-effect-trpc-drizzle-prisma-zod-vitest-2026-deep-dive.en>
- NestJS 高频面试题解析：<https://www.yuque.com/guluguluwater-qkq0t/qbbqks/xkg7la1ifd1oy331>
- NestJS 生产场景面试题集：<https://fridolph.github.io/FE-prepare-interview/面试官问/18nestjs/intro.html>
- NestJS 注册系统高频考点：<https://juejin.cn/post/7599911091086589952>
- NestJS 性能对比（2026-07）：<https://devanddeliver.com/blog/development/nest-js-vs-express-vs-fastify-in-2026-a-practical-comparison>

