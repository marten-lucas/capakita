/**
 * Returns all payments for a financial object that overlap with the given period.
 * @param {string} start - ISO date string (inclusive)
 * @param {string} end - ISO date string (inclusive)
 * @param {Object} financial - Financial object with payments array
 * @returns {Array} Array of payment objects
 */
export function getPayments4Period(start, end, financial) {
  if (!financial?.payments || !Array.isArray(financial.payments)) {
    console.log("[getPayments4Period] No payments found for financial:", financial);
    return [];
  }
  const startDate = new Date(start);
  const endDate = new Date(end);

  const filtered = financial.payments.filter(payment => {
    const paymentStart = payment.valid_from ? new Date(payment.valid_from) : null;
    const paymentEnd = payment.valid_to ? new Date(payment.valid_to) : paymentStart;
    if (!paymentStart) return false;
    // Overlap: payment period intersects [startDate, endDate]
    return paymentEnd >= startDate && paymentStart <= endDate;
  });
  console.log(`[getPayments4Period] start: ${start}, end: ${end}, found:`, filtered);
  return filtered;
}

/**
 * Returns the sum of amounts for all payments in a financial object that overlap with the given period.
 * @param {string} start - ISO date string (inclusive)
 * @param {string} end - ISO date string (inclusive)
 * @param {Object} financial - Financial object with payments array
 * @returns {number} Sum of payment amounts
 */
export function getPaymentSum4Period(start, end, financial) {
  const payments = getPayments4Period(start, end, financial);
  const sum = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  console.log(`[getPaymentSum4Period] start: ${start}, end: ${end}, sum:`, sum);
  return sum;
}

