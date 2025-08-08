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
 * Returns the valid fee object for a given child, financial assignment, reference date, and bookings.
 * @param {string} refDate - ISO date string
 * @param {Object} dataItem - The child object
 * @param {Object} financialItem - The Financial object (income-fee)
 * @param {Object} financialDef - The FinancialDef object
 * @param {Object} groupAssignments - Group assignments for the child (object of assignments)
 * @param {Array} bookings - Array of booking objects for the child
 * @returns {Object|null} The matching fee object or null
 */
export function getValidFee(refDate, dataItem, financialItem, financialDef, groupAssignments, bookings) {
  // 1. Check if child is present at refDate
  if (!dataItem) return null;
  const present =
    (!dataItem.startdate || dataItem.startdate <= refDate) &&
    (!dataItem.enddate || dataItem.enddate >= refDate);
  if (!present) return null;

  // 2. Find assigned group at refDate
  let assignedGroupId = null;
  if (groupAssignments) {
    const activeAssignment = Object.values(groupAssignments).find(a => {
      const startOk = !a.start || a.start <= refDate;
      const endOk = !a.end || a.end >= refDate;
      return startOk && endOk;
    });
    assignedGroupId = activeAssignment?.groupId || dataItem.groupId || null;
  } else {
    assignedGroupId = dataItem.groupId || null;
  }
  if (!assignedGroupId) return null;

  // 3. Find correct feeSet in financialDef for assigned group and date
  let feeSetsArr = [];
  if (financialDef?.fee_sets && Array.isArray(financialDef.fee_sets)) {
    feeSetsArr = financialDef.fee_sets;
  }
  let feeSet = null;
  if (feeSetsArr.length > 0) {
    feeSet = feeSetsArr.find(set =>
      set.groupref === assignedGroupId &&
      (!set.valid_from || set.valid_from <= refDate) &&
      (!set.valid_to || set.valid_to >= refDate)
    );
  }
  if (!feeSet || !Array.isArray(feeSet.fees)) {
    return null;
  }

  // 4. Sum booking hours for the child at refDate
  let bookingHours = 0;
  if (Array.isArray(bookings)) {
    bookings.forEach(booking => {
      const startOk = !booking.startdate || booking.startdate <= refDate;
      const endOk = !booking.enddate || booking.enddate >= refDate;
      if (startOk && endOk) {
        // Sum all hours in booking.times
        if (Array.isArray(booking.times)) {
          booking.times.forEach(dayObj => {
            if (Array.isArray(dayObj.segments)) {
              dayObj.segments.forEach(seg => {
                // Assume booking_start and booking_end are in "HH:MM" format
                const [startH, startM] = seg.booking_start.split(':').map(Number);
                const [endH, endM] = seg.booking_end.split(':').map(Number);
                let hours = (endH + endM / 60) - (startH + startM / 60);
                if (hours > 0) bookingHours += hours;
              });
            }
          });
        }
      }
    });
  }

  // 5. Find the fee for the booking hours (maxHours >= bookingHours, lowest maxHours that fits)
  const sortedFees = [...feeSet.fees].sort((a, b) => a.maxHours - b.maxHours);
  for (const fee of sortedFees) {
    if (bookingHours <= fee.maxHours) {
      return fee;
    }
  }
  // If no fee matches, return the highest maxHours fee (fallback)
  if (sortedFees.length > 0) {
    return sortedFees[sortedFees.length - 1];
  }
  //console.warn("[getValidFee] No fee found at all");
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
      // Also check for nested fee_sets
      if (Array.isArray(obj.fee_sets)) {
        obj.fee_sets.forEach(fs => {
          if (fs.valid_from) addDate(fs.valid_from);
          if (fs.valid_to) addDate(fs.valid_to);
        });
      }
    });
  });

  // Filter, sort, deduplicate, and remove empty strings
  let result = dates.filter(d => d && d !== "").map(d => new Date(d).toISOString().slice(0, 10));
  if (minDate) {
    result = result.filter(d => d >= minDate);
  }
  return [...new Set(result)].sort();
}

/**
 * Utility to find a financialDef by id from an array or object.
 * Returns the matching def or the first one if not found, or null if none.
 */
export function getFinancialDefById(financialDefs, financialDefId) {
  if (Array.isArray(financialDefs)) {
    if (!financialDefId && financialDefs.length > 0) return financialDefs[0];
    return financialDefs.find(def => def.id === financialDefId) || financialDefs[0] || null;
  } else if (financialDefs && typeof financialDefs === "object") {
    if (!financialDefId && financialDefs.id) return financialDefs;
    if (financialDefs.id === financialDefId) return financialDefs;
    return null;
  }
  return null;
}
