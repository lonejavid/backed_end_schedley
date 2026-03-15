// Vercel serverless: forward all /api/* requests to the Nest app
// Build must run first so dist/main.js exists (npm run build)
module.exports = require('../dist/main.js');
