// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

describe('Coolify-Produktionsserver', () => {
  let distDir;
  let server;
  let baseUrl;
  let fetchUpstream;

  beforeEach(async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'capakita-server-'));
    await mkdir(path.join(distDir, 'assets'));
    await writeFile(path.join(distDir, 'index.html'), '<main>Capakita app</main>');
    await writeFile(path.join(distDir, 'assets', 'app.js'), 'console.log("app")');
    fetchUpstream = vi.fn(async () => new Response('XLS fixture', {
      status: 200,
      headers: { 'content-type': 'application/vnd.ms-excel' },
    }));
    server = createAppServer({ distDir, fetchImpl: fetchUpstream });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (distDir) await rm(distDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('serves static assets and falls back to the entry point on SPA routes', async () => {
    const routeResponse = await fetch(`${baseUrl}/analyse/szenarien`, {
      headers: { accept: 'text/html' },
    });
    expect(routeResponse.status).toBe(200);
    expect(await routeResponse.text()).toBe('<main>Capakita app</main>');

    const assetResponse = await fetch(`${baseUrl}/assets/app.js`, {
      headers: { 'accept-encoding': 'identity' },
    });
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get('content-type')).toContain('javascript');
    expect(await assetResponse.text()).toContain('console.log');
  });

  it('exposes a no-cache health endpoint and returns 404 for missing assets', async () => {
    const healthResponse = await fetch(`${baseUrl}/healthz`);
    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.text()).toBe('ok');
    expect(healthResponse.headers.get('cache-control')).toBe('no-store');

    const missingAsset = await fetch(`${baseUrl}/assets/missing.js`);
    expect(missingAsset.status).toBe(404);
  });

  it('proxies only STMAS spreadsheet paths through the production endpoint', async () => {
    const documentPath = '/stmas-proxy/imperia/md/content/stmas/kinderbetreuung/beitrag.xls?download=1';
    const response = await fetch(`${baseUrl}${documentPath}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('XLS fixture');
    expect(fetchUpstream).toHaveBeenCalledWith(
      new URL('https://www.stmas.bayern.de/imperia/md/content/stmas/kinderbetreuung/beitrag.xls?download=1'),
      expect.objectContaining({ method: 'GET', redirect: 'manual' })
    );

    const rejected = await fetch(`${baseUrl}/stmas-proxy/https://example.com/private`);
    expect(rejected.status).toBe(404);
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
  });
});
