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
  const port = config.get<number>('port') ?? 5000;
  if (!process.env.VERCEL) {
    await app.listen(port);
    console.log(`[Schedley] Listening on port ${port}`);
  }
  return app;
}

// Vercel serverless: export a handler that forwards (req, res) to the Nest app. APIs only respond after DB is connected.
const appPromise = bootstrap();

function handler(req: { url?: string; method?: string; headers?: Record<string, string | string[] | undefined> } & unknown, res: unknown): void {
  let url = (req.url ?? '').split('?')[0];
  const method = (req.method ?? 'GET').toUpperCase();
  // Vercel rewrite sends original path as __path query param (see scripts/vercel-build.js)
  const rawUrl = req.url ?? '';
  const pathMatch = rawUrl.includes('__path=') && rawUrl.match(/[?&]__path=([^&]*)/);
  if (pathMatch) {
    try {
      url = decodeURIComponent(pathMatch[1]);
    } catch {
      url = pathMatch[1];
    }
    if (url && !url.startsWith('/')) url = '/' + url;
    // Strip __path from query so Express doesn't see it
    const q = rawUrl.indexOf('?');
    if (q >= 0) {
      const params = new URLSearchParams(rawUrl.slice(q));
      params.delete('__path');
      const rest = params.toString();
      req.url = url + (rest ? '?' + rest : '');
    } else {
      req.url = url;
    }
  }
  // Ensure /api prefix for routes that don't have it
  if (url && !url.startsWith('/api')) {
    const base = '/api' + (url.startsWith('/') ? url : '/' + url);
    const q = (req.url ?? '').indexOf('?');
    req.url = q >= 0 ? base + (req.url as string).slice(q) : base;
  }
  appPromise
    .then((app) => {
      const expressApp = app.getHttpAdapter().getInstance();
      expressApp(req, res);
    })
    .catch((err) => {
      console.error('[Schedley] Database connection failed, API not ready:', err?.message ?? err);
      const resObj = res as { statusCode?: number; setHeader?: (a: string, b: string) => void; end?: (s: string) => void };
      if (resObj.setHeader) resObj.setHeader('Content-Type', 'application/json');
      if (typeof resObj.statusCode !== 'undefined') resObj.statusCode = 503;
      if (resObj.end) resObj.end(JSON.stringify({ status: 'error', message: 'Service unavailable (database not connected)' }));
    });
}

if (process.env.VERCEL) {
  (module as NodeModule & { exports: typeof handler }).exports = handler;
}
