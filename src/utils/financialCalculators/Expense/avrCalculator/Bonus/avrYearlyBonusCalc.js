import { getAvrBonusByType, getPresencePercentageInPeriod } from "../../../../financialCalculators/avrUtils";

// Helper: get last day of month for a given year/month
function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).toISOString().slice(0, 10);
}




// Helper: get payments for parent AVR financial for given months

// Helper: get percentage for group and stage
function getBonusPercentage(bonusDef, group) {
  if (!Array.isArray(bonusDef.percentage)) return 1;
  // Find matching percentage entry
  for (const p of bonusDef.percentage) {
    if (group >= p.from_group && group <= (p.to_group || p.to_group)) {
      return p.value;
    }
  }
  return 1;
}

export function updatePayments(financial, dataItem) {
  // Compose payments using all dependencies (same signature as avrexpenseCalculator)
  // parentFinancial and stage upgrades are not used for bonus calculation here

  // 1. Load bonus details from AVR data
  const referenceDate = financial.valid_from || dataItem?.startdate || new Date().toISOString().slice(0, 10);
  const bonusDef = getAvrBonusByType(financial.type, referenceDate);
  if (!bonusDef) return [];

  // 2. Evaluate start/end date
  const startDate = financial.startdate || financial.valid_from || dataItem?.startdate;
  const endDate = financial.enddate || financial.valid_to || dataItem?.enddate;
  if (!startDate) return [];

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  // 3. Get first payment day: last day of due_month in start year
  const dueMonth = bonusDef.due_month || 11;
  let year = start.getFullYear();
  let paymentDate = getLastDayOfMonth(year, dueMonth);

  // If start is after payment date, move to next year
  if (start > new Date(paymentDate)) {
    year++;
    paymentDate = getLastDayOfMonth(year, dueMonth);
  }

  // 4. Continue iteration for each year until endDate (if present)
  const payments = [];
  while (!end || new Date(paymentDate) <= end) {
    // 5. If continue_on_absence = false, use presence percentage for the payment period
    let presenceFactor = 1;
    if (!bonusDef.continue_on_absence) {
      const periodStart = new Date(year, dueMonth - 1, 1);
      const periodEnd = new Date(year, dueMonth, 0);
      presenceFactor = getPresencePercentageInPeriod(dataItem, periodStart, periodEnd, false);
      if (presenceFactor <= 0) {
        year++;
        paymentDate = getLastDayOfMonth(year, dueMonth);
        continue;
      }
    }

    // 6. Get relevant parent payments for base_month_average
    // For bonus calculation, parent payments should be passed in financial.payments
    const baseMonths = Array.isArray(bonusDef.base_month_average) ? bonusDef.base_month_average : [7,8,9];
    const parentPayments = Array.isArray(financial.payments)
      ? financial.payments.filter(p => {
          if (!p.valid_from) return false;
          const d = new Date(p.valid_from);
          return d.getFullYear() === year && baseMonths.includes(d.getMonth() + 1);
        })
      : [];
    const avgAmount = parentPayments.length > 0
      ? parentPayments.reduce((sum, p) => sum + (p.amount || 0), 0) / parentPayments.length
      : 0;

    // 7. Find correct percentage
    const group = financial?.type_details?.group || 1;
    const percentage = getBonusPercentage(bonusDef, group);

    // 8. If reduce_partyear, calculate fraction of year covered
    let partYearFactor = 1;
    if (bonusDef.reduce_partyear && (start || end)) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      const coveredStart = start > yearStart ? start : yearStart;
      const coveredEnd = end && end < yearEnd ? end : yearEnd;
      const daysCovered = (coveredEnd - coveredStart) / (1000 * 60 * 60 * 24) + 1;
      partYearFactor = Math.max(0, Math.min(1, daysCovered / 365));
    }

    // 9. Generate payment object
    payments.push({
      valid_from: paymentDate,
      valid_to: paymentDate,
      amount: avgAmount * percentage * partYearFactor * presenceFactor,
      frequency: "yearly",
      currency: "EUR",
      type: "expense",
      label: `${bonusDef.name || "Jahressonderzahlung"} ${year}`
    });

    // Continue to next year
    year++;
    paymentDate = getLastDayOfMonth(year, dueMonth);
  }

  return payments;
}
