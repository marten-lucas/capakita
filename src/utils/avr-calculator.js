// Dynamically import all AVR JSONs in the avg-data folder (Vite syntax)
const avrDataModules = import.meta.glob('../assets/avr-data/*.json', { eager: true });

// Extract all JSON objects into an array
const avrDataArray = Object.values(avrDataModules).map(mod => mod.default);

// Helper to parse DD.MM.YYYY to Date
function parseDate(d) {
  const [day, month, year] = d.split('.').map(Number);
  return new Date(year, month - 1, day);
}

// Helper to normalize date string to YYYY-MM-DD
export function normalizeDateString(dateStr) {
  if (!dateStr) return '';
  // If already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // If in DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month}-${day}`;
  }
  // Otherwise, try to parse as Date
  const d = new Date(dateStr);
  if (!isNaN(d)) {
    return d.toISOString().slice(0, 10);
  }
  return dateStr;
}

// Find the AVR data valid for a given date (dateStr: 'YYYY-MM-DD' or similar)
export function findApplicableAvrData(dateStr) {
  const normalized = normalizeDateString(dateStr);
  const date = new Date(normalized);
  return avrDataArray.find(data => {
    const from = parseDate(data.validfrom);
    const to = parseDate(data.validto);
    return date >= from && date <= to;
  });
}

// Returns the salary for a given date, group name, and stage ID
export function getSalaryForGroupAndStage(dateStr, groupName, stageId) {
  const avrData = findApplicableAvrData(dateStr);
  if (!avrData) return null;
  // Use salery_groups and group_name/amount structure
  const group = avrData.salery_groups?.find(g => g.group_name === groupName);
  if (!group) return null;
  const stage = group.amount?.find(s => s.stage === stageId);
  if (!stage) return null;
  return stage.amount ?? null;
}

/**
 * Calculates the stage at a given future date, based on entry date, current stage, and AVR stage upgrade rules.
 * @param {string} entryDateStr - Entry date (YYYY-MM-DD or DD.MM.YYYY)
 * @param {string} futureDateStr - Future date (YYYY-MM-DD or DD.MM.YYYY)
 * @param {object} avrData - AVR data object (must have stage_upgrade)
 * @param {number} currentStage - The current stage as of today
 * @returns {number} - The stage at the future date
 */
function calculateStageAtDate(entryDateStr, futureDateStr, avrData, currentStage) {
  // Normalize and parse dates
  let entryDate = new Date(normalizeDateString(entryDateStr));
  let futureDate = new Date(normalizeDateString(futureDateStr));
  if (isNaN(entryDate) || isNaN(futureDate)) return currentStage;

  // Calculate years since entry
  let yearsSinceEntry = (futureDate - entryDate) / (365.25 * 24 * 60 * 60 * 1000);
  if (yearsSinceEntry < 0) return currentStage;

  // Find all stage upgrades, sorted by from_stage
  let upgrades = (avrData.stage_upgrade || []).sort((a, b) => a.from_stage - b.from_stage);

  let stage = currentStage;
  let found = false;

  // Find the upgrade path starting from currentStage
  for (let i = 0; i < upgrades.length; ++i) {
    if (upgrades[i].from_stage === stage) {
      found = true;
      break;
    }
  }
  if (!found) return stage;

  // Simulate stage upgrades from entry date
  let upgradeIdx = upgrades.findIndex(u => u.from_stage === stage);
  let yearsLeft = yearsSinceEntry;
  while (upgradeIdx >= 0 && upgradeIdx < upgrades.length && yearsLeft >= upgrades[upgradeIdx].years) {
    yearsLeft -= upgrades[upgradeIdx].years;
    stage = upgrades[upgradeIdx].to_stage;
    upgradeIdx = upgrades.findIndex(u => u.from_stage === stage);
  }
  return stage;
}

// Inflation rate per year for fallback calculation (can be moved to settings)
export const AVR_INFLATION_RATE = 0.02;

/**
 * Gets the future salary for a group at a future date, given entry date and today's stage.
 * If no AVR data is available for the future date, uses the latest AVR data and applies inflation.
 * Returns also what the calculation was based on: 'current', 'future', or 'inflated'.
 * @param {string} futureDateStr - The future date (YYYY-MM-DD or DD.MM.YYYY)
 * @param {string} groupName - The group name (e.g. "E1")
 * @param {number} currentStage - The current stage as of today
 * @param {string} entryDateStr - The entry date (YYYY-MM-DD or DD.MM.YYYY)
 * @returns {{salary: number|null, futureStage: number|null, calculationBase: 'current'|'future'|'inflated'|null}} - The salary, stage, and calculation base
 */
