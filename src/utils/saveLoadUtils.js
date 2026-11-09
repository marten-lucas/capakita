import CryptoJS from 'crypto-js';
import validator from 'validator';

// Password validation using validator.js
export const validatePassword = (password) => {
  if (!password) return 'Passwort ist erforderlich.';
  
  const options = {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  };
  
  if (!validator.isStrongPassword(password, options)) {
    return 'Passwort muss mindestens 8 Zeichen lang sein und Groß- und Kleinbuchstaben, Zahlen sowie Sonderzeichen enthalten.';
  }
  
  return null;
};

const CAPAKITA_EXPORT_FORMAT = 'capakita-export';
const CAPAKITA_EXPORT_VERSION = 1;

export function encodeCapakitaExport(data, { password = '', anonymized = false } = {}) {
  const json = JSON.stringify(data);
  if (password) return CryptoJS.AES.encrypt(json, password).toString();
  if (!anonymized) throw new Error('Nicht anonymisierte Exporte müssen mit einem Passwort geschützt werden.');

  return JSON.stringify({
    format: CAPAKITA_EXPORT_FORMAT,
    version: CAPAKITA_EXPORT_VERSION,
    encrypted: false,
    anonymized: true,
    payload: data,
  });
}

export function decodeCapakitaExport(text, password = '') {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (parsed?.format === CAPAKITA_EXPORT_FORMAT) {
    if (parsed.version !== CAPAKITA_EXPORT_VERSION) {
      throw new Error('Diese Capakita-Dateiversion wird nicht unterstützt.');
    }
    if (parsed.encrypted !== false || parsed.anonymized !== true || !parsed.payload || typeof parsed.payload !== 'object') {
      throw new Error('Die anonymisierte Capakita-Datei ist ungültig.');
    }
    return parsed.payload;
  }

  if (!password) throw new Error('Für diese passwortgeschützte Capakita-Datei ist ein Passwort erforderlich.');
  const bytes = CryptoJS.AES.decrypt(text, password);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) throw new Error('Falsches Passwort oder beschädigte Capakita-Datei.');
  return JSON.parse(decrypted);
}

// Extract save data from Redux store state
export const extractSaveData = (state) => {
  return {
    scenarios: state.simScenario.scenarios,
    selectedScenarioId: state.simScenario.selectedScenarioId,
    selectedItems: state.simScenario.selectedItems,
    dataByScenario: state.simData.dataByScenario,
    bookingsByScenario: state.simBooking.bookingsByScenario,
    groupsByScenario: state.simGroup.groupsByScenario,
    groupDefsByScenario: state.simGroup.groupDefsByScenario,
    financeByScenario: state.simFinance.financeByScenario,
    qualificationDefsByScenario: state.simQualification.qualificationDefsByScenario,
    qualificationAssignmentsByScenario: state.simQualification.qualificationAssignmentsByScenario,
    chartStore: {
      stichtag: state.chart.stichtag,
      selectedGroups: state.chart.selectedGroups,
      selectedQualifications: state.chart.selectedQualifications,
      midtermTimeDimension: state.chart.midtermTimeDimension,
      midtermSelectedGroups: state.chart.midtermSelectedGroups,
      midtermSelectedQualifications: state.chart.midtermSelectedQualifications,
      weeklySelectedScenarioId: state.chart.weeklySelectedScenarioId,
      midtermSelectedScenarioId: state.chart.midtermSelectedScenarioId,
      chartToggles: state.chart.chartToggles,
    }
  };
};

const PRIVATE_EXPORT_FIELDS = new Set([
  'adebisid', 'address', 'adrnr', 'anstellnr', 'bemerkung', 'bic', 'comment', 'famnr', 'geschw1vn', 'geschw2vn', 'geschw3vn', 'grunr',
  'grund', 'iban', 'idnr', 'kindnr', 'kontoinhaber', 'kontonr', 'kontonummer', 'landkreis', 'lkz', 'mail',
  'medicalreason', 'mobile', 'mobil', 'notiz', 'notes', 'ort', 'ortsteil', 'phone', 'personalnr', 'persnr',
  'plz', 'postcode', 'postalcode', 'reason', 'reasontext', 'remark', 'sourcefile', 'filename', 'originalfilename',
  'strasse', 'street', 'telefon', 'telefonnummer', 'wohnort',
]);
const PRIVATE_NAME_FIELDS = new Set([
  'name', 'fname', 'vorname', 'nachname', 'firstname', 'lastname', 'surname', 'fullname', 'bez',
]);

