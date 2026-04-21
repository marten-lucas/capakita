const AUTO_SAVE_SETTINGS_KEY = 'kigasim:auto-save:settings:v1';
const AUTO_SAVE_STATE_KEY = 'kigasim:auto-save:state:v1';

const getStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
};

const readJson = (key) => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeJson = (key, value) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / availability issues.
  }
};

export const loadBrowserAutoSaveEnabled = () => {
  return Boolean(readJson(AUTO_SAVE_SETTINGS_KEY)?.enabled);
};

export const saveBrowserAutoSaveEnabled = (enabled) => {
  writeJson(AUTO_SAVE_SETTINGS_KEY, {
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
  });
};

export const loadBrowserAutoSaveState = () => {
  const stored = readJson(AUTO_SAVE_STATE_KEY);
  if (!stored || typeof stored !== 'object') {
    return null;
  }

  return stored.data ?? null;
};

export const saveBrowserAutoSaveState = (state) => {
  if (!state) {
    return;
  }

  writeJson(AUTO_SAVE_STATE_KEY, {
    version: 1,
    updatedAt: new Date().toISOString(),
    data: state,
  });
};
