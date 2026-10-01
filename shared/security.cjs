const path = require('path');
const { fileURLToPath } = require('url');

function contentSecurityPolicy(dev) {
  if (dev) {
    return [
      "default-src 'self' http://localhost:5173 http://127.0.0.1:5173",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 http://127.0.0.1:5173",
      "style-src 'self' 'unsafe-inline' http://localhost:5173 http://127.0.0.1:5173",
      "img-src 'self' data: blob: http://localhost:5173 http://127.0.0.1:5173",
      "font-src 'self' data: http://localhost:5173 http://127.0.0.1:5173",
      "connect-src 'self' http://localhost:5173 http://127.0.0.1:5173 ws://localhost:5173 ws://127.0.0.1:5173",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
    ].join('; ');
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join('; ');
}

function isDevServerUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:'
    && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    && parsed.port === '5173';
}

function isInsideDir(file, dir) {
  if (!file || !dir) return false;
  const root = path.resolve(dir);
  const target = path.resolve(file);
  return target === root || target.startsWith(root + path.sep);
}

function isAppNavigation(url, { dev, appRoot }) {
  if (dev) return isDevServerUrl(url);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'file:') return false;
  let filePath;
  try {
    filePath = fileURLToPath(parsed);
  } catch {
    return false;
  }
  return isInsideDir(filePath, appRoot);
}

module.exports = { contentSecurityPolicy, isDevServerUrl, isInsideDir, isAppNavigation };
