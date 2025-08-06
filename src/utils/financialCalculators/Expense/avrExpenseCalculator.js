import { getAvrAmountForGroupAndStage, getAvrFulltimeHours, getStageUpgradeDates, getPresencePercentageInPeriod } from "../avrUtils";
import { sumBookingHours as sumBookingHoursFromBooking } from "../../bookingUtils";

// TODO: Implpement inflation beyond avr Data

export function updatePayments(financial, dataItem, bookings, avrStageUpgrades) {
  // Compose payments using all dependencies
  const payments = buildPayments(financial, dataItem, bookings, avrStageUpgrades);
  return payments;
}

/**
 * Build payment objects for each period.
 * @param {object} financial
 * @param {object} dataItem
 * @param {Array} bookings
 * @param {Array} avrStageUpgrades
 * @returns {Array} payments
 */
function buildPayments(financial, dataItem, bookings, avrStageUpgrades) {
  const dates = collectRelevantDates(financial, dataItem, bookings, avrStageUpgrades);
  const periods = buildPeriodsFromDates(dates);

  const group = Number(financial?.type_details?.group);
  const initialStage = Number(financial?.type_details?.stage);

  // Use dataItem.startdate or type_details.StartDate as employment start
  const employmentStart = dataItem?.startdate || financial?.type_details?.StartDate;

  // Use working hours from type_details or fallback to sum of bookings
  const workingHours = Number(financial?.type_details?.WorkingHours) || sumBookingHours(bookings, null, null);

  return periods.map(period => {
    const { valid_from, valid_to } = period;
    const avrStage = getAvrStageAtDate(
      employmentStart,
      initialStage,
      avrStageUpgrades,
      valid_from
    );
    // Use presence percentage for absence reduction
    let absenceFactor = 1;
    if (Array.isArray(dataItem?.absences) && valid_to) {
      const periodStart = new Date(valid_from);
      const periodEnd = new Date(valid_to);
      absenceFactor = getPresencePercentageInPeriod(dataItem, periodStart, periodEnd);
    }
    let amount = 0;
    if (group && avrStage) {
      const avrAmount = getAvrAmountForGroupAndStage(group, avrStage, valid_from);
      const fulltimeHours = getAvrFulltimeHours(valid_from);
      const reduction = fulltimeHours > 0 ? (workingHours / fulltimeHours) : 1;
      amount = avrAmount * reduction * absenceFactor;
    }
    return {
      valid_from,
      valid_to,
      amount,
      frequency: "monthly",
      currency: 'EUR',
      type: 'expense',
    };
  });
}

/**
 * Collect all relevant change dates for payment segmentation.
 * @param {object} financial - The financial object (with .from, .to, .type_details, etc.)
 * @param {object} dataItem - The data item (with .startdate, .enddate, .absences)
 * @param {Array} bookings - Array of booking objects (with .startdate, .enddate)
 * @returns {string[]} Sorted array of unique ISO date strings
 */
function collectRelevantDates(financial, dataItem, bookings) {
  const dates = [];

  // Data item start is always present and required
  if (dataItem?.startdate) dates.push(dataItem.startdate);
  // Data item enddate may be empty, skip if empty
  if (dataItem?.enddate && dataItem.enddate !== "") dates.push(dataItem.enddate);

  // Absence periods
  if (Array.isArray(dataItem?.absences)) {
    dataItem.absences.forEach(abs => {
      if (abs.start && abs.start !== "") dates.push(abs.start);
      if (abs.end && abs.end !== "") dates.push(abs.end);
    });
  }

  // Bookings start/end: only push if non-empty string
  if (bookings) {
    if (Array.isArray(bookings)) {
      bookings.forEach(b => {
        if (b.startdate && b.startdate !== "") dates.push(b.startdate);
        if (b.enddate && b.enddate !== "") dates.push(b.enddate);
      });
    } else if (typeof bookings === "object") {
      Object.values(bookings).forEach(b => {
        if (b.startdate && b.startdate !== "") dates.push(b.startdate);
        if (b.enddate && b.enddate !== "") dates.push(b.enddate);
      });
    }
  }

  // AVR stage upgrades: use getStageUpgradeDates with today as reference
  if (dataItem?.startdate && financial?.type_details?.stage) {
    const today = new Date().toISOString().slice(0, 10);
    const upgradeDates = getStageUpgradeDates(
      dataItem.startdate,
      Number(financial.type_details.stage),
      today
    );
    upgradeDates.forEach(upg => dates.push(upg.date));
  }

  // Financial start/end: only push if non-empty string
  if (financial?.from && financial.from !== "") dates.push(financial.from);
  if (financial?.to && financial.to !== "") dates.push(financial.to);

  // Filter, sort, deduplicate, and remove empty strings
  return [...new Set(
    dates.filter(d => d && d !== "").map(d => new Date(d).toISOString().slice(0, 10))
  )].sort();
}

/**
 * Given a sorted array of unique dates, build periods with valid_from and valid_to.
 * The last period will have only valid_from and no valid_to (open-ended).
 * Periods should not overlap - valid_to is one day before the next valid_from.
 * @param {string[]} sortedDates - Array of ISO date strings, sorted ascending.
 * @returns {Array<{valid_from: string, valid_to?: string}>}
 */
function buildPeriodsFromDates(sortedDates) {
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
 * Calculate the sum of booking hours for a period.
 * @param {Object} bookingsById - Object of bookingId -> booking object (with .startdate, .enddate, .times)
 * @param {string} from - Period start (inclusive, ISO string)
 * @param {string} to - Period end (exclusive, ISO string)
 * @returns {number}
 */
function sumBookingHours(bookingsById, from, to) {
  if (!bookingsById || typeof bookingsById !== "object") return 0;
  let total = 0;
  Object.values(bookingsById).forEach(booking => {
    // Booking overlaps with period (no overlap validation needed)
    if (
      booking.startdate &&
      (booking.enddate || !to) &&
      booking.times &&
      (!from || booking.startdate < to) &&
      (!to || !booking.enddate || booking.enddate > from)
    ) {
      const hours = sumBookingHoursFromBooking(booking);
      total += hours;
    }
  });
  return total;
}

