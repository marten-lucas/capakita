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
 * @property {boolean} hasDisability - For BayKiBiG categories 4 & 7 (disability = 4.5x)
 * @property {string} temporaryDisabilityDate - For BayKiBiG category 5 (6-month window = 4.5x)
 * @property {boolean} isInDaycare - For BayKiBiG categories 6 & 7 (day-care = 1.3x)
 * @property {boolean} hasNonGermanSpeakingParents - For BayKiBiG category 8 (both parents non-German = 1.3x)
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
    hasDisability = false,
    temporaryDisabilityDate = '',
    isInDaycare = false,
    hasNonGermanSpeakingParents = false,
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
    // Ensure absences have payType and id
    this.absences = Array.isArray(absences)
      ? absences.map(a => ({
          ...a,
          payType: a.payType || 'fully_paid',
          id: a.id || `${this.id}-absence-${Math.random().toString(36).slice(2)}`
        }))
      : [];
    // BayKiBiG weight modifiers for children (demand)
    this.hasDisability = Boolean(hasDisability);
    this.temporaryDisabilityDate = temporaryDisabilityDate || '';
    this.isInDaycare = Boolean(isInDaycare);
    this.hasNonGermanSpeakingParents = Boolean(hasNonGermanSpeakingParents);
    Object.assign(this, rest);
  }
}
