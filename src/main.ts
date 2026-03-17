import './dotenv-loader';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const useSqlite = process.env.USE_SQLITE === 'true';
  console.log(
    '[Schedley] Connecting to database...',
    useSqlite ? '(SQLite)' : '(PostgreSQL)',
  );
  if (useSqlite) {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  console.log('[Schedley] Database connected, API ready');
  const config = app.get(ConfigService);
  const port = Number(process.env.PORT) || (config.get<number>('port') ?? 8000);
  const frontendOrigin = config.get<string>('frontend.origin');
  const baseOrigins = [
    'https://schedley.com',
    'https://www.schedley.com',
    'http://localhost:3000',
  ];
  const allowedOrigins = [
    ...baseOrigins,
    ...(frontendOrigin && !baseOrigins.includes(frontendOrigin)
      ? [frontendOrigin]
      : []),
  ];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.listen(port);
  console.log(`[Schedley] Listening on port ${port}`);
}
bootstrap().catch((err) => {
  console.error('[Schedley] Failed to start:', err?.message ?? err);
  process.exit(1);
});
