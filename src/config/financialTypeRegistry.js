import { Financial } from '../models/Financial';

export const FINANCIAL_TYPE_REGISTRY = [
  {
    value: 'expense-avr',
    label: 'Ausgabe: AVR-Entgelt',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/AvrExpenseDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/avrExpenseCalculator').then(mod => mod.updatePayments),
    typeDetailsDefinition: Financial.typeDetailsDefinitions['expense-avr'], // <-- use typeDetailsDefinition
  },
  {
    value: 'expense-custom',
    label: 'Ausgabe: Festbetrag',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/CustomExpenseDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/customExpenseCalculator').then(mod => mod.updatePayments),
    typeDetailsDefinition: Financial.typeDetailsDefinitions['expense-custom'],
  },
  {
    value: 'income-fee',
    label: 'Einnahme: Elternbeitrag',
    allowed: ['demand'],
    component: () => import('../components/SimDataDetail/Financials/Income/FeeIncomeDetail'),
    calculator: () => import('../utils/financialCalculators/Income/feeIncomeCalculator').then(mod => mod.updatePayments),
    typeDetailsDefinition: Financial.typeDetailsDefinitions['income-fee'],
  },
  {
    value: 'income-baykibig',
    label: 'Einnahme: BayKiBiG-Förderung',
    allowed: ['demand'],
    component: () => import('../components/SimDataDetail/Financials/Income/BaykibigIncomeDetail'),
    calculator: () => import('../utils/financialCalculators/Income/baykibigIncomeCalculator').then(mod => mod.updatePayments),
    typeDetailsDefinition: Financial.typeDetailsDefinitions['income-baykibig'],
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
    typeDetailsDefinition: Financial.typeDetailsDefinitions['bonus-yearly'],
  },
  {
    value: 'bonus-children',
    label: 'Kinderzuschlag',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/Bonus/BonusChildrenDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/avrCalculator/Bonus/avrChildBonusCalc').then(mod => mod.updatePayments),
    unique: false,
    deleteable: false,
    typeDetailsDefinition: Financial.typeDetailsDefinitions['bonus-children'],
  },
  {
    value: 'bonus-instructor',
    label: 'Praxisanleiterzulage',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/Bonus/BonusInstructorDetail'),
    calculator: () => import('../utils/financialCalculators/Expense/avrCalculator/Bonus/avrInstructorBonusCalc').then(mod => mod.updatePayments),
    unique: false,
    deleteable: true,
    typeDetailsDefinition: Financial.typeDetailsDefinitions['bonus-instructor'],
  },
];

// Helper function to get calculator for a financial type
export function getCalculatorForType(financialType) {
  const allTypes = [...FINANCIAL_TYPE_REGISTRY, ...FINANCIAL_BONUS_REGISTRY];
  const typeEntry = allTypes.find(entry => entry.value === financialType);
  return typeEntry?.calculator;
}
