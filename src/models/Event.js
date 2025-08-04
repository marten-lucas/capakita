/**
 * @typedef {Object} Event
 * @property {string} id
 * @property {string} scenarioId
 * @property {string} effectiveDate
 * @property {string} sourceDate
 * @property {string} type
 * @property {string} category
 * @property {string} entityType
 * @property {string} entityId
 * @property {string} entityName
 * @property {string|null} relatedId
 * @property {string} description
 * @property {Object} metadata
 * // ...add other properties as needed
 */

/**
 * Event model class
 */
export class Event {
  constructor({
    id,
    scenarioId,
    effectiveDate,
    sourceDate,
    type,
    category,
    entityType,
    entityId,
    entityName,
    relatedId = null,
    description = '',
    metadata = {},
    ...rest
  }) {
    this.id = String(id);
    this.scenarioId = String(scenarioId);
    this.effectiveDate = effectiveDate;
    this.sourceDate = sourceDate;
    this.type = type;
    this.category = category;
    this.entityType = entityType;
    this.entityId = entityId;
    this.entityName = entityName;
    this.relatedId = relatedId;
    this.description = description;
    this.metadata = metadata;
    Object.assign(this, rest);
  }
}
