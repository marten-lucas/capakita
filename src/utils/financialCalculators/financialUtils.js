/**
 * Returns all payments for a financial object that overlap with the given period.
 * @param {string} start - ISO date string (inclusive)
 * @param {string} end - ISO date string (inclusive)
 * @param {Object} financial - Financial object with payments array
 * @returns {Array} Array of payment objects
 */
export function getPayments4Period(start, end, financial) {
  if (!financial?.payments || !Array.isArray(financial.payments)) {
    console.log("[getPayments4Period] No payments found for financial:", financial);
    return [];
  }
  const startDate = new Date(start);
  const endDate = new Date(end);

  const filtered = financial.payments.filter(payment => {
    const paymentStart = payment.valid_from ? new Date(payment.valid_from) : null;
    const paymentEnd = payment.valid_to ? new Date(payment.valid_to) : paymentStart;
    if (!paymentStart) return false;
    // Overlap: payment period intersects [startDate, endDate]
    return paymentEnd >= startDate && paymentStart <= endDate;
  });
  console.log(`[getPayments4Period] start: ${start}, end: ${end}, found:`, filtered);
  return filtered;
}

/**
 * Returns the sum of amounts for all payments in a financial object that overlap with the given period.
 * @param {string} start - ISO date string (inclusive)
 * @param {string} end - ISO date string (inclusive)
 * @param {Object} financial - Financial object with payments array
 * @returns {number} Sum of payment amounts
 */
export function getPaymentSum4Period(start, end, financial) {
  const payments = getPayments4Period(start, end, financial);
  const sum = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  console.log(`[getPaymentSum4Period] start: ${start}, end: ${end}, sum:`, sum);
  return sum;
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
  let groupRef = financial?.type_details?.groupRef || "";
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

  // Debug: log groupRef and assignedGroup
  console.log("[getValidFee] groupRef:", groupRef, "assignedGroup:", assignedGroup);

  // Find the matching fee group in the FinancialDef
  let feeGroup = null;
  if (financialDef?.fee_groups && Array.isArray(financialDef.fee_groups)) {
    feeGroup = financialDef.fee_groups.find(g => {
      if (groupRef && g.groupref !== groupRef) return false;
      const from = g.valid_from ? new Date(g.valid_from) : null;
      const to = g.valid_to ? new Date(g.valid_to) : null;
      const d = new Date(refDate);
      return (!from || d >= from) && (!to || d <= to);
    });
  }

  // Debug: log feeGroup
  console.log("[getValidFee] feeGroup:", feeGroup);

  if (!feeGroup || !Array.isArray(feeGroup.fees)) {
    console.log("[getValidFee] No matching feeGroup or fees array");
    return null;
  }

  // Find the fee for the booking hours (maxHours >= bookingHours, lowest maxHours that fits)
  const sortedFees = [...feeGroup.fees].sort((a, b) => a.maxHours - b.maxHours);
  for (const fee of sortedFees) {
    if (bookingHours <= fee.maxHours) {
      console.log("[getValidFee] matched fee:", fee, "for bookingHours:", bookingHours);
      return fee;
    }
  }
  // If no fee matches, return the highest maxHours fee (fallback)
  if (sortedFees.length > 0) {
    console.log("[getValidFee] fallback fee:", sortedFees[sortedFees.length - 1]);
    return sortedFees[sortedFees.length - 1];
  }
  console.log("[getValidFee] No fee found at all");
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

