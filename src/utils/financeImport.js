/**
 * Import function for official BayKiBiG table from STMAS Excel file
 * Source: https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls
 * 
 * Extracts:
 * - Base value from cell B2
 * - Weight factors from row 5 (C5=regelkind, E5=schulkind, G5=migration, I5=under3, K5=disabled)
 */

function parseBayKiBiGWorkbook(workbook) {
  if (!workbook.SheetNames.includes('Fördertabellen')) {
    throw new Error('Sheet "Fördertabellen" not found in Excel file');
  }

  const worksheet = workbook.Sheets['Fördertabellen'];

  // Extract base value from B2 (row 2, column B)
  const baseValueCell = worksheet.B2;
  const baseValue = baseValueCell ? Number(baseValueCell.v) : null;

  if (!baseValue || !Number.isFinite(baseValue)) {
    throw new Error('Could not extract base value from cell B2');
  }

  // Extract weight factors from row 5
  // Column mapping: C=regelkind, E=schulkind, G=migration, I=under3, K=disabled
  const factors = {
    regelkind_3to6: extractCellValue(worksheet, 'C5', 1.0),
    schulkind: extractCellValue(worksheet, 'E5', 1.2),
    migration: extractCellValue(worksheet, 'G5', 1.3),
    under3: extractCellValue(worksheet, 'I5', 2.0),
    disabled: extractCellValue(worksheet, 'K5', 4.5),
  };

  // Get current year for the rule
  const currentYear = new Date().getFullYear();
  const validFrom = `${currentYear}-01-01`;
  const validUntil = `${currentYear}-12-31`;

  return {
    label: `BayKiBiG ${currentYear} (offizielle Tabelle)`,
    baseValue,
    weightFactors: factors,
    validFrom,
    validUntil,
  };
}

async function parseBayKiBiGArrayBuffer(arrayBuffer) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  return parseBayKiBiGWorkbook(workbook);
}

// Download-Reihenfolge für die offizielle Tabelle:
// 1. same-origin STMAS-Proxy (Dev/Coolify),
// 2. same-origin, im Pages-Build ausgelieferte öffentliche Tabellenkopie,
// 3. direkter Fetch und optionale CORS-Proxys für frei eingegebene URLs.
const OFFICIAL_STMAS_HOST = 'www.stmas.bayern.de';
const OFFICIAL_STMAS_PATH = '/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls';
const LOCAL_OFFICIAL_TABLE_PATH = 'reference/baykibig-foerdertabellen.xls';
const CORS_PROXY_BUILDERS = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
];

function resolveApplicationBaseUrl() {
  if (typeof window !== 'undefined' && String(import.meta.env.BASE_URL || '').startsWith('/')) {
    return new URL(import.meta.env.BASE_URL, window.location.origin);
  }
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  }
  return new URL('../', new URL('.', import.meta.url));
}

export function buildDownloadCandidates(url, {
  applicationBaseUrl = resolveApplicationBaseUrl(),
  serverProxyAvailable = import.meta.env.DEV || String(import.meta.env.BASE_URL || '').startsWith('/'),
} = {}) {
  const trimmed = String(url || '').trim();
  const candidates = [];
  let parsed = null;
  try {
    parsed = new URL(trimmed);
  } catch {
    parsed = null;
  }

  if (parsed && parsed.host === OFFICIAL_STMAS_HOST) {
    if (serverProxyAvailable) {
      const proxyPath = `stmas-proxy${parsed.pathname}${parsed.search || ''}`;
      candidates.push(new URL(proxyPath, applicationBaseUrl).href);
    }
    if (parsed.pathname === OFFICIAL_STMAS_PATH) {
      candidates.push(new URL(LOCAL_OFFICIAL_TABLE_PATH, applicationBaseUrl).href);
    }
  }
  candidates.push(trimmed);
  CORS_PROXY_BUILDERS.forEach((build) => candidates.push(build(trimmed)));
  return candidates;
}

function shortCandidateLabel(candidate) {
  const text = String(candidate);
  if (text.includes('/stmas-proxy/')) return 'STMAS-Proxy';
  if (text.includes(LOCAL_OFFICIAL_TABLE_PATH)) return 'lokale Tabellenkopie';
  if (text.includes('allorigins')) return 'CORS-Proxy allorigins';
  if (text.includes('corsproxy')) return 'CORS-Proxy corsproxy.io';
  try {
    return new URL(text).host;
  } catch {
    return text.slice(0, 40);
  }
}

function looksLikeExcelFile(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 4) return false;
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  // XLS (BIFF): D0 CF 11 E0 — XLSX (OOXML): PK\x03\x04
  return (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
    || (bytes[0] === 0x50 && bytes[1] === 0x4b);
}

export async function importBayKiBiGTableFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        const result = await parseBayKiBiGArrayBuffer(arrayBuffer);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export async function importBayKiBiGTableFromUrl(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('Bitte eine gueltige URL angeben.');
  }

  const attempts = [];
  for (const candidate of buildDownloadCandidates(url, options)) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) {
        attempts.push(`${shortCandidateLabel(candidate)}: HTTP ${response.status}`);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!looksLikeExcelFile(arrayBuffer)) {
        attempts.push(`${shortCandidateLabel(candidate)}: keine Excel-Datei`);
        continue;
      }
      return await parseBayKiBiGArrayBuffer(arrayBuffer);
    } catch (error) {
      attempts.push(`${shortCandidateLabel(candidate)}: ${error?.message || 'Netzwerk/CORS'}`);
    }
  }

  throw new Error(
    'Download fehlgeschlagen. Bitte URL pruefen oder die Datei ueber den Datei-Import einlesen. Versucht: '
    + attempts.join(' | ')
  );
}

function extractCellValue(worksheet, cellAddress, defaultValue = null) {
  const cell = worksheet[cellAddress];
  if (!cell) return defaultValue;
  
  const value = Number(cell.v);
  return Number.isFinite(value) ? value : defaultValue;
}
