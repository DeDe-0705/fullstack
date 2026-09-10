# Quickstart: 商品下单端到端验证

## 前置

- Node.js 20+、pnpm
- 依赖安装：`pnpm install`

## 启动

```bash
pnpm dev        # tsx watch 启动，默认 http://localhost:3000
```

启动后自动建表并写入种子数据（见 data-model.md：p-1 键盘×10、p-2 耳机×5、p-3 手办×1）。

## 手动验证场景

### 场景 1：浏览商品（US2）

```bash
curl http://localhost:3000/api/products
curl http://localhost:3000/api/products/p-1
```

预期：列表含 3 件商品及库存；单商品返回 `{"id":"p-1","name":"机械键盘","stock":10}`。

### 场景 2：正常下单（US1）

```bash
curl -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-req-001' \
  -d '{"productId":"p-1","quantity":2}'
```

预期：201，响应含 `remainingStock: 8`；再次 `curl /api/products/p-1` 库存为 8。

### 场景 3：库存不足（FR-005）

```bash
curl -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: demo-req-002' \
  -d '{"productId":"p-3","quantity":2}'
```

预期：409，`error.code = INSUFFICIENT_STOCK`，message 为「库存不足」；
p-3 库存仍为 1。

### 场景 4：幂等重放（US3）

重复执行场景 2 的同一请求（同一 Idempotency-Key）。

预期：第二次返回 200 且响应体与首次完全一致；p-1 库存不再变化。

### 场景 5：缺少请求标识（FR-010）

```bash
curl -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"productId":"p-1","quantity":1}'
```

预期：400，`error.code = MISSING_REQUEST_ID`。

### 场景 6：订单详情（US1）

```bash
curl http://localhost:3000/api/orders/<场景2返回的orderId>
```

预期：200，含 productId、quantity、remainingStock（快照值）。

## 自动化验证（宪法 DoD）

```bash
pnpm test        # Vitest：单元 + inject 接口测试（含并发抢购用例）
pnpm typecheck   # tsc --noEmit
```

两条命令全绿 = 特性完成。
