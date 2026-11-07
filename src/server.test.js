// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { openDatabase } from '../server/database.mjs';

describe('Coolify-Produktionsserver', () => {
  let distDir;
  let server;
  let authServer;
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
    server = createAppServer({
      distDir,
      fetchImpl: fetchUpstream,
      backendOptions: {
        dbPath: path.join(distDir, 'workspace.sqlite'),
        env: {
          APP_ORIGIN: 'https://capakita.example.org',
          SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
        },
      },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    for (const activeServer of [server, authServer]) {
      if (activeServer?.listening) {
        await new Promise((resolve, reject) => {
          activeServer.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
    authServer = null;
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

  it('starts an Authentik OIDC login with state, nonce, PKCE, and a secure browser cookie', async () => {
    const issuer = 'https://authentik.example.org/application/o/capakita/';
    const oidcFetch = vi.fn(async () => new Response(JSON.stringify({
      issuer,
      authorization_endpoint: 'https://authentik.example.org/application/o/authorize/',
      token_endpoint: 'https://authentik.example.org/application/o/token/',
      jwks_uri: 'https://authentik.example.org/application/o/capakita/jwks/',
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic'],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    authServer = createAppServer({
      distDir,
      fetchImpl: oidcFetch,
      backendOptions: {
        dbPath: path.join(distDir, 'auth.sqlite'),
        env: {
          NODE_ENV: 'production',
          APP_ORIGIN: 'https://capakita.example.org',
          SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
          AUTHENTIK_ISSUER_URL: issuer,
          AUTHENTIK_CLIENT_ID: 'capakita-client',
          AUTHENTIK_CLIENT_SECRET: 'test-client-secret',
          AUTHENTIK_ALLOWED_GROUP: 'capakita-users',
        },
      },
    });
    await new Promise((resolve, reject) => {
      authServer.once('error', reject);
      authServer.listen(0, '127.0.0.1', resolve);
    });

    const response = await fetch(`http://127.0.0.1:${authServer.address().port}/api/auth/login`, {
      redirect: 'manual',
    });
    expect(response.status).toBe(302);
    const authorizationUrl = new URL(response.headers.get('location'));
    expect(authorizationUrl.origin).toBe('https://authentik.example.org');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('capakita-client');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
    expect(authorizationUrl.searchParams.get('nonce')).toBeTruthy();
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(oidcFetch).toHaveBeenCalledTimes(1);
  });

  it('protects workspace reads and uses optimistic versions for shared writes', async () => {
    const backendHealth = await fetch(`${baseUrl}/api/v1/health`);
    expect(backendHealth.status).toBe(200);
    expect(await backendHealth.json()).toEqual({ status: 'ok', database: 'ok' });

    const sessionResponse = await fetch(`${baseUrl}/api/v1/session`);
    expect(sessionResponse.status).toBe(401);
    expect(await sessionResponse.json()).toEqual({ error: 'authentication_required' });

    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const csrfToken = 'test-csrf-token';
    const database = openDatabase({ filename: path.join(distDir, 'workspace.sqlite') });
    database.createSession({
      sid: sessionId,
      sub: 'authentik-user',
      name: 'Workspace Editor',
      email: 'editor@example.org',
      role: 'editor',
      csrfToken,
      expiresAt: Date.now() + 60_000,
    });
    const headers = {
      Cookie: `capakita_sid=${sessionId}`,
      Origin: 'https://capakita.example.org',
      'X-CSRF-Token': csrfToken,
    };
    const workspaceData = {
      scenarios: [{ id: 'shared-scenario', imported: true, importedAnonymized: true }],
      selectedScenarioId: 'shared-scenario',
      selectedItems: {},
      dataByScenario: { 'shared-scenario': {} },
      bookingsByScenario: {},
      groupsByScenario: {},
      groupDefsByScenario: {},
      financeByScenario: {},
      qualificationDefsByScenario: {},
      qualificationAssignmentsByScenario: {},
      chartStore: {},
      overlaysByScenario: {},
      disabledEventIdsByScenario: {},
    };

    try {
      const current = await fetch(`${baseUrl}/api/v1/workspace/state`, { headers });
      expect(current.status).toBe(200);
      const emptyWorkspace = await current.json();

      const write = await fetch(`${baseUrl}/api/v1/workspace/state`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: emptyWorkspace.version, data: workspaceData }),
      });
      expect(write.status).toBe(200);
      expect(await write.json()).toMatchObject({ version: 1, data: workspaceData });

      const staleWrite = await fetch(`${baseUrl}/api/v1/workspace/state`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 0, data: workspaceData }),
      });
      expect(staleWrite.status).toBe(409);
      expect(await staleWrite.json()).toMatchObject({ error: 'version_conflict', current: { version: 1 } });

      const noCsrf = await fetch(`${baseUrl}/api/v1/workspace/state`, {
        method: 'PUT',
        headers: { ...headers, 'X-CSRF-Token': 'invalid', 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, data: workspaceData }),
      });
      expect(noCsrf.status).toBe(403);
    } finally {
      database.close();
    }
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