export function getFutureSalaryForGroupAndStage(futureDateStr, groupName, currentStage, entryDateStr) {
  let avrData = findApplicableAvrData(futureDateStr);
  let usedFallback = false;
  let fallbackYears = 0;
  let fallbackBaseAmount = null;
  let calculationBase = null;

  // If no AVR data for the future date, use the latest available and apply inflation
  if (!avrData) {
    usedFallback = true;
    // Find the latest AVR data by validto
    avrData = avrDataArray.reduce((latest, data) => {
      const latestTo = parseDate(latest?.validto || '01.01.1900');
      const dataTo = parseDate(data.validto);
      return dataTo > latestTo ? data : latest;
    }, null);
    if (!avrData) return { salary: null, futureStage: null, calculationBase: null };

    // Calculate how many started years in the future from the latest validto
    const latestValidTo = parseDate(avrData.validto);
    const futureDate = new Date(normalizeDateString(futureDateStr));
    // Count every started year (partial years count as a full year)
    const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const diffMs = futureDate - latestValidTo;
    fallbackYears = diffMs > 0 ? Math.ceil(diffMs / msPerYear) : 0;
    calculationBase = 'inflated';
  } else {
    // If the AVR data is valid for the future date, check if it's the current table or a future table
    const now = new Date();
    const avrFrom = parseDate(avrData.validfrom);
    if (now >= avrFrom) {
      calculationBase = 'current';
    } else {
      calculationBase = 'future';
    }
  }

  const futureStage = calculateStageAtDate(entryDateStr, futureDateStr, avrData, currentStage);
  const group = avrData.salery_groups?.find(g => g.group_name === groupName);
  if (!group) return { salary: null, futureStage, calculationBase };

  const stageObj = group.amount?.find(s => s.stage === futureStage);

  if (stageObj && !usedFallback) {
    return { salary: stageObj.amount ?? null, futureStage, calculationBase };
  }

  // Fallback: use latest amount for the stage and apply inflation
  fallbackBaseAmount = stageObj ? stageObj.amount : null;
  if (fallbackBaseAmount == null) {
    // If no exact stage found, use the highest available stage below or equal to futureStage
    const maxStageObj = group.amount
      ?.filter(s => s.stage <= futureStage)
      .sort((a, b) => b.stage - a.stage)[0];
    fallbackBaseAmount = maxStageObj ? maxStageObj.amount : null;
  }
  if (fallbackBaseAmount == null) return { salary: null, futureStage, calculationBase };

  // Apply inflation for every started year beyond the latest AVR data
  let inflated = fallbackBaseAmount;
  for (let i = 0; i < fallbackYears; ++i) {
    inflated *= 1 + AVR_INFLATION_RATE;
  }

  return { salary: Math.round(inflated * 100) / 100, futureStage, calculationBase: 'inflated' };
}

/**
 * Returns all salary groups for a given date (or latest if not found).
 * @param {string} dateStr
 * @returns {Array<{group_id:number, group_name:string}>}
 */
export function getAllSalaryGroups(dateStr) {
  const avrData = findApplicableAvrData(dateStr) || avrDataArray[avrDataArray.length - 1];
  if (!avrData) return [];
  return avrData.salery_groups.map(g => ({
    group_id: g.group_id,
    group_name: g.group_name
  }));
}

/**
 * Returns all salary stages for a group_id at a given date (or latest if not found).
 * @param {string} dateStr
 * @param {number} groupId
 * @returns {Array<{stage:number, amount:number}>}
 */
export function getAllSalaryStages(dateStr, groupId) {
  const avrData = findApplicableAvrData(dateStr) || avrDataArray[avrDataArray.length - 1];
  if (!avrData) return [];
  const group = avrData.salery_groups.find(g => g.group_id === groupId);
  if (!group) return [];
  return group.amount.map(a => ({
    stage: a.stage,
    amount: a.amount
  }));
}

/**
 * Returns all bonus types for a given date (or latest if not found).
 * Extracts from AVR JSON data if available, otherwise falls back to empty list.
 * @param {string} dateStr
 * @returns {Array<{value:string, label:string}>}
 */
export function getAllBonusTypes(dateStr) {
  const avrData = findApplicableAvrData(dateStr) || avrDataArray[avrDataArray.length - 1];
  if (avrData && Array.isArray(avrData.bonus)) {
    // Map bonus objects to { value, label }
    return avrData.bonus.map(b => ({
      value: b.type,
      label: b.name || b.type
    }));
  }
  // Fallback empty list
  return [
  ];
}

