/**
 * @typedef {Object} Booking
 * @property {string} id
 * @property {string} dataItemId
 * @property {string} startdate
 * @property {string} enddate
 * @property {Array} times
 * @property {Object} rawdata
 * // ...add other properties as needed
 */

/**
 * Booking model class (optional)
 */
export class Booking {
  constructor({
    id,
    dataItemId,
    startdate = '',
    enddate = '',
    times = [],
    rawdata = {},
    ...rest
  }) {
    this.id = String(id);
    this.dataItemId = String(dataItemId);
    this.startdate = startdate;
    this.enddate = enddate;
    this.times = times;
    this.rawdata = rawdata;
    Object.assign(this, rest);
  }
}
