import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const EMPTY_WORKSPACE = {
  scenarios: [],
  selectedScenarioId: null,
  selectedItems: {},
  dataByScenario: {},
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

export function openDatabase({ filename = process.env.SQLITE_PATH || '/data/capakita.sqlite' } = {}) {
  if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });

  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      user_sub TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS workspace_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );
  `);

  db.prepare(`
    INSERT OR IGNORE INTO workspace_state (id, version, data_json, updated_at, updated_by)
    VALUES (1, 0, ?, ?, 'system')
  `).run(JSON.stringify(EMPTY_WORKSPACE), new Date().toISOString());

  const createSessionStatement = db.prepare(`
    INSERT INTO sessions (sid, user_sub, user_name, user_email, role, csrf_token, expires_at)
    VALUES (@sid, @sub, @name, @email, @role, @csrfToken, @expiresAt)
  `);
  const getSessionStatement = db.prepare(`
    SELECT sid, user_sub AS sub, user_name AS name, user_email AS email,
      role, csrf_token AS csrfToken, expires_at AS expiresAt
    FROM sessions WHERE sid = ? AND expires_at > ?
  `);
  const getWorkspaceStatement = db.prepare(`
    SELECT version, data_json AS dataJson, updated_at AS updatedAt, updated_by AS updatedBy
    FROM workspace_state WHERE id = 1
  `);
  const updateWorkspaceStatement = db.prepare(`
    UPDATE workspace_state
    SET version = version + 1, data_json = ?, updated_at = ?, updated_by = ?
    WHERE id = 1 AND version = ?
  `);

  return {
    createSession(session) {
      createSessionStatement.run(session);
    },
    getSession(sid) {
      return getSessionStatement.get(sid, Date.now()) || null;
    },
    deleteSession(sid) {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    },
    deleteExpiredSessions() {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    },
    getWorkspace() {
      const row = getWorkspaceStatement.get();
      return {
        version: row.version,
        data: JSON.parse(row.dataJson),
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      };
    },
    saveWorkspace({ expectedVersion, data, updatedBy }) {
      const result = updateWorkspaceStatement.run(
        JSON.stringify(data),
        new Date().toISOString(),
        updatedBy,
        expectedVersion,
      );
      return result.changes === 1;
    },
    close() {
      db.close();
    },
  };
}
