import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务异常：逻辑可预见的失败（用户名已存在、库存不足等），与系统故障区分。
 *
 * 约定：HTTP 状态码仍返回 200，真正的错误语义由响应体里的业务码 code 表达，
 * 与 ResponseInterceptor 的统一格式 { code, data, message, trace_id } 配套。
 * 前端只需判断 code === 0 即成功，非 0 直接展示 message。
 */
export class BusinessException extends HttpException {
  constructor(
    /** 业务码：建议按模块分段，如 100xx 用户、200xx 会话 */
    public readonly bizCode: number,
    message: string,
    /** 需要语义化 HTTP 状态时可覆盖（如鉴权类仍用 401/403） */
    public readonly httpStatus: HttpStatus = HttpStatus.OK,
  ) {
    super(message, httpStatus);
  }
}
