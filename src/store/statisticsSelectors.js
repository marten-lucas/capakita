import { createSelector } from '@reduxjs/toolkit';
import { sumBookingHours } from '../utils/bookingUtils';
import { hasAllowedChildStatus } from '../utils/dataVisibility';

const EMPTY_RESULT = {
  aggregation: 'month',
  asOfDate: null,
  buckets: [],
};

const EMPTY_TRANSITIONS_RESULT = {
  asOfDate: null,
  windowDays: 90,
  transitions: [],
  summary: {
    count: 0,
    averageAgeMonths: 0,
    medianAgeMonths: 0,
    averageBeforeHours: 0,
    averageAfterHours: 0,
    averageDeltaHours: 0,
    averageDeltaPercent: 0,
  },
  ageHistogram: [],
  corridor: {
    eligibleCount: 0,
    evaluatedCount: 0,
    remainedInRegelCount: 0,
    switchedToSchoolCount: 0,
    remainProbability: 0,
  },
};

const ENTRY_STAGE_ID = 'entry';
const KRIPPE_STAGE_ID = 'krippe';
const REGEL_STAGE_ID = 'regelgruppe';
const SCHOOL_STAGE_ID = 'schulkindbetreuung';

const TRANSITION_KIND = {
  ENTRY_KRIPPE: 'entry_krippe',
  ENTRY_REGEL: 'entry_regelgruppe',
  KRIPPE_TO_REGEL: 'krippe_to_regelgruppe',
  REGEL_TO_SCHOOL: 'regelgruppe_to_schulkindbetreuung',
};

function getStageLabel(stageId) {
  if (stageId === ENTRY_STAGE_ID) return 'Einstieg';
  if (stageId === KRIPPE_STAGE_ID) return 'Krippe';
  if (stageId === REGEL_STAGE_ID) return 'Regelgruppe';
  if (stageId === SCHOOL_STAGE_ID) return 'Schulkindbetreuung';
  return '';
}

