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
  constructor({
    id,
    dataItemId,
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

