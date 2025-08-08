import { buildPeriodsFromDates } from "../../dateUtils";
import { collectRelevantDatesFromObjects } from "../financialUtils";

export function updatePayments(financial, dataItem, bookings) {
  console.log('CustomExpenseCalculator: updatePayments called', { financial, dataItem, bookings });
  // Compose payments using all dependencies
  const payments = buildPayments(financial, dataItem, bookings);
  console.log('CustomExpenseCalculator: payments generated', payments);
  return payments;
}

/**
 * Build payment objects for each period.
 * @param {object} financial
 * @param {object} dataItem
 * @param {Array} bookings
 * @returns {Array} payments
 */
function buildPayments(financial, dataItem, bookings) {
  console.log('CustomExpenseCalculator: buildPayments started', { financial, dataItem, bookings });
  
  // Collect all relevant change dates (do NOT filter by minDate here)
  const dates = collectRelevantDatesFromObjects([
    [dataItem],
    bookings
  ]);

  // Add financial from/to if present
  if (financial?.valid_from) dates.push(new Date(financial.valid_from).toISOString().slice(0, 10));
  if (financial?.valid_to) dates.push(new Date(financial.valid_to).toISOString().slice(0, 10));

  // Always add today's date to ensure we have current periods for charting
  const today = new Date().toISOString().slice(0, 10);
  dates.push(today);

  console.log('CustomExpenseCalculator: collected dates', dates);

  // Filter, sort, deduplicate, and remove empty strings
  const uniqueDates = [...new Set(dates.filter(d => d && d !== ""))].sort();
  console.log('CustomExpenseCalculator: uniqueDates', uniqueDates);

  let periods = buildPeriodsFromDates(uniqueDates);
  console.log('CustomExpenseCalculator: initial periods', periods);

  // Filter out periods that end before today (but keep open-ended periods)
  periods = periods.filter(p => !p.valid_to || p.valid_to >= today);
  console.log('CustomExpenseCalculator: filtered periods', periods);

  // Get custom amount from type_details
  const customAmount = Number(financial?.type_details?.Amount) || 0;
  console.log('CustomExpenseCalculator: customAmount', customAmount);

  const payments = periods.map(period => {
    const { valid_from, valid_to } = period;

    const payment = {
      valid_from,
      valid_to,
      amount: customAmount,
      frequency: "monthly",
      currency: 'EUR',
      type: 'expense',
    };
    
    console.log('CustomExpenseCalculator: payment created for period', { period, payment });
    return payment;
  });

  console.log('CustomExpenseCalculator: final payments array', payments);
  return payments;
}
