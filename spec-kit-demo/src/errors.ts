// 统一错误响应格式见 specs/001-product-ordering/contracts/api.md：
// { error: { code, message } }，code 供程序判断，message 供人阅读
export interface ErrorBody {
  error: { code: string; message: string };
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ProductNotFoundError extends AppError {
  constructor(productId: string) {
    super(404, 'PRODUCT_NOT_FOUND', `商品不存在: ${productId}`);
  }
}

export class InsufficientStockError extends AppError {
  constructor() {
    // message 固定为「库存不足」：spec FR-005 的明确要求
    super(409, 'INSUFFICIENT_STOCK', '库存不足');
  }
}

export class MissingRequestIdError extends AppError {
  constructor() {
    super(400, 'MISSING_REQUEST_ID', '缺少请求标识（Idempotency-Key）');
  }
}

export class InvalidQuantityError extends AppError {
  constructor() {
    super(400, 'INVALID_QUANTITY', '购买数量必须为正整数');
  }
}

export class OrderNotFoundError extends AppError {
  constructor(orderId: string) {
    super(404, 'ORDER_NOT_FOUND', `订单不存在: ${orderId}`);
  }
}

export class RequestIdMismatchError extends AppError {
  constructor() {
    super(409, 'REQUEST_ID_MISMATCH', '该请求标识已被不同的请求体使用');
  }
}

export function toErrorBody(err: AppError): ErrorBody {
  return { error: { code: err.code, message: err.message } };
}
