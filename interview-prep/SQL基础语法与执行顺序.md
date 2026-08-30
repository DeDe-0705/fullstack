# SQL 基础语法与执行顺序

> 面向「能写 SQL」的地基：从 SELECT 骨架、执行顺序，一路到聚合、子查询、JOIN、窗口函数。以 MySQL 为例，练习数据统一用 `employees` / `departments` 两张表（与《MySQL 高频考点与手写 SQL》保持一致）。

```sql
-- 员工表
employees(id, name, dept_id, salary, hire_date)

-- 部门表
departments(id, name)
```

练习数据（注意两个「孤儿」：郑十没部门、运营没员工，专门用来区分 JOIN 类型）：

```
employees：
1, 张三, 1,   30000, 2021-01-15
2, 李四, 1,   28000, 2021-03-20
3, 王五, 2,   25000, 2022-05-10
4, 赵六, 2,   22000, 2022-07-01
5, 孙七, 3,   35000, 2020-11-11
6, 周八, 3,   32000, 2021-06-06
7, 吴九, 1,   18000, 2023-02-02
8, 郑十, NULL,20000, 2023-08-08   -- 没部门

departments：
1, 研发
2, 测试
3, 产品
4, 运营   -- 没员工
```

---

## 一、SQL 的核心心智：执行顺序（8 步流水线）

SQL 是**声明式语言**：你写的是「想要什么」，数据库按固定顺序一步步加工数据。理解执行顺序，是写对复杂 SQL、解释各种报错的根基。

### 1.1 书写顺序 vs 执行顺序

书写顺序（我们习惯这么写）：

```sql
SELECT   列              -- 6
FROM     表              -- 1
WHERE    条件            -- 2
GROUP BY 分组列          -- 3
HAVING   分组后条件      -- 4
ORDER BY 排序列          -- 7
LIMIT    数量;           -- 8
```

但数据库**真正的执行顺序**是：

```
1. FROM + JOIN   → 确定数据来源，把多张表关联成一张「宽表」
2. WHERE         → 过滤「行」（分组前）
3. GROUP BY      → 分组
4. HAVING        → 过滤「组」（分组后）
5. 窗口函数       → 计算 OVER()，给每行附加统计列
6. SELECT        → 选列、算表达式、DISTINCT 去重、起别名
7. ORDER BY      → 排序
8. LIMIT         → 截取
```

画面感：**数据像水一样，从 FROM 流到 LIMIT，每一步都在过滤或变形它。**

### 1.2 每一步能做什么、不能做什么

| 阶段 | 作用 | 能用什么 | 不能用什么 |
|---|---|---|---|
| ① FROM + JOIN | 拼出数据源 | 表、连接条件 | — |
| ② WHERE | 过滤行 | 原始列 | 聚合函数、SELECT 别名 |
| ③ GROUP BY | 分组 | 分组列、组合键 | 聚合函数 |
| ④ HAVING | 过滤组 | 聚合函数 | 行的原始列（未分组） |
| ⑤ 窗口函数 | 附加统计列 | OVER() | 不能直接在 WHERE 用其结果 |
| ⑥ SELECT | 选列/别名/去重 | 表达式、别名 | — |
| ⑦ ORDER BY | 排序 | SELECT 的别名 | — |
| ⑧ LIMIT | 截取 | 数字 | — |

### 1.3 逻辑顺序 vs 物理执行

这套顺序是**逻辑顺序**——SQL 标准规定的「结果必须等价于这么执行」。实际跑的时候，MySQL 优化器会根据索引、统计信息**打乱物理执行顺序**（如提前走索引过滤），但保证结果一致。

结论：**写 SQL 按逻辑顺序思考，调优时看 EXPLAIN 理解真实执行**，两件事别混。

---

## 二、基础查询四件套

### 2.1 SELECT + 别名

`SELECT` 后面每一项 = 「要输出的一个列」，可以是原始列，也可以是**表达式/函数算出来的值**。

