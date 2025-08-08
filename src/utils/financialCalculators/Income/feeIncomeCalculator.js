import { getValidFee, collectRelevantDatesFromObjects } from "../financialUtils";
import { buildPeriodsFromDates } from "../../dateUtils";
import { sumBookingHoursForPeriod } from "../../bookingUtils";

// financial: the Financial object (income-fee)
// dataItem: the child or entity assigned
// bookings: booking objects (by id or array)
// feeGroups: array of fee group assignments (with valid_from/to)
// financialDef: the FinancialDef object for this fee income

/**
 * updatePayments for income-fee
 * @param {Object} financial - The Financial object (income-fee)
 * @param {Object} dataItem - The child or entity assigned
 * @param {Object|Array} bookings - Booking objects (by id or array)
 * @param {Array} feeGroups - Array of fee group assignments (with valid_from/to)
 * @param {Object|Array} financialDefs - Array of FinancialDef objects for this fee income
 * @returns {Array} payments
 */
export function updatePayments(financial, dataItem, bookings, feeGroups, financialDefs) {
  // Debug: log all incoming props for verification
  console.log("[feeIncomeCalculator] PROPS", {
    financial,
    dataItem,
    bookings,
    feeGroups,
    financialDefs
  });

  // Collect all relevant change dates (do NOT filter by minDate here)
  const dates = collectRelevantDatesFromObjects([
    [dataItem],
    bookings,
    feeGroups,
    [financial],
    Array.isArray(financialDefs) ? financialDefs.flatMap(def => def.fee_groups) : financialDefs?.fee_groups
  ]);
  console.log("[feeIncomeCalculator] relevant dates:", dates);

  let periods = buildPeriodsFromDates(dates);

  // Filter out periods that end before today
  const today = new Date().toISOString().slice(0, 10);
  periods = periods.filter(p => !p.valid_to || p.valid_to >= today);

  // Determine financialDefId as a string (do NOT mutate financial)
  let financialDefId = financial?.type_details?.financialDefId;
  if (typeof financialDefId !== "string" || !financialDefId) {
    // Try to pick the first available financialDef if not set
    if (Array.isArray(financialDefs) && financialDefs.length > 0) {
      financialDefId = financialDefs[0].id;
    } else {
      financialDefId = "";
    }
  }

  // Find the correct financialDef object by id
  let financialDef = null;
  if (Array.isArray(financialDefs)) {
    financialDef = financialDefs.find(def => def.id === financialDefId) || financialDefs[0] || null;
  } else if (financialDefs && typeof financialDefs === "object") {
    financialDef = financialDefs;
  }

  // For each period, determine booking hours and fee
  const payments = periods.map(period => {
    const { valid_from, valid_to } = period;
    const bookingHours = sumBookingHoursForPeriod(bookings, valid_from, valid_to);
    // Pass financialDefId as override in a shallow copy of financial
    const fee = getValidFee(
      { ...financial, type_details: { ...financial.type_details, financialDefId } },
      financialDef,
      feeGroups,
      valid_from,
      bookingHours
    );
    console.log("[feeIncomeCalculator] period:", period, "bookingHours:", bookingHours, "fee:", fee);
    return {
      valid_from,
      valid_to,
      amount: fee ? fee.amount : 0,
      currency: fee ? fee.currency : 'EUR',
      frequency: "monthly",
      type: 'income',
    };
  });

  console.log("Fee income payments updated:", payments);
  return payments;
}

