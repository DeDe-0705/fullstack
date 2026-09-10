# API Contracts: 商品下单

统一约定：

- 所有接口路径以 `/api` 为前缀；请求/响应体均为 JSON。
- 错误响应统一格式：`{ "error": { "code": "<错误码>", "message": "<人类可读提示>" } }`。
- 下单接口的请求标识经 `Idempotency-Key` 请求头传递（研究 D4）。

## 1. 查询商品列表

`GET /api/products`

**响应 200**

```json
{
  "products": [
    { "id": "p-1", "name": "机械键盘", "stock": 10 }
  ]
}
```

## 2. 查询单个商品

`GET /api/products/:id`

**响应 200**

```json
{ "id": "p-1", "name": "机械键盘", "stock": 10 }
```

**错误**

| 状态码 | code | 触发条件 |
|---|---|---|
| 404 | `PRODUCT_NOT_FOUND` | 商品不存在，message 明确提示商品不存在 |

## 3. 提交订单

`POST /api/orders`

**请求头**: `Idempotency-Key: <调用方生成的唯一标识，如 UUID>`（必填）

**请求体**

```json
{ "productId": "p-1", "quantity": 2 }
```

**响应 201（首次下单成功）**

```json
{
  "orderId": "ord-3f9c...",
  "productId": "p-1",
  "quantity": 2,
  "remainingStock": 8,
  "createdAt": "2026-09-08T12:00:00.000Z"
}
```

- `remainingStock`：本订单扣减完成时刻的库存快照（FR-009），非实时库存。

**重放语义（研究 D7）**

- 同 `Idempotency-Key` + 相同请求体再次提交 → **200** + 与首次完全相同的响应体
  （不再扣库存、不新建订单）。
- 同 `Idempotency-Key` + 不同请求体（productId/quantity 不一致）→ **409**
  `REQUEST_ID_MISMATCH`。
- 首次因库存不足失败的请求，同标识重放返回相同的失败结果（409 `INSUFFICIENT_STOCK`）。

**错误**

| 状态码 | code | 触发条件 |
|---|---|---|
| 400 | `MISSING_REQUEST_ID` | 未携带 Idempotency-Key，message 明确提示缺少请求标识（FR-010） |
| 400 | `INVALID_QUANTITY` | quantity 非正整数（FR-006） |
| 404 | `PRODUCT_NOT_FOUND` | 商品不存在 |
| 409 | `INSUFFICIENT_STOCK` | 库存不足，message 为「库存不足」（FR-005）；库存不变、不建订单 |
| 409 | `REQUEST_ID_MISMATCH` | 同标识但请求体不同 |

## 4. 查询订单详情

`GET /api/orders/:id`

**响应 200**

```json
{
  "orderId": "ord-3f9c...",
  "productId": "p-1",
  "quantity": 2,
  "remainingStock": 8,
  "createdAt": "2026-09-08T12:00:00.000Z"
}
```

**错误**

| 状态码 | code | 触发条件 |
|---|---|---|
| 404 | `ORDER_NOT_FOUND` | 订单不存在 |

## 契约 → 需求映射

| 契约 | 覆盖的功能需求 / 用户故事 |
|---|---|
| GET /api/products、GET /api/products/:id | FR-001、FR-002（US2） |
| POST /api/orders 201 | FR-003、FR-004、FR-009（US1） |
| 409 INSUFFICIENT_STOCK | FR-005、FR-008（US1 边界、US4） |
| 400 MISSING_REQUEST_ID | FR-010（澄清 1） |
| 400 INVALID_QUANTITY | FR-006 |
| 200 重放 / 唯一约束 | FR-007（US3） |
| GET /api/orders/:id | FR-009（US1） |