```sql
SELECT name AS 姓名, salary * 1.2 AS 涨薪后 FROM employees;
```

`AS` 只影响结果列的**显示名字**，不影响计算。

### 2.2 WHERE 条件运算符

```sql
-- =  <  >  <=  >=  <>（不等于）  BETWEEN  IN  LIKE  IS NULL
SELECT * FROM employees WHERE salary BETWEEN 20000 AND 30000; -- 闭区间
SELECT * FROM employees WHERE dept_id IN (1, 3);
SELECT * FROM employees WHERE name LIKE '张%';   -- % 任意多个字符，_ 单个字符
SELECT * FROM employees WHERE dept_id IS NULL;   -- 判断 NULL 必须用 IS
```

关键：**`NULL` 不能用 `= NULL` 判断**。`NULL = NULL` 的结果是 UNKNOWN（不是 true 也不是 false），必须用 `IS NULL` / `IS NOT NULL`。

### 2.3 ORDER BY 多列排序

```sql
SELECT name, dept_id, salary FROM employees
ORDER BY dept_id ASC, salary DESC;  -- 先部门升序，部门内工资降序
```

### 2.4 LIMIT 分页

```sql
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3;      -- 前 3
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3, 2;   -- 跳过 3 条取 2 条
```

### 2.5 DISTINCT 去重

```sql
SELECT DISTINCT dept_id FROM employees;
-- 结果：1, 2, 3, NULL（多个 NULL 去重成一个 NULL）
```

关键：**`DISTINCT` 会把所有 NULL 视为同一个值**，最终保留一行 NULL。去重要靠 `DISTINCT`，`IS NOT NULL` 是「过滤空值」，两者不是一回事。

---

## 三、聚合 + GROUP BY + HAVING

### 3.1 聚合函数

| 函数 | 含义 | 类比 JS |
|---|---|---|
| `AVG(列)` | 平均值 | 数组求平均 |
| `SUM(列)` | 求和 | `reduce((a,b)=>a+b)` |
| `COUNT(*)` | 行数 | `arr.length` |
| `MAX(列)` | 最大值 | `Math.max(...arr)` |
| `MIN(列)` | 最小值 | `Math.min(...arr)` |

注意：`COUNT(*)` 数**行数**，`COUNT(列)` 数**该列非 NULL 的个数**，遇 NULL 结果不同。

### 3.2 GROUP BY 的本质：把相同值的行摞成一组

`GROUP BY dept_id` = 把相同 `dept_id` 的行归成一堆，聚合函数再对每一堆做计算。分组后，输出从「行」变成「组」，每个组浓缩成一行。

```sql
SELECT dept_id,
       AVG(salary) AS avg_salary,
       COUNT(*)   AS emp_cnt
FROM employees
GROUP BY dept_id;
```

### 3.3 分组铁律

> `SELECT` 里出现的列，要么在 `GROUP BY` 里，要么被聚合函数包着，否则报 `ONLY_FULL_GROUP_BY`。

原因：分组后每个组只剩一行代表，组内多个不同值（如多个 `name`）无法确定显示哪个。

### 3.4 GROUP BY 多列 = 组合键

`GROUP BY a, b` 是**按 (a, b) 这个组合分组**，两行只有 a、b 都相同才算同一组，不是「分两组」。

```sql
SELECT city, category, SUM(amount)
FROM orders
GROUP BY city, category;
-- 按 (city, category) 组合分组，组数 = 不同组合的个数
```

### 3.5 WHERE vs HAVING

```sql
SELECT dept_id, AVG(salary) AS avg_salary
FROM employees
WHERE salary > 20000          -- 分组前过滤「行」
GROUP BY dept_id
HAVING AVG(salary) > 28000;   -- 分组后过滤「组」
```

