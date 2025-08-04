/**
 * @typedef {Object} GroupDef
 * @property {string} id
 * @property {string} name
 * @property {string} [remark]
 * // ...add other properties as needed
 */

/**
 * GroupDef model class
 */
export class GroupDef {
  constructor({
    id,
    name = '',
    remark = '',
    ...rest
  }) {
    this.id = String(id);
    this.name = name;
    this.remark = remark;
    Object.assign(this, rest);
  }
}
