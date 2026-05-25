import { createSelector } from '@reduxjs/toolkit';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { calculateChartDataWeekly } from '../utils/chartUtils/chartUtilsWeekly';
import { calculateChartDataMidterm, generateMidtermCategories, formatDateToCategory } from '../utils/chartUtils/chartUtilsMidterm';
import { calculateChartDataHistogram } from '../utils/chartUtils/chartUtilsHistogram';
import { calculateChartDataAgeHistogram } from '../utils/chartUtils/chartUtilsAgeHistogram';
import { isArchivedDataItem } from '../utils/dataVisibility';
import {
  calculateScenarioMonthlyFinance,
  convertMonthlyAmountToPeriod,
  getPeriodBoundsForCategory,
  hasAnyBookingInWeek,
  isRecordActiveOnDate,
  resolveGroupIdsForBounds,
} from '../utils/financeUtils';
import { minutesToTime, timeToMinutes } from '../utils/timeUtils';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const EMPTY_WEEKLY_DATA = {
  categories: [],
  demand: [],
  maxdemand: '',
  capacity: [],
  capacity_pedagogical: [],
  capacity_administrative: [],
  maxcapacity: '',
  care_ratio: [],
  max_care_ratio: '',
  expert_ratio: [],
  maxexpert_ratio: '100',
  flags: [],
};

const EMPTY_MIDTERM_DATA = {
  categories: [],
  demand: [],
  maxdemand: '',
  capacity: [],
  capacity_pedagogical: [],
  capacity_administrative: [],
  maxcapacity: '',
  care_ratio: [],
  max_care_ratio: '',
  expert_ratio: [],
  maxexpert_ratio: '100',
  income_total: [],
  expenses_total: [],
  net_total: [],
  child_count: [],
  employee_count: [],
  child_count_by_group: [],
  employee_count_by_group: [],
  maxcount: 0,
  maxchildcount: 0,
  maxemployeecount: 0,
  maxfinance: 0,
  financeKpis: {
    averageCareRatioWeek: 0,
    personnelCostPerChild: 0,
    activeChildrenWithBookings: 0,
    monthlyPersonnelCost: 0,
  },
  flags: [],
};

const EMPTY_HISTOGRAM_DATA = {
  categories: [],
  demand: [],
  maxdemand: '',
  capacity: [],
  capacity_pedagogical: [],
  capacity_administrative: [],
  maxcapacity: '',
};

const EMPTY_AGE_HISTOGRAM_DATA = {
  categories: [],
  series: [],
  maxCount: 0,
};

const selectSelectedScenarioId = (state) => state.simScenario.selectedScenarioId;
const selectChartSlice = (state) => state.chart;
const selectScenarios = (state) => state.simScenario.scenarios;
const selectOverlaysByScenario = (state) => state.simOverlay.overlaysByScenario;
const selectDataByScenario = (state) => state.simData.dataByScenario;
const selectBookingsByScenario = (state) => state.simBooking.bookingsByScenario;
const selectGroupDefsByScenario = (state) => state.simGroup.groupDefsByScenario;
const selectGroupsByScenario = (state) => state.simGroup.groupsByScenario;
const selectQualificationAssignmentsByScenario = (state) => state.simQualification.qualificationAssignmentsByScenario;
const selectQualificationDefsByScenario = (state) => state.simQualification.qualificationDefsByScenario;
const selectEventsByScenario = (state) => state.events?.eventsByScenario || EMPTY_OBJECT;
const selectFinanceByScenario = (state) => state.simFinance?.financeByScenario || EMPTY_OBJECT;

function parseIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const date = parseIsoDate(dateStr);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function cloneTimes(times = []) {
  return (times || []).map((day) => ({
    ...day,
    segments: (day?.segments || []).map((segment) => ({ ...segment })),
  }));
}

function isBookingActiveOnDate(booking, dateStr) {
  if (!booking || !dateStr) return false;
  if (booking.startdate && booking.startdate > dateStr) return false;
  if (booking.enddate && booking.enddate < dateStr) return false;
  return true;
}

