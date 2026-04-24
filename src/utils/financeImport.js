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

function normalizeImportUrl(url) {
  const trimmed = String(url || '').trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  // Browser direct fetch to stmas often fails because of CORS.
  // In dev we route through Vite proxy under /stmas-proxy.
  if (parsed.host === 'www.stmas.bayern.de') {
    const query = parsed.search || '';
    return `/stmas-proxy${parsed.pathname}${query}`;
  }

  return trimmed;
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

export async function importBayKiBiGTableFromUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Bitte eine gueltige URL angeben.');
  }

  const resolvedUrl = normalizeImportUrl(url);

  let response;
  try {
    response = await fetch(resolvedUrl);
  } catch {
    throw new Error('Download fehlgeschlagen (Network/CORS). Bitte pruefe die URL oder nutze den Datei-Import.');
  }

  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return parseBayKiBiGArrayBuffer(arrayBuffer);
}

function extractCellValue(worksheet, cellAddress, defaultValue = null) {
  const cell = worksheet[cellAddress];
  if (!cell) return defaultValue;
  
  const value = Number(cell.v);
  return Number.isFinite(value) ? value : defaultValue;
}
