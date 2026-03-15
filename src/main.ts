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
  const port = config.get<number>('port') ?? 5000;
  if (!process.env.VERCEL) {
    await app.listen(port);
    console.log(`[Schedley] Listening on port ${port}`);
  }
  return app;
}

// Vercel serverless handler
const appPromise = bootstrap();

function getHeader(req: { headers?: Record<string, string | string[] | undefined> }, name: string): string | undefined {
  const h = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  if (typeof h === 'string') return h;
  if (Array.isArray(h) && h[0]) return h[0];
  return undefined;
}

function resolvePathname(req: {
  url?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[] | undefined>;
  path?: string;
}): string {
  const rawUrl = typeof req.url === 'string' ? req.url : '';

  // --- Step 0: Vercel often sends original URL/path in headers; use these first ---
  const vercelUrl = getHeader(req, 'x-vercel-url');
  if (vercelUrl) {
    try {
      const pathname = new URL(vercelUrl.startsWith('http') ? vercelUrl : `https://x${vercelUrl}`).pathname;
      if (pathname && pathname !== '/index') return pathname;
    } catch {
      // fall through
    }
  }
  const invokePath = getHeader(req, 'x-invoke-path') ?? getHeader(req, 'x-url') ?? getHeader(req, 'x-original-url');
  if (invokePath && invokePath.trim()) {
    const p = invokePath.trim();
    return p.startsWith('/') ? p : '/' + p;
  }

  // --- Step 1: Vercel route is now /index/$1 so path comes in req.url as /index/api/health (or /index for root) ---
  if (rawUrl.startsWith('/index')) {
    const pathPart = rawUrl.split('?')[0];
    const afterIndex = pathPart === '/index' ? '' : pathPart.slice(6); // '/index'.length === 6
    const p = afterIndex ? (afterIndex.startsWith('/') ? afterIndex : '/' + afterIndex) : '/';
    if (p !== '/index') return p;
  }

  // --- Step 2: __path query (legacy / fallback) ---
  const queryPath = req.query?.__path;
  const fromQuery =
    typeof queryPath === 'string' ? queryPath : Array.isArray(queryPath) ? queryPath[0] : undefined;
  const fromUrlMatch = rawUrl.match(/[?&]__path=([^&]*)/);
  const fromUrl = fromUrlMatch ? decodeURIComponent(fromUrlMatch[1]) : undefined;
  const pathParam = fromQuery ?? fromUrl;
  if (pathParam && pathParam.trim()) {
    let p = pathParam.trim();
    if (!p.startsWith('/')) p = '/' + p;
    return p;
  }

  // --- Step 3: Full URL in req.url ---
  if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    try {
      return new URL(rawUrl).pathname || '/';
    } catch {
      // fall through
    }
  }

  // --- Step 4: Path-only req.url (not /index) ---
  if (rawUrl) {
    const p = rawUrl.split('?')[0];
    if (p && p !== '/index') return p;
  }

  // --- Step 5: req.path ---
  if (typeof req.path === 'string' && req.path.trim()) {
    const p = req.path.trim();
    return p.startsWith('/') ? p : '/' + p;
  }

  return '/';
}

function handler(
  req: {
    url?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[]>;
    path?: string;
  } & Record<string, unknown>,
  res: unknown,
): void {
  const rawUrl = typeof req.url === 'string' ? req.url : '';

  // Resolve the true pathname
  let pathname = resolvePathname(req);

  // Nest has setGlobalPrefix('api'), so it only serves /api, /api/health, etc.
  if (pathname === '/' || pathname === '/index') {
    pathname = '/api';
  } else if (pathname && !pathname.startsWith('/api')) {
    // When function is at api/health.func, Vercel may pass path as /health; prepend /api.
    pathname = '/api' + (pathname.startsWith('/') ? pathname : '/' + pathname);
  }

  // Normalize trailing slash (but keep bare "/")
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Vercel: if the request looks like a health check, force exact path so Nest always matches
  if (process.env.VERCEL && (rawUrl.includes('health') || pathname.includes('health'))) {
    pathname = '/api/health';
  }
  if (process.env.VERCEL && (rawUrl === '/api' || pathname === '/api' || rawUrl.endsWith('/api'))) {
    pathname = '/api';
  }

  // Build query string, stripping __path
  let queryStr = '';
  if (req.query && typeof req.query === 'object') {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === '__path') continue;
      if (v !== undefined && v !== null) {
        params.set(k, Array.isArray(v) ? v[0] : String(v));
      }
    }
    queryStr = params.toString();
  } else if (rawUrl.includes('?')) {
    const params = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1));
    params.delete('__path');
    queryStr = params.toString();
  }

  const resolvedUrl = pathname + (queryStr ? '?' + queryStr : '');

  console.log(`[Schedley] Vercel request: rawUrl="${rawUrl}" -> resolvedUrl="${resolvedUrl}"`);

  // Overwrite req.url so Express sees the correct path
  try {
    delete req.url;
    Object.defineProperty(req, 'url', { value: resolvedUrl, writable: true, configurable: true });
  } catch {
    req.url = resolvedUrl;
  }
  try {
    delete (req as Record<string, unknown>).originalUrl;
    Object.defineProperty(req, 'originalUrl', { value: resolvedUrl, writable: true, configurable: true });
  } catch {
    (req as Record<string, unknown>).originalUrl = resolvedUrl;
  }

  appPromise
    .then((app) => {
      const expressApp = app.getHttpAdapter().getInstance();
      expressApp(req, res);
    })
    .catch((err) => {
      console.error('[Schedley] Database connection failed:', err?.message ?? err);
      const r = res as {
        statusCode?: number;
        setHeader?: (a: string, b: string) => void;
        end?: (s: string) => void;
      };
      if (r.setHeader) r.setHeader('Content-Type', 'application/json');
      if (typeof r.statusCode !== 'undefined') r.statusCode = 503;
      if (r.end) r.end(JSON.stringify({ status: 'error', message: 'Service unavailable (database not connected)' }));
    });
}

if (process.env.VERCEL) {
  (module as NodeModule & { exports: typeof handler }).exports = handler;
}