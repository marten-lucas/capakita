/**
 * @typedef {Object} Scenario
 * @property {string} id
 * @property {string} name
 * @property {string} remark
 * @property {number} confidence
 * @property {number} likelihood
 * @property {number} desirability
 * @property {string|null} baseScenarioId
 * @property {boolean} imported
 * @property {boolean} importedAnonymized
 * // ...add other properties as needed
 */

/**
 * Scenario model class (optional, for instantiation)
 */
export class Scenario {
  constructor({
    id,
    name = 'Neues Szenario',
    remark = '',
    confidence = 50,
    likelihood = 50,
    desirability = 50,
    baseScenarioId = null,
    imported = false,
    importedAnonymized = false,
    ...rest
  }) {
    this.id = String(id);
    this.name = name;
    this.remark = remark;
    this.confidence = confidence;
    this.likelihood = likelihood;
    this.desirability = desirability;
    this.baseScenarioId = baseScenarioId;
    this.imported = imported;
    this.importedAnonymized = importedAnonymized;
    Object.assign(this, rest);
  }
}
