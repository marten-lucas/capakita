/**
 * Returns all payments for a financial object that overlap with the given period.
 * @param {string} start - ISO date string (inclusive)
 * @param {string} end - ISO date string (inclusive)
 * @param {Object} financial - Financial object with payments array
 * @param {Object} [opts] - Options object
 *   - {string[]} [types] - Only include payments of these types (e.g. ['income','expense'])
 * @returns {Array} Array of payment objects
 */
export function getPayments4Period(start, end, financials, opts = {}) {
  if (Array.isArray(financials)) {
    // If array, flatten all payments from all financials
    return financials.flatMap(financial => getPayments4Period(start, end, financial, opts));
  }
  if (!financials?.payments || !Array.isArray(financials.payments)) {
    console.warn("[getPayments4Period] No payments found for financial:", financials);
    return [];
  }
  const startDate = new Date(start);
  const endDate = new Date(end);

  const filtered = financials.payments.filter(payment => {
    const paymentStart = payment.valid_from ? new Date(payment.valid_from) : null;
    const paymentEnd = payment.valid_to ? new Date(payment.valid_to) : paymentStart;
    if (!paymentStart) return false;
    // Overlap: payment period intersects [startDate, endDate]
    const overlaps = paymentEnd >= startDate && paymentStart <= endDate;
    if (!overlaps) return false;
    if (opts.types && Array.isArray(opts.types) && opts.types.length > 0) {
      return opts.types.includes(payment.type);
    }
    return true;
  });
  return filtered;
}

/**
 * Returns the sum of amounts for all payments in a financial object that overlap with the given period.
 * @param {string} start - ISO date string (inclusive)
 * @param {string} end - ISO date string (inclusive)
 * @param {Object} financial - Financial object with payments array
 * @param {Object} [opts] - Options object
 *   - {boolean} [balance=false] - If true, expenses are negated
 *   - {string[]} [types] - Only include payments of these types
 * @returns {Object} { sum: number, types: string[] }
 */
export function getPaymentSum4Period(start, end, financials, opts = {}) {
  const { balance = false, types } = opts;
  const payments = getPayments4Period(start, end, financials, { types });
  let sum = 0;
  const typeSet = new Set();
  payments.forEach(p => {
    typeSet.add(p.type);
    let amount = Number(p.amount) || 0;
    if (balance && p.type === 'expense') amount = -amount;
    sum += amount;
  });
  return { sum, types: Array.from(typeSet) };
}

/**
 * Returns the valid fee object for a given financial assignment, reference date, and booking hours.
 * @param {Object} financial - The Financial object (income-fee)
 * @param {Object} financialDef - The FinancialDef object
 * @param {Array} feeGroups - Array of assigned fee groups (with valid_from/to)
 * @param {string} refDate - ISO date string
 * @param {number} bookingHours - Number of booking hours in this period
 * @returns {Object|null} The matching fee object or null
 */
export function getValidFee(financial, financialDef, feeGroups, refDate, bookingHours) {
  // Find the assigned fee group for this date
  let groupRef = ""; // Not used for id matching anymore
  let assignedGroup = null;

  // Prefer explicit feeGroups assignment if present
  if (Array.isArray(feeGroups) && feeGroups.length > 0) {
    assignedGroup = feeGroups.find(g => {
      const from = g.valid_from ? new Date(g.valid_from) : null;
      const to = g.valid_to ? new Date(g.valid_to) : null;
      const d = new Date(refDate);
      return (!from || d >= from) && (!to || d <= to);
    });
    if (assignedGroup) groupRef = assignedGroup.groupref;
  }

  

  // Find the matching fee group in the FinancialDef
  let feeGroup = null;
  if (financialDef?.fee_groups && Array.isArray(financialDef.fee_groups)) {
    // Use groupref from assignedGroup if present, otherwise use groupref from fee group
    feeGroup = financialDef.fee_groups.find(g => {
      // If assignedGroup, match groupref; otherwise, just match by date
      if (assignedGroup && g.groupref !== groupRef) return false;
      const from = g.valid_from ? new Date(g.valid_from) : null;
      const to = g.valid_to ? new Date(g.valid_to) : null;
      const d = new Date(refDate);
      return (!from || d >= from) && (!to || d <= to);
    });
  }



  if (!feeGroup || !Array.isArray(feeGroup.fees)) {
    console.warn("[getValidFee] No matching feeGroup or fees array");
    return null;
  }

  // Find the fee for the booking hours (maxHours >= bookingHours, lowest maxHours that fits)
  const sortedFees = [...feeGroup.fees].sort((a, b) => a.maxHours - b.maxHours);
  for (const fee of sortedFees) {
    if (bookingHours <= fee.maxHours) {
      return fee;
    }
  }
  // If no fee matches, return the highest maxHours fee (fallback)
  if (sortedFees.length > 0) {
    return sortedFees[sortedFees.length - 1];
  }
  console.warn("[getValidFee] No fee found at all");
  return null;
}

/**
 * Collect all relevant change dates from an array of objects or arrays.
 * For each object, checks for startdate/enddate and valid_from/valid_to pairs.
 * Returns a sorted, deduplicated array of ISO date strings (YYYY-MM-DD).
 * Only includes dates >= minDate (if provided).
 * @param {Array} sources - Array of objects or arrays of objects
 * @param {string} [minDate] - ISO date string; only include dates >= minDate
 * @returns {string[]} Sorted array of unique ISO date strings
 */
export function collectRelevantDatesFromObjects(sources, minDate) {
  const dates = [];
  const addDate = d => { if (d && d !== "") dates.push(d); };

  sources.forEach(source => {
    if (!source) return;
    const items = Array.isArray(source)
      ? source
      : typeof source === "object"
        ? Object.values(source)
        : [];
    items.forEach(obj => {
      if (!obj || typeof obj !== "object") return;
      if (obj.startdate) addDate(obj.startdate);
      if (obj.enddate) addDate(obj.enddate);
      if (obj.valid_from) addDate(obj.valid_from);
      if (obj.valid_to) addDate(obj.valid_to);
    });
  });

  // Filter, sort, deduplicate, and remove empty strings
  let result = dates.filter(d => d && d !== "").map(d => new Date(d).toISOString().slice(0, 10));
  if (minDate) {
    result = result.filter(d => d >= minDate);
  }
  return [...new Set(result)].sort();
}
