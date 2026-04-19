/**
 * @typedef {Object} Overlay
 * @property {string} scenarioId
 * @property {Object} [dataItems]
 * @property {Object} [bookings]
 * @property {Object} [groupassignments]
 * @property {Object} [qualificationDefs]
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
    ...rest
  }) {
    this.scenarioId = String(scenarioId);
    this.dataItems = dataItems;
    this.bookings = bookings;
    this.groupassignments = groupassignments;
    this.qualificationDefs = qualificationDefs;
    Object.assign(this, rest);
  }
}
