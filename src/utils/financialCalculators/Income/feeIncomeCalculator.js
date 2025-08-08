import { getValidFee, collectRelevantDatesFromObjects, getFinancialDefById } from "../financialUtils";
import { buildPeriodsFromDates } from "../../dateUtils";

// financial: the Financial object (income-fee)
// dataItem: the child or entity assigned
// bookings: booking objects (by id or array)
// feeSets: array of fee set assignments (with valid_from/to)
// financialDef: the FinancialDef object for this fee income

/**
 * updatePayments for income-fee
 * @param {Object} financial - The Financial object (income-fee)
 * @param {Object} dataItem - The child or entity assigned
 * @param {Array} bookings - Booking objects (array)
 * @param {Object} groupAssignments - Group assignments for the child (object)
 * @param {Object|Array} financialDefs - Array of FinancialDef objects for this fee income
 * @returns {Array} payments
 */
export function updatePayments(financial, dataItem, bookings, groupAssignments, financialDefs) {

  // Collect all relevant change dates (do NOT filter by minDate here)
  const dates = collectRelevantDatesFromObjects([
    [dataItem],
    bookings,
    groupAssignments,
    [financial],
    Array.isArray(financialDefs)
      ? financialDefs.flatMap(def => [
          ...(def.fee_sets || [])
        ])
      : [
          ...(financialDefs?.fee_sets || [])
        ]
  ]);

  let periods = buildPeriodsFromDates(dates);

  // Filter out periods that end before today
  const today = new Date().toISOString().slice(0, 10);
  periods = periods.filter(p => !p.valid_to || p.valid_to >= today);

  // Determine financialDefId as a string (do NOT mutate financial)
  let financialDefId = financial?.type_details?.financialDefId;
  if (typeof financialDefId !== 'string') {
    financialDefId = financialDefId?.toString() || '';
  }

  // Use utility function to find the correct financialDef object by id
  const financialDef = getFinancialDefById(financialDefs, financialDefId);

  // For each period, determine fee
  const payments = periods.map(period => {
    const { valid_from, valid_to } = period;
    // Use refDate as valid_from for fee calculation
    const fee = getValidFee(
      valid_from,
      dataItem,
      financial,
      financialDef,
      groupAssignments,
      bookings
    );
    console.log('Calculated fee for period:', period, 'Fee:', fee);
    return {
      valid_from,
      valid_to,
      amount: fee ? fee.amount : 0,
      currency: fee ? fee.currency : 'EUR',
      frequency: "monthly",
      type: 'income',
    };
  });

  return payments;
}
