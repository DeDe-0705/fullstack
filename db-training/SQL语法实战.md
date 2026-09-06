# SQL 语法实战

> 目标：系统掌握 SQL 常用语法，配合练习数据实战。训练环境见 `docker-compose.yml`（MySQL 8.0，`train_tx` 库）。

## 练习数据

```sql
USE train_tx;

CREATE TABLE departments (
  id   INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);
INSERT INTO departments VALUES
  (1, '技术部'), (2, '产品部'), (3, '运营部'), (4, '市场部');

CREATE TABLE employees (
  id            INT PRIMARY KEY,
  name          VARCHAR(50) NOT NULL,
  department_id INT NULL,
  salary        DECIMAL(10,2) NOT NULL,
  hire_date     DATE NOT NULL,
  city          VARCHAR(50)
);
INSERT INTO employees (id, name, department_id, salary, hire_date, city) VALUES
  (1, '张三', 1, 15000.00, '2020-01-15', '北京'),
  (2, '李四', 1, 12000.00, '2021-03-20', '上海'),
  (3, '王五', 2, 18000.00, '2019-07-01', '北京'),
  (4, '赵六', 2, 10000.00, '2022-05-10', '深圳'),
  (5, '孙七', 3, 9000.00,  '2023-02-01', '上海'),
  (6, '周八', NULL, 8000.00, '2023-09-15', '广州');
```

设计意图：**周八没有部门**（练 LEFT JOIN）、**市场部没有员工**（练 RIGHT JOIN）。

## 一、SQL 语法地图

| 模块 | 内容 | 关键词 |
|---|---|---|
| 1 | 查询基础 | `SELECT`、别名、`DISTINCT`、`LIMIT` |
| 2 | 条件过滤 | `WHERE`、`AND/OR`、`IN`、`BETWEEN`、`LIKE`、`IS NULL` |
| 3 | 排序 | `ORDER BY` |
| 4 | 聚合分组 | `COUNT/SUM/AVG/MAX/MIN`、`GROUP BY`、`HAVING` |
| 5 | 多表连接 | `INNER/LEFT/RIGHT JOIN` |
| 6 | 子查询 | 标量、`IN`、相关子查询 |
| 7 | 窗口函数 | `ROW_NUMBER/RANK/DENSE_RANK`、`PARTITION BY` |
| 8 | 执行顺序 | `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT` |

## 二、模块详解与练习题

### 模块 1-3：查询 / 过滤 / 排序

```sql
-- 1. 所有员工姓名和工资
SELECT name, salary FROM employees;
-- 2. 工资 > 10000
SELECT name FROM employees WHERE salary > 10000;
-- 3. 北京或上海（IN 多值）
SELECT * FROM employees WHERE city IN ('北京', '上海');
-- 4. 工资 10000~15000（BETWEEN 闭区间）
SELECT * FROM employees WHERE salary BETWEEN 10000 AND 15000;
-- 5. 姓张（LIKE）
SELECT * FROM employees WHERE name LIKE '张%';
-- 6. 没有部门（IS NULL）
SELECT * FROM employees WHERE department_id IS NULL;
-- 7. 按工资降序
SELECT * FROM employees ORDER BY salary DESC;
-- 8. 工资最高 3 人
SELECT * FROM employees ORDER BY salary DESC LIMIT 3;
```

要点：`IN` 用于「多个值」，单值用 `=`；`LIKE '张%'` 是「张开头」，`%` 是通配符。

### 模块 4：聚合 + GROUP BY + HAVING

```sql
-- 1. 总人数
SELECT COUNT(*) FROM employees;
-- 2. 平均、最高工资
SELECT AVG(salary), MAX(salary) FROM employees;
-- 3. 每部门人数（排除无部门的，用 WHERE 而不是 HAVING）
SELECT department_id, COUNT(*) FROM employees
WHERE department_id IS NOT NULL GROUP BY department_id;
-- 4. 每城市人数
SELECT city, COUNT(*) FROM employees GROUP BY city;
-- 5. 人数 ≥ 2 的城市（聚合条件用 HAVING）
SELECT city, COUNT(*) AS total FROM employees GROUP BY city HAVING total >= 2;
```

核心：**筛「行」用 WHERE（分组前），筛「组」用 HAVING（分组后）。**

### 模块 5：多表 JOIN