function normalizeExportField(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stripPrivateExportFields(value, removeNames = false) {
  if (Array.isArray(value)) return value.map((entry) => stripPrivateExportFields(entry, removeNames));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => {
      const normalizedKey = normalizeExportField(key);
      return !PRIVATE_EXPORT_FIELDS.has(normalizedKey)
        && !(removeNames && PRIVATE_NAME_FIELDS.has(normalizedKey));
    })
    .map(([key, entry]) => [key, stripPrivateExportFields(entry, removeNames)]));
}

function anonymizeScenarioDataItems(items = {}) {
  const familyIds = new Map();
  const childCounters = { demand: 0, capacity: 0, other: 0 };

  return Object.fromEntries(Object.entries(items).map(([itemId, sourceItem]) => {
    const item = stripPrivateExportFields(sourceItem, true);
    const type = sourceItem?.type || 'other';
    childCounters[type] = (childCounters[type] || 0) + 1;
    const displayName = type === 'demand'
      ? `Kind ${childCounters.demand}`
      : type === 'capacity' ? `Mitarbeiter ${childCounters.capacity}` : `Eintrag ${childCounters.other}`;
    const familyKey = String(sourceItem?.familyId || sourceItem?.familyLabel || `item:${itemId}`);
    if (type === 'demand' && !familyIds.has(familyKey)) {
      familyIds.set(familyKey, `family-${familyIds.size + 1}`);
    }
    const familyId = type === 'demand' ? familyIds.get(familyKey) : undefined;
    const familyLabel = type === 'demand' ? `Familie ${familyIds.get(familyKey).slice('family-'.length)}` : undefined;
    const rawdata = stripPrivateExportFields(sourceItem?.rawdata || {}, true);
    const originalData = sourceItem?.originalData && typeof sourceItem.originalData === 'object'
      ? {
        ...stripPrivateExportFields(sourceItem.originalData, true),
        name: displayName,
        remark: '',
        ...(type === 'demand' ? { familyId, familyLabel } : {}),
      }
      : undefined;

    return [String(itemId), {
      ...item,
      id: String(itemId),
      name: displayName,
      remark: '',
      ...(type === 'demand' ? { familyId, familyLabel } : {}),
      ...(Object.keys(rawdata).length > 0 ? { rawdata } : {}),
      ...(originalData ? { originalData } : {}),
    }];
  }));
}

function anonymizeGroupDefinitions(groupDefinitions = []) {
  return groupDefinitions.map((definition, index) => ({
    ...stripPrivateExportFields(definition, true),
    name: `Gruppe ${index + 1}`,
    ...(definition?.rawdata
      ? { rawdata: stripPrivateExportFields(definition.rawdata, true) }
      : {}),
  }));
}

export function anonymizeSaveData(saveData) {
  const data = stripPrivateExportFields(saveData || {});
  data.scenarios = (data.scenarios || []).map((scenario, index) => ({
    ...stripPrivateExportFields(scenario, true),
    name: `Szenario ${index + 1}`,
    remark: '',
    importedAnonymized: true,
  }));
  data.dataByScenario = Object.fromEntries(Object.entries(data.dataByScenario || {}).map(([scenarioId, items]) => [
    scenarioId,
    anonymizeScenarioDataItems(items),
  ]));
  data.groupDefsByScenario = Object.fromEntries(Object.entries(data.groupDefsByScenario || {}).map(([scenarioId, definitions]) => [
    scenarioId,
    anonymizeGroupDefinitions(definitions),
  ]));
  data.bookingsByScenario = stripPrivateExportFields(data.bookingsByScenario || {}, true);
  data.groupsByScenario = stripPrivateExportFields(data.groupsByScenario || {}, true);
  data.financeByScenario = Object.fromEntries(Object.entries(data.financeByScenario || {}).map(([scenarioId, finance]) => [
    scenarioId,
    { ...stripPrivateExportFields(finance), itemFinances: {} },
  ]));
  return data;
}

// Save data to encrypted file
export const saveToFile = async (data, password, filename = 'capakita-data.enc') => {
  try {
    const json = JSON.stringify(data, null, 2);
    const ciphertext = CryptoJS.AES.encrypt(json, password).toString();
    
    const blob = new Blob([ciphertext], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Load and decrypt data from file
export const loadFromFile = async (file, password) => {
  try {
    const ciphertext = await file.text();
    const bytes = CryptoJS.AES.decrypt(ciphertext, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      throw new Error('Falsches Passwort oder beschädigte Datei.');
    }
    
    const data = JSON.parse(decrypted);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
