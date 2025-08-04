/**
 * @typedef {Object} Financial
 * @property {string} id
 * @property {string} dataItemId
 * @property {string} type
 * @property {string} name
 * @property {string} from
 * @property {string} to
 * @property {number} amount
 * @property {Object} [originalData]
 * // ...add other properties as needed
 */

/**
 * Financial model class
 */
export class Financial {
  constructor({
    id,
    dataItemId,
    type = '',
    name = '',
    from = '',
    to = '',
    amount = 0,
    originalData = null,
    ...rest
  }) {
    this.id = String(id);
    this.dataItemId = String(dataItemId);
    this.type = type;
    this.name = name;
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.originalData = originalData;
    Object.assign(this, rest);
  }
}
