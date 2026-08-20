import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // 演示项目用 Node 内置能力加载 .env，避免引入 dotenv 依赖
  try {
    process.loadEnvFile();
  } catch {
    // .env 不存在时使用系统环境变量
  }
  const app = await NestFactory.create(AppModule);
  // 全局 DTO 校验：whitelist 剥离未声明字段，transform 把 body 转成 DTO 类实例
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // CORS 由 CorsMiddleware 手写实现（见 middleware/cors.middleware.ts），不再用内置 enableCors
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
