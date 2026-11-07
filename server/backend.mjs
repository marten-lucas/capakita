import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import * as oidc from 'openid-client';
import { openDatabase } from './database.mjs';

const SESSION_COOKIE = 'capakita_sid';
const LOGIN_COOKIE = 'capakita_oidc';
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const LOGIN_MAX_AGE_SECONDS = 10 * 60;
const DEFAULT_MAX_BODY_BYTES = 25 * 1024 * 1024;
const WORKSPACE_KEYS = [
  'scenarios',
  'selectedScenarioId',
  'selectedItems',
  'dataByScenario',
  'bookingsByScenario',
  'groupsByScenario',
  'groupDefsByScenario',
  'financeByScenario',
  'qualificationDefsByScenario',
  'qualificationAssignmentsByScenario',
  'chartStore',
  'overlaysByScenario',
  'disabledEventIdsByScenario',
];

function serializeCookie(name, value, { maxAge, secure, path = '/' } = {}) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
    ...(maxAge === undefined ? [] : [`Max-Age=${maxAge}`]),
  ].join('; ');
}

function readCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        if (separator < 0) return [part, ''];
        try {
          return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
        } catch {
          return [part.slice(0, separator), ''];
        }
      }),
  );
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function signPayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

function verifyPayload(value, secret) {
  if (typeof value !== 'string') return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const encoded = value.slice(0, separator);
  const providedSignature = Buffer.from(value.slice(separator + 1));
  const expectedSignature = Buffer.from(sign(encoded, secret));
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function sendJson(response, statusCode, value, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function redirect(response, location, headers = {}) {
  response.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...headers });
  response.end();
}

async function readJsonBody(request, maxBytes) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBytes) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

function normalizeGroups(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function validateWorkspaceData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Array.isArray(data.scenarios)) return false;
  return WORKSPACE_KEYS.every((key) => Object.hasOwn(data, key));
}