```sql
-- 1. 员工 + 部门名（INNER JOIN，自动排除周八）
SELECT e.name, d.name FROM employees e JOIN departments d ON e.department_id = d.id;
-- 2. 所有员工 + 部门名（LEFT JOIN，周八部门名 NULL）
SELECT e.name, d.name FROM employees e LEFT JOIN departments d ON e.department_id = d.id;
-- 3. 所有部门 + 员工（RIGHT JOIN，市场部员工 NULL）
SELECT * FROM employees e RIGHT JOIN departments d ON e.department_id = d.id;
-- 4. 技术部员工
SELECT e.name, d.name FROM employees e JOIN departments d ON e.department_id = d.id
WHERE d.name = '技术部';
```

铁律：**所有 JOIN 都用 `ON` 写连接条件，`WHERE` 写过滤条件**（INNER/LEFT/RIGHT 统一）。

### 模块 6：子查询

```sql
-- 1. 工资高于平均（标量子查询）
SELECT name, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);
-- 2. 有员工的部门名（IN 子查询）
SELECT name FROM departments WHERE id IN (SELECT department_id FROM employees);
-- 3. 每部门最高工资（相关子查询，关键在 WHERE e2.department_id = e1.department_id）
SELECT e1.name, e1.department_id, e1.salary FROM employees e1
WHERE e1.salary = (SELECT MAX(e2.salary) FROM employees e2
                   WHERE e2.department_id = e1.department_id);
```

**相关子查询**：子查询引用了外层列，外层每扫一行、子查询就重跑一次。缺关联条件会变成「全公司最高」，不是「每部门最高」。

### 模块 7：窗口函数

```sql
-- 1. 全表排名
SELECT name, salary, ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn FROM employees;
-- 2. 每部门内排名
SELECT name, department_id, salary,
       ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
FROM employees;
-- 3. 每部门最高（窗口函数结果要套子查询再 WHERE）
SELECT * FROM (
  SELECT name, department_id, salary,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rn
  FROM employees
) t WHERE rn = 1;
```

语法拆解：`函数名() OVER (PARTITION BY 分组 ORDER BY 排序)`。`PARTITION BY` 分组、`ORDER BY` 组内排序。

三兄弟区别（遇到并列时）：

| 函数 | 行为 | 例子 |
|---|---|---|
| `ROW_NUMBER()` | 强行连续编号 | 1,2,3,4,5 |
| `RANK()` | 并列同号、跳号 | 1,1,3,4 |
| `DENSE_RANK()` | 并列同号、不跳号 | 1,1,2,3 |

注意：`ROW_NUMBER()` 遇到并列最高会「丢一个」，要返回所有并列最高用 `DENSE_RANK()` + `WHERE dr = 1`。

## 三、执行顺序（模块 8）

书写顺序 ≠ 执行顺序。实际执行顺序：

```
① FROM     确定数据来源（表 + JOIN + ON）
② WHERE    过滤原始行
③ GROUP BY 分组
④ HAVING   过滤分组结果
⑤ SELECT   选列、算聚合、算窗口函数
⑥ DISTINCT 去重
⑦ ORDER BY 排序
⑧ LIMIT    截取前 N 行
```

执行顺序能解释的规则：

| 疑问 | 答案 |
|---|---|
| 为什么 `WHERE COUNT(*) > 2` 不行？ | 聚合在 ③ 之后，WHERE 在 ②，太早 |
| 为什么 WHERE 不能用别名？ | 别名在 ⑤ 才定义 |
| 为什么 HAVING 能用聚合？ | HAVING 在 ④，聚合已算完 |
| 为什么 ORDER BY 能用别名？ | ORDER BY 在 ⑦，别名已存在 |
| 为什么窗口函数不能在 WHERE？ | 窗口函数在 ⑤，WHERE 在 ② |

记忆口诀：**先 FROM 找表，再 WHERE 筛行，再 GROUP 分组，再 HAVING 筛组，再 SELECT 选列，再 DISTINCT 去重，再 ORDER 排序，最后 LIMIT 截断。**

## 四、关键踩坑点（2026-09-04 实战）

