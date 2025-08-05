export function feeIncomeCalculator({ financial, financialDefs = [], item }) {
  // Find the selected financialDef by id
  const selectedDef = financialDefs.find(def => def.id === financial.financialDefId);
  if (!selectedDef) {
    return { calculatedAmount: 0 };
  }

  // Find the groupRef for the item (if available)
  const groupRef = item?.groupId || null;

  // Find the matching fee group for the groupRef
  const feeGroup = Array.isArray(selectedDef.fee_groups)
    ? selectedDef.fee_groups.find(g => g.groupref === groupRef)
    : null;

  // Calculate sum of booking times for the item (if available)
  const sumOfBookingTimes = typeof item?.bookings === 'object' && typeof item.calculateWorktimeFromBookings === 'function'
    ? item.calculateWorktimeFromBookings(item.bookings)
    : 0;

  // Find the matching fee in the fee group
  let matchedFee = null;
  if (feeGroup && Array.isArray(feeGroup.fees)) {
    const sortedFees = [...feeGroup.fees].sort((a, b) => (a.minHours ?? 0) - (b.minHours ?? 0));
    for (let i = 0; i < sortedFees.length; i++) {
      const lowerBound = sortedFees[i].minHours ?? 0;
      const upperBound = sortedFees[i + 1]?.minHours ?? Infinity;
      if (sumOfBookingTimes >= lowerBound && sumOfBookingTimes < upperBound) {
        matchedFee = sortedFees[i];
        break;
      }
      if (sumOfBookingTimes === 0 && i === 0) {
        matchedFee = sortedFees[0];
        break;
      }
    }
  }

  // If this financial has stacked financials, sum their calculated amounts recursively
  let stackedAmount = 0;
  if (Array.isArray(financial.financial) && financial.financial.length > 0) {
    stackedAmount = financial.financial.reduce((sum, fin) => {
      const res = feeIncomeCalculator({ financial: fin, financialDefs, item });
      return sum + (res.calculatedAmount || 0);
    }, 0);
  }

  return {
    calculatedAmount: (matchedFee ? matchedFee.amount : 0) + stackedAmount
  };
}
