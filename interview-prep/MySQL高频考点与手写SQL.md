# MySQL 高频考点与手写 SQL

> 以 MySQL 为主，覆盖大厂后端面试的两条主线：**基础语法能写**、**原理能聊深**。文档统一使用下面两张表作为练习数据。

```sql
-- 员工表
employees(id, name, dept_id, salary, hire_date)

-- 部门表
departments(id, name)

-- 登录表（连续登录题用）
login_log(user_id, login_date)
```

---

## 一、高频考点速查

### 1.1 索引

- **B+ 树**：InnoDB 默认索引结构，数据存在叶子节点，叶子节点通过链表连接，适合范围查询。
- **聚簇索引 vs 二级索引**：聚簇索引（主键索引）叶子存整行数据；二级索引叶子存主键值，查到主键后需要「回表」取整行。
- **联合索引最左前缀**：`(a, b, c)` 能命中 `a`、`a,b`、`a,b,c`；跳过最左列（如只用 `b`）无法命中。
- **回表 / 覆盖索引**：二级索引没覆盖查询字段时要回聚簇索引；查询字段全部在索引里则无需回表，`Extra` 显示 `Using index`。
- **索引失效常见原因**：索引列上使用函数、类型转换/隐式转换、`!=`、`LIKE '%x'`、`OR`、不满足最左前缀。

### 1.2 执行计划 EXPLAIN

重点看四个字段：

| 字段 | 含义 | 关注点 |
|---|---|---|
| `type` | 访问类型 | 最好 `ref`/`eq_ref`/`range`，最差 `ALL` |
| `key` | 实际使用的索引 | `NULL` 表示未用索引 |
| `rows` | 预估扫描行数 | 越小越好 |
| `Extra` | 额外信息 | `Using index` 覆盖索引；`Using filesort`、`Using temporary` 要警惕 |

### 1.3 事务与 MVCC

- **ACID**：原子性、一致性、隔离性、持久性。
- **隔离级别**：读未提交、读已提交（RC）、可重复读（RR）、串行化；对应解决脏读、不可重复读、幻读。
- **MVCC**：靠 `undo log` 版本链 + 隐藏列 `trx_id`、`roll_pointer` + `Read View` 实现非阻塞读。
  - RC：每次读都创建新 Read View，能读到别的事务新提交的数据。
  - RR：事务内首次读创建 Read View 后复用，保证可重复读。

### 1.4 锁与慢查询

- **锁**：行锁、间隙锁、临键锁（行锁 + 间隙锁）；`SELECT ... FOR UPDATE` 是当前读，会加锁，并发场景易死锁。
- **慢查询**：慢查询日志定位慢 SQL → `EXPLAIN` 分析 → 考虑索引、覆盖索引、深分页优化、`ORDER BY` 是否触发 `Using filesort`。
- **深分页**：`LIMIT 100000, 10` 会扫过前 10 万行，可用「延迟关联」或游标/上次主键优化。

### 1.5 DB 自带锁 vs 应用层锁（并发控制分层）

面试高频："写入并发控制是 DB 管还是应用管？"——**分层答案**：

**DB 自动给的（不写代码）**：

- **行锁**：`UPDATE/DELETE` 命中行自动加排他锁，并发改同一行自动串行（项目实例：`editConversation` 的 `update({id, userId}, ...)` 靠行锁 + `affected=0` 判断防并发写花）
- **唯一约束**：并发插入同名数据 DB 保证只成功一个（`ER_DUP_ENTRY`），是幂等的最后兜底
- **MVCC + 隔离级别**（InnoDB 默认 RR）：读写不互斥、快照读，引擎内置

**应用层必须自己写的（DB 不替你做）**：

1. **乐观锁**：读-改-写竞态（余额、库存）——`UPDATE ... SET version = version+1 WHERE id=? AND version=?`，`affected=0` 说明被抢改，重试或报错；TypeORM 对应 `@VersionColumn`
2. **悲观锁**：`SELECT ... FOR UPDATE` 锁本身是 DB 的，但**锁的时机和范围**是设计决策，锁大了就是性能事故
3. **业务级互斥**：跨请求/跨资源的互斥（如"同一会话同时只允许一个进行中的 AI 回复"），没有单条 SQL 能表达，只能应用层分布式锁（Redis SET NX）
4. **热点行保护**：秒杀抢同一行库存，DB 行锁会串行化拖垮自己——应用层把竞争前移：Redis 预扣、请求排队，让 DB 只见少量并发

