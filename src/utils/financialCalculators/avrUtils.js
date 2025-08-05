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
