/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} type   // e.g. 'income', 'expense'
 * @property {number} amount
 * @property {string} valid_from
 * @property {string} valid_to
 * @property {string} currency
 * @property {string} frequency // e.g. 'monthly', 'yearly'
 * // ...add other properties as needed
 */

/**
 * @typedef {Object} Financial
 * @property {string} id
 * @property {string} dataItemId
 * @property {string} type
 * @property {string} [parentId] 
 * @property {string} name
 * @property {string} valid_from
 * @property {string} valid_to
 * @property {Object} [type_details] // User-editable fields, e.g. for AVR: stage, group, StartDate, NoOfChildren, WorkingHours; for income-fee: group_ref
 * @property {string} [financialDefId] // Only for income-fee type
 * @property {Array<Financial>} [financial] // Stacked financials (e.g. bonuses)
 * // ...add other properties as needed
 */


/**
 * Financial model class
 */
export class Financial {
  // Static type_details definitions for registry reference
  static typeDetailsDefinitions = {
    'expense-avr': {
      group: { type: 'number', required: true },
      stage: { type: 'number', required: true },
      startDate: { type: 'string', required: false },
      endDate: { type: 'string', required: false },
      WorkingHours: { type: 'number', required: false },
      NoOfChildren: { type: 'number', required: false },
      // ...other AVR-specific fields...
    },
    'income-fee': {
      financialDefId: { type: 'string', required: true },
      groupRef: { type: 'string', required: false },
      // ...other fee-specific fields...
    },
    'bonus-yearly': {
      payable: { type: 'string', required: true },
      due_month: { type: 'number', required: true },
      continue_on_absence: { type: 'boolean', required: false },
      base_month_average: { type: 'array', required: false },
      percentage: { type: 'array', required: false },
      reduce_parttime: { type: 'boolean', required: false },
      reduce_partyear: { type: 'boolean', required: false },
      // ...other bonus fields...
    },
    // ...add definitions for other types...
  };

  constructor({
    id,
    dataItemId,
    parentId = '', // Optional parent reference for hierarchical financials
    type = '', // e.g. avr, fee, etc.
    name = '',
    valid_from = '',
    valid_to = '',
    type_details = {}, // User-editable fields
    financial = [],    // Stacked financials (e.g. bonuses)
    payments = [], // Array of Payment objects
    ...rest
  }) {
    this.id = String(id);
    this.dataItemId = String(dataItemId);
    // Only set parentId if parent type starts with "expense-"
    if (rest.parentType && typeof rest.parentType === 'string' && rest.parentType.startsWith('expense-')) {
      this.parentId = String(parentId);
    } else {
      this.parentId = '';
    }
    this.type = type;
    this.name = name;
    this.valid_from = valid_from;
    this.valid_to = valid_to;
    this.type_details = type_details;
    this.payments = Array.isArray(payments) ? payments : [];
    this.financial = Array.isArray(financial) ? financial : [];
    Object.assign(this, rest);
  }
}

