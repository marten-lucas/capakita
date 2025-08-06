import { getAvrBonusByType } from "../../../../financialCalculators/avrUtils";

export function updatePayments(financial, dataItem) {
  // 1. Load bonus details from AVR data
  const referenceDate = financial.valid_from || dataItem?.startdate || new Date().toISOString().slice(0, 10);
  const bonusDef = getAvrBonusByType('bonus-instructor', referenceDate);
  if (!bonusDef) return [];

  // 2. Get start/end date from financial type_details
  const startDate = financial.type_details?.Startdate || financial.valid_from;
  const endDate = financial.type_details?.Enddate || financial.valid_to;
  if (!startDate) return [];

  // 3. Calculate duration in months for total amount
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const startMonth = start.getFullYear() * 12 + start.getMonth();
  const endMonth = end.getFullYear() * 12 + end.getMonth();
  const durationMonths = Math.max(1, endMonth - startMonth + 1);

  // 4. Create single payment for the entire period
  const payments = [{
    valid_from: startDate,
    valid_to: endDate || startDate,
    amount: Number(bonusDef.value || 0) * durationMonths,
    frequency: "one-time",
    currency: "EUR",
    type: "expense",
    label: `${bonusDef.name || "Praxisanleiterzulage"} (${durationMonths} Monate)`
  }];

  return payments;
}