export function createBackendService({ dbPath, env = process.env, fetchImpl } = {}) {
  const database = openDatabase({ filename: dbPath || env.SQLITE_PATH || '/data/capakita.sqlite' });
  const appOrigin = env.APP_ORIGIN?.replace(/\/$/, '');
  const sessionSecret = env.SESSION_SECRET;
  const secureCookie = Boolean(appOrigin && new URL(appOrigin).protocol === 'https:');
  const redirectUri = env.AUTHENTIK_REDIRECT_URI || (appOrigin ? `${appOrigin.replace(/\/$/, '')}/api/auth/callback` : '');
  const maxBodyBytes = Number.parseInt(env.MAX_API_BODY_BYTES || String(DEFAULT_MAX_BODY_BYTES), 10);
  let oidcConfigPromise;

  function requireAuthConfiguration() {
    if (!appOrigin || !sessionSecret || sessionSecret.length < 32) {
      throw new Error('APP_ORIGIN and a SESSION_SECRET of at least 32 characters are required');
    }
    if (env.NODE_ENV === 'production' && new URL(appOrigin).protocol !== 'https:') {
      throw new Error('APP_ORIGIN must use HTTPS in production');
    }
    if (env.NODE_ENV === 'production' && new URL(env.AUTHENTIK_ISSUER_URL || 'http://invalid').protocol !== 'https:') {
      throw new Error('AUTHENTIK_ISSUER_URL must use HTTPS in production');
    }
    if (!env.AUTHENTIK_ISSUER_URL || !env.AUTHENTIK_CLIENT_ID || !env.AUTHENTIK_CLIENT_SECRET || !redirectUri || !env.AUTHENTIK_ALLOWED_GROUP) {
      throw new Error('Authentik OIDC configuration is incomplete (including AUTHENTIK_ALLOWED_GROUP)');
    }
  }

  async function getOidcConfig() {
    requireAuthConfiguration();
    if (!oidcConfigPromise) {
      oidcConfigPromise = oidc.discovery(
        new URL(env.AUTHENTIK_ISSUER_URL),
        env.AUTHENTIK_CLIENT_ID,
        env.AUTHENTIK_CLIENT_SECRET,
        undefined,
        fetchImpl ? { [oidc.customFetch]: fetchImpl } : undefined,
      );
    }
    return oidcConfigPromise;
  }

  function getSession(request) {
    const sid = readCookies(request)[SESSION_COOKIE];
    if (!sid || !/^[a-f0-9-]{36}$/i.test(sid)) return null;
    return database.getSession(sid);
  }

  function requireCsrf(request, session) {
    const origin = request.headers.origin;
    const csrfToken = request.headers['x-csrf-token'];
    return origin === appOrigin && typeof csrfToken === 'string' && csrfToken === session.csrfToken;
  }

  function getRole(claims) {
    const groupsClaim = env.AUTHENTIK_GROUPS_CLAIM || 'groups';
    const groups = normalizeGroups(claims[groupsClaim]);
    const requiredGroup = env.AUTHENTIK_ALLOWED_GROUP;
    if (requiredGroup && !groups.includes(requiredGroup)) return null;
    if (env.AUTHENTIK_ADMIN_GROUP && groups.includes(env.AUTHENTIK_ADMIN_GROUP)) return 'admin';
    return 'editor';
  }

  async function handle(request, response, url) {
    if (url.pathname === '/api/v1/health' && request.method === 'GET') {
      try {
        database.getWorkspace();
        sendJson(response, 200, { status: 'ok', database: 'ok' });
      } catch {
        sendJson(response, 503, { status: 'unavailable' });
      }
      return true;
    }

    if (url.pathname === '/api/auth/login' && request.method === 'GET') {
      try {
        const config = await getOidcConfig();
        const state = randomBytes(32).toString('base64url');
        const nonce = randomBytes(32).toString('base64url');
        const verifier = oidc.randomPKCECodeVerifier();
        const challenge = await oidc.calculatePKCECodeChallenge(verifier);
        const params = {
          redirect_uri: redirectUri,
          scope: env.AUTHENTIK_SCOPES || 'openid profile email',
          state,
          nonce,
          code_challenge: challenge,
          code_challenge_method: 'S256',
        };
        const loginCookie = signPayload({
          state,
          nonce,
          verifier,
          expiresAt: Date.now() + LOGIN_MAX_AGE_SECONDS * 1000,
        }, sessionSecret);
        const target = oidc.buildAuthorizationUrl(config, params);
        redirect(response, target.href, {
          'Set-Cookie': serializeCookie(LOGIN_COOKIE, loginCookie, {
            maxAge: LOGIN_MAX_AGE_SECONDS,
            secure: secureCookie,
            path: '/api/auth',
          }),
        });
      } catch (error) {
        console.error('Authentik login could not be started');
        redirect(response, '/?auth_error=configuration');
      }
      return true;
    }

    if (url.pathname === '/api/auth/callback' && request.method === 'GET') {
      const clearLoginCookie = serializeCookie(LOGIN_COOKIE, '', { maxAge: 0, secure: secureCookie, path: '/api/auth' });
      try {
        const pending = verifyPayload(readCookies(request)[LOGIN_COOKIE], sessionSecret || '');
        if (!pending || pending.expiresAt < Date.now()) throw new Error('Invalid or expired OIDC state');
        const config = await getOidcConfig();
        const currentUrl = new URL(`${appOrigin}${request.url}`);
        const tokenSet = await oidc.authorizationCodeGrant(config, currentUrl, {
          pkceCodeVerifier: pending.verifier,
          expectedState: pending.state,
          expectedNonce: pending.nonce,
          idTokenExpected: true,
        });
        const claims = tokenSet.claims();
        if (!claims?.sub) throw new Error('OIDC response is missing subject');
        const role = getRole(claims);
        if (!role) {
          redirect(response, '/?auth_error=not_allowed', { 'Set-Cookie': clearLoginCookie });
          return true;
        }

        database.deleteExpiredSessions();
        const sid = randomUUID();
        const csrfToken = randomBytes(32).toString('base64url');
        const name = String(claims.name || claims.preferred_username || claims.email || claims.sub).slice(0, 200);
        const email = String(claims.email || '').slice(0, 320);
        database.createSession({
          sid,
          sub: String(claims.sub),
          name,
          email,
          role,
          csrfToken,
          expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
        });
        redirect(response, '/', {
          'Set-Cookie': [
            clearLoginCookie,
            serializeCookie(SESSION_COOKIE, sid, { maxAge: SESSION_MAX_AGE_SECONDS, secure: secureCookie }),
          ],
        });
      } catch (error) {
        console.error('Authentik callback failed');
        redirect(response, '/?auth_error=login_failed', { 'Set-Cookie': clearLoginCookie });
      }
      return true;
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const session = getSession(request);
      if (!session) {
        sendJson(response, 401, { error: 'authentication_required' });
        return true;
      }
      if (!requireCsrf(request, session)) {
        sendJson(response, 403, { error: 'csrf_check_failed' });
        return true;
      }
      database.deleteSession(session.sid);
      sendJson(response, 200, { ok: true }, {
        'Set-Cookie': serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: secureCookie }),
      });
      return true;
    }

    if (url.pathname.startsWith('/api/')) {
      const session = getSession(request);
      if (!session) {
        sendJson(response, 401, { error: 'authentication_required' });
        return true;
      }

      if (url.pathname === '/api/v1/session' && request.method === 'GET') {
        sendJson(response, 200, {
          user: { sub: session.sub, name: session.name, email: session.email },
          role: session.role,
          csrfToken: session.csrfToken,
        });
        return true;
      }

      if (url.pathname === '/api/v1/workspace/state' && request.method === 'GET') {
        const workspace = database.getWorkspace();
        sendJson(response, 200, workspace);
        return true;
      }

      if (url.pathname === '/api/v1/workspace/state' && request.method === 'PUT') {
        if (session.role === 'viewer') {
          sendJson(response, 403, { error: 'read_only' });
          return true;
        }
        if (!requireCsrf(request, session)) {
          sendJson(response, 403, { error: 'csrf_check_failed' });
          return true;
        }
        const body = await readJsonBody(request, maxBodyBytes);
        if (!validateWorkspaceData(body.data) || !Number.isInteger(body.version) || body.version < 0) {
          sendJson(response, 400, { error: 'invalid_workspace_state' });
          return true;
        }
        if (env.ALLOW_UNANONYMIZED_IMPORTS !== 'true') {
          const containsPersonalImport = body.data.scenarios.some(
            (scenario) => scenario?.imported === true && scenario?.importedAnonymized !== true,
          );
          if (containsPersonalImport) {
            sendJson(response, 422, { error: 'un-anonymized_imports_disabled' });
            return true;
          }
        }
        const saved = database.saveWorkspace({
          expectedVersion: body.version,
          data: body.data,
          updatedBy: session.sub,
        });
        if (!saved) {
          sendJson(response, 409, { error: 'version_conflict', current: database.getWorkspace() });
          return true;
        }
        sendJson(response, 200, database.getWorkspace());
        return true;
      }

      sendJson(response, 404, { error: 'not_found' });
      return true;
    }

    return false;
  }

  return {
    handle,
    close() {
      database.close();
    },
  };
}
