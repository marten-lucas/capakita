export function updatePayments(financial) {
  // ...implement yearly bonus payment calculation...
  // Return a new payments array instead of mutating the object
  const payments = [];
  // ...fill payments as needed...
  console.log("Yearly bonus payments updated:", payments);
  return payments;
}

/**
 * Collect all relevant change dates for payment segmentation.
 * @param {object} financial - The financial object (with .from, .to, .type_details, etc.)
 * @param {object} dataItem - The data item (with .startdate, .enddate, .absences)
 * @param {Array} bookings - Array of booking objects (with .startdate, .enddate)
 * @param {Array} avrStageUpgrades - Array of upgrade rules (with .years, etc.)
 * @returns {string[]} Sorted array of unique ISO date strings
 */
function collectRelevantDates(financial, dataItem, bookings, avrStageUpgrades) {
  const dates = [];

  // Data item start/end
  if (dataItem?.startdate) dates.push(dataItem.startdate);
  if (dataItem?.enddate) dates.push(dataItem.enddate);

  // Absence periods
  if (Array.isArray(dataItem?.absences)) {
    dataItem.absences.forEach(abs => {
      if (abs.start) dates.push(abs.start);
      if (abs.end) dates.push(abs.end);
    });
  }

  // Bookings start/end
  if (Array.isArray(bookings)) {
    bookings.forEach(b => {
      if (b.startdate) dates.push(b.startdate);
      if (b.enddate) dates.push(b.enddate);
    });
  }

  // AVR stage upgrades (calculate upgrade dates)
  if (dataItem?.startdate && Array.isArray(avrStageUpgrades)) {
    let baseDate = new Date(dataItem.startdate);
    avrStageUpgrades.forEach(upg => {
      baseDate = new Date(baseDate.getFullYear() + (upg.years || 0), baseDate.getMonth(), baseDate.getDate());
      dates.push(baseDate.toISOString().slice(0, 10));
    });
  }

  // Financial start/end
  if (financial?.from) dates.push(financial.from);
  if (financial?.to) dates.push(financial.to);

  // Filter, sort, deduplicate
  return [...new Set(
    dates.filter(Boolean).map(d => new Date(d).toISOString().slice(0, 10))
  )].sort();
}

/**
 * Given a sorted array of unique dates, build periods with valid_from and valid_to.
 * @param {string[]} sortedDates - Array of ISO date strings, sorted ascending.
 * @returns {Array<{valid_from: string, valid_to: string}>}
 */
function buildPeriodsFromDates(sortedDates) {
  const periods = [];
  for (let i = 0; i < sortedDates.length - 1; i++) {
    periods.push({
      valid_from: sortedDates[i],
      valid_to: sortedDates[i + 1]
    });
  }
  return periods;
}

/**
 * Determine AVR stage for a given date.
 * @param {string} startdate - Employment start date (ISO string)
 * @param {number} initialStage - The starting AVR stage (from type_details.stage)
 * @param {Array} avrStageUpgrades - Array of upgrade rules (with .from_stage, .to_stage, .years)
 * @param {string} currentDate - The date to check (ISO string)
 * @returns {number} The AVR stage at the given date
 */
function getAvrStageAtDate(startdate, initialStage, avrStageUpgrades, currentDate) {
  if (!startdate || !initialStage || !Array.isArray(avrStageUpgrades)) return initialStage;
  let stage = initialStage;
  let baseDate = new Date(startdate);

  for (const upg of avrStageUpgrades) {
    baseDate = new Date(baseDate.getFullYear() + (upg.years || 0), baseDate.getMonth(), baseDate.getDate());
    if (new Date(currentDate) >= baseDate) {
      stage = upg.to_stage;
    } else {
      break;
    }
  }
  return stage;
}

/**
 * Check if the employee is fully absent during a period.
 * @param {Array} absences - Array of absence objects with .start and .end (ISO strings)
 * @param {string} from - Period start (inclusive, ISO string)
 * @param {string} to - Period end (exclusive, ISO string)
 * @returns {boolean}
 */
function isFullyAbsent(absences, from, to) {
  if (!Array.isArray(absences)) return false;
  for (const abs of absences) {
    if (abs.start && abs.end) {
      // If absence fully covers the period
      if (abs.start <= from && abs.end >= to) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculate the sum of booking hours for a period.
 * @param {Array} bookings - Array of booking objects with .startdate, .enddate, .hours
 * @param {string} from - Period start (inclusive, ISO string)
 * @param {string} to - Period end (exclusive, ISO string)
 * @returns {number}
 */
function sumBookingHours(bookings, from, to) {
  if (!Array.isArray(bookings)) return 0;
  let total = 0;
  for (const b of bookings) {
    // Booking overlaps with period
    if (
      b.startdate &&
      b.enddate &&
      b.hours &&
      b.startdate < to &&
      b.enddate > from
    ) {
      total += Number(b.hours) || 0;
    }
  }
  return total;
}