/**
 * Get the bonus definition object for a given type at a reference date.
 * @param {string} dateStr
 * @param {string} bonusType
 * @returns {object|null}
 */
export function getBonusDefinition(dateStr, bonusType) {
  const avrData = findApplicableAvrData(dateStr) || avrDataArray[avrDataArray.length - 1];
  if (!avrData || !Array.isArray(avrData.bonus)) return null;
  return avrData.bonus.find(b => b.type === bonusType) || null;
}

/**
 * Hole fulltimeHours aus dem AVR-Datensatz für das Referenzdatum.
 * @param {string} dateStr
 * @returns {number}
 */
export function getFulltimeHours(dateStr) {
  const avrData = findApplicableAvrData(dateStr) || avrDataArray[avrDataArray.length - 1];
  return avrData?.fulltimehours || 39;
}

/**
 * Calculate the child bonus amount for a given date and number of children.
 * Takes into account part-time reduction if reduce_parttime is true.
 * @param {string} dateStr
 * @param {number} kinderanzahl
 * @param {number} wochenstunden
 * @returns {number|null}
 */
export function calcAvrChildBonus(dateStr, kinderanzahl, wochenstunden) {
  const def = getBonusDefinition(dateStr, 'avr-childbonus');
  if (!def || !def.value) return null;
  const value = Number(def.value);
  if (isNaN(value)) return null;
  let bonus = value * (Number(kinderanzahl) || 0);
  const fulltimeHours = getFulltimeHours(dateStr);
  if (def.reduce_parttime && fulltimeHours && wochenstunden) {
    const ratio = wochenstunden / fulltimeHours;
    console.log(`[AVR] Kinderzuschlag Teilzeit-Kürzung: ${wochenstunden} / ${fulltimeHours} = ${ratio}, bonus vorher: ${bonus}`);
    bonus = bonus * ratio;
    console.log(`[AVR] Kinderzuschlag nach Teilzeit-Kürzung: ${bonus}`);
  }
  return Math.round(bonus * 100) / 100;
}

/**
 * Calculate the instructor bonus amount for a given date.
 * Takes into account part-time reduction if reduce_parttime is true.
 * Returns 0 if no start date is provided.
 * @param {string} dateStr
 * @param {number} wochenstunden
 * @param {string} startdate - Start date for the bonus (optional)
 * @param {string} enddate - End date for the bonus (optional)
 * @returns {number|null}
 */
export function calcAvrInstructorBonus(dateStr, wochenstunden, startdate, enddate) {
  const def = getBonusDefinition(dateStr, 'avr-instructor');
  if (!def || !def.value) return null;
  if (!startdate) {
    console.log('[AVR] Praxisanleiterzulage: Kein Startdatum, Bonus = 0');
    return 0;
  }
  const currentDate = new Date(normalizeDateString(dateStr));
  const start = new Date(normalizeDateString(startdate));
  if (currentDate < start) {
    console.log(`[AVR] Praxisanleiterzulage: currentDate (${currentDate}) < start (${start}), Bonus = 0`);
    return 0;
  }
  if (enddate) {
    const end = new Date(normalizeDateString(enddate));
    if (currentDate > end) {
      console.log(`[AVR] Praxisanleiterzulage: currentDate (${currentDate}) > end (${end}), Bonus = 0`);
      return 0;
    }
  }
  const value = Number(def.value);
  if (isNaN(value)) return null;
  let bonus = value;
  const fulltimeHours = getFulltimeHours(dateStr);
  if (def.reduce_parttime && fulltimeHours && wochenstunden) {
    const ratio = wochenstunden / fulltimeHours;
    console.log(`[AVR] Praxisanleiterzulage Teilzeit-Kürzung: ${wochenstunden} / ${fulltimeHours} = ${ratio}, bonus vorher: ${bonus}`);
    bonus = bonus * ratio;
    console.log(`[AVR] Praxisanleiterzulage nach Teilzeit-Kürzung: ${bonus}`);
  }
  return Math.round(bonus * 100) / 100;
}

/**
 * Calculate the yearly bonus (Jahressonderzahlung) for a given date, group, and stage.
 * Returns { amount, payoutDate }
 * Takes into account part-time and part-year reductions.
 * @param {string} dateStr - reference date (YYYY-MM-DD)
 * @param {string} groupName - e.g. "S 18"
 * @param {number} stage - e.g. 3
 * @param {number} wochenstunden
 * @param {string} startdate - Eintrittsdatum (YYYY-MM-DD)
 * @param {string} enddate - Austrittsdatum (YYYY-MM-DD, optional)
 * @returns {{amount: number|null, payoutDate: string|null}}
 */