**判断标准**：一致性边界在单条记录 + 单个事务内 → 信任 DB 自带；涉及读-改-写、跨请求、跨系统、热点竞争 → 应用层显式设计，并讲清选了乐观锁/悲观锁/分布式锁中哪个、为什么。

**关联**：流量洪峰的保护也是同样分层——连接池限物理连接数，应用层并发信号量限排队请求数（见 [NestJS与Redis实战场景题](./NestJS与Redis实战场景题.md) 6.1 节，server/ 已实现 `DbSemaphore`）。

---

## 二、手写 SQL 题与参考答案

### 2.1 基础 + 聚合

**题 1：查询每个部门的平均工资，按平均工资降序排列。**

```sql
SELECT d.name AS dept_name,
       AVG(e.salary) AS avg_salary
FROM employees e
JOIN departments d ON e.dept_id = d.id
GROUP BY d.id, d.name
ORDER BY avg_salary DESC;
```

要点：MySQL 8.0 默认开启 `ONLY_FULL_GROUP_BY`，`SELECT` 中的非聚合字段 `d.name` 必须出现在 `GROUP BY` 中。

**题 2：统计每个部门的人数、最高工资、最低工资、平均工资。**

```sql
SELECT e.dept_id,
       d.name,
       COUNT(*) AS emp_cnt,
       MAX(e.salary) AS max_salary,
       MIN(e.salary) AS min_salary,
       AVG(e.salary) AS avg_salary
FROM employees e
JOIN departments d ON e.dept_id = d.id
GROUP BY e.dept_id, d.name;
```

要点：如果要求「没有员工的部门也要统计」，改成 `LEFT JOIN` 并用 `COUNT(e.id)` 代替 `COUNT(*)`，避免把空行算成 1。

**题 3：查询工资高于本部门平均工资的员工。**

窗口函数版本（推荐，只扫一次表）：

```sql
SELECT id, name, dept_id, salary
FROM (
    SELECT e.*,
           AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg
    FROM employees e
) t
WHERE salary > dept_avg;
```

相关子查询版本（直观，但每个员工执行一次子查询）：

```sql
SELECT e.*
FROM employees e
WHERE e.salary > (
    SELECT AVG(e2.salary)
    FROM employees e2
    WHERE e2.dept_id = e.dept_id
);
```

**题 4：查询没有员工的部门。**

```sql
SELECT d.*
FROM departments d
LEFT JOIN employees e ON d.id = e.dept_id
WHERE e.id IS NULL;
```

要点：用 `IS NULL` 判断左连接未匹配；注意 `NOT IN` 写法在子查询出现 `NULL` 时会得到错误结果，优先 `LEFT JOIN ... IS NULL` 或 `NOT EXISTS`。

### 2.2 分组 TopN + 排名

**题 5：查询每个部门工资最高的员工；并列最高都要返回。**

```sql
SELECT id, name, dept_id, salary
FROM (
    SELECT e.*,
           DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rk
    FROM employees e
) t
WHERE rk = 1;
```

要点：并列最高用 `DENSE_RANK`；`ROW_NUMBER` 会把并列工资强行排出 1、2，`RANK` 会跳号。

**题 6：查询每个部门工资排名前 2 的员工。**

```sql
SELECT id, name, dept_id, salary
FROM (
    SELECT e.*,
           DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rk
    FROM employees e
) t
WHERE rk <= 2;
```

要点：

- `DENSE_RANK`：并列工资同号，结果可能超过 2 人。
- `ROW_NUMBER`：强行排序，严格只取 2 人，但会人为拆散并列名次。
- 面试时要能说出两者区别，并根据业务语义选择。

**题 7：查询全公司第二高的工资；不存在第二高时返回 NULL。**

```sql
SELECT
  (SELECT DISTINCT salary
   FROM employees
   ORDER BY salary DESC
   LIMIT 1 OFFSET 1) AS second_highest;
```

等价写法：