function adjustSegmentsForDay(segments = [], deltaMinutes) {
  const nextSegments = (segments || []).map((segment) => ({ ...segment }));
  if (!deltaMinutes || nextSegments.length === 0) return nextSegments;

  if (deltaMinutes > 0) {
    const lastSegment = nextSegments[nextSegments.length - 1];
    const endMinutes = timeToMinutes(lastSegment.booking_end);
    if (endMinutes === null) return nextSegments;
    lastSegment.booking_end = minutesToTime(endMinutes + deltaMinutes);
    return nextSegments;
  }

  let remainingReduction = Math.abs(deltaMinutes);
  for (let index = nextSegments.length - 1; index >= 0 && remainingReduction > 0; index -= 1) {
    const segment = nextSegments[index];
    const startMinutes = timeToMinutes(segment.booking_start);
    const endMinutes = timeToMinutes(segment.booking_end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) continue;

    const reducibleMinutes = endMinutes - startMinutes;
    if (remainingReduction >= reducibleMinutes) {
      nextSegments.splice(index, 1);
      remainingReduction -= reducibleMinutes;
      continue;
    }

    segment.booking_end = minutesToTime(endMinutes - remainingReduction);
    remainingReduction = 0;
  }

  return nextSegments;
}

function adjustBookingTimesByWeeklyDelta(times = [], weeklyDeltaHours = 0) {
  const totalDeltaMinutes = Math.round(Number(weeklyDeltaHours || 0) * 60);
  const activeDayIndexes = (times || []).reduce((indexes, day, index) => {
    if (Array.isArray(day?.segments) && day.segments.length > 0) {
      indexes.push(index);
    }
    return indexes;
  }, []);

  if (totalDeltaMinutes === 0 || activeDayIndexes.length === 0) {
    return cloneTimes(times);
  }

  const baseDelta = Math.trunc(totalDeltaMinutes / activeDayIndexes.length);
  let remainder = totalDeltaMinutes - baseDelta * activeDayIndexes.length;
  const remainderStep = remainder === 0 ? 0 : remainder > 0 ? 1 : -1;
  const nextTimes = cloneTimes(times);

  activeDayIndexes.forEach((dayIndex) => {
    let dayDelta = baseDelta;
    if (remainder !== 0) {
      dayDelta += remainderStep;
      remainder -= remainderStep;
    }

    nextTimes[dayIndex].segments = adjustSegmentsForDay(nextTimes[dayIndex].segments, dayDelta);
  });

  return nextTimes;
}

function applyAutoTransitionEventsToBookings(effectiveBookingsByItem, scenarioEvents = []) {
  const projectedBookingsByItem = Object.fromEntries(
    Object.entries(effectiveBookingsByItem || {}).map(([itemId, bookings]) => [
      itemId,
      Object.fromEntries(Object.entries(bookings || {}).map(([bookingId, booking]) => [bookingId, { ...booking, times: cloneTimes(booking.times) }])),
    ])
  );

  const autoEvents = (scenarioEvents || [])
    .filter((event) => event?.enabled !== false && event?.type === 'auto_group_transition' && event?.effectiveDate && event?.entityId)
    .sort((left, right) => {
      const dateDiff = String(left.effectiveDate).localeCompare(String(right.effectiveDate));
      if (dateDiff !== 0) return dateDiff;
      return String(left.id).localeCompare(String(right.id));
    });

  autoEvents.forEach((event) => {
    const itemBookings = projectedBookingsByItem[event.entityId];
    if (!itemBookings) return;

    const activeBookingEntry = Object.entries(itemBookings)
      .filter(([, booking]) => isBookingActiveOnDate(booking, event.effectiveDate))
      .sort(([, left], [, right]) => String(right.startdate || '').localeCompare(String(left.startdate || '')))[0];

    if (!activeBookingEntry) return;

    const [activeBookingId, activeBooking] = activeBookingEntry;
    const adjustedTimes = adjustBookingTimesByWeeklyDelta(activeBooking.times, event.metadata?.bookingDeltaHours || 0);
    const projectedBookingId = `${activeBookingId}__${event.id}`;
    const previousDate = addDays(event.effectiveDate, -1);
    const canSplitCurrentBooking = previousDate && (!activeBooking.startdate || activeBooking.startdate <= previousDate);

    if (canSplitCurrentBooking) {
      itemBookings[activeBookingId] = {
        ...activeBooking,
        enddate: previousDate,
      };
    } else {
      delete itemBookings[activeBookingId];
    }

    itemBookings[projectedBookingId] = {
      ...activeBooking,
      id: projectedBookingId,
      startdate: event.effectiveDate,
      times: adjustedTimes,
      metadata: {
        ...(activeBooking.metadata || {}),
        projectedFromEventId: event.id,
        autoGenerated: true,
      },
    };
  });

  return projectedBookingsByItem;
}

