export const FINANCIAL_TYPE_REGISTRY = [
  {
    value: 'expense-avr',
    label: 'Ausgabe: AVR-Entgelt',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/AvrExpenseDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/avrExpenseCalculator').then(mod => mod.updatePayments),
  },
  {
    value: 'income-fee',
    label: 'Einnahme: Elternbeitrag',
    allowed: ['demand'],
    component: () => import('../components/SimDataDetail/Financials/Income/FeeIncomeDetail'),
    calculator: () => import('../utils/financialCalculators/Income/feeIncomeCalculator').then(mod => mod.updatePayments),
  },
  // ...other types...
];

// Registry for bonus types only (for bonus menu)
export const FINANCIAL_BONUS_REGISTRY = [
  {
    value: 'bonus-yearly',
    label: 'Jahressonderzahlung',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/Bonus/BonusYearlyDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/avrCalculator/Bonus/avrYearlyBonusCalc').then(mod => mod.updatePayments),
    unique: true,
    deleteable: false,
  },
  {
    value: 'bonus-children',
    label: 'Kinderzuschlag',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/Bonus/BonusChildrenDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/avrCalculator/Bonus/avrChildBonusCalc').then(mod => mod.updatePayments),
    unique: false,
    deleteable: false,
  },
  {
    value: 'bonus-instructor',
    label: 'Praxisanleiterzulage',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/Bonus/BonusInstructorDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/avrCalculator/Bonus/avrYearlyBonusCalc').then(mod => mod.updatePayments),
    unique: false,
    deleteable: true,
  },
];

// Helper function to get calculator for a financial type
export function getCalculatorForType(financialType) {
  const allTypes = [...FINANCIAL_TYPE_REGISTRY, ...FINANCIAL_BONUS_REGISTRY];
  const typeEntry = allTypes.find(entry => entry.value === financialType);
  return typeEntry?.calculator;
}
