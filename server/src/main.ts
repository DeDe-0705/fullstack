import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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

  // Swagger 文档：/api-docs 在线查看/调试；addBearerAuth 对应 TokenGuard 的 Bearer token
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Agent Demo API')
    .setDescription('出入预约系统 AI 助手后端接口')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
