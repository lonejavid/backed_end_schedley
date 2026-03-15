/**
 * Vercel Build Output API: run nest build, then emit .vercel/output
 * so the Nest app is deployed as a single serverless function.
 * Run as: node scripts/vercel-build.js (set as buildCommand in vercel.json or Project Settings).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.vercel', 'output');
const funcDir = path.join(outDir, 'functions', 'index.func');

console.log('[vercel-build] Running nest build...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

const distDir = path.join(root, 'dist');
const nodeModulesDir = path.join(root, 'node_modules');
if (!fs.existsSync(distDir)) {
  console.error('[vercel-build] dist/ not found after build');
  process.exit(1);
}

console.log('[vercel-build] Creating .vercel/output...');
fs.mkdirSync(funcDir, { recursive: true });

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

copyRecursive(distDir, path.join(funcDir, 'dist'));
copyRecursive(nodeModulesDir, path.join(funcDir, 'node_modules'));

fs.writeFileSync(
  path.join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs20.x',
      handler: 'dist/main.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: true,
    },
    null,
    2,
  ),
);

fs.mkdirSync(path.join(outDir, 'static'), { recursive: true });

// Per Vercel Build Output API: a function at functions/api/health.func is served at URL /api/health
// and the request path the function receives is /api/health. Copy index.func so /api and /api/health
// get the correct path without relying on rewrites.
const apiFuncDir = path.join(outDir, 'functions', 'api.func');
const apiHealthFuncDir = path.join(outDir, 'functions', 'api', 'health.func');
copyRecursive(funcDir, apiFuncDir);
fs.mkdirSync(path.dirname(apiHealthFuncDir), { recursive: true });
copyRecursive(funcDir, apiHealthFuncDir);

// Filesystem first (serves /api via api.func, /api/health via api/health.func); then miss → rewrite to index for all other paths.
fs.writeFileSync(
  path.join(outDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { handle: 'miss' },
        { src: '/(.*)', dest: '/index/$1' },
      ],
    },
    null,
    2,
  ),
);

console.log('[vercel-build] Done. Output in .vercel/output');
