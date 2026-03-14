import './dotenv-loader';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.USE_SQLITE === 'true') {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const allowedOrigin = config.get<string>('frontend.origin');
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      if (allowedOrigin && origin === allowedOrigin) return cb(null, true);
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(config.get<number>('port') ?? 5000);
}
bootstrap();
