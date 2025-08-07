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
export function parseGermanDateString(dateString) {
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
  const date = parseGermanDateString(dateString);
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date >= now;
}

// Check if a string is a valid YYYY-MM-DD date
export function isValidDateString(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// Format date as d.m.yyyy from YYYY-MM-DD or Date object
export function formatDate(dateStr) {
  if (!dateStr) return '';
  let d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d)) return dateStr;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

// Format a date range string with hours
export function getDateRangeString(start, end, hours) {
  // Helper: check if start is in the past
  function isPast(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (isNaN(date)) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date < now;
  }

  if (!start && !end) return hours ? `${hours} h` : '';
  if (start && end) {
    return hours ? `${hours} h von ${formatDate(start)} bis ${formatDate(end)}` : `${formatDate(start)} bis ${formatDate(end)}`;
  }
  if (start) {
    if (isPast(start)) {
      return hours ? `${hours} h seit ${formatDate(start)}` : `seit ${formatDate(start)}`;
    }
    return hours ? `${hours} h ab ${formatDate(start)}` : `ab ${formatDate(start)}`;
  }
  return hours ? `${hours} h` : '';
}

/**
 * Normalize a date string to ISO format (YYYY-MM-DD).
 * Accepts DD.MM.YYYY, YYYY-MM-DD, or other parseable formats.
 * Returns '' if input is empty or invalid.
 */
export function normalizeToISODateString(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month}-${day}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d)) {
    return d.toISOString().slice(0, 10);
  }
  return dateStr;
}

/**
 * Given a sorted array of unique dates, build periods with valid_from and valid_to.
 * The last period will have only valid_from and no valid_to (open-ended).
 * Periods should not overlap - valid_to is one day before the next valid_from.
 * @param {string[]} sortedDates - Array of ISO date strings, sorted ascending.
 * @returns {Array<{valid_from: string, valid_to?: string}>}
 */
export function buildPeriodsFromDates(sortedDates) {
  const periods = [];
  for (let i = 0; i < sortedDates.length - 1; i++) {
    // Calculate valid_to as one day before the next period starts
    const nextDate = new Date(sortedDates[i + 1]);
    const validTo = new Date(nextDate);
    validTo.setDate(validTo.getDate() - 1);
    periods.push({
      valid_from: sortedDates[i],
      valid_to: validTo.toISOString().slice(0, 10)
    });
  }
  if (sortedDates.length > 0) {
    // Add last open-ended period
    periods.push({
      valid_from: sortedDates[sortedDates.length - 1]
      // no valid_to
    });
  }
  return periods;
}
