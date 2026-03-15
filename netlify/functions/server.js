/**
 * Netlify serverless function: wraps the Nest/Express app so /api/* is handled by Nest.
 * Redirect in netlify.toml sends /api/* here; event.path is the original path (e.g. /api/health).
 */
const path = require('path');

// dist/ is copied into netlify/functions/ during build, so it sits next to server.js
const mainPath = path.resolve(__dirname, 'dist/main.js');
const { bootstrap } = require(mainPath);
const serverless = require('serverless-http');

let handlerPromise;
function getHandler() {
  if (!handlerPromise) {
    handlerPromise = bootstrap().then((app) =>
      serverless(app.getHttpAdapter().getInstance())
    );
  }
  return handlerPromise;
}

exports.handler = async (event, context) => {
  const h = await getHandler();
  return h(event, context);
};
