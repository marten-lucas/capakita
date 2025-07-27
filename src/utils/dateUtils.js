// Convert DD.MM.YYYY to YYYY-MM-DD
export function convertDDMMYYYYtoYYYYMMDD(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('.');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
}

// Convert YYYY-MM-DD to DD.MM.YYYY
export function convertYYYYMMDDtoDDMMYYYY(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return '';
}

// Compare two dates for modification (used for marking changes)
export function isDateModified(local, original) {
  if (!original && !local) return false;
  if (!original || !local) return true;
  const origParts = original.split('.');
  if (origParts.length !== 3) return true;
  const origIso = `${origParts[2]}-${origParts[1].padStart(2, '0')}-${origParts[0].padStart(2, '0')}`;
  return origIso !== local;
}

// Parse date string (dd.mm.yyyy)
export function parseDate(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('.');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return null;
}

// Check if date is in the future or empty
export function isFutureOrEmptyDate(dateString) {
  if (!dateString || dateString.trim() === '') return true;
  const date = parseDate(dateString);
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date >= now;
}

// Check if a string is a valid YYYY-MM-DD date
export function isValidDateString(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}
