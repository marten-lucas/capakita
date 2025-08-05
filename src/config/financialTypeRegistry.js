import AvrExpenseDetail from '../components/SimDataDetail/Financials/AvrExpenseDetail';
import FeeIncomeDetail from '../components/SimDataDetail/Financials/FeeIncomeDetail';
// ...import other detail components...
import { avrExpenseCalculator } from '../utils/financialCalculators/avrExpenseCalculator';
import { feeIncomeCalculator } from '../utils/financialCalculators/feeIncomeCalculator';
// ...import other calculators...

export const FINANCIAL_TYPE_REGISTRY = [
  {
    value: 'expense-avr',
    label: 'Ausgabe: AVR-Entgelt',
    allowed: ['capacity'],
    component: AvrExpenseDetail,
    calculator: (params) => avrExpenseCalculator(params),
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
