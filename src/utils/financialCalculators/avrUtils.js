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


/**
 * Calculate the percentage of presence for a dataItem in a given time period.
 * Only considers working days (Monday-Friday).
 * For limited_paid: paid phase (first 42 calendar days) is present, unpaid phase is absent.
 * @param {Object} dataItem
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @param {boolean} considerAbsences
 * @returns {number} Presence percentage (0..1)
 */
export function getPresencePercentageInPeriod(dataItem, periodStart, periodEnd, considerAbsences = true) {
  if (!dataItem) return 0;
  // Clamp period to employment
  const employmentStart = dataItem.startdate ? new Date(dataItem.startdate) : null;
  const employmentEnd = dataItem.enddate ? new Date(dataItem.enddate) : null;
  const start = employmentStart && employmentStart > periodStart ? employmentStart : periodStart;
  const end = employmentEnd && employmentEnd < periodEnd ? employmentEnd : periodEnd;
  if (start > end) return 0;

  // Calculate total working days in period (Mon-Fri)
  let totalDays = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) totalDays++;
  }
  if (totalDays <= 0) return 0;

  // Subtract absences if requested
  let absentDays = 0;
  if (considerAbsences && Array.isArray(dataItem.absences)) {
    dataItem.absences.forEach(abs => {
      if (abs.start && abs.end) {
        const absStart = new Date(abs.start) < start ? start : new Date(abs.start);
        const absEnd = new Date(abs.end) > end ? end : new Date(abs.end);
        if (absStart > absEnd) return;

        if (abs.payType === "unpaid") {
          // All working days in absence are absent
          for (let d = new Date(absStart); d <= absEnd; d.setDate(d.getDate() + 1)) {
            const day = d.getDay();
            if (day >= 1 && day <= 5) absentDays++;
          }
        } else if (abs.payType === "limited_paid") {
          // First 42 calendar days are paid (present), rest is unpaid (absent)
          const paidEnd = new Date(absStart);
          paidEnd.setDate(paidEnd.getDate() + 41); // 42 days including start
          // Paid phase: present, do not subtract
          // Unpaid phase: after paidEnd, subtract working days
          const unpaidStart = new Date(paidEnd);
          unpaidStart.setDate(unpaidStart.getDate() + 1);
          const actualUnpaidStart = unpaidStart > absEnd ? null : unpaidStart;
          if (actualUnpaidStart) {
            for (let d = new Date(actualUnpaidStart); d <= absEnd; d.setDate(d.getDate() + 1)) {
              const day = d.getDay();
              if (day >= 1 && day <= 5) absentDays++;
            }
          }
        }
        // fully_paid: do not subtract
      }
    });
  }

  const presentDays = Math.max(0, totalDays - absentDays);
  return presentDays / totalDays;
}

/**
 * Determine AVR stage for a given date.
 * @param {string} startdate - Employment start date (ISO string)
 * @param {number} initialStage - The starting AVR stage (from type_details.stage)
 * @param {Array} avrStageUpgrades - Array of upgrade rules (with .from_stage, .to_stage, .years)
 * @param {string} currentDate - The date to check (ISO string)
 * @returns {number} The AVR stage at the given date
 */
export function getAvrStageAtDate(startdate, initialStage, avrStageUpgrades, currentDate) {
  if (!startdate || !initialStage || !Array.isArray(avrStageUpgrades)) return initialStage;
  let stage = initialStage;
  let baseDate = new Date(startdate);

  for (const upg of avrStageUpgrades) {
    baseDate = new Date(baseDate.getFullYear() + (upg.years || 0), baseDate.getMonth(), baseDate.getDate());
    if (new Date(currentDate) >= baseDate) {
      stage = upg.to_stage;
    } else {
      break;
    }
  }
  return stage;
}