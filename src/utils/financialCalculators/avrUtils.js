// Dynamically import all AVR JSONs in the avr-data folder (Vite syntax)
const avrDataModules = import.meta.glob('../../assets/avr-data/*.json', { eager: true });
const avrDataArray = Object.values(avrDataModules).map(mod => mod.default);

// Select the valid AVR config for today
function getValidAvrConfig() {
  const today = new Date().toISOString().slice(0, 10);
  // Find config where validfrom <= today and (validto is empty or today <= validto)
  return (
    avrDataArray.find(cfg => {
      const from = cfg.validfrom || '';
      const to = cfg.validto || '';
      return from <= today && (to === '' || today <= to);
    }) || { salery_groups: [] }
  );
}

/**
 * Returns all stages for a given group (by group_id or group_name) using the AVR config valid today.
 * @param {number|string} groupRef - The group_id or group_name.
 * @returns {Array} Array of stage objects.
 */
export function getAllStagesForGroup(groupRef) {
  const avrConfig = getValidAvrConfig();
  if (!avrConfig.salery_groups) return [];
  let group;
  if (typeof groupRef === 'number') {
    group = avrConfig.salery_groups.find(g => g.group_id === groupRef);
  } else {
    group = avrConfig.salery_groups.find(g => g.group_name === groupRef);
  }
  if (!group || !Array.isArray(group.amount)) return [];
  return group.amount;
}

/**
 * Returns all AVR groups (salery_groups) from the AVR config valid today.
 * @returns {Array} Array of group objects.
 */
export function getAllAvrGroups() {
  const avrConfig = getValidAvrConfig();
  return Array.isArray(avrConfig.salery_groups) ? avrConfig.salery_groups : [];
}

/**
 * Get the AVR config valid for a given date (YYYY-MM-DD).
 */
export function getAvrConfigForDate(dateStr) {
  const date = new Date(dateStr);
  return (
    avrDataArray.find(cfg => {
      const from = cfg.validfrom ? new Date(cfg.validfrom.split('.').reverse().join('-')) : null;
      const to = cfg.validto ? new Date(cfg.validto.split('.').reverse().join('-')) : null;
      return (!from || from <= date) && (!to || date <= to);
    }) || avrDataArray[0] || { salery_groups: [], fulltimehours: 39 }
  );
}

/**
 * Get the AVR amount for a group and stage at a reference date.
 * @param {number} groupId
 * @param {number} stage
 * @param {string} dateStr - ISO date string
 * @returns {number}
 */
export function getAvrAmountForGroupAndStage(groupId, stage, dateStr) {
  const avrConfig = getAvrConfigForDate(dateStr);
  const group = avrConfig.salery_groups?.find(g => Number(g.group_id) === Number(groupId));
  if (!group) return 0;
  const stageObj = group.amount?.find(a => Number(a.stage) === Number(stage));
  return stageObj ? Number(stageObj.amount) : 0;
}

/**
 * Get the fulltime hours for a given date.
 * @param {string} dateStr - ISO date string
 * @returns {number}
 */
export function getAvrFulltimeHours(dateStr) {
  const avrConfig = getAvrConfigForDate(dateStr);
  return Number(avrConfig.fulltimehours) || 39;
}

/**
 * Get all stage upgrade dates for a given start date,
 * using the AVR config valid at the given reference date.
 * Always starts from stage 1 and projects upgrades from the start date.
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {any} _currentStage - (ignored, always starts from 1)
 * @param {string} referenceDate - ISO date string (YYYY-MM-DD) for AVR config
 * @returns {Array<{date: string, from_stage: number, to_stage: number}>}
 */
export function getStageUpgradeDates(startDate, _currentStage, referenceDate) {
  const avrConfig = getAvrConfigForDate(referenceDate);
  const upgrades = Array.isArray(avrConfig.stage_upgrade) ? avrConfig.stage_upgrade : [];
  const result = [];
  let currentStage = 1; // Always start from stage 1
  const start = new Date(startDate);

  let yearsSum = 0;
  while (true) {
    const upgrade = upgrades.find(u => Number(u.from_stage) === currentStage);
    if (!upgrade) break;
    yearsSum += Number(upgrade.years);
    // Create upgrade date by adding years to the original start date
    const upgradeDate = new Date(start);
    upgradeDate.setFullYear(upgradeDate.getFullYear() + yearsSum);
    
    result.push({
      date: upgradeDate.toISOString().slice(0, 10),
      from_stage: upgrade.from_stage,
      to_stage: upgrade.to_stage
    });
    currentStage = Number(upgrade.to_stage);
  }
  return result;
}

/**
 * Get the bonus definition of a specific type from the AVR config valid at a reference date.
 * @param {string} bonusType - e.g. "avr-yearly"
 * @param {string} referenceDate - ISO date string (YYYY-MM-DD)
 * @returns {object|null} The bonus object or null if not found
 */
export function getAvrBonusByType(bonusType, referenceDate) {
  const avrConfig = getAvrConfigForDate(referenceDate);
  if (!Array.isArray(avrConfig.bonus)) return null;
  return avrConfig.bonus.find(b => b.type === bonusType) || null;
}
