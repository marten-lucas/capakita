/**
 * @typedef {Object} QualificationDef
 * @property {string} key         // Unique ID for the qualification
 * @property {string} initial     // Short name/initial for UI
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
    initial = '',
    name = '',
    IsExpert = true,
    remark = '',
    ...rest
  }) {
    this.key = String(key);
    this.initial = initial;
    this.name = name;
    this.IsExpert = IsExpert !== false;
    this.remark = remark;
    Object.assign(this, rest);
  }
}