一句话：**WHERE 过滤行（分组前），HAVING 过滤组（分组后），聚合函数只能出现在分组后（HAVING/SELECT/ORDER BY），不能出现在 WHERE 里。**

---

## 四、子查询

子查询 = 查询里再套一个查询，里面的结果给外面用。

### 4.1 按返回结果分类

| 类型 | 返回什么 | 放在哪 | 搭配 |
|---|---|---|---|
| 标量子查询 | 单个值（1 行 1 列） | 比较符后面 | `= > < >= <=` |
| 列子查询 | 一列多行 | `WHERE` | `IN` / `ANY` / `ALL` |
| 表子查询 | 一张表 | `FROM` 后当临时表 | 起别名再查 |

### 4.2 相关 vs 非相关

- **非相关子查询**：内层独立算一次，结果给外层用。
- **相关子查询**：内层引用外层列，外层每看一行，内层重算一次。

```sql
-- 相关子查询：查工资高于本部门平均的员工
SELECT name, salary FROM employees e
WHERE salary > (
    SELECT AVG(salary) FROM employees e2
    WHERE e2.dept_id = e.dept_id
);
```

### 4.3 IN / NOT IN / EXISTS

`IN`：值在集合里。`EXISTS`：只判断子查询**有没有返回至少一行**，不关心返回什么值。

### 4.4 重点大坑：NOT IN 遇到 NULL 会翻车

查「没有员工的部门」，直觉写法：

```sql
SELECT name FROM departments
WHERE id NOT IN (SELECT dept_id FROM employees);
-- 子查询返回 1,1,1,2,2,3,3,NULL（郑十的 NULL 混进来）
```

结果是**空**，连该返回的「运营」都没了。原因：`NOT IN` 等价于 `id <> 1 AND id <> 2 AND ... AND id <> NULL`，而 `id <> NULL` 永远 UNKNOWN，导致整行被吞。

正确写法（不受 NULL 影响）：

```sql
-- 写法一：NOT EXISTS（推荐）
SELECT name FROM departments d
WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.dept_id = d.id
);

-- 写法二：LEFT JOIN ... IS NULL
SELECT d.name FROM departments d
LEFT JOIN employees e ON d.id = e.dept_id
WHERE e.id IS NULL;
```

一句话：**只要子查询结果里混进 NULL，`NOT IN` 就全军覆没，用 `NOT EXISTS` 或 `LEFT JOIN ... IS NULL` 更稳。**

---

## 五、JOIN

JOIN = 把两张表按关联条件「横着拼」成一张宽表。核心是搞清楚「以哪张表为主」和「匹配不上的行怎么办」。

### 5.1 四种类型

| 类型 | 返回什么 | 谁可能补 NULL |
|---|---|---|
| `INNER JOIN` | 两边都匹配上的行 | 无 |
| `LEFT JOIN` | 左表全保留 + 右表匹配的行 | 右表 |
| `RIGHT JOIN` | 右表全保留 + 左表匹配的行 | 左表 |
| `FULL OUTER JOIN` | 两边全保留 | 两边（MySQL 需 UNION 模拟） |

```sql
-- 所有员工 + 部门名（含没部门的郑十，部门名 NULL）
SELECT e.name, d.name AS dept_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id;
```

### 5.2 LEFT JOIN + IS NULL：找「左表独有」

```sql
-- 没有员工的部门
SELECT d.name FROM departments d
LEFT JOIN employees e ON d.id = e.dept_id
WHERE e.id IS NULL;   -- 右表没匹配上的行
```

套路：**左表是全的，右表没匹配上的行 `IS NULL`，就是左表独有的。**

### 5.3 重点坑：ON 和 WHERE 的区别

对 `INNER JOIN` 两者效果一样；对 `LEFT JOIN` 有本质区别。

