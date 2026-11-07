// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '../../server/database.mjs';

const validWorkspace = {
  scenarios: [{ id: 'scenario-1', name: 'Gemeinsam' }],
  selectedScenarioId: 'scenario-1',
  selectedItems: {},
  dataByScenario: { 'scenario-1': {} },
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

describe('SQLite workspace storage', () => {
  let directory;
  let database;

  afterEach(async () => {
    database?.close();
    database = null;
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = null;
  });

  it('persists shared workspace state and rejects stale versions', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'capakita-sqlite-'));
    const filename = path.join(directory, 'workspace.sqlite');
    database = openDatabase({ filename });

    expect(database.getWorkspace()).toMatchObject({ version: 0, data: { scenarios: [] } });
    expect(database.saveWorkspace({ expectedVersion: 0, data: validWorkspace, updatedBy: 'user-a' })).toBe(true);
    expect(database.getWorkspace()).toMatchObject({
      version: 1,
      data: validWorkspace,
      updatedBy: 'user-a',
    });
    expect(database.saveWorkspace({ expectedVersion: 0, data: validWorkspace, updatedBy: 'user-b' })).toBe(false);

    database.close();
    database = openDatabase({ filename });
    expect(database.getWorkspace()).toMatchObject({ version: 1, data: validWorkspace });
  });

  it('stores and expires server-side sessions', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'capakita-session-'));
    database = openDatabase({ filename: path.join(directory, 'sessions.sqlite') });
    database.createSession({
      sid: 'session-id',
      sub: 'authentik-user-id',
      name: 'Capakita Nutzer',
      email: 'user@example.org',
      role: 'editor',
      csrfToken: 'csrf-token',
      expiresAt: Date.now() + 60_000,
    });

    expect(database.getSession('session-id')).toMatchObject({
      sub: 'authentik-user-id',
      role: 'editor',
      csrfToken: 'csrf-token',
    });
    database.deleteSession('session-id');
    expect(database.getSession('session-id')).toBeNull();
  });
});
