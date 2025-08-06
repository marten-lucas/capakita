import { getAvrBonusByType, getPresencePercentageInPeriod } from "../../../../financialCalculators/avrUtils";
import { getPaymentSum4Period } from "../../../../financialCalculators/financialUtils";

// Helper: get last day of month for a given year/month
function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).toISOString().slice(0, 10);
}

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

export function updatePayments(financial, dataItem, bookings, avrStageUpgrades, allFinancials) {
  // Guard: allFinancials must be defined and an array
  if (!Array.isArray(allFinancials)) {
    console.log("[avrYearlyBonusCalc] allFinancials is undefined or not an array");
    return [];
  }
  // Use parentId if present, otherwise do not proceed
  if (!financial.parentId) {
    console.log("[avrYearlyBonusCalc] No parentId for bonus financial:", financial);
    return [];
  }
  const parentFinancial = allFinancials.find(f => f.id === financial.parentId);
  if (!parentFinancial) {
    console.log("[avrYearlyBonusCalc] Parent financial not found for parentId:", financial.parentId);
    return [];
  }
  console.log("[avrYearlyBonusCalc] parentFinancial:", parentFinancial);

  // 1. Load bonus details from AVR data
  const referenceDate = financial.valid_from || dataItem?.startdate || new Date().toISOString().slice(0, 10);
  const bonusDef = getAvrBonusByType(financial.type, referenceDate);
  console.log("[avrYearlyBonusCalc] bonusDef:", bonusDef);
  if (!bonusDef) return [];

  // 2. Evaluate start/end date
  const startDate = financial.startdate || financial.valid_from || parentFinancial.startDate || parentFinancial.valid_from || dataItem?.startdate;
  let endDate = financial.enddate || financial.valid_to || parentFinancial.endDate || parentFinancial.valid_to || dataItem?.enddate;
  // If endDate is null or empty, set to maxYear-12-31
  const maxYear = new Date().getFullYear() + 10;
  if (!endDate || endDate === "") {
    endDate = `${maxYear}-12-31`;
  }
  console.log("[avrYearlyBonusCalc] startDate:", startDate, "endDate:", endDate);
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

  // 4. Continue iteration for each year until endDate (if present) or maxYear
  const payments = [];
  while ((!end || new Date(paymentDate) <= end) && year <= maxYear) {
    // 5. If continue_on_absence = false, use presence percentage for the payment period
    let presenceFactor = 1;
    if (!bonusDef.continue_on_absence) {
      const periodStart = new Date(year, dueMonth - 1, 1);
      const periodEnd = new Date(year, dueMonth, 0);
      presenceFactor = getPresencePercentageInPeriod(dataItem, periodStart, periodEnd, false);
      console.log(`[avrYearlyBonusCalc] year ${year} presenceFactor:`, presenceFactor, "period:", periodStart, periodEnd);
      if (presenceFactor <= 0) {
        year++;
        paymentDate = getLastDayOfMonth(year, dueMonth);
        continue;
      }
    }

    // 6. Get relevant parent payments for base_month_average using financialUtils
    const baseMonths = Array.isArray(bonusDef.base_month_average) ? bonusDef.base_month_average : [7,8,9];
    // Calculate average amount using getPaymentSum4Period
    let totalAmount = 0;
    let count = 0;
    baseMonths.forEach(m => {
      const monthStart = new Date(year, m, 1).toISOString().slice(0, 10);
      const monthEnd = new Date(year, m, 0).toISOString().slice(0, 10);
      const monthAmount = getPaymentSum4Period(monthStart, monthEnd, parentFinancial);
      console.log(`[avrYearlyBonusCalc] year ${year} baseMonth ${monthStart} - ${monthEnd} sum:`, monthAmount);
      totalAmount += monthAmount;
      count++;
    });
    const avgAmount = count > 0 ? totalAmount / count : 0;
    console.log(`[avrYearlyBonusCalc] year ${year} avgAmount:`, avgAmount);

    // 7. Find correct percentage
    const group = financial?.type_details?.group || 1;
    const percentage = getBonusPercentage(bonusDef, group);
    console.log(`[avrYearlyBonusCalc] year ${year} group:`, group, "percentage:", percentage);

    // 8. If reduce_partyear, calculate fraction of year covered
    let partYearFactor = 1;
    if (bonusDef.reduce_partyear && (start || end)) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      const coveredStart = start > yearStart ? start : yearStart;
      const coveredEnd = end && end < yearEnd ? end : yearEnd;
      const daysCovered = (coveredEnd - coveredStart) / (1000 * 60 * 60 * 24) + 1;
      partYearFactor = Math.max(0, Math.min(1, daysCovered / 365));
      console.log(`[avrYearlyBonusCalc] year ${year} partYearFactor:`, partYearFactor, "daysCovered:", daysCovered);
    }

    // 9. Generate payment object
    const paymentObj = {
      valid_from: paymentDate,
      valid_to: paymentDate,
      amount: avgAmount * percentage * partYearFactor * presenceFactor,
      frequency: "yearly",
      currency: "EUR",
      type: "expense",
      label: `${bonusDef.name || "Jahressonderzahlung"} ${year}`
    };
    console.log(`[avrYearlyBonusCalc] year ${year} paymentObj:`, paymentObj);

    payments.push(paymentObj);

    // Continue to next year
    year++;
    paymentDate = getLastDayOfMonth(year, dueMonth);
  }

  console.log("[avrYearlyBonusCalc] payments:", payments);
  return payments;
}