```sql
-- 条件放 ON：左表全保留，只影响右表匹配
SELECT e.name, d.name AS dept_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id AND d.name = '研发';
-- 结果：所有员工都在，非研发的部门名是 NULL

-- 条件放 WHERE：连接后过滤整行，把 LEFT JOIN 退化成 INNER JOIN
SELECT e.name, d.name AS dept_name
FROM employees e
LEFT JOIN departments d ON e.dept_id = d.id
WHERE d.name = '研发';
-- 结果：只剩研发 3 人
```

一句话：**想「保留左表全部 + 只影响右表匹配」条件放 ON；想「过滤最终结果」条件放 WHERE。**

---

## 六、窗口函数

### 6.1 窗口函数 vs GROUP BY

- `GROUP BY` + 聚合：把多行**压成一行**，行数变少。
- **窗口函数**：**不减少行数**，只是给每一行「旁边多算出一列」。

### 6.2 ROW_NUMBER() OVER(...)

```sql
ROW_NUMBER() OVER (
    PARTITION BY conversation_id      -- 分区：每个会话独立编号
    ORDER BY created_at DESC          -- 组内排序：最新排第 1
) AS rn
```

- `ROW_NUMBER()`：给每行发序号 1、2、3…
- `PARTITION BY`：按什么分组，各组独立从 1 开始编号。
- `ORDER BY`：组内按什么排序。
- `rn`：别名，表示「组内排名」，名字任意。

### 6.3 分组 TopN（高频真题）

查「每个会话最新一条消息」：

```sql
SELECT *
FROM (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY conversation_id
               ORDER BY created_at DESC
           ) AS rn
    FROM messages
    WHERE created_at >= '2026-08-01'
) t
WHERE rn = 1;
```

### 6.4 为什么要套子查询

窗口函数在 `WHERE` **之后**才算出来（见执行顺序第 ⑤ 步），所以 `WHERE rn = 1` 必须放到外层，先在子查询里算好 `rn`。

预告：同族还有 `RANK`（并列跳号）、`DENSE_RANK`（并列不跳号），遇到「并列工资」再展开。

---

## 七、踩坑清单（统一用执行顺序解释）

| 坑 | 原因（都在执行顺序） |
|---|---|
| `WHERE` 里不能放 `AVG(salary)` | WHERE 在 GROUP BY 之前，还没分组 |
| `HAVING` 里能用聚合函数 | HAVING 在 GROUP BY 之后 |
| `WHERE rn = 1` 报错 | 窗口函数在 WHERE 之后，只能套子查询 |
| `WHERE` 不能用 `AS` 别名 | 别名在 SELECT 才生效，WHERE 太早 |
| `ORDER BY` 能用别名 | ORDER BY 在 SELECT 之后 |
| `NOT IN` 遇 NULL 返回空 | `id <> NULL` 恒 UNKNOWN |
| `SELECT *` + `GROUP BY` 矛盾 | 分组后其他列无法确定取哪行 |
| `= NULL` 判断错误 | NULL 比较恒 UNKNOWN，用 IS NULL |

---

## 八、经典题型

- 每个部门平均工资 / 人数 / 最高工资（GROUP BY + 聚合）
- 工资高于本部门平均的员工（相关子查询 / 窗口函数）
- 没有员工的部门（LEFT JOIN ... IS NULL / NOT EXISTS）
- 第二高工资（`ORDER BY ... LIMIT 1 OFFSET 1` 或 MAX 子查询）
- 平均工资最高的部门（JOIN + GROUP BY + ORDER BY + LIMIT）
- 每个会话最新消息 / 每个部门前 2（窗口函数 ROW_NUMBER）

---

## 九、来源

- 阿里云开发者社区《MySQL 高频面试题》：EXPLAIN、索引优化、MVCC
- CSDN《SQL 常见面试题（基础+进阶+优化）》：连续登录、窗口函数、NOT IN 陷阱
- JavaGuide《MySQL 索引详解》：B+ 树、最左前缀、覆盖索引
- 字节/美团数据分析面经：窗口函数连续登录、分组 TopN
