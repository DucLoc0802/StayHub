import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/errors';
import { validationException } from './common/validation';
import {
  RuntimeConfigError,
  validateRuntimeConfig,
} from './common/runtime-config';
import { ProductionLogger } from './common/production-logger';

async function bootstrap() {
  const runtime = validateRuntimeConfig(process.env);
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    ...(process.env.NODE_ENV === 'production'
      ? { logger: new ProductionLogger() }
      : {}),
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: runtime.origin,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  const config = new DocumentBuilder()
    .setTitle('StayHub API')
    .setDescription(
      'Nền tảng đặt chỗ nghỉ tại TP. Hồ Chí Minh. Thanh toán mô phỏng cho đồ án; không phát sinh giao dịch tiền thật.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}
void bootstrap().catch((error: unknown) => {
  // Startup exceptions can include database connection strings; do not emit them.
  console.error(
    error instanceof RuntimeConfigError
      ? error.message
      : 'StayHub startup failed. Check database availability and runtime configuration.',
  );
  process.exitCode = 1;
});