```sql
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

要点：`DISTINCT` 保证并列工资算同一名次；没有第二高时标量子查询返回空集，结果自然为 `NULL`。

### 2.3 窗口函数 / 连续登录

**题 8：查询连续登录 3 天及以上的用户。**

```sql
SELECT DISTINCT user_id
FROM (
    SELECT user_id,
           DATE_SUB(login_date, INTERVAL rn DAY) AS grp
    FROM (
        SELECT user_id,
               login_date,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS rn
        FROM (
            SELECT DISTINCT user_id, login_date
            FROM login_log
        ) a
    ) b
) c
GROUP BY user_id, grp
HAVING COUNT(*) >= 3;
```

思路（连续问题的通用套路）：

1. 先 `DISTINCT` 去重，避免同一天多次登录干扰。
2. 按 `user_id` 分组、按日期升序给行号 `rn`。
3. `login_date - rn`：连续日期会得到相同的 `grp`，断一天 `grp` 就变。
4. 按 `user_id, grp` 分组，`COUNT(*)` 就是连续天数。

**题 9：计算每个用户的最大连续登录天数。**

```sql
SELECT user_id,
       MAX(consecutive_days) AS max_consecutive_days
FROM (
    SELECT user_id,
           grp,
           COUNT(*) AS consecutive_days
    FROM (
        SELECT user_id,
               DATE_SUB(login_date, INTERVAL rn DAY) AS grp
        FROM (
            SELECT user_id,
                   login_date,
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS rn
            FROM (
                SELECT DISTINCT user_id, login_date
                FROM login_log
            ) a
        ) b
    ) c
    GROUP BY user_id, grp
) d
GROUP BY user_id;
```

### 2.4 执行计划 / 优化

**题 10：为第 3 题设计索引，并说明 `EXPLAIN` 重点看什么、怎么判断是否回表。**

建议联合索引：

```sql
CREATE INDEX idx_dept_salary ON employees(dept_id, salary);
```

判断方法：

```sql
EXPLAIN
SELECT id, dept_id, salary
FROM employees e
WHERE salary > (
    SELECT AVG(salary)
    FROM employees e2
    WHERE e2.dept_id = e.dept_id
);
```

重点看：

- `type`：是否为 `ref` / `range`，`ALL` 表示全表扫描。
- `key`：是否命中 `idx_dept_salary`。
- `rows`：预估扫描行数是否明显下降。
- `Extra`：`Using index` 表示覆盖索引，无需回表；`Using filesort`、`Using temporary` 表示额外排序/临时表，要优化。

回表判断：走二级索引且 `Extra` 没有 `Using index` 时，通常需要回表取整行；如果查询字段全部包含在索引中，则不会回表。

---

## 三、面试速答话术

**Q：为什么 InnoDB 用 B+ 树而不是 B 树 / 哈希？**

B+ 树非叶子节点只存索引、不存数据，单页能装更多索引项，树更矮、IO 更少；叶子节点有序且用链表串联，天然适合范围查询和排序。哈希适合等值查询，但不支持范围、排序，且无法避免哈希冲突。

**Q：联合索引 `(a, b, c)` 哪些查询能走索引？**

能走：`a`、`a,b`、`a,b,c`，以及部分范围后的最左前缀；跳过最左列 `b`、`c` 单独查询通常走不了该索引。

**Q：RC 和 RR 的 MVCC 有什么区别？**

RC 每次读都创建新的 Read View，所以能读到其他事务已提交的新数据；RR 事务内首次读创建 Read View 后复用，保证同一事务多次读结果一致。

**Q：`WHERE` 和 `HAVING` 有什么区别？**

`WHERE` 在分组前过滤行，不能使用聚合函数；`HAVING` 在分组后过滤组，可以使用聚合函数。执行顺序：`WHERE` → `GROUP BY` → `HAVING`。

---

## 四、来源

- 阿里云开发者社区《MySQL 高频面试题》：MVCC、EXPLAIN 四字段（type/key/rows/Extra）
- CSDN《MySql 之 SQL 查询经典题目》：连续登录、部门最高工资、第二高薪水
- CSDN《MySQL 开窗函数 rank/dense_rank/row_number 区别详解》：窗口函数选型与 LeetCode 真题
- JavaGuide《MySQL 索引详解》：B+ 树、聚簇/二级索引、最左前缀、覆盖索引、索引失效
- 美团一面面经：MVCC、锁、间隙锁、`SELECT ... FOR UPDATE` 死锁场景
