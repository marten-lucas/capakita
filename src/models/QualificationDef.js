/**
 * @typedef {Object} QualificationDef
 * @property {string} key
 * @property {string} name
 * @property {boolean} IsExpert
 * @property {string} [remark]
 * // ...add other properties as needed
 */

/**
 * QualificationDef model class
 */
export class QualificationDef {
  constructor({
    key,
    name = '',
    IsExpert = true,
    remark = '',
    ...rest
  }) {
    this.key = String(key);
    this.name = name;
    this.IsExpert = IsExpert !== false;
    this.remark = remark;
    Object.assign(this, rest);
  }
}
