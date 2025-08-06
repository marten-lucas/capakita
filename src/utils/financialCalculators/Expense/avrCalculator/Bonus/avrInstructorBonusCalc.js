import { getAvrBonusByType } from "../../../../financialCalculators/avrUtils";

export function updatePayments(financial, dataItem) {
  // 1. Load bonus details from AVR data
  const referenceDate = financial.valid_from || dataItem?.startdate || new Date().toISOString().slice(0, 10);
  const bonusDef = getAvrBonusByType('bonus-instructor', referenceDate);
  console.log("[avrInstructorBonusCalc] bonusDef:", bonusDef);
  if (!bonusDef) return [];

  // 2. Get start/end date from financial type_details
  const startDate = financial.type_details?.Startdate || financial.valid_from;
  const endDate = financial.type_details?.Enddate || financial.valid_to;
  console.log("[avrInstructorBonusCalc] startDate:", startDate, "endDate:", endDate);
  if (!startDate) return [];

  

  // 4. Create single payment for the entire period
  const paymentObj = {
    valid_from: startDate,
    valid_to: endDate,
    amount: Number(bonusDef.value || 0) ,
    frequency: "monthly",
    currency: "EUR",
    type: "expense",
    label: `${bonusDef.name || "Praxisanleiterzulage"}`
  };
  console.log("[avrInstructorBonusCalc] paymentObj:", paymentObj);

  return [paymentObj];
}
