import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = path.join(ROOT_DIR, 'dist');
const STMAS_ORIGIN = 'https://www.stmas.bayern.de';
const STMAS_DOCUMENT_PATH = /^\/imperia\/md\/content\/stmas\/.+\.(?:xls|xlsx)$/i;
const MIME_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.otf', 'font/otf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
]);
const COMPRESSIBLE_TYPE = /^(?:text\/|application\/(?:javascript|json|manifest\+json|wasm|xml)|image\/svg\+xml)/i;

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(message);
}

function sendStaticFile(request, response, filePath, metadata, requestPath) {
  const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
  const cacheControl = requestPath.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
  const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers['accept-encoding'] || '');
  const compress = request.method !== 'HEAD'
    && metadata.size >= 1024
    && acceptsGzip
    && COMPRESSIBLE_TYPE.test(contentType);

  response.statusCode = 200;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Cache-Control', cacheControl);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Last-Modified', metadata.mtime.toUTCString());
  if (COMPRESSIBLE_TYPE.test(contentType)) response.setHeader('Vary', 'Accept-Encoding');
  if (compress) {
    response.setHeader('Content-Encoding', 'gzip');
  } else {
    response.setHeader('Content-Length', metadata.size);
  }

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const fileStream = createReadStream(filePath);
  fileStream.on('error', () => response.destroy());
  if (compress) fileStream.pipe(createGzip()).pipe(response);
  else fileStream.pipe(response);
}

async function proxyStmas(request, response, parsedUrl, fetchImpl) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendText(response, 405, 'Method not allowed');
    return;
  }

  const remotePath = parsedUrl.pathname.slice('/stmas-proxy'.length) || '/';
  if (!STMAS_DOCUMENT_PATH.test(remotePath)) {
    sendText(response, 404, 'STMAS document not found');
    return;
  }

  const targetUrl = new URL(`${remotePath}${parsedUrl.search}`, STMAS_ORIGIN);
  let upstream;
  try {
    upstream = await fetchImpl(targetUrl, {
      method: request.method,
      headers: { Accept: request.headers.accept || '*/*' },
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    sendText(response, 502, 'STMAS upstream unavailable');
    return;
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel();
    sendText(response, 502, 'STMAS upstream redirect rejected');
    return;
  }

  response.statusCode = upstream.status;
  response.setHeader('Content-Type', upstream.headers.get('content-type') || MIME_TYPES.get(path.extname(remotePath).toLowerCase()));
  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const lastModified = upstream.headers.get('last-modified');
  if (lastModified) response.setHeader('Last-Modified', lastModified);

  if (request.method === 'HEAD' || !upstream.body) {
    await upstream.body?.cancel();
    response.end();
    return;
  }
  Readable.fromWeb(upstream.body).on('error', () => response.destroy()).pipe(response);
}

export function createAppServer({ distDir = DEFAULT_DIST_DIR, fetchImpl = globalThis.fetch } = {}) {
  const absoluteDistDir = path.resolve(distDir);

  return http.createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      sendText(response, 405, 'Method not allowed');
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(request.url || '/', 'http://localhost');
    } catch {
      sendText(response, 400, 'Bad request');
      return;
    }

    if (parsedUrl.pathname === '/healthz') {
      response.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : 'ok');
      return;
    }

    if (parsedUrl.pathname === '/stmas-proxy' || parsedUrl.pathname.startsWith('/stmas-proxy/')) {
      await proxyStmas(request, response, parsedUrl, fetchImpl);
      return;
    }

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(parsedUrl.pathname);
    } catch {
      sendText(response, 400, 'Bad request');
      return;
    }

    const filePath = path.resolve(absoluteDistDir, `.${decodedPath}`);
    if (filePath !== absoluteDistDir && !filePath.startsWith(`${absoluteDistDir}${path.sep}`)) {
      sendText(response, 403, 'Forbidden');
      return;
    }

    let resolvedPath = filePath;
    let metadata;
    try {
      metadata = await stat(resolvedPath);
      if (metadata.isDirectory()) {
        resolvedPath = path.join(resolvedPath, 'index.html');
        metadata = await stat(resolvedPath);
      }
    } catch {
      const acceptsHtml = (request.headers.accept || '').includes('text/html');
      if (!acceptsHtml) {
        sendText(response, 404, 'Not found');
        return;
      }
      resolvedPath = path.join(absoluteDistDir, 'index.html');
      try {
        metadata = await stat(resolvedPath);
      } catch {
        sendText(response, 503, 'Application build is missing');
        return;
      }
    }

    if (!metadata.isFile()) {
      sendText(response, 404, 'Not found');
      return;
    }
    sendStaticFile(request, response, resolvedPath, metadata, parsedUrl.pathname);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  const server = createAppServer();
  server.listen(port, host, () => {
    console.log(`Capakita listening on http://${host}:${port}`);
  });
  server.on('error', (error) => {
    console.error('Capakita server failed to start:', error);
    process.exitCode = 1;
  });
}
