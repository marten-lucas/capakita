/**
 * @typedef {Object} FinancialDef
 * @property {string} id
 * @property {string} name
 * @property {string} [remark]
 * @property {Array} fees
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
    fees = [],
    ...rest
  }) {
    this.id = String(id);
    this.name = name;
    this.remark = remark;
    this.fees = Array.isArray(fees) ? fees : [];
    Object.assign(this, rest);
  }
}