function itemOverlapsBounds(item, bounds) {
  if (!item || !bounds) return false;
  const itemStart = item?.startdate || '';
  const itemEnd = item?.enddate || '';
  return itemStart <= bounds.end && (itemEnd === '' || itemEnd >= bounds.start);
}

function bookingOverlapsBounds(booking, bounds) {
  if (!booking || !bounds) return false;
  const bookingStart = booking?.startdate || '';
  const bookingEnd = booking?.enddate || '';
  return bookingStart <= bounds.end && (bookingEnd === '' || bookingEnd >= bounds.start);
}

function hasKnownEntityName(name) {
  if (!name) return false;
  return String(name).trim().toLowerCase() !== 'unbekannt';
}

function buildGroupedCountSeries({
  categories,
  timedimension,
  effectiveDataItems,
  effectiveBookingsByItem,
  effectiveGroupAssignmentsByItem,
  effectiveGroupDefs,
  itemType,
}) {
  const groupLabelById = new Map(
    (effectiveGroupDefs || []).map((groupDef) => [String(groupDef.id), groupDef.name || String(groupDef.id)])
  );
  const groupedCounts = new Map();

  (categories || []).forEach((category, categoryIndex) => {
    const bounds = getPeriodBoundsForCategory(timedimension, category);
    if (!bounds) return;

    Object.entries(effectiveDataItems || {}).forEach(([itemId, item]) => {
      if (item?.type !== itemType) return;
      if (isArchivedDataItem(item)) return;
      if (!itemOverlapsBounds(item, bounds)) return;

      const hasBooking = Object.values(effectiveBookingsByItem?.[itemId] || {}).some((booking) => bookingOverlapsBounds(booking, bounds));
      if (!hasBooking) return;

      const resolvedGroupIds = resolveGroupIdsForBounds(
        effectiveGroupAssignmentsByItem?.[itemId] || {},
        bounds,
        item?.groupId ? String(item.groupId) : '__NO_GROUP__'
      );

      const groupKeys = resolvedGroupIds.length > 0 ? resolvedGroupIds : ['__NO_GROUP__'];

      groupKeys.forEach((resolvedGroupId) => {
        const groupKey = String(resolvedGroupId || '__NO_GROUP__');
        const groupLabel = groupKey === '__NO_GROUP__' ? 'Ohne Gruppe' : (groupLabelById.get(groupKey) || groupKey);

        if (!groupedCounts.has(groupKey)) {
          groupedCounts.set(groupKey, {
            groupId: groupKey,
            name: groupLabel,
            data: new Array((categories || []).length).fill(0),
          });
        }

        groupedCounts.get(groupKey).data[categoryIndex] += 1;
      });
    });
  });

  return Array.from(groupedCounts.values())
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildTotalCountSeries({
  categories,
  timedimension,
  effectiveDataItems,
  effectiveBookingsByItem,
  itemType,
}) {
  return (categories || []).map((category) => {
    const bounds = getPeriodBoundsForCategory(timedimension, category);
    if (!bounds) return 0;

    let count = 0;
    Object.entries(effectiveDataItems || {}).forEach(([itemId, item]) => {
      if (item?.type !== itemType) return;
      if (isArchivedDataItem(item)) return;
      if (!itemOverlapsBounds(item, bounds)) return;

      const hasBooking = Object.values(effectiveBookingsByItem?.[itemId] || {}).some((booking) => bookingOverlapsBounds(booking, bounds));
      if (!hasBooking) return;

      count += 1;
    });

    return count;
  });
}

export const selectChartScenarioState = createSelector(
  [selectChartSlice, selectSelectedScenarioId],
  (chartState, scenarioId) => (scenarioId ? (chartState[scenarioId] || EMPTY_OBJECT) : EMPTY_OBJECT)
);

export const selectChartFilters = createSelector(
  [selectChartScenarioState],
  (chartScenarioState) => ({
    referenceDate: chartScenarioState.referenceDate || new Date().toISOString().slice(0, 10),
    timedimension: chartScenarioState.timedimension || 'month',
    selectedGroups: chartScenarioState.filter?.Groups || EMPTY_ARRAY,
    selectedQualifications: chartScenarioState.filter?.Qualifications || EMPTY_ARRAY,
  })
);

export const selectOverlayAwareChartData = createSelector(
  [
    selectSelectedScenarioId,
    selectScenarios,
    selectOverlaysByScenario,
    selectDataByScenario,
    selectBookingsByScenario,
    selectGroupDefsByScenario,
    selectGroupsByScenario,
    selectQualificationAssignmentsByScenario,
    selectQualificationDefsByScenario,
    selectEventsByScenario,
  ],
  (
    scenarioId,
    scenarios,
    overlaysByScenario,
    dataByScenario,
    bookingsByScenario,
    groupDefsByScenario,
    groupsByScenario,
    qualificationAssignmentsByScenario,
    qualificationDefsByScenario,
    eventsByScenario
  ) => {
    if (!scenarioId) {
      return null;
    }

    const overlayData = buildOverlayAwareData(scenarioId, {
      simScenario: { scenarios },
      simOverlay: { overlaysByScenario },
      simData: { dataByScenario },
      simBooking: { bookingsByScenario },
      simGroup: { groupDefsByScenario, groupsByScenario },
      simQualification: { qualificationAssignmentsByScenario, qualificationDefsByScenario },
    });

    return {
      ...overlayData,
      effectiveBookingsByItem: applyAutoTransitionEventsToBookings(
        overlayData.effectiveBookingsByItem,
        eventsByScenario?.[scenarioId] || EMPTY_ARRAY
      ),
    };
  }
);

export const selectWeeklyChartData = createSelector(
  [selectSelectedScenarioId, selectChartFilters, selectOverlayAwareChartData],
  (scenarioId, { referenceDate, selectedGroups, selectedQualifications }, overlayData) => {
    if (!scenarioId || !overlayData) {
      return EMPTY_WEEKLY_DATA;
    }

    const {
      effectiveDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveQualificationAssignmentsByItem,
      effectiveGroupDefs,
      effectiveQualificationDefs,
    } = overlayData;

    const wrappedPayload = {
      bookingsByScenario: { [scenarioId]: effectiveBookingsByItem },
      dataByScenario: { [scenarioId]: effectiveDataItems },
      groupDefs: effectiveGroupDefs,
      qualificationDefs: effectiveQualificationDefs,
      groupsByScenario: { [scenarioId]: effectiveGroupAssignmentsByItem },
      qualificationAssignmentsByScenario: { [scenarioId]: effectiveQualificationAssignmentsByItem },
      overlaysByScenario: EMPTY_OBJECT,
      scenarioId,
    };

    let chartData;
    try {
      chartData = calculateChartDataWeekly(referenceDate, selectedGroups, selectedQualifications, wrappedPayload);
    } catch {
      chartData = EMPTY_WEEKLY_DATA;
    }

    return {
      categories: chartData?.categories ? [...chartData.categories] : [],
      demand: chartData?.demand ? chartData.demand.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxdemand: chartData?.maxdemand || '',
      capacity: chartData?.capacity ? chartData.capacity.map((value) => (typeof value === 'number' ? value : 0)) : [],
      capacity_pedagogical: chartData?.capacity_pedagogical ? chartData.capacity_pedagogical.map((value) => (typeof value === 'number' ? value : 0)) : [],
      capacity_administrative: chartData?.capacity_administrative ? chartData.capacity_administrative.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxcapacity: chartData?.maxcapacity || '',
      care_ratio: chartData?.care_ratio ? chartData.care_ratio.map((value) => (typeof value === 'number' ? value : 0)) : [],
      max_care_ratio: chartData?.max_care_ratio || '',
      expert_ratio: chartData?.expert_ratio ? chartData.expert_ratio.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxexpert_ratio: chartData?.maxexpert_ratio || '100',
      flags: [],
    };
  }
);

export const selectWeeklyChartDataByGroup = createSelector(
  [selectSelectedScenarioId, selectChartFilters, selectOverlayAwareChartData],
  (scenarioId, { referenceDate, selectedGroups, selectedQualifications }, overlayData) => {
    if (!scenarioId || !overlayData) {
      return EMPTY_ARRAY;
    }

    const {
      effectiveDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveQualificationAssignmentsByItem,
      effectiveGroupDefs,
      effectiveQualificationDefs,
    } = overlayData;

    const wrappedPayload = {
      bookingsByScenario: { [scenarioId]: effectiveBookingsByItem },
      dataByScenario: { [scenarioId]: effectiveDataItems },
      groupDefs: effectiveGroupDefs,
      qualificationDefs: effectiveQualificationDefs,
      groupsByScenario: { [scenarioId]: effectiveGroupAssignmentsByItem },
      qualificationAssignmentsByScenario: { [scenarioId]: effectiveQualificationAssignmentsByItem },
      overlaysByScenario: EMPTY_OBJECT,
      scenarioId,
    };

    const groupLabelById = new Map(
      (effectiveGroupDefs || []).map((groupDef) => [String(groupDef.id), groupDef.name || String(groupDef.id)])
    );

    return (selectedGroups || [])
      .filter((groupId) => groupId !== '__NO_GROUP__')
      .map((groupId) => {
        let chartData;
        try {
          chartData = calculateChartDataWeekly(referenceDate, [String(groupId)], selectedQualifications, wrappedPayload);
        } catch {
          chartData = EMPTY_WEEKLY_DATA;
        }

        return {
          groupId: String(groupId),
          groupName: groupLabelById.get(String(groupId)) || String(groupId),
          chartData: {
            categories: chartData?.categories ? [...chartData.categories] : [],
            demand: chartData?.demand ? chartData.demand.map((value) => (typeof value === 'number' ? value : 0)) : [],
            maxdemand: chartData?.maxdemand || '',
            capacity: chartData?.capacity ? chartData.capacity.map((value) => (typeof value === 'number' ? value : 0)) : [],
            capacity_pedagogical: chartData?.capacity_pedagogical ? chartData.capacity_pedagogical.map((value) => (typeof value === 'number' ? value : 0)) : [],
            capacity_administrative: chartData?.capacity_administrative ? chartData.capacity_administrative.map((value) => (typeof value === 'number' ? value : 0)) : [],
            maxcapacity: chartData?.maxcapacity || '',
            care_ratio: chartData?.care_ratio ? chartData.care_ratio.map((value) => (typeof value === 'number' ? value : 0)) : [],
            max_care_ratio: chartData?.max_care_ratio || '',
            expert_ratio: chartData?.expert_ratio ? chartData.expert_ratio.map((value) => (typeof value === 'number' ? value : 0)) : [],
            maxexpert_ratio: chartData?.maxexpert_ratio || '100',
            flags: [],
          },
        };
      });
  }
);

export const selectMidtermChartData = createSelector(
  [selectSelectedScenarioId, selectChartFilters, selectOverlayAwareChartData, selectEventsByScenario, selectFinanceByScenario, selectWeeklyChartData],
  (
    scenarioId,
    { referenceDate, timedimension, selectedGroups, selectedQualifications },
    overlayData,
    eventsByScenario,
    financeByScenario,
    weeklyChartData
  ) => {
    if (!scenarioId || !overlayData) {
      return EMPTY_MIDTERM_DATA;
    }

    const scenarioEvents = (eventsByScenario?.[scenarioId] || EMPTY_ARRAY).filter((event) => event.enabled !== false);
    const categories = generateMidtermCategories(timedimension, scenarioEvents);

    const {
      effectiveDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveQualificationAssignmentsByItem,
      effectiveGroupDefs,
      effectiveQualificationDefs,
    } = overlayData;
    const effectiveAnalysisDataItems = Object.fromEntries(
      Object.entries(effectiveDataItems || {}).filter(([, item]) => !isArchivedDataItem(item))
    );
    const financeScenario = financeByScenario?.[scenarioId] || EMPTY_OBJECT;

    const wrappedPayload = {
      bookingsByScenario: { [scenarioId]: effectiveBookingsByItem },
      dataByScenario: { [scenarioId]: effectiveAnalysisDataItems },
      groupDefs: effectiveGroupDefs,
      qualificationDefs: effectiveQualificationDefs,
      groupsByScenario: { [scenarioId]: effectiveGroupAssignmentsByItem },
      qualificationAssignmentsByScenario: { [scenarioId]: effectiveQualificationAssignmentsByItem },
      overlaysByScenario: EMPTY_OBJECT,
      scenarioId,
      timedimension,
    };

    let chartData;
    try {
      chartData = calculateChartDataMidterm(
        categories,
        referenceDate,
        selectedGroups,
        selectedQualifications,
        wrappedPayload
      );
    } catch {
      chartData = EMPTY_MIDTERM_DATA;
    }

    const flags = scenarioEvents
      .filter((event) => hasKnownEntityName(event?.entityName))
      .map((event) => {
        const label = formatDateToCategory(timedimension, event.effectiveDate);
        const index = chartData?.categories?.indexOf(label) ?? -1;
        if (index < 0) return null;
        return {
          x: index,
          title: event.metadata?.autoGenerated ? 'A' : 'R',
          text: `${event.description || event.type} - ${event.entityName}`,
        };
      })
      .filter(Boolean);

    const financeSeriesData = (chartData?.categories || []).map((category) => {
      const bounds = getPeriodBoundsForCategory(timedimension, category);
      const financeReferenceDate = bounds?.start || referenceDate;
      const finance = calculateScenarioMonthlyFinance({
        referenceDate: financeReferenceDate,
        effectiveDataItems: effectiveAnalysisDataItems,
        effectiveBookingsByItem,
        effectiveGroupAssignmentsByItem,
        effectiveGroupDefs,
        financeScenario,
      });

      return {
        income: convertMonthlyAmountToPeriod(finance.summary.incomeTotal, timedimension),
        expenses: convertMonthlyAmountToPeriod(finance.summary.expensesTotal, timedimension),
        net: convertMonthlyAmountToPeriod(finance.summary.net, timedimension),
      };
    });

    const childCountByGroup = buildGroupedCountSeries({
      categories: chartData?.categories || [],
      timedimension,
      effectiveDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveGroupDefs,
      itemType: 'demand',
    });

    const employeeCountByGroup = buildGroupedCountSeries({
      categories: chartData?.categories || [],
      timedimension,
      effectiveDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveGroupDefs,
      itemType: 'capacity',
    });

    const childCount = buildTotalCountSeries({
      categories: chartData?.categories || [],
      timedimension,
      effectiveDataItems,
      effectiveBookingsByItem,
      itemType: 'demand',
    });

    const employeeCount = buildTotalCountSeries({
      categories: chartData?.categories || [],
      timedimension,
      effectiveDataItems,
      effectiveBookingsByItem,
      itemType: 'capacity',
    });

    const referenceFinance = calculateScenarioMonthlyFinance({
      referenceDate,
      effectiveDataItems: effectiveAnalysisDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveGroupDefs,
      financeScenario,
    });

    const activeChildrenWithBookings = Object.entries(effectiveDataItems || {}).filter(([itemId, item]) => {
      if (item?.type !== 'demand') return false;
      if (isArchivedDataItem(item)) return false;
      if (!isRecordActiveOnDate(item, referenceDate)) return false;
      return hasAnyBookingInWeek(Object.values(effectiveBookingsByItem?.[itemId] || {}), referenceDate);
    }).length;

    const careRatioValues = (weeklyChartData?.care_ratio || []).filter((value) => Number(value) > 0);
    const averageCareRatioWeek = careRatioValues.length > 0
      ? careRatioValues.reduce((sum, value) => sum + value, 0) / careRatioValues.length
      : 0;

    const financeKpis = {
      averageCareRatioWeek,
      personnelCostPerChild: activeChildrenWithBookings > 0
        ? referenceFinance.summary.expensesPersonnel / activeChildrenWithBookings
        : 0,
      activeChildrenWithBookings,
      monthlyPersonnelCost: referenceFinance.summary.expensesPersonnel,
    };

    const incomeTotal = financeSeriesData.map((entry) => entry.income);
    const expensesTotal = financeSeriesData.map((entry) => entry.expenses);
    const netTotal = financeSeriesData.map((entry) => entry.net);
    const maxchildcount = Math.max(...childCount, 0);
    const maxemployeecount = Math.max(...employeeCount, 0);
    const maxcount = Math.max(...childCount, ...employeeCount, 0);
    const maxfinance = Math.max(...incomeTotal, ...expensesTotal, ...netTotal.map((value) => Math.abs(value)), 0);

    return {
      categories: chartData?.categories ? [...chartData.categories] : [],
      demand: chartData?.demand ? chartData.demand.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxdemand: chartData?.maxdemand || '',
      capacity: chartData?.capacity ? chartData.capacity.map((value) => (typeof value === 'number' ? value : 0)) : [],
      capacity_pedagogical: chartData?.capacity_pedagogical ? chartData.capacity_pedagogical.map((value) => (typeof value === 'number' ? value : 0)) : [],
      capacity_administrative: chartData?.capacity_administrative ? chartData.capacity_administrative.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxcapacity: chartData?.maxcapacity || '',
      care_ratio: chartData?.care_ratio ? chartData.care_ratio.map((value) => (typeof value === 'number' ? value : 0)) : [],
      max_care_ratio: chartData?.max_care_ratio || '',
      expert_ratio: chartData?.expert_ratio ? chartData.expert_ratio.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxexpert_ratio: chartData?.maxexpert_ratio || '100',
      income_total: incomeTotal,
      expenses_total: expensesTotal,
      net_total: netTotal,
      child_count: childCount,
      employee_count: employeeCount,
      child_count_by_group: childCountByGroup,
      employee_count_by_group: employeeCountByGroup,
      maxcount,
      maxchildcount,
      maxemployeecount,
      maxfinance,
      financeKpis,
      flags,
    };
  }
);

export const selectHistogramChartData = createSelector(
  [selectSelectedScenarioId, selectChartFilters, selectOverlayAwareChartData],
  (scenarioId, { referenceDate, selectedGroups, selectedQualifications }, overlayData) => {
    if (!scenarioId || !overlayData) {
      return EMPTY_HISTOGRAM_DATA;
    }

    const {
      effectiveDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveQualificationAssignmentsByItem,
      effectiveGroupDefs,
      effectiveQualificationDefs,
    } = overlayData;

    const wrappedPayload = {
      bookingsByScenario: { [scenarioId]: effectiveBookingsByItem },
      dataByScenario: { [scenarioId]: effectiveDataItems },
      groupDefs: effectiveGroupDefs,
      qualificationDefs: effectiveQualificationDefs,
      groupsByScenario: { [scenarioId]: effectiveGroupAssignmentsByItem },
      qualificationAssignmentsByScenario: { [scenarioId]: effectiveQualificationAssignmentsByItem },
      overlaysByScenario: EMPTY_OBJECT,
      scenarioId,
    };

    let chartData;
    try {
      chartData = calculateChartDataHistogram(referenceDate, selectedGroups, selectedQualifications, wrappedPayload);
    } catch {
      chartData = EMPTY_HISTOGRAM_DATA;
    }

    return {
      categories: chartData?.categories ? [...chartData.categories] : [],
      demand: chartData?.demand ? chartData.demand.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxdemand: chartData?.maxdemand || '',
      capacity: chartData?.capacity ? chartData.capacity.map((value) => (typeof value === 'number' ? value : 0)) : [],
      capacity_pedagogical: chartData?.capacity_pedagogical ? chartData.capacity_pedagogical.map((value) => (typeof value === 'number' ? value : 0)) : [],
      capacity_administrative: chartData?.capacity_administrative ? chartData.capacity_administrative.map((value) => (typeof value === 'number' ? value : 0)) : [],
      maxcapacity: chartData?.maxcapacity || '',
    };
  }
);

export const selectAgeHistogramChartData = createSelector(
  [selectSelectedScenarioId, selectChartFilters, selectOverlayAwareChartData],
  (scenarioId, { referenceDate, selectedGroups }, overlayData) => {
    if (!scenarioId || !overlayData) {
      return EMPTY_AGE_HISTOGRAM_DATA;
    }

    const {
      effectiveDataItems,
      effectiveGroupAssignmentsByItem,
    } = overlayData;

    let chartData;
    try {
      chartData = calculateChartDataAgeHistogram(referenceDate, selectedGroups, {
        dataByScenario: { [scenarioId]: effectiveDataItems },
        groupsByScenario: { [scenarioId]: effectiveGroupAssignmentsByItem },
        scenarioId,
      });
    } catch {
      chartData = EMPTY_AGE_HISTOGRAM_DATA;
    }

    return {
      categories: chartData?.categories ? [...chartData.categories] : [],
      series: chartData?.series ? [...chartData.series] : [],
      maxCount: chartData?.maxCount || 0,
    };
  }
);