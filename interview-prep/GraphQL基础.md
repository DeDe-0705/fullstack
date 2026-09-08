# GraphQL 基础（接口层 · 不是数据库）

> 定位一句话：GraphQL 是 **API 查询语言 + 运行时**，属于 **接口/协议层**。它 **不存数据**，而是把"客户端想要的数据形状"翻译成对背后数据源（MySQL/Redis/其他 API）的读取。

---

## 0. 先破除最大的误区

很多人一听"查询语言"就把它和 SQL 归为一类，其实二者是**不同层面**的东西：

- **SQL**：是**数据库语言**，面向**表 / 行 / 列**，负责**存取数据 + 事务**。
- **GraphQL**：是**接口语言**，面向**对象图 / 前端页面**，负责**按需取字段、拼装响应**，背后可以连任意数据源。

GraphQL 官方 FAQ 里有一句话说得很直白：

> "你不拿 GraphQL 去查询某一种特定数据库（如 MySQL）；你拿它去查询来自任何数量的、不同来源的数据。"

---

## 1. GraphQL vs MySQL 对比表

| 维度 | MySQL | GraphQL |
|---|---|---|
| 层级 | 存储层（数据库） | 接口/协议层（API） |
| 本质 | 负责存放、管理、持久化数据 | 负责定义"客户端能请求什么形状的数据" |
| 直接操作对象 | 表、行、列 | Schema 里的类型和字段 |
| 是否存数据 | ✅ 存 | ❌ 不存（只是个中间层） |
| 数据来源 | 自身 | 背后任意（MySQL/Redis/ES/另一个 API） |
| 主要使用者 | 后端 / 运维 / 数据 | 前端 / 移动端等调用方 |
| 典型操作 | SELECT / INSERT / UPDATE / DELETE | query / mutation / subscription |
| 事务 | ✅ 有 | ❌ 无（由 resolver 内部处理） |
| 强类型约束 | 表结构 | Schema 类型系统（schema 即文档/约定） |

---

## 2. SQL 语句一样吗？—— 完全不一样

虽然名字里都带"查询"，但**语法、对象、目的都不同**：

| 对比 | SQL | GraphQL |
|---|---|---|
| 查询对象 | 表：`SELECT id,name FROM users WHERE age > 18` | 对象图：`query { user(id:1){ id name } }` |
| 返回形状 | 固定二维表结构 | 客户端按需决定，可嵌套、可裁剪字段 |
| 谁决定取什么 | 服务端写死 SQL | 客户端决定字段 |
| 聚合/统计 | GROUP BY / HAVING / 窗口函数 很强大 | 不擅长，靠 resolver 背后拼 |
| 副作用操作 | INSERT / UPDATE / DELETE | mutation（写）、subscription（订阅推送） |
| 运行位置 | 数据库引擎 | 应用服务（resolver 层） |

**关键翻译（面试常抓的点）**：GraphQL 的 `query` ≠ SQL 的 `SELECT`。

- GraphQL 的 `query` = 一次**对接口的读请求动作**；
- 对应的写动作叫 **`mutation`**；
- 实时推送叫 **`subscription`**。

SQL 的 `SELECT` 只是数据库里"取行取列"的指令。二者不要混淆。

---

## 3. GraphQL 为什么出现（前端视角最痛的三点）

它主要解决 REST 的三个老大难：

1. **over-fetching（取多了）**：列表页只要 `id / name`，后端却把详情字段全塞过来。
2. **under-fetching（取少了 / 要多次请求）**：一个页面要调 3 个接口再自己拼。
3. **多端差异化**：App 和 Web 要的字段不一样，得各自维护接口。

GraphQL 把这些变成"**客户端写什么就返回什么**"：一次请求拿全、字段精准；schema 即文档，前后端强类型对齐。

---

## 4. 同一链路里的上下层关系

```
前端(React) → GraphQL API(schema + resolver) → 背后真正执行 SQL 的 MySQL
```

- 客户端看到的只是 GraphQL，**它不需要知道**数据库长什么样。
- **resolver（解析器）才是真正干活的地方**：它内部写 SQL 去查 MySQL（或调 Redis / 别的微服务），把结果组装成 GraphQL 要求的形状返回。

所以它俩是**上下层配合**，不是二选一。

---

## 5. 高频面试考点（2026 大厂版）

### 5.1 N+1 问题（最常考）

- **现象**：GraphQL 一个请求里，每个字段的 resolver 可能各触发一次 DB 查询 → 一个请求打出 N+1 条 SQL，DB 压力暴涨。
- **解决**：**DataLoader 批量化**——把同一请求内的多条子查询**合并、去重、批量查一次**再分发。NestJS 里用 `@nestjs/graphql` + DataLoader。
- 一句话话术："GraphQL 把解析逻辑下沉到 resolver，**如果一个请求里每个字段都独立查库就会出现 N+1**；我用 DataLoader 把同一批查询合并成一次数据库往返，保证字段级取数高效。"

### 5.2 code-first vs schema-first

- **code-first**：用装饰器 + TypeScript 类型**自动生成 schema**（NestJS 推荐，类型安全、少写重复定义）。
- **schema-first**：手写 `.graphql` schema 文件，再绑定 resolver。

### 5.3 字段级权限（field-level permissions）

- 控制"某些人看不到某些字段"。在 resolver 里做鉴权，或用**指令（directive / guard）**统一处理。
- 企业效率系统（OA/ERP/BI 的 SSO、权限、网关）里这点尤其相关——**字段级数据权限**是高频场景题。

### 5.4 GraphQL vs REST 选型

| 场景 | 倾向 |
|---|---|
| 字段异构、多端、跨数据源聚合 | GraphQL |
| 简单 CRUD、强缓存（HTTP 缓存/CDN）、团队不熟 | REST |

### 5.5 和 AI 工程化的斜杠点（你的差异化）

GraphQL 强类型 schema 很适合做 **AI 工具 / Agent 的数据接口层**：

- schema 即约束，**LLM 可按 schema 生成合法的 query**；
- 前端/Agent 都能精准按需取字段，避免 LLM 输出不可控的字段膨胀。

这条能呼应懂车帝 JD 里第 3/6/7/8 条（AI 工程化落地）。

---

## 6. 面试话术模板（一句话说清定位）

> "GraphQL 不是数据库，它是**接口层的查询语言**。它跟 SQL 是不同层面的东西：SQL 是**我对 MySQL 取数的手段**，GraphQL 是**前端对后端要我想要的数据形状的手段**。它解决的是 REST 的 over/under-fetching 和字段多端差异化，schema 强类型即文档。真正的取数还是 resolver 里走 SQL/数据源，所以它和 MySQL 是**上下层配合**，不是二选一。唯一要小心的是 N+1，一个请求别打出太多条 SQL，用 DataLoader 批量化。"
