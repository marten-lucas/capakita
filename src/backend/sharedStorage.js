import { extractSaveData } from '../utils/saveLoadUtils';

const API_BASE = '/api';
const SAVE_DEBOUNCE_MS = 700;
const listeners = new Set();

let persistenceVersion = 0;
let csrfToken = '';
let role = 'editor';
let saveTimer = null;
let pendingSave = null;
let saveInProgress = false;
let writesBlocked = false;
let lastSavedJson = null;
let currentStatus = { kind: 'idle', message: 'Gemeinsamer Workspace' };

function publishStatus(nextStatus) {
  currentStatus = nextStatus;
  listeners.forEach((listener) => listener(currentStatus));
}

export function subscribeSharedStorageStatus(listener) {
  listeners.add(listener);
  listener(currentStatus);
  return () => listeners.delete(listener);
}

export async function loadSharedWorkspace() {
  const sessionResponse = await fetch(`${API_BASE}/v1/session`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (sessionResponse.status === 401) return { authenticated: false };
  if (!sessionResponse.ok) throw new Error(`Anmeldung fehlgeschlagen (${sessionResponse.status})`);
  const session = await sessionResponse.json();

  const stateResponse = await fetch(`${API_BASE}/v1/workspace/state`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!stateResponse.ok) throw new Error(`Workspace konnte nicht geladen werden (${stateResponse.status})`);
  const workspace = await stateResponse.json();

  persistenceVersion = workspace.version;
  csrfToken = session.csrfToken;
  role = session.role;
  lastSavedJson = JSON.stringify(workspace.data);
  writesBlocked = false;
  publishStatus({ kind: role === 'viewer' ? 'readonly' : 'saved', message: role === 'viewer' ? 'Nur-Lesezugriff' : 'Gemeinsamer Stand geladen' });

  return {
    authenticated: true,
    session,
    workspace,
  };
}

function flushPendingSave() {
  if (saveInProgress || writesBlocked || !pendingSave || role === 'viewer') return;
  const saving = pendingSave;
  pendingSave = null;
  saveInProgress = true;
  publishStatus({ kind: 'saving', message: 'Änderungen werden gespeichert …' });

  fetch(`${API_BASE}/v1/workspace/state`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ version: persistenceVersion, data: saving.data }),
  }).then(async (response) => {
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      writesBlocked = true;
      pendingSave = saving;
      publishStatus({ kind: 'auth_expired', message: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' });
      return;
    }
    if (response.status === 409) {
      writesBlocked = true;
      pendingSave = null;
      publishStatus({
        kind: 'conflict',
        message: 'Ein anderer Nutzer hat inzwischen gespeichert. Bitte neu laden, bevor du weiterarbeitest.',
      });
      return;
    }
    if (!response.ok) {
      const reason = result.error === 'un-anonymized_imports_disabled'
        ? 'Nicht anonymisierte Imports dürfen nicht im gemeinsamen Workspace gespeichert werden.'
        : `Speichern fehlgeschlagen (${response.status}).`;
      pendingSave ||= saving;
      publishStatus({ kind: 'error', message: reason });
      return;
    }

    persistenceVersion = result.version;
    lastSavedJson = saving.serialized;
    publishStatus({ kind: 'saved', message: `Gemeinsam gespeichert · ${new Date(result.updatedAt).toLocaleTimeString()}` });
  }).catch(() => {
    pendingSave ||= saving;
    publishStatus({ kind: 'error', message: 'Backend nicht erreichbar. Änderungen sind noch nicht gemeinsam gespeichert.' });
  }).finally(() => {
    saveInProgress = false;
    if (pendingSave && !writesBlocked && currentStatus.kind !== 'error' && currentStatus.kind !== 'auth_expired') {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushPendingSave, SAVE_DEBOUNCE_MS);
    }
  });
}

export function createSharedStoragePersistence() {
  return {
    start(store) {
      store.subscribe(() => {
        if (role === 'viewer' || writesBlocked) return;
        const state = store.getState();
        const data = {
          ...extractSaveData(state),
          overlaysByScenario: state.simOverlay?.overlaysByScenario || {},
          disabledEventIdsByScenario: state.events?.disabledEventIdsByScenario || {},
        };
        const serialized = JSON.stringify(data);
        if (serialized === lastSavedJson) return;
        pendingSave = { data, serialized };
        publishStatus({ kind: 'pending', message: 'Änderungen ausstehend …' });
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushPendingSave, SAVE_DEBOUNCE_MS);
      });
    },
  };
}

export function retrySharedStorageSave() {
  if (writesBlocked || !pendingSave) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPendingSave, 0);
}

export async function logoutFromSharedWorkspace() {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRF-Token': csrfToken },
  });
  if (!response.ok && response.status !== 401) throw new Error('Abmelden fehlgeschlagen');
  window.location.assign('/');
}

export function workspaceSnapshotToReduxState(snapshot = {}) {
  return {
    simScenario: {
      scenarios: Array.isArray(snapshot.scenarios) ? snapshot.scenarios : [],
      selectedScenarioId: snapshot.selectedScenarioId ?? null,
      selectedItems: snapshot.selectedItems || {},
      saveDialogOpen: false,
      loadDialogOpen: false,
    },
    simData: { dataByScenario: snapshot.dataByScenario || {} },
    simBooking: { bookingsByScenario: snapshot.bookingsByScenario || {} },
    simGroup: {
      groupsByScenario: snapshot.groupsByScenario || {},
      groupDefsByScenario: snapshot.groupDefsByScenario || {},
    },
    simQualification: {
      qualificationDefsByScenario: snapshot.qualificationDefsByScenario || {},
      qualificationAssignmentsByScenario: snapshot.qualificationAssignmentsByScenario || {},
    },
    simFinance: { financeByScenario: snapshot.financeByScenario || {} },
    chart: snapshot.chartStore || {},
    simOverlay: { overlaysByScenario: snapshot.overlaysByScenario || {} },
    events: {
      eventsByScenario: {},
      disabledEventIdsByScenario: snapshot.disabledEventIdsByScenario || {},
      _needsRefresh: true,
    },
    datesOfInterest: { datesByScenario: {} },
  };
}
