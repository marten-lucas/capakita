/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} type   // e.g. 'income', 'expense', 'bonus'
 * @property {number} amount
 * @property {string} valid_from
 * @property {string} valid_to
 * @property {string} currency
 * // ...add other properties as needed
 */

/**
 * @typedef {Object} Financial
 * @property {string} id
 * @property {string} dataItemId
 * @property {string} type
 * @property {string} name
 * @property {string} from
 * @property {string} to
 * @property {number} amount
 * @property {Object} [type_details]
 * @property {Array<Financial>} [financial] // stackable financial objects (e.g. for bonus, etc.)
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
    from = '',
    to = '',
    amount = 0,
    type_details = {}, // e.g. for avr: group, stage, startdate
    financial = [],    // Array of Financial objects (stackable)
    ...rest
  }) {
    this.id = String(id);
    this.dataItemId = String(dataItemId);
    this.type = type;
    this.name = name;
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.type_details = type_details;
    this.financial = Array.isArray(financial) ? financial : [];
    Object.assign(this, rest);
  }
}
