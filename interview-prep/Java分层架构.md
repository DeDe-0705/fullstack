# Java 项目分层架构

> 面向 Java 方向的分层设计与数据载体（各种「O」）面试知识点。典型技术栈：Spring Boot + MyBatis。

---

## 〇、典型项目目录结构（按层分包，最主流）

```text
demo/
├── pom.xml                            # Maven 依赖管理
└── src/
    ├── main/
    │   ├── java/com/example/demo/
    │   │   ├── DemoApplication.java   # 启动类（@SpringBootApplication）
    │   │   ├── controller/            # 表现层
    │   │   │   └── UserController.java
    │   │   ├── service/               # 业务层：接口
    │   │   │   ├── UserService.java
    │   │   │   └── impl/              # 业务层：实现
    │   │   │       └── UserServiceImpl.java
    │   │   ├── mapper/                # 持久层：MyBatis 接口
    │   │   │   └── UserMapper.java
    │   │   ├── entity/                # 实体：对应数据库表
    │   │   │   └── User.java
    │   │   ├── dto/                   # 数据传输对象
    │   │   │   ├── request/           # 入参
    │   │   │   └── response/          # 出参
    │   │   ├── vo/                    # 视图对象：返回前端
    │   │   ├── config/                # 配置类
    │   │   ├── common/ 或 utils/      # 工具类、统一返回 Result
    │   │   ├── exception/             # 全局异常处理
    │   │   ├── constant/ 或 enums/    # 常量、枚举
    │   │   └── aspect/ 或 aop/        # 切面：日志、事务增强
    │   └── resources/
    │       ├── application.yml        # 核心配置（端口/数据源/MyBatis）
    │       ├── mapper/                # MyBatis XML 映射文件
    │       │   └── UserMapper.xml
    │       └── static/                # 静态资源
    └── test/                          # 单元测试
```

**命名规范（背下来）：**

- Controller：`XxxController`
- Service：接口 `XxxService`，实现 `XxxServiceImpl`（放 `impl` 子包）
- Mapper：`XxxMapper`（MyBatis-Plus 常继承 `BaseMapper<Entity>`）
- Entity：`Xxx` 或 `XxxEntity`，与数据库表一一对应
- DTO 按用途再分：`dto/request`（入参）、`dto/response`（出参）

**两种组织方式（面试加分）：**

1. **按层分包**（上图，传统主流）：先按 `controller/service/mapper` 分，再按业务。
2. **按领域分包**（DDD / 模块化趋势）：先按业务模块（`user/`、`order/`）分，每个模块内部再分层，或拆成 `domain/` + `application/` + `infrastructure/`。

---

## 一、三层核心骨架

```text
Controller（表现层）→ Service（业务层）→ Mapper/DAO（持久层）→ 数据库
```

| 层 | 注解 | 职责 |
| --- | --- | --- |
| Controller | `@RestController` | 接收 HTTP 请求、参数校验、调用 Service、封装响应 |
| Service | `@Service` | 业务逻辑、编排多个 DAO、事务（`@Transactional`） |
| Mapper/DAO | `@Mapper` / `@Repository` | 操作数据库、执行 SQL |

> 补充：Spring Data JPA 里持久层习惯叫 `Repository`；MyBatis 里叫 `Mapper`（接口 + XML）。

---

## 二、数据载体层：各种「O」（最容易混）

| 对象 | 全称 | 所属层 | 作用 |
| --- | --- | --- | --- |
| PO | Persistent Object | 持久层 | 与数据库表字段一一对应 |
| DO | Data Object | 持久层 | 同 PO（阿里规范常用 DO） |
| Entity | 实体 | 持久层 | 同 PO |
| DTO | Data Transfer Object | 传输 | 层间 / 服务间传数据 |
| VO | View Object | 表现层 | 返回给前端展示 |
| BO | Business Object | 业务层 | 承载业务逻辑的领域对象 |
| Query | 查询对象 | 表现/传输 | 封装查询条件、分页参数 |
| POJO | Plain Old Java Object | 全层基础 | 以上所有「O」的泛化概念 |

**核心区分：**

- **PO/DO/Entity**：跟数据库表一一对应，字段就是列。
- **DTO**：面向「传输」，跨层/跨服务搬运数据，避免直接用 PO。
- **VO**：面向「前端展示」，字段是页面需要的，可能多个 DO 拼出来，也可能隐藏敏感字段（如密码）。
- **BO**：面向「业务」，复杂业务里才单独出现；简单 CRUD 可以省略。

---

## 三、其他支撑层

| 层/包 | 作用 |
| --- | --- |
| Config | 配置类（`@Configuration`），Bean 装配、拦截器注册等 |
| Common / Utils | 通用工具类、常量、Result 统一返回 |
| Exception | 全局异常处理（`@RestControllerAdvice` + `@ExceptionHandler`） |
| AOP / Filter / Interceptor | 横切关注点：日志、鉴权、限流、事务增强 |
| Constant / Enum | 常量、枚举 |
| Domain / Model | 领域模型层（DDD 场景，区别于贫血模型） |

---

## 四、完整分层与数据流转

```text
请求 → Controller（入参 DTO）
        ↓ 转 BO
     Service（业务逻辑、事务，BO）
        ↓ 转 PO
     Mapper/DAO（操作 DB，PO）
        ↓
     数据库
        ↓ 返回 PO
     Service（PO → BO 继续业务）
        ↓ 返回 BO
     Controller（BO → VO）
        ↓
     响应（VO 给前端）
```

> 面试要点：**Controller 入参通常是 DTO，返回是 VO；Service 内部用 BO；DAO 层用 PO**。简单场景可合并（DTO 直接当 VO、PO 直接当 BO），但复杂/多人协作时严格区分，防止数据库字段泄漏、字段耦合。

---

## 五、为什么分层（面试高频）

1. **职责单一**：每层只干一件事，好懂、好改。
2. **可测试**：Service 可脱离 HTTP 单独测试，DAO 可 mock。
3. **可替换**：换 ORM（MyBatis → JPA）、换数据库，只改持久层。
4. **安全解耦**：VO 隔离数据库字段，不把表结构/敏感字段直接暴露给前端。

---

## 六、高频考点速查

1. **Java 有哪些层？** → Controller / Service / Mapper(DAO) / 数据载体(Entity、DTO、VO、BO) / Config、Utils、Exception、AOP 等支撑层。
2. **DTO 和 VO 的区别？** → DTO 面向层间传输，VO 面向前端展示；字段取舍、变更频率不同。
3. **PO 和 BO 的区别？** → PO 对应数据库表，BO 承载业务语义；简单场景可复用，复杂场景分开。
4. **为什么要这么多「O」？** → 分层解耦、数据安全、职责单一、前端字段与表结构解耦。
5. **为什么分层？** → 职责隔离、易测试、易替换、安全。

---

## 来源

- 掘金：Java 为什么有这么多「O」——从请求链路看清楚：https://juejin.cn/post/7486659696062267442
- 阿里云：POJO/DO/PO/DTO/VO/BO/Query/Entity 全方位对比：https://developer.aliyun.com/article/1720695
- 51CTO：Spring Boot 分层为什么重要：https://blog.51cto.com/u_16099241/14856794
