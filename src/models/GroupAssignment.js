/**
 * @typedef {Object} GroupAssignment
 * @property {string} id
 * @property {string} kindId
 * @property {string} groupId
 * @property {string} groupName
 * @property {string} start
 * @property {string} end
 * @property {Object} [originalData]
 * // ...add other properties as needed
 */

/**
 * GroupAssignment model class
 */
export class GroupAssignment {
  constructor({
    id,
    kindId,
    groupId,
    groupName = '',
    start = '',
    end = '',
    originalData = null,
    ...rest
  }) {
    this.id = String(id);
    this.kindId = String(kindId);
    this.groupId = String(groupId);
    this.groupName = groupName;
    this.start = start;
    this.end = end;
    this.originalData = originalData;
    Object.assign(this, rest);
  }
}