function roundOne(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function isKrippeGroup(definition, fallbackName = '') {
  const haystack = `${definition?.type || ''} ${definition?.name || ''} ${fallbackName}`.toLowerCase();
  return haystack.includes('krippe');
}

function isSchoolGroup(definition, fallbackName = '') {
  const haystack = `${definition?.type || ''} ${definition?.name || ''} ${fallbackName}`.toLowerCase();
  return haystack.includes('schul');
}

function compressAssignments(assignments) {
  return assignments.reduce((accumulator, assignment) => {
    const last = accumulator[accumulator.length - 1];
    if (last && String(last.groupId) === String(assignment.groupId)) {
      return accumulator;
    }

    accumulator.push(assignment);
    return accumulator;
  }, []);
}

function classifyAssignmentStages(assignments, groupDefsById) {
  const schoolIndex = assignments.findIndex((assignment) => {
    const definition = groupDefsById[String(assignment.groupId)];
    return isSchoolGroup(definition, assignment.groupName);
  });
  const nonSchoolCutoff = schoolIndex >= 0 ? schoolIndex : assignments.length;
  const nonSchoolAssignments = assignments.slice(0, nonSchoolCutoff);
  const hasExplicitKrippeStage = nonSchoolAssignments.some((assignment) => {
    const definition = groupDefsById[String(assignment.groupId)];
    return isKrippeGroup(definition, assignment.groupName);
  });

  return assignments.map((assignment) => {
    const definition = groupDefsById[String(assignment.groupId)];
    if (isSchoolGroup(definition, assignment.groupName)) {
      return { ...assignment, stageId: SCHOOL_STAGE_ID };
    }

    const nonSchoolIndex = nonSchoolAssignments
      .filter((candidate) => !isSchoolGroup(groupDefsById[String(candidate.groupId)], candidate.groupName))
      .findIndex((candidate) => String(candidate.id) === String(assignment.id));

    if (isKrippeGroup(definition, assignment.groupName)) {
      return { ...assignment, stageId: KRIPPE_STAGE_ID };
    }

    if (!hasExplicitKrippeStage && nonSchoolAssignments.length >= 2 && nonSchoolIndex === 0) {
      return { ...assignment, stageId: KRIPPE_STAGE_ID };
    }

    return { ...assignment, stageId: REGEL_STAGE_ID };
  });
}

const AGGREGATIONS = new Set(['month', 'quarter', 'year']);

function parseIsoDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getSchoolEnrollmentDateByBayRules(dateOfBirth, deferredInCorridor = false) {
  const birthDate = parseIsoDate(dateOfBirth);
  if (!birthDate) return null;

  const sixthBirthday = new Date(Date.UTC(
    birthDate.getUTCFullYear() + 6,
    birthDate.getUTCMonth(),
    birthDate.getUTCDate()
  ));

  const year = sixthBirthday.getUTCFullYear();
  const month = sixthBirthday.getUTCMonth() + 1;
  const day = sixthBirthday.getUTCDate();

  const isBeforeOrOnJune30 = month < 7 || (month === 6 && day <= 30);
  const isCorridor = month === 7 || month === 8 || (month === 9 && day <= 30);
  const enrollmentYear = isBeforeOrOnJune30
    ? year
    : isCorridor
      ? (deferredInCorridor ? year + 1 : year)
      : year + 1;

  return new Date(Date.UTC(enrollmentYear, 8, 1));
}

function isCorridorBirthdayByBayRules(dateOfBirth) {
  const birthDate = parseIsoDate(dateOfBirth);
  if (!birthDate) return false;

  const sixthBirthday = new Date(Date.UTC(
    birthDate.getUTCFullYear() + 6,
    birthDate.getUTCMonth(),
    birthDate.getUTCDate()
  ));

  const month = sixthBirthday.getUTCMonth() + 1;
  const day = sixthBirthday.getUTCDate();
  return month === 7 || month === 8 || (month === 9 && day <= 30);
}

function findStageAtDate(assignments, date) {
  if (!Array.isArray(assignments) || !date) return null;

  const active = assignments.find((assignment) => (
    normalizeStart(assignment?.start) <= date && normalizeEnd(assignment?.end) >= date
  ));

  return active?.stageId || null;
}

function normalizeStart(dateValue) {
  return parseIsoDate(dateValue) || new Date(Date.UTC(1, 0, 1));
}

function normalizeEnd(dateValue) {
  return parseIsoDate(dateValue) || new Date(Date.UTC(9999, 11, 31));
}

function isActiveOn(date, startDate, endDate) {
  return normalizeStart(startDate) <= date && normalizeEnd(endDate) >= date;
}

function getMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getMonthEnd(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function getQuarterStart(date) {
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

function getQuarterEnd(date) {
  const start = getQuarterStart(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
}

function getYearStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function getYearEnd(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
}

function shiftPeriodStart(date, aggregation, step) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  if (aggregation === 'month') {
    return new Date(Date.UTC(year, month + step, 1));
  }

  if (aggregation === 'quarter') {
    return new Date(Date.UTC(year, month + step * 3, 1));
  }

  return new Date(Date.UTC(year + step, 0, 1));
}

function periodBounds(date, aggregation) {
  if (aggregation === 'quarter') {
    return { start: getQuarterStart(date), end: getQuarterEnd(date) };
  }

  if (aggregation === 'year') {
    return { start: getYearStart(date), end: getYearEnd(date) };
  }

  return { start: getMonthStart(date), end: getMonthEnd(date) };
}

function formatBucketLabel(startDate, aggregation) {
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth() + 1;

  if (aggregation === 'year') {
    return String(year);
  }

  if (aggregation === 'quarter') {
    const quarter = Math.floor(startDate.getUTCMonth() / 3) + 1;
    return `Q${quarter} ${year}`;
  }

  return `${String(month).padStart(2, '0')}.${year}`;
}

function collectFirstRelevantDate(items, bookings) {
  let minDate = null;

  Object.values(items || {}).forEach((item) => {
    const candidates = [item?.startdate].map(parseIsoDate).filter(Boolean);
    candidates.forEach((candidate) => {
      if (!minDate || candidate < minDate) minDate = candidate;
    });
  });

  Object.values(bookings || {}).forEach((bookingMap) => {
    Object.values(bookingMap || {}).forEach((booking) => {
      const startDate = parseIsoDate(booking?.startdate);
      if (!startDate) return;
      if (!minDate || startDate < minDate) minDate = startDate;
    });
  });

  return minDate;
}

function roundTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addDays(date, deltaDays) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + deltaDays));
}

function snapshotWeeklyHoursAtDate(bookingMap, date) {
  let total = 0;
  Object.values(bookingMap || {}).forEach((booking) => {
    if (!isActiveOn(date, booking?.startdate, booking?.enddate)) return;
    total += sumBookingHours(booking, { mode: 'all' });
  });
  return total;
}

