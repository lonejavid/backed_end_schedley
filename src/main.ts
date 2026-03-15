import './dotenv-loader';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';

export async function bootstrap(): Promise<INestApplication> {
  const useSqlite = process.env.USE_SQLITE === 'true';
  console.log('[Schedley] Connecting to database...', useSqlite ? '(SQLite)' : '(PostgreSQL)');
  if (useSqlite) {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  }
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  console.log('[Schedley] Database connected, API ready');
  const config = app.get(ConfigService);
  const frontendOrigin = config.get<string>('frontend.origin');
  const baseOrigins = ['https://schedley.com', 'https://www.schedley.com', 'http://localhost:3000'];
  const allowedOrigins = [
    ...baseOrigins,
    ...(frontendOrigin && !baseOrigins.includes(frontendOrigin) ? [frontendOrigin] : []),
  ];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  return app;
}

// Cached app for Vercel serverless (single function)
let appPromise: Promise<INestApplication> | null = null;
function getApp(): Promise<INestApplication> {
  if (!appPromise) appPromise = bootstrap();
  return appPromise;
}

// Default export for Vercel: must be a function or server
export default async (req: any, res: any): Promise<void> => {
  const app = await getApp();
  const expressApp = app.getHttpAdapter().getInstance();
  return new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve());
    res.on('error', reject);
    expressApp(req, res);
  });
};

// When run directly (e.g. node dist/main.js), start the HTTP server
if (require.main === module) {
  bootstrap().then((app) => {
    const config = app.get(ConfigService);
    // Vercel sets PORT; otherwise use config or default
    const port = Number(process.env.PORT) || (config.get<number>('port') ?? 5000);
    return app.listen(port).then(() => {
      console.log(`[Schedley] Listening on port ${port}`);
    });
  }).catch((err) => {
    console.error('[Schedley] Failed to start:', err?.message ?? err);
    process.exit(1);
  });
}
