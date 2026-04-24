import { createSelector } from '@reduxjs/toolkit';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { calculateChartDataWeekly } from '../utils/chartUtils/chartUtilsWeekly';
import { calculateChartDataMidterm, generateMidtermCategories, formatDateToCategory } from '../utils/chartUtils/chartUtilsMidterm';
import { calculateChartDataHistogram } from '../utils/chartUtils/chartUtilsHistogram';
import { calculateChartDataAgeHistogram } from '../utils/chartUtils/chartUtilsAgeHistogram';
import {
  calculateScenarioMonthlyFinance,
  convertMonthlyAmountToPeriod,
  getPeriodBoundsForCategory,
  hasAnyBookingInWeek,
  isRecordActiveOnDate,
} from '../utils/financeUtils';

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
    qualificationDefsByScenario
  ) => {
    if (!scenarioId) {
      return null;
    }

    return buildOverlayAwareData(scenarioId, {
      simScenario: { scenarios },
      simOverlay: { overlaysByScenario },
      simData: { dataByScenario },
      simBooking: { bookingsByScenario },
      simGroup: { groupDefsByScenario, groupsByScenario },
      simQualification: { qualificationAssignmentsByScenario, qualificationDefsByScenario },
    });
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
    const financeScenario = financeByScenario?.[scenarioId] || EMPTY_OBJECT;

    const wrappedPayload = {
      bookingsByScenario: { [scenarioId]: effectiveBookingsByItem },
      dataByScenario: { [scenarioId]: effectiveDataItems },
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
        effectiveDataItems,
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

    const referenceFinance = calculateScenarioMonthlyFinance({
      referenceDate,
      effectiveDataItems,
      effectiveBookingsByItem,
      effectiveGroupAssignmentsByItem,
      effectiveGroupDefs,
      financeScenario,
    });

    const activeChildrenWithBookings = Object.entries(effectiveDataItems || {}).filter(([itemId, item]) => {
      if (item?.type !== 'demand') return false;
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