import { getAvrBonusByType } from "../../../../financialCalculators/avrUtils";

export function updatePayments(financial, dataItem) {
  // 1. Load bonus details from AVR data
  const referenceDate = financial.valid_from || dataItem?.startdate || new Date().toISOString().slice(0, 10);
  const bonusDef = getAvrBonusByType('bonus-children', referenceDate);
  console.log("[avrChildBonusCalc] bonusDef:", bonusDef);
  if (!bonusDef) return [];

  // 2. Get number of children from type_details
  const noOfChildren = Number(financial.type_details?.noOfChildren) || 0;
  console.log("[avrChildBonusCalc] noOfChildren:", noOfChildren);
  if (noOfChildren === 0) return [];

  // 3. Evaluate start/end date
  const startDate = financial.startdate || financial.valid_from || dataItem?.startdate;
  const endDate = financial.enddate || financial.valid_to || dataItem?.enddate;
  console.log("[avrChildBonusCalc] startDate:", startDate, "endDate:", endDate);
  if (!startDate) return [];


  // 4. Generate single payment for the entire period
  const payments = [];
  
  const paymentObj = {
    valid_from: startDate,
    valid_to: endDate,
    amount: Number(bonusDef.value) * noOfChildren,
    frequency: "monthly",
    currency: "EUR",
    type: "expense",
    label: `${bonusDef.name || "Kinderzuschlag"}`
  };
  console.log("[avrChildBonusCalc] paymentObj:", paymentObj);

  payments.push(paymentObj);

  return payments;
}


