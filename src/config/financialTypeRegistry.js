export const FINANCIAL_TYPE_REGISTRY = [
  {
    value: 'expense-avr',
    label: 'Ausgabe: AVR-Entgelt',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/AvrExpenseDetail'),
    calculator: () => ({}),
  },
  {
    value: 'income-fee',
    label: 'Einnahme: Elternbeitrag',
    allowed: ['demand'],
    component: () => import('../components/SimDataDetail/Financials/Income/FeeIncomeDetail'),
    calculator: () => ({}),
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
    calculator: () => ({}),
    unique: true,
    deleteable: false,
  },
  {
    value: 'bonus-children',
    label: 'Kinderzuschlag',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/Bonus/BonusChildrenDetail'),
    calculator: () => ({}),
    unique: false,
    deleteable: false,
  },
  {
    value: 'bonus-instructor',
    label: 'Praxisanleiterzulage',
    allowed: ['capacity'],
    component: () => import('../components/SimDataDetail/Financials/Expense/Bonus/BonusInstructorDetail'),
    calculator: () => ({}),
    unique: false,
    deleteable: true,
  },
];
