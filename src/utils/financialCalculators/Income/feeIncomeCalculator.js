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
 * @param {Object} financialDef - The FinancialDef object for this fee income
 * @returns {Array} payments
 */
export function updatePayments(financial, dataItem, bookings, feeGroups, financialDef) {
  // Debug: log all incoming props for verification
  console.log("[feeIncomeCalculator] PROPS", {
    financial,
    dataItem,
    bookings,
    feeGroups,
    financialDef
  });

  // Collect all relevant change dates (do NOT filter by minDate here)
  const dates = collectRelevantDatesFromObjects([
    [dataItem],
    bookings,
    feeGroups,
    [financial],
    financialDef?.fee_groups
  ]);
  console.log("[feeIncomeCalculator] relevant dates:", dates);

  let periods = buildPeriodsFromDates(dates);

  // Filter out periods that end before today
  const today = new Date().toISOString().slice(0, 10);
  periods = periods.filter(p => !p.valid_to || p.valid_to >= today);

  // Determine groupRef as a string (do NOT mutate financial)
  let groupRef = financial?.type_details?.groupRef;
  if (typeof groupRef !== "string" || !groupRef) {
    const groupAssignment = Array.isArray(feeGroups) && feeGroups.length > 0
      ? feeGroups.find(g => g.groupId || g.groupref)
      : null;
    if (groupAssignment) {
      groupRef = groupAssignment.groupId || groupAssignment.groupref || "";
    } else if (typeof dataItem?.groupId === "string") {
      groupRef = dataItem.groupId;
    } else {
      groupRef = "";
    }
  }

  // For each period, determine booking hours and fee
  const payments = periods.map(period => {
    const { valid_from, valid_to } = period;
    const bookingHours = sumBookingHoursForPeriod(bookings, valid_from, valid_to);
    // Pass groupRef as override in a shallow copy of financial
    const fee = getValidFee(
      { ...financial, type_details: { ...financial.type_details, groupRef } },
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

