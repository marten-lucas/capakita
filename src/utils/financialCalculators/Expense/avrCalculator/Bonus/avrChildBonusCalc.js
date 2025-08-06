import { getAvrBonusByType } from "../../../../financialCalculators/avrUtils";

export function updatePayments(financial, dataItem) {
  // 1. Load bonus details from AVR data
  const referenceDate = financial.valid_from || dataItem?.startdate || new Date().toISOString().slice(0, 10);
  const bonusDef = getAvrBonusByType('bonus-children', referenceDate);
  if (!bonusDef) return [];

  // 2. Get number of children from type_details
  const noOfChildren = Number(financial.type_details?.noOfChildren) || 0;
  if (noOfChildren === 0) return [];

  // 3. Evaluate start/end date
  const startDate = financial.startdate || financial.valid_from || dataItem?.startdate;
  const endDate = financial.enddate || financial.valid_to || dataItem?.enddate;
  if (!startDate) return [];

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  // 4. Generate single payment for the entire period
  const payments = [];
  
  // Calculate duration in months for total amount
  const startMonth = start.getFullYear() * 12 + start.getMonth();
  const endMonth = end ? (end.getFullYear() * 12 + end.getMonth()) : startMonth;
  const durationMonths = Math.max(1, endMonth - startMonth + 1);
  
  payments.push({
    valid_from: startDate,
    valid_to: endDate || startDate,
    amount: Number(bonusDef.value) * noOfChildren * durationMonths,
    frequency: "one-time",
    currency: "EUR",
    type: "expense",
    label: `${bonusDef.name || "Kinderzuschlag"} (${durationMonths} Monate)`
  });

  return payments;
}
  