export function calcAvrYearlyBonus(dateStr, groupName, stage, wochenstunden, startdate, enddate) {
  const def = getBonusDefinition(dateStr, 'avr-yearly');
  if (!def) return { amount: null, payoutDate: null };

  const fulltimeHours = getFulltimeHours(dateStr);

  // 1. Berechne das Gehalt für jeden base_month_average im gleichen Jahr wie das Referenzdatum
  const refDate = new Date(normalizeDateString(dateStr));
  const year = refDate.getFullYear();
  const months = Array.isArray(def.base_month_average) ? def.base_month_average : [];
  const salaries = months.map(month => {
    // Erzeuge ein Datum im gewünschten Monat und Jahr
    const monthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    return getSalaryForGroupAndStage(monthStr, groupName, stage);
  }).filter(val => typeof val === 'number' && !isNaN(val));

  // 2. Bilde den Durchschnitt dieser Werte
  if (salaries.length === 0) return { amount: null, payoutDate: null };
  const avgSalary = salaries.reduce((a, b) => a + b, 0) / salaries.length;

  // 3. Ermittle den passenden percentage
  let percentage = null;
  if (Array.isArray(def.percentage)) {
    for (const p of def.percentage) {
      if (
        (p.from_group === undefined || groupNameMatchesGroupId(groupName, p.from_group)) &&
        (p.to_stage === undefined || stage <= p.to_stage)
      ) {
        percentage = p.value;
        break;
      }
    }
    if (percentage === null && def.percentage.length > 0) {
      percentage = def.percentage[0].value;
    }
  }
  if (percentage === null) return { amount: null, payoutDate: null };

  // 4. Errechne den Betrag aus Durchschnittsgehalt und percentage
  let amount = avgSalary * percentage;

  // Teilzeit-Kürzung
   

  console.log(`[AVR] Jahressonderzahlung Teilzeit-Kürzung: ${def.reduce_parttime} | ${fulltimeHours}| ${wochenstunden}`);
  if (def.reduce_parttime && fulltimeHours ) {
    const ratio = wochenstunden / fulltimeHours;
    console.log(`[AVR] Jahressonderzahlung Teilzeit-Kürzung: ${wochenstunden} / ${fulltimeHours} = ${ratio}, amount vorher: ${amount}`);
    amount = amount * ratio;
    console.log(`[AVR] Jahressonderzahlung nach Teilzeit-Kürzung: ${amount}`);
  }

  // Teiljahr-Kürzung
  if (def.reduce_partyear && startdate) {
    const start = new Date(normalizeDateString(startdate));
    const end = enddate ? new Date(normalizeDateString(enddate)) : null;
    let monthsWorked = 12;
    if (start.getFullYear() === year) {
      monthsWorked -= (start.getMonth());
    }
    if (end && end.getFullYear() === year) {
      monthsWorked -= (11 - end.getMonth());
    }
    monthsWorked = Math.max(0, Math.min(12, monthsWorked));
    const ratio = monthsWorked / 12;
    console.log(`[AVR] Jahressonderzahlung Teiljahr-Kürzung: monthsWorked=${monthsWorked}/12 = ${ratio}, amount vorher: ${amount}`);
    amount = amount * ratio;
    console.log(`[AVR] Jahressonderzahlung nach Teiljahr-Kürzung: ${amount}`);
  }

  amount = Math.round(amount * 100) / 100;

  // 5. Errechne das nächste Auszahlungstag (letzter Tag des due_month)
  let payoutDate = null;
  if (def.due_month) {
    let payoutYear = year;
    if (refDate.getMonth() + 1 > def.due_month) payoutYear += 1;
    const lastDay = new Date(payoutYear, def.due_month, 0).getDate();
    payoutDate = `${payoutYear}-${String(def.due_month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  return { amount, payoutDate };
}

/**
 * Helper: Check if groupName matches a group_id (as number or string).
 * @param {string} groupName
 * @param {number} groupId
 * @returns {boolean}
 */
function groupNameMatchesGroupId(groupName, groupId) {
  // Find group name for groupId in current AVR data
  for (const avrData of avrDataArray) {
    const group = avrData.salery_groups?.find(g => g.group_id === groupId);
    if (group && group.group_name === groupName) return true;
  }
  return false;
}

// Export all loaded AVR data if needed elsewhere
export { avrDataArray };