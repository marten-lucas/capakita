import { getAvrAmountForGroupAndStage, getAvrFulltimeHours, getStageUpgradeDates, getPresencePercentageInPeriod, getAvrStageAtDate } from "../avrUtils";
import { sumBookingHoursForPeriod } from "../../bookingUtils";
import { buildPeriodsFromDates } from "../../dateUtils";
import { collectRelevantDatesFromObjects } from "../financialUtils";

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
  // Collect all relevant change dates (do NOT filter by minDate here)
  const dates = collectRelevantDatesFromObjects([
    [dataItem],
    bookings
  ]);

  // Add AVR stage upgrade dates (if any)
  const today = new Date().toISOString().slice(0, 10);
  if (dataItem?.startdate && financial?.type_details?.stage) {
    const upgradeDates = getStageUpgradeDates(
      dataItem.startdate,
      Number(financial.type_details.stage),
      today
    );
    upgradeDates.forEach(upg => dates.push(upg.date));
  }

  // Add financial from/to if present
  if (financial?.from) dates.push(new Date(financial.from).toISOString().slice(0, 10));
  if (financial?.to) dates.push(new Date(financial.to).toISOString().slice(0, 10));

  // Filter, sort, deduplicate, and remove empty strings
  const uniqueDates = [...new Set(dates.filter(d => d && d !== ""))].sort();

  let periods = buildPeriodsFromDates(uniqueDates);

  
  const group = Number(financial?.type_details?.group);
  const initialStage = Number(financial?.type_details?.stage);

  // Use dataItem.startdate or type_details.StartDate as employment start
  const employmentStart = dataItem?.startdate || financial?.type_details?.StartDate;

  // Use working hours from type_details or fallback to sum of bookings
  const workingHours = sumBookingHoursForPeriod(bookings, null, null);

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

