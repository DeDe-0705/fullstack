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
  // CORS 白名单从环境变量读，未配置时仅允许本地前端开发地址
  const origins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173'];
  app.enableCors({ origin: origins });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
