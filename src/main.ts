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
  const rawUrl = typeof (req as { url?: string }).url === 'string' ? (req as { url: string }).url : '';
  let pathname = rawUrl.split('?')[0];
  // If Vercel passes full URL (e.g. https://api.schedley.com/api/health), extract pathname
  if (pathname && (pathname.startsWith('http://') || pathname.startsWith('https://'))) {
    try {
      const u = new URL(pathname);
      pathname = u.pathname || '/';
    } catch {
      pathname = pathname.split('?')[0];
    }
  }

  // Vercel rewrite sends original path as __path query param. Read from every possible source:
  // 1. req.query.__path (when shouldAddHelpers is true)
  // 2. req.url query string (when raw request has ?__path=...)
  // 3. x-invoke-path / x-url / x-vercel-url headers (some runtimes set these)
  const queryPath = req.query && (req.query.__path as string | string[] | undefined);
  const fromQuery =
    typeof queryPath === 'string' ? queryPath : Array.isArray(queryPath) ? queryPath[0] : undefined;
  const fromUrlMatch = rawUrl.match(/[?&]__path=([^&]*)/);
  const fromUrl = fromUrlMatch ? fromUrlMatch[1] : null;
  const getHeader = (name: string): string | undefined => {
    const h = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
    if (typeof h === 'string') return h;
    if (Array.isArray(h) && h[0]) return h[0];
    return undefined;
  };
  const fromHeader =
    getHeader('x-invoke-path') ??
    getHeader('x-url') ??
    getHeader('x-vercel-original-url') ??
    (() => {
      const vurl = getHeader('x-vercel-url');
      if (vurl) {
        try {
          const path = new URL(vurl.startsWith('http') ? vurl : `https://x${vurl}`).pathname;
          return path || undefined;
        } catch {
          return undefined;
        }
      }
      return undefined;
    })();

  const pathParam = fromQuery ?? fromUrl ?? fromHeader;

  if (pathParam != null && String(pathParam).trim() !== '') {
    try {
      pathname = decodeURIComponent(String(pathParam).trim());
    } catch {
      pathname = String(pathParam).trim();
    }
    if (pathname && !pathname.startsWith('/')) pathname = '/' + pathname;
  }

  // If path is still /index or empty (e.g. Vercel didn't pass __path), treat as root so at least /api works
  if (!pathname || pathname === '/index') {
    pathname = '/';
  }

  // Ensure /api prefix for non-api paths (e.g. / -> /api, /health -> /api/health)
  if (pathname && !pathname.startsWith('/api')) {
    pathname = '/api' + (pathname.startsWith('/') ? pathname : '/' + pathname);
  }

  // Normalize trailing slash so /api/ and /api both hit GET /api
  if (pathname && pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Build final URL for Express: pathname + query (without __path)
  let queryStr = '';
  if (req.query && typeof req.query === 'object') {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === '__path') continue;
      if (v !== undefined && v !== null)
        params.set(k, Array.isArray(v) ? v[0] : String(v));
    }
    queryStr = params.toString();
  } else if (rawUrl.includes('?')) {
    const params = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?')));
    params.delete('__path');
    queryStr = params.toString();
  }
  const resolvedUrl = pathname + (queryStr ? '?' + queryStr : '');

  // Force Express to see this URL: remove any getter then define (Vercel may use getters)
  const reqRecord = req as Record<string, unknown>;
  try {
    delete reqRecord.url;
    Object.defineProperty(req, 'url', { value: resolvedUrl, writable: true, configurable: true });
  } catch {
    reqRecord.url = resolvedUrl;
  }
  if ('originalUrl' in req) {
    try {
      delete (req as Record<string, unknown>).originalUrl;
      Object.defineProperty(req, 'originalUrl', { value: resolvedUrl, writable: true, configurable: true });
    } catch {
      (req as Record<string, unknown>).originalUrl = resolvedUrl;
    }
  } else {
    (req as Record<string, unknown>).originalUrl = resolvedUrl;
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
