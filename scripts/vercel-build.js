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

// Symlink /api/health -> same handler so req.url is naturally /api/health (no __path needed)
const apiDir = path.join(outDir, 'functions', 'api');
fs.mkdirSync(apiDir, { recursive: true });
const healthFuncLink = path.join(apiDir, 'health.func');
if (fs.existsSync(healthFuncLink)) fs.unlinkSync(healthFuncLink);
fs.symlinkSync(path.join('..', 'index.func'), healthFuncLink);

fs.writeFileSync(
  path.join(outDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '/api/health', dest: '/api/health' },
        { src: '/(.*)', dest: '/index?__path=/$1' },
      ],
    },
    null,
    2,
  ),
);

console.log('[vercel-build] Done. Output in .vercel/output');
