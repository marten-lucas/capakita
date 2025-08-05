/**
 * @typedef {Object} DataItem
 * @property {string} id
 * @property {string} type
 * @property {string} source
 * @property {string} name
 * @property {string} remark
 * @property {string} startdate
 * @property {string} enddate
 * @property {string} dateofbirth
 * @property {string} groupId
 * @property {Object} rawdata
 * @property {Array<{start: string, end: string, payType?: string}>} absences
 * // ...add other properties as needed
 */

/**
 * DataItem model class (optional)
 */
export class DataItem {
  constructor({
    id,
    type = '',
    source = 'manual entry',
    name = '',
    remark = '',
    startdate = '',
    enddate = '',
    dateofbirth = '',
    groupId = '',
    rawdata = {},
    absences = [],
    ...rest
  }) {
    this.id = String(id);
    this.type = type;
    this.source = source;
    this.name = name;
    this.remark = remark;
    this.startdate = startdate;
    this.enddate = enddate;
    this.dateofbirth = dateofbirth;
    this.groupId = groupId;
    this.rawdata = rawdata;
    // Ensure absences have payType
    this.absences = Array.isArray(absences)
      ? absences.map(a => ({ ...a, payType: a.payType || 'fully_paid' }))
      : [];
    Object.assign(this, rest);
  }
}
