/**
 * @typedef {Object} Overlay
 * @property {string} scenarioId
 * @property {Object} [dataItems]
 * @property {Object} [bookings]
 * @property {Object} [groupassignments]
 * @property {Object} [qualificationDefs]
 * @property {Object} [financials]
 * @property {Object} [financialDefs]
 * // ...add other overlay properties as needed
 */

/**
 * Overlay model class
 */
export class Overlay {
  constructor({
    scenarioId,
    dataItems = {},
    bookings = {},
    groupassignments = {},
    qualificationDefs = {},
    financials = {},
    financialDefs = {},
    ...rest
  }) {
    this.scenarioId = String(scenarioId);
    this.dataItems = dataItems;
    this.bookings = bookings;
    this.groupassignments = groupassignments;
    this.qualificationDefs = qualificationDefs;
    this.financials = financials;
    this.financialDefs = financialDefs;
    Object.assign(this, rest);
  }
}