1. `IN` 多个值才用，单值用 `=`（曾漏掉「北京」）。
2. `JOIN` 必须 `ON`，不能 `JOIN ... WHERE`（曾把 INNER JOIN 写成 WHERE）。
3. 相关子查询必须加关联条件（曾漏 `e2.department_id = e1.department_id`）。
4. 筛行用 WHERE、筛组用 HAVING（`department_id IS NOT NULL` 该放 WHERE）。
5. `ROW_NUMBER` 并列会丢一个，并列最高用 `DENSE_RANK`。
6. 窗口函数结果不能在 WHERE 直接用，要套子查询。
7. 相关子查询 vs 窗口函数：并列最高时相关子查询返回全部、ROW_NUMBER 返回一个；性能上窗口函数通常更优，相关子查询依赖索引。
8. 函数套列导致索引失效：`DATE(col)`、`YEAR(col)`、`LOWER(name)`、`col + 1 > 100` 等都会让索引失效、全表扫描。

## 五、补充：条件聚合与 NULL 处理（打卡场景题）

### 条件聚合（CASE WHEN + 聚合函数）

场景：分类型取极值。比如打卡记录里「上班时间 = 所有 in 的 MIN，下班时间 = 所有 out 的 MAX」。

```sql
SELECT employee_id,
       MIN(CASE WHEN punch_type='in'  THEN punch_time END) AS check_in,
       MAX(CASE WHEN punch_type='out' THEN punch_time END) AS check_out
FROM attendance
GROUP BY employee_id;
```

精髓：`CASE WHEN` 把**不匹配的变成 `NULL`**，聚合函数**天然忽略 `NULL`**，等于"只对匹配的记录做聚合"。

### NULL 处理（IFNULL / COALESCE）

没有匹配记录时，条件聚合结果是 `NULL`，用 `COALESCE` 转默认值：

```sql
COALESCE(MAX(CASE WHEN punch_type='out' THEN punch_time END), '缺卡') AS check_out
```

- `IFNULL(x, '默认')`：MySQL 专用。
- `COALESCE(x, '默认')`：标准 SQL，取第一个非 NULL 的值，推荐。

### 函数套列 → 索引失效

```sql
-- ❌ 对列套函数，索引失效
WHERE DATE(punch_time) = '2026-09-04'
-- ✅ 列保持裸奔，范围比较走索引
WHERE punch_time >= '2026-09-04 00:00:00' AND punch_time < '2026-09-05 00:00:00'
```

铁律：**WHERE 里索引列上不要套任何函数或运算**，否则索引失效。

## 六、窗口函数全景（扩展）

窗口函数远不止排名三兄弟，分三大类：

| 类别 | 函数 | 作用 |
|---|---|---|
| 排名类 | `ROW_NUMBER` / `RANK` / `DENSE_RANK` / `NTILE` / `PERCENT_RANK` / `CUME_DIST` | 编号、排名、分桶 |
| 聚合窗口 | `SUM` / `AVG` / `MAX` / `MIN` / `COUNT` + `OVER` | 累计、移动、分组内聚合（不压缩行） |
| 取值类 | `LAG` / `LEAD` / `FIRST_VALUE` / `LAST_VALUE` / `NTH_VALUE` | 取前一行/后一行/第一个/最后一个 |

### 累计求和（聚合窗口）

```sql
SELECT name, salary,
       SUM(salary) OVER (ORDER BY id) AS running_total
FROM employees;
```

每行的 `running_total` 是「从第一行累加到当前行」的总和，`GROUP BY` 做不出来。

### LAG 取上一行（取值类）

```sql
SELECT name, hire_date, salary,
       LAG(salary, 1) OVER (ORDER BY hire_date) AS prev_salary
FROM employees;
```

`LAG(col, n)` 取按排序后「前 n 行」的值，用于环比、连续登录天数、相邻行比较。

### NTILE 分桶（排名类）

```sql
SELECT name, salary,
       NTILE(4) OVER (ORDER BY salary DESC) AS quartile
FROM employees;
```

`NTILE(n)` 把结果平均分成 n 组，常用于 Top N%、四分位统计。

### 窗口帧（Window Frame）

聚合窗口函数可用 `ROWS BETWEEN` 定义窗口的精确范围：

```sql
-- 移动平均：当前行 + 前 2 行，共 3 行
SELECT name, salary,
       AVG(salary) OVER (ORDER BY id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS moving_avg
FROM employees;
```

- `UNBOUNDED PRECEDING`：从第一行到当前行（累计）
- `2 PRECEDING`：前 2 行（移动窗口）

### 本质

窗口函数 = **保留每一行，同时基于「当前行相关的一个窗口（分区 + 排序 + 范围）」做计算**。排名、累计、取前后行、移动平均，都是这个本质的不同应用。
