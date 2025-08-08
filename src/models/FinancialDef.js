/**
 * @typedef {Object} Fee
 * @property {number} maxHours
 * @property {number} amount
 * @property {string} currency
 */

/**
 * @typedef {Object} FeeSet
 * @property {string} id
 * @property {string} groupref
 * @property {string} valid_from
 * @property {string} valid_to
 * @property {Array<Fee>} fees
 */

/**
 * @typedef {Object} FinancialDef
 * @property {string} id
 * @property {string} name
 * @property {string} [remark]
 * @property {Array<FeeSet>} fee_sets
 * // ...add other properties as needed
 */

/**
 * FinancialDef model class
 */
export class FinancialDef {
  constructor({
    id,
    name = '',
    remark = '',
    fee_sets = [
      {
        id: '',
        groupref: '',
        valid_from: '',
        valid_to: '',
        fees: [
          {
            maxHours: 0,
            amount: 0,
            currency: 'EUR',
          }
        ]
      }
    ],
    ...rest
  }) {
    this.id = String(id);
    this.name = name;
    this.remark = remark;
    this.fee_sets = Array.isArray(fee_sets) ? fee_sets : [];
    Object.assign(this, rest);
  }
}
