import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  for (const k of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'REDIS_URL', 'S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET_PRIVATE', 'S3_BUCKET_PUBLIC']) {
    if (!process.env[k]) throw new Error(`Missing required env var ${k}`);
  }
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1); // real client IP behind Nginx
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: process.env.APP_URL, credentials: true });
  await app.listen(3000);
}
bootstrap();
