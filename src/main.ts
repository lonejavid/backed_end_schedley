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

function handler(
  req: {
    url?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[]>;
  } & unknown,
  res: unknown,
): void {
  const rawUrl = req.url ?? '';
  let url = rawUrl.split('?')[0];
  const method = (req.method ?? 'GET').toUpperCase();

  // Vercel rewrite sends original path as __path query param (see scripts/vercel-build.js).
  // Prefer req.query.__path (if helpers added), then parse from req.url (raw Node has full url).
  const queryPath = req.query && (req.query.__path as string | string[] | undefined);
  const pathFromQuery =
    typeof queryPath === 'string' ? queryPath : Array.isArray(queryPath) ? queryPath[0] : undefined;
  const pathFromUrl = rawUrl.match(/[?&]__path=([^&]*)/);
  const pathParam = pathFromQuery ?? (pathFromUrl ? pathFromUrl[1] : null);

  if (pathParam != null && String(pathParam).trim() !== '') {
    try {
      url = decodeURIComponent(String(pathParam));
    } catch {
      url = String(pathParam);
    }
    if (url && !url.startsWith('/')) url = '/' + url;
    if (req.query && '__path' in req.query) delete req.query.__path;
    let restQuery = '';
    if (req.query && typeof req.query === 'object') {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined && v !== null)
          params.set(k, Array.isArray(v) ? v[0] : String(v));
      }
      restQuery = params.toString();
    } else {
      const qi = rawUrl.indexOf('?');
      if (qi >= 0) {
        const params = new URLSearchParams(rawUrl.slice(qi));
        params.delete('__path');
        restQuery = params.toString();
      }
    }
    req.url = url + (restQuery ? '?' + restQuery : '');
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
