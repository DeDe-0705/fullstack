// 独立成文件而不是放在 redis.module.ts：lock.service 也要引用这个 token，
// 放在 module 里会形成 redis.module → lock.service → redis.module 的循环引用
export const REDIS_CLIENT = 'REDIS_CLIENT';
