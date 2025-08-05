// BonusExpenseCalculator.js

/**
 * Calculates the bonus expense for a given financial object and item.
 * @param {Object} params
 * @param {Object} params.financial - The financial object containing bonus info.
 * @param {Object} params.item - The item/context for calculation.
 * @returns {Object} - { calculatedBonus }
 */
export function bonusExpenseCalculator({ financial, item }) {
  // Example logic, replace with actual bonus calculation as needed
  const bonusRate = financial.bonusRate || 0;
  const baseAmount = item.baseAmount || 0;
  let calculatedBonus = baseAmount * bonusRate;

  // If this financial has stacked financials, sum their calculated bonuses recursively
  if (Array.isArray(financial.financial) && financial.financial.length > 0) {
    calculatedBonus += financial.financial.reduce((sum, fin) => {
      const res = bonusExpenseCalculator({ financial: fin, item });
      return sum + (res.calculatedBonus || 0);
    }, 0);
  }

  return { calculatedBonus };
}
