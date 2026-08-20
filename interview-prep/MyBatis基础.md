# MyBatis 基础

> 面向 Java 方向的持久层框架面试知识点。MyBatis 名字和 MySQL 很像，但两者完全不是一个层面的东西。

---

## 一、MyBatis 和 MySQL 的本质区别

| | MySQL | MyBatis |
| --- | --- | --- |
| 定位 | 关系型数据库（存储数据） | Java 持久层框架（操作数据） |
| 层次 | 数据存储层 | 数据访问层 |
| 类比 | 仓库 | 搬运工 / 调度员 |

调用链：

```text
Java 应用 → MyBatis（框架，组织 SQL）→ JDBC（驱动）→ MySQL（数据库，执行 SQL）
```

一句话：**MySQL 是「存数据的地方」，MyBatis 是「操作数据库的工具」**。MyBatis 不绑定 MySQL，它同样能连 Oracle、PostgreSQL 等。

---

## 二、MyBatis 是什么

一句话：**MyBatis 是一个半自动的 ORM（对象关系映射）框架，封装了 JDBC，简化 Java 对数据库的操作**。

- 前身 iBatis，专注「SQL 映射」：把 SQL 语句和 Java 对象关联起来
- 免去手动管理 Connection / Statement / ResultSet 的开关与结果集解析
- SQL 写在 XML 或注解里，通过接口 + Mapper 映射执行

**为什么需要它？** 直接用 JDBC 有两大痛点：代码冗余（大量样板代码）、每次操作都要手动开关连接（性能差）。MyBatis 封装了这些，并自带连接池。

---

## 三、MyBatis vs JPA/Hibernate

| 对比 | MyBatis | JPA / Hibernate |
| --- | --- | --- |
| ORM 类型 | 半自动（自己写 SQL） | 全自动（框架生成 SQL） |
| SQL 掌控力 | 强，可精确优化 | 弱，依赖框架生成 |
| 灵活性 | 高 | 低 |
| 跨库迁移 | 差（SQL 依赖数据库方言） | 好（方言由框架适配） |
| 适用 | 复杂 SQL、报表、性能敏感 | 简单 CRUD、快速开发 |

> 面试高频：「为什么你们项目用 MyBatis 不用 JPA？」——答案骨架：业务 SQL 复杂、需要精确控制执行计划与性能、团队习惯 SQL 编程。

---

## 四、高频考点速查

1. **`#{}` 和 `${}` 的区别？** → `#{}` 预编译占位符 `?`，防 SQL 注入；`${}` 直接字符串拼接，只用于动态表名/列名等无法预编译的场景，有注入风险。
2. **一级缓存和二级缓存？** → 一级缓存 SqlSession 级别，默认开启，会话内复用；二级缓存 Mapper/namespace 级别，默认关闭，需手动开启，跨会话共享。
3. **动态 SQL 有哪些标签？** → `if` / `where` / `foreach` / `trim` / `choose`，在 XML 里做条件判断与 SQL 拼接。
4. **ResultMap 作用？** → 解决数据库字段名和 Java 属性名不一致、以及一对一/一对多复杂映射。
5. **MyBatis 的缺点？** → SQL 强依赖数据库方言，跨库迁移成本高（此时更适合 JPA/Hibernate）。

---

## 来源

- 腾讯云：MyBatis 和 MySQL 有什么区别：https://developer.cloud.tencent.cn/ask/2177404
- Java 最新 MyBatis 面试题及解答：https://juejin.cn/post/7571678388954595347
- 阿里云 MyBatis 高频面试题与核心原理（`#{}`/`${}`、缓存）：https://developer.aliyun.com/article/1671340
- JavaGuide：MyBatis 常见面试题总结：https://github.com/Snailclimb/JavaGuide
