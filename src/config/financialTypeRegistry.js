import AvrExpenseDetail from '../components/SimDataDetail/Financials/AvrExpenseDetail';
import FeeIncomeDetail from '../components/SimDataDetail/Financials/FeeIncomeDetail';
// ...import other detail components...
import { useAvrExpenseCalculator } from '../utils/financialCalculators/avrExpenseCalculator';
import { feeIncomeCalculator } from '../utils/financialCalculators/feeIncomeCalculator';
// ...import other calculators...

export const FINANCIAL_TYPE_REGISTRY = [
  {
    value: 'expense-avr',
    label: 'Ausgabe: AVR-Entgelt',
    allowed: ['capacity'],
    component: AvrExpenseDetail,
    calculator: (params) => useAvrExpenseCalculator(params),
  },
  {
    value: 'income-fee',
    label: 'Einnahme: Elternbeitrag',
    allowed: ['demand'],
    component: FeeIncomeDetail,
    calculator: (params) => feeIncomeCalculator(params),
  },
  // ...other types...
];

// Registry for bonus types only (for bonus menu)
export const FINANCIAL_BONUS_REGISTRY = [
  {
    value: 'bonus-yearly',
    label: 'Jahressonderzahlung',
    allowed: ['capacity'],
    component: AvrExpenseDetail,
    calculator: () => ({}),
  },
  {
    value: 'bonus-children',
    label: 'Kinderzuschlag',
    allowed: ['capacity'],
    component: AvrExpenseDetail,
    calculator: () => ({}),
  },
  {
    value: 'bonus-instructor',
    label: 'Praxisanleiterzulage',
    allowed: ['capacity'],
    component: AvrExpenseDetail,
    calculator: () => ({}),
  },
];
