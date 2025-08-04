/**
 * @typedef {Object} QualificationAssignment
 * @property {string} id
 * @property {string} dataItemId
 * @property {string} qualification
 * @property {Object} [originalData]
 * // ...add other properties as needed
 */

/**
 * QualificationAssignment model class
 */
export class QualificationAssignment {
  constructor({
    id,
    dataItemId,
    qualification,
    originalData = null,
    ...rest
  }) {
    this.id = String(id);
    this.dataItemId = String(dataItemId);
    this.qualification = String(qualification);
    this.originalData = originalData;
    Object.assign(this, rest);
  }
}