function averageWeeklyBookedHoursInWindow(bookingMap, item, fromDate, toDate) {
  if (!fromDate || !toDate || fromDate > toDate) return 0;

  let daysCounted = 0;
  let total = 0;

  for (let cursor = fromDate; cursor <= toDate; cursor = addDays(cursor, 1)) {
    if (!isActiveOn(cursor, item?.startdate, item?.enddate)) continue;

    total += snapshotWeeklyHoursAtDate(bookingMap, cursor);
    daysCounted += 1;
  }

  if (daysCounted === 0) return 0;
  return roundTwo(total / daysCounted);
}

function monthsBetween(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return null;

  let months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12;
  months += endDate.getUTCMonth() - startDate.getUTCMonth();
  if (endDate.getUTCDate() < startDate.getUTCDate()) {
    months -= 1;
  }

  return months;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return roundTwo((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function average(values) {
  if (!values.length) return 0;
  return roundTwo(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildAgeHistogram(ages) {
  const bucketCounts = new Map();

  ages.forEach((age) => {
    if (!Number.isFinite(age) || age < 0) return;
    const start = Math.floor(age / 3) * 3;
    const end = start + 2;
    const key = `${start}-${end}`;
    bucketCounts.set(key, (bucketCounts.get(key) || 0) + 1);
  });

  return Array.from(bucketCounts.entries())
    .map(([range, count]) => {
      const [start, end] = range.split('-').map(Number);
      return { key: range, label: `${start}-${end} Monate`, start, end, count };
    })
    .sort((a, b) => a.start - b.start);
}

export function deriveAutoEventSettingsFromStatistics(transitionStatistics, groupDefs = [], fallbackSettings = {}) {
  void groupDefs;
  const groupedTransitions = {
    kita: (transitionStatistics?.transitions || []).filter(
      (transition) => transition.transitionKind === TRANSITION_KIND.KRIPPE_TO_REGEL
    ),
    school: (transitionStatistics?.transitions || []).filter(
      (transition) => transition.transitionKind === TRANSITION_KIND.REGEL_TO_SCHOOL
    ),
  };

  return ['kita', 'school'].reduce((accumulator, key) => {
    const routeTransitions = groupedTransitions[key];
    const fallback = fallbackSettings?.[key] || {};
    const ages = key === 'kita'
      ? routeTransitions
        .map((transition) => transition.ageMonths)
        .filter((value) => Number.isFinite(value))
      : [];
    const deltas = routeTransitions
      .map((transition) => transition.deltaHours)
      .filter((value) => Number.isFinite(value));

    accumulator[key] = {
      ageYears: ages.length > 0 ? roundOne(average(ages) / 12) : Number(fallback.ageYears) || 0,
      bookingDeltaHours: deltas.length > 0 ? roundOne(average(deltas)) : Number(fallback.bookingDeltaHours) || 0,
    };

    return accumulator;
  }, {});
}

export const selectHistoricalStatistics = createSelector(
  [
    (state) => state.simScenario.selectedScenarioId,
    (state) => state.simData.dataByScenario,
    (state) => state.simBooking.bookingsByScenario,
    (_, options) => options?.aggregation || 'month',
    (_, options) => options?.asOfDate || new Date().toISOString().slice(0, 10),
  ],
  (scenarioId, dataByScenario, bookingsByScenario, rawAggregation, rawAsOfDate) => {
    const aggregation = AGGREGATIONS.has(rawAggregation) ? rawAggregation : 'month';
    const asOfDate = parseIsoDate(rawAsOfDate);

    if (!scenarioId || !asOfDate) {
      return EMPTY_RESULT;
    }

    const items = dataByScenario?.[scenarioId] || {};
    const bookingsByItem = bookingsByScenario?.[scenarioId] || {};
    const firstRelevantDate = collectFirstRelevantDate(items, bookingsByItem);

    if (!firstRelevantDate) {
      return {
        aggregation,
        asOfDate: toIsoDate(asOfDate),
        buckets: [],
      };
    }

    const firstBucket = periodBounds(firstRelevantDate, aggregation).start;
    const lastBucket = periodBounds(asOfDate, aggregation).start;
    const buckets = [];

    for (
      let cursor = firstBucket;
      cursor <= lastBucket;
      cursor = shiftPeriodStart(cursor, aggregation, 1)
    ) {
      const { start, end } = periodBounds(cursor, aggregation);
      const evaluationDate = end <= asOfDate ? end : asOfDate;

      let childrenCount = 0;
      let bookingHours = 0;
      let careHours = 0;

      Object.entries(items).forEach(([itemId, item]) => {
        if (!isActiveOn(evaluationDate, item?.startdate, item?.enddate)) return;
        if (!hasAllowedChildStatus(item)) return;

        if (item?.type === 'demand') {
          childrenCount += 1;
        }

        const bookingMap = bookingsByItem[itemId] || {};
        Object.values(bookingMap).forEach((booking) => {
          if (!isActiveOn(evaluationDate, booking?.startdate, booking?.enddate)) return;

          if (item?.type === 'demand') {
            bookingHours += sumBookingHours(booking, { mode: 'all' });
          }

          if (item?.type === 'capacity') {
            careHours += sumBookingHours(booking, { mode: 'pedagogical' });
          }
        });
      });

      buckets.push({
        key: `${aggregation}:${toIsoDate(start)}`,
        label: formatBucketLabel(start, aggregation),
        start: toIsoDate(start),
        end: toIsoDate(end),
        evaluationDate: toIsoDate(evaluationDate),
        childrenCount,
        bookingHours: roundTwo(bookingHours),
        careHours: roundTwo(careHours),
      });
    }

    return {
      aggregation,
      asOfDate: toIsoDate(asOfDate),
      buckets,
    };
  }
);

export const selectGroupTransitionStatistics = createSelector(
  [
    (state) => state.simScenario.selectedScenarioId,
    (state) => state.simData.dataByScenario,
    (state) => state.simBooking.bookingsByScenario,
    (state) => state.simGroup.groupsByScenario,
    (state) => state.simGroup.groupDefsByScenario,
    (_, options) => options?.asOfDate || new Date().toISOString().slice(0, 10),
    (_, options) => (Number.isInteger(options?.windowDays) && options.windowDays > 0 ? options.windowDays : 90),
  ],
  (scenarioId, dataByScenario, bookingsByScenario, groupsByScenario, groupDefsByScenario, rawAsOfDate, windowDays) => {
    const asOfDate = parseIsoDate(rawAsOfDate);
    if (!scenarioId || !asOfDate) {
      return EMPTY_TRANSITIONS_RESULT;
    }

    const items = dataByScenario?.[scenarioId] || {};
    const bookingsByItem = bookingsByScenario?.[scenarioId] || {};
    const groupAssignmentsByItem = groupsByScenario?.[scenarioId] || {};
    const groupDefs = groupDefsByScenario?.[scenarioId] || [];
    const groupDefsById = Object.fromEntries((groupDefs || []).map((def) => [String(def.id), def]));

    const transitions = [];
    const corridor = {
      eligibleCount: 0,
      evaluatedCount: 0,
      remainedInRegelCount: 0,
      switchedToSchoolCount: 0,
      remainProbability: 0,
    };

    function pushTransition({ itemId, item, transitionDate, fromStageId, toStageId, transitionKind, includeAge = true }) {
      const bookingMap = bookingsByItem[itemId] || {};
      const beforeStart = fromStageId === ENTRY_STAGE_ID ? null : addDays(transitionDate, -windowDays);
      const beforeEnd = fromStageId === ENTRY_STAGE_ID ? null : addDays(transitionDate, -1);
      const afterStart = transitionDate;
      const afterEnd = addDays(transitionDate, windowDays - 1) < asOfDate
        ? addDays(transitionDate, windowDays - 1)
        : asOfDate;

      const beforeHours = fromStageId === ENTRY_STAGE_ID
        ? 0
        : averageWeeklyBookedHoursInWindow(bookingMap, item, beforeStart, beforeEnd);
      const afterHours = averageWeeklyBookedHoursInWindow(bookingMap, item, afterStart, afterEnd);
      const deltaHours = roundTwo(afterHours - beforeHours);
      const deltaPercent = beforeHours > 0 ? roundTwo((deltaHours / beforeHours) * 100) : null;
      const dateOfBirth = parseIsoDate(item?.dateofbirth);
      const ageMonths = includeAge ? monthsBetween(dateOfBirth, transitionDate) : null;

      transitions.push({
        key: `${itemId}:${toIsoDate(transitionDate)}:${transitionKind}`,
        itemId,
        itemName: item?.name || itemId,
        date: toIsoDate(transitionDate),
        fromGroupId: fromStageId,
        fromGroupName: getStageLabel(fromStageId),
        toGroupId: toStageId,
        toGroupName: getStageLabel(toStageId),
        transitionKind,
        ageMonths,
        beforeHours,
        afterHours,
        deltaHours,
        deltaPercent,
      });
    }

    Object.entries(items).forEach(([itemId, item]) => {
      if (item?.type !== 'demand') return;
      if (!hasAllowedChildStatus(item)) return;

      const assignments = compressAssignments(
        Object.values(groupAssignmentsByItem[itemId] || {})
        .filter((assignment) => assignment?.groupId)
        .sort((a, b) => normalizeStart(a?.start) - normalizeStart(b?.start))
      );

      if (assignments.length === 0) return;

      const classifiedAssignments = classifyAssignmentStages(assignments, groupDefsById);
      const firstAssignment = classifiedAssignments[0];
      const firstDate = parseIsoDate(firstAssignment?.start) || parseIsoDate(item?.startdate);

      if (firstDate && firstDate <= asOfDate) {
        if (firstAssignment.stageId === KRIPPE_STAGE_ID) {
          pushTransition({
            itemId,
            item,
            transitionDate: firstDate,
            fromStageId: ENTRY_STAGE_ID,
            toStageId: KRIPPE_STAGE_ID,
            transitionKind: TRANSITION_KIND.ENTRY_KRIPPE,
          });
        } else if (firstAssignment.stageId === REGEL_STAGE_ID) {
          pushTransition({
            itemId,
            item,
            transitionDate: firstDate,
            fromStageId: ENTRY_STAGE_ID,
            toStageId: REGEL_STAGE_ID,
            transitionKind: TRANSITION_KIND.ENTRY_REGEL,
          });
        }
      }

      if (classifiedAssignments.length >= 2) {
        for (let index = 1; index < classifiedAssignments.length; index += 1) {
        const previous = classifiedAssignments[index - 1];
        const current = classifiedAssignments[index];
        const transitionDate = parseIsoDate(current?.start) || parseIsoDate(previous?.end);
        if (!transitionDate || transitionDate > asOfDate) continue;

        if (previous.stageId === KRIPPE_STAGE_ID && current.stageId === REGEL_STAGE_ID) {
          pushTransition({
            itemId,
            item,
            transitionDate,
            fromStageId: KRIPPE_STAGE_ID,
            toStageId: REGEL_STAGE_ID,
            transitionKind: TRANSITION_KIND.KRIPPE_TO_REGEL,
          });
        }

        if (previous.stageId === REGEL_STAGE_ID && current.stageId === SCHOOL_STAGE_ID) {
          pushTransition({
            itemId,
            item,
            transitionDate,
            fromStageId: REGEL_STAGE_ID,
            toStageId: SCHOOL_STAGE_ID,
            transitionKind: TRANSITION_KIND.REGEL_TO_SCHOOL,
            includeAge: false,
          });
        }
      }
      }

      if (isCorridorBirthdayByBayRules(item?.dateofbirth)) {
        const firstPossibleSchoolStart = getSchoolEnrollmentDateByBayRules(item?.dateofbirth, false);
        if (firstPossibleSchoolStart && firstPossibleSchoolStart <= asOfDate) {
          corridor.eligibleCount += 1;
          const stageAtSchoolStart = findStageAtDate(classifiedAssignments, firstPossibleSchoolStart);
          if (stageAtSchoolStart) {
            corridor.evaluatedCount += 1;
            if (stageAtSchoolStart === REGEL_STAGE_ID) {
              corridor.remainedInRegelCount += 1;
            }
            if (stageAtSchoolStart === SCHOOL_STAGE_ID) {
              corridor.switchedToSchoolCount += 1;
            }
          }
        }
      }
    });

    transitions.sort((a, b) => a.date.localeCompare(b.date));

    const ages = transitions.map((transition) => transition.ageMonths).filter((value) => Number.isFinite(value));
    const beforeValues = transitions.map((transition) => transition.beforeHours);
    const afterValues = transitions.map((transition) => transition.afterHours);
    const deltaValues = transitions.map((transition) => transition.deltaHours);
    const deltaPercentValues = transitions
      .map((transition) => transition.deltaPercent)
      .filter((value) => Number.isFinite(value));

    corridor.remainProbability = corridor.evaluatedCount > 0
      ? roundTwo(corridor.remainedInRegelCount / corridor.evaluatedCount)
      : 0;

    return {
      asOfDate: toIsoDate(asOfDate),
      windowDays,
      transitions,
      summary: {
        count: transitions.length,
        averageAgeMonths: average(ages),
        medianAgeMonths: median(ages),
        averageBeforeHours: average(beforeValues),
        averageAfterHours: average(afterValues),
        averageDeltaHours: average(deltaValues),
        averageDeltaPercent: average(deltaPercentValues),
      },
      ageHistogram: buildAgeHistogram(ages),
      corridor,
    };
  }
);
