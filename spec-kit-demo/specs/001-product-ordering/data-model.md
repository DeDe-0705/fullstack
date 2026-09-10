# Data Model: 商品下单

## 表结构

### products（商品）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | 商品标识（如 `p-1`），种子数据预置 |
| name | TEXT | NOT NULL | 商品名称 |
| stock | INTEGER | NOT NULL, CHECK (stock >= 0) | 当前库存；CHECK 约束为「库存非负」的数据库层兜底 |

- 校验规则（来自 FR-004）：stock 任何时刻 >= 0，扣减只能经条件更新进行。
- 无 UPDATE/DELETE 入口（商品管理后台在范围外），仅种子初始化与下单扣减会写。

### orders（订单）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | 订单标识（服务端生成，如 `ord-<uuid>`） |
| request_id | TEXT | NOT NULL, UNIQUE | 幂等键（调用方生成）；唯一索引兜底防重复下单 |
| product_id | TEXT | NOT NULL, REFERENCES products(id) | 所购商品 |
| quantity | INTEGER | NOT NULL, CHECK (quantity > 0) | 购买数量（FR-006：正整数） |
| remaining_stock | INTEGER | NOT NULL, CHECK (remaining_stock >= 0) | 本订单扣减完成时刻的库存快照（非实时库存，FR-009） |
| created_at | TEXT | NOT NULL | ISO 8601 创建时间 |

- 唯一性规则：一个 request_id 最多对应一行订单（FR-007 的数据库层保证）。
- 状态机：无。订单创建即终态（支付/取消在范围外）。

## 关键写入路径（不变量落点）

```text
事务开始
  1. UPDATE products SET stock = stock - :qty
     WHERE id = :pid AND stock >= :qty     -- changes = 0 → 库存不足，整体回滚
  2. INSERT INTO orders (...)              -- request_id 唯一冲突 → 整体回滚
事务提交
```

- 两步写同事务：杜绝「扣了库存没订单」中间态（研究 D5）。
- remaining_stock 在事务内取扣减后的 stock 值写入，即「扣减完成时刻的快照」。

## 种子数据

| id | name | stock |
|---|---|---|
| p-1 | 机械键盘 | 10 |
| p-2 | 降噪耳机 | 5 |
| p-3 | 限量手办 | 1 |

（p-3 库存为 1，专供并发抢购与库存不足场景演示。）
