import { createSlice } from '@reduxjs/toolkit';
import { calculateChartDataWeekly } from '../utils/chartUtils/chartUtilsWeekly';
import { calculateChartDataMidterm, generateMidtermCategories } from '../utils/chartUtils/chartUtilsMidterm';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import { calculateChartDataFinancial, generateFinancialCategories } from '../utils/chartUtils/chartUtilsFinancial';
import { FINANCIAL_TYPE_REGISTRY, FINANCIAL_BONUS_REGISTRY, getCalculatorForType } from '../config/financialTypeRegistry';
import { updateFinancialThunk } from './simFinancialsSlice';

// Helper for initial chart state per scenario
function getInitialChartState() {
  return {
    referenceDate: new Date().toISOString().slice(0, 10),
    timedimension: 'month',
    chartToggles: ['weekly', 'midterm'],
    filter: {
      Groups: [],
      Qualifications: [],
    },
    chartData: {
      weekly: {
        categories: [],
        demand: [],
        maxdemand: "",
        capacity: [],
        maxcapacity: "",
        care_ratio: [],
        max_care_ratio: "",
        expert_ratio: [],
        maxexpert_ratio: "100"
      },
      midterm: {
        categories: [],
      }
    }
  };
}

const initialState = {
};

const chartSlice = createSlice({
  name: 'chart',
  initialState,
  reducers: {
    // Ensure scenario state exists
    ensureScenario(state, action) {
      const scenarioId = action.payload;
      if (!state[scenarioId]) {
        state[scenarioId] = getInitialChartState();
      }
    },
    setReferenceDate(state, action) {
      const { scenarioId, date } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].referenceDate = date;
    },
    setTimedimension(state, action) {
      const { scenarioId, timedimension } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].timedimension = timedimension;
    },
    setChartToggles(state, action) {
      const { scenarioId, toggles } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].chartToggles = toggles;
    },
    setFilterGroups(state, action) {
      const { scenarioId, groups } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].filter.Groups = groups;
    },
    setFilterQualifications(state, action) {
      const { scenarioId, qualifications } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].filter.Qualifications = qualifications;
    },
    setChartData(state, action) {
      const { scenarioId, chartType, data } = action.payload;
      if (!state[scenarioId]) state[scenarioId] = getInitialChartState();
      state[scenarioId].chartData[chartType] = data;
    },
    // Optionally, add a reset for a scenario
    resetScenarioChart(state, action) {
      const scenarioId = action.payload;
      state[scenarioId] = getInitialChartState();
    },
    // Add cleanup reducer for deleted scenarios
    deleteScenarioChart(state, action) {
      const scenarioId = action.payload;
      delete state[scenarioId];
    }
  },
  extraReducers: (builder) => {
    // Listen to scenario deletion from other slices
    builder.addCase('simScenario/deleteScenario', (state, action) => {
      const scenarioId = String(action.payload);
      delete state[scenarioId];
    });
  }
});


// Thunk to update weekly chart data for a scenario
export const updateWeeklyChartData = (scenarioId) => (dispatch, getState) => {
  const state = getState();
  const chartState = state.chart[scenarioId] || {};
  const referenceDate = chartState.referenceDate || '';
  const selectedGroups = [...(chartState.filter?.Groups || [])];
  const selectedQualifications = [...(chartState.filter?.Qualifications || [])];

  // Use utility to build overlay-aware data
  const {
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveQualificationAssignmentsByItem,
    effectiveGroupDefs,
    effectiveQualificationDefs
  } = buildOverlayAwareData(scenarioId, state);

  // Wrap by scenarioId for chartUtils compatibility
  const bookingsByScenarioWrapped = { [scenarioId]: effectiveBookingsByItem };
  const groupsByScenarioWrapped = { [scenarioId]: effectiveGroupAssignmentsByItem };
  const qualificationAssignmentsByScenarioWrapped = { [scenarioId]: effectiveQualificationAssignmentsByItem };
  const dataByScenarioWrapped = { [scenarioId]: effectiveDataItems };

  // Pass overlay-aware data to chart utils
  let chartData;
  try {
    chartData = calculateChartDataWeekly(
      referenceDate,
      selectedGroups,
      selectedQualifications,
      {
        bookingsByScenario: bookingsByScenarioWrapped,
        dataByScenario: dataByScenarioWrapped,
        groupDefs: effectiveGroupDefs,
        qualificationDefs: effectiveQualificationDefs,
        groupsByScenario: groupsByScenarioWrapped,
        qualificationAssignmentsByScenario: qualificationAssignmentsByScenarioWrapped,
        overlaysByScenario: {},
        scenarioId
      }
    );
   
  } catch {
    chartData = {};
  }

  // Ensure all arrays are deeply cloned and completely mutable
  const clonedData = {
    categories: chartData?.categories ? [...chartData.categories] : [],
    demand: chartData?.demand ? chartData.demand.map(val => typeof val === 'number' ? val : 0) : [],
    maxdemand: chartData?.maxdemand || "",
    capacity: chartData?.capacity ? chartData.capacity.map(val => typeof val === 'number' ? val : 0) : [],
    maxcapacity: chartData?.maxcapacity || "",
    care_ratio: chartData?.care_ratio ? chartData.care_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    max_care_ratio: chartData?.max_care_ratio || "",
    expert_ratio: chartData?.expert_ratio ? chartData.expert_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    maxexpert_ratio: chartData?.maxexpert_ratio || "100"
  };

  dispatch(setChartData({
    scenarioId,
    chartType: 'weekly',
    data: clonedData
  }));
};

// Thunk to update midterm chart data for a scenario
export const updateMidTermChartData = (scenarioId) => (dispatch, getState) => {
  const state = getState();
  const chartState = state.chart[scenarioId] || {};
  const referenceDate = chartState.referenceDate || '';
  const timedimension = chartState.timedimension || 'month';
  const selectedGroups = [...(chartState.filter?.Groups || [])];
  const selectedQualifications = [...(chartState.filter?.Qualifications || [])];

  // Use utility to build overlay-aware data
  const {
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveQualificationAssignmentsByItem,
    effectiveGroupDefs,
    effectiveQualificationDefs
  } = buildOverlayAwareData(scenarioId, state);

  // Get events for scenario
  const events = state.events?.eventsByScenario?.[scenarioId] || [];
  // Generate categories for midterm chart
  const categories = generateMidtermCategories(timedimension, events);

  // Wrap by scenarioId for chartUtils compatibility
  const bookingsByScenarioWrapped = { [scenarioId]: effectiveBookingsByItem };
  const groupsByScenarioWrapped = { [scenarioId]: effectiveGroupAssignmentsByItem };
  const qualificationAssignmentsByScenarioWrapped = { [scenarioId]: effectiveQualificationAssignmentsByItem };
  const dataByScenarioWrapped = { [scenarioId]: effectiveDataItems };

  // Pass overlay-aware data to chart utils
  let chartData;
  try {
    chartData = calculateChartDataMidterm(
      categories,
      referenceDate,
      selectedGroups,
      selectedQualifications,
      {
        bookingsByScenario: bookingsByScenarioWrapped,
        dataByScenario: dataByScenarioWrapped,
        groupDefs: effectiveGroupDefs,
        qualificationDefs: effectiveQualificationDefs,
        groupsByScenario: groupsByScenarioWrapped,
        qualificationAssignmentsByScenario: qualificationAssignmentsByScenarioWrapped,
        overlaysByScenario: {},
        scenarioId,
        timedimension
      }
    );
  } catch {
    chartData = {};
  }

  // Ensure all arrays are deeply cloned and completely mutable
  const clonedData = {
    categories: chartData?.categories ? [...chartData.categories] : [],
    demand: chartData?.demand ? chartData.demand.map(val => typeof val === 'number' ? val : 0) : [],
    maxdemand: chartData?.maxdemand || "",
    capacity: chartData?.capacity ? chartData.capacity.map(val => typeof val === 'number' ? val : 0) : [],
    maxcapacity: chartData?.maxcapacity || "",
    care_ratio: chartData?.care_ratio ? chartData.care_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    max_care_ratio: chartData?.max_care_ratio || "",
    expert_ratio: chartData?.expert_ratio ? chartData.expert_ratio.map(val => typeof val === 'number' ? val : 0) : [],
    maxexpert_ratio: chartData?.maxexpert_ratio || "100"
  };

  dispatch(setChartData({
    scenarioId,
    chartType: 'midterm',
    data: clonedData
  }));
};

// Thunk to update payments for all financials in a scenario
export const updatePaymentsThunk = (scenarioId) => async (dispatch, getState) => {
  const state = getState();

  // Get all overlay-aware data
  const {
    effectiveFinancialsByItem,
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    effectiveFinancialDefs,
  } = buildOverlayAwareData(scenarioId, state);

  // Flatten all financials across all items, preserving the dataItemId
  const allFinancials = Object.entries(effectiveFinancialsByItem || {}).flatMap(
    ([dataItemId, itemFinancials]) =>
      Object.values(itemFinancials || {}).map(financial => ({
        ...financial,
        dataItemId // Add the dataItemId to each financial
      }))
  );

  if (allFinancials.length === 0) {
    console.log(`No financials found for scenario ${scenarioId}`);
    return [];
  }

  // Recursive payment updater for nested financials (bonuses)
  const updatePaymentsRecursive = async (financial, dataItem, bookings, avrStageUpgrades, allFinancials) => {
    const calculatorLoader = getCalculatorForType(financial.type);
    if (!calculatorLoader) return financial;
    const updatePayments = await calculatorLoader();
    // Calculate payments for this financial
    const newPayments = updatePayments(financial, dataItem, bookings, avrStageUpgrades, allFinancials);

    // Update this financial with its payments
    let updatedFinancial = { ...financial, payments: newPayments };

    // Recursively update payments for nested bonuses, passing updated parent financials
    if (Array.isArray(financial.financial)) {
      // Build a new allFinancials array with the updated parent financial
      const updatedAllFinancials = allFinancials.map(f =>
        f.id === updatedFinancial.id ? updatedFinancial : f
      );
      updatedFinancial.financial = await Promise.all(
        financial.financial.map(async bonus => {
          return await updatePaymentsRecursive(bonus, dataItem, bookings, avrStageUpgrades, updatedAllFinancials);
        })
      );
    }
    return updatedFinancial;
  };

  const updatePromises = allFinancials.map(async (financial) => {
    const dataItem = effectiveDataItems[financial.dataItemId];
    const bookings = effectiveBookingsByItem[financial.dataItemId];
    const avrStageUpgrades = financial.type_details?.stage_upgrades || [];
    
    // Get group assignments for this data item
    const groupAssignments = effectiveGroupAssignmentsByItem[financial.dataItemId];
    const feeGroups = groupAssignments ? Object.values(groupAssignments) : [];
    
    // Get financial definitions (array)
    const financialDefs = Array.isArray(effectiveFinancialDefs) ? effectiveFinancialDefs : Object.values(effectiveFinancialDefs || {});

    try {
      const calculatorLoader = getCalculatorForType(financial.type);
      if (!calculatorLoader) return financial;
      
      const updatePayments = await calculatorLoader();
      
      // Pass the correct parameters based on financial type
      let newPayments;
      if (financial.type === 'income-fee') {
        newPayments = updatePayments(financial, dataItem, bookings, feeGroups, financialDefs);
      } else {
        newPayments = updatePayments(financial, dataItem, bookings, avrStageUpgrades, allFinancials);
      }

      // Update this financial with its payments
      let updatedFinancial = { ...financial, payments: newPayments };

      // Recursively update payments for nested bonuses, passing updated parent financials
      if (Array.isArray(financial.financial)) {
        // Build a new allFinancials array with the updated parent financial
        const updatedAllFinancials = allFinancials.map(f =>
          f.id === updatedFinancial.id ? updatedFinancial : f
        );
        updatedFinancial.financial = await Promise.all(
          financial.financial.map(async bonus => {
            return await updatePaymentsRecursive(bonus, dataItem, bookings, avrStageUpgrades, updatedAllFinancials);
          })
        );
      }
      dispatch(updateFinancialThunk({
        scenarioId,
        dataItemId: financial.dataItemId,
        financialId: financial.id,
        updates: { payments: updatedFinancial.payments, financial: updatedFinancial.financial }
      }));
      return { financialId: financial.id, payments: updatedFinancial.payments };
    } catch (error) {
      console.error(`Error updating payments for financial ${financial.id}:`, error);
      return null;
    }
  });

  const results = await Promise.all(updatePromises);
  const successfulUpdates = results.filter(result => result !== null);

  console.log(`Updated payments for ${successfulUpdates.length} financials in scenario ${scenarioId}`);
  return successfulUpdates;
};

// Thunk to update financial chart data for a scenario
export const updateFinancialChartData = (scenarioId, timedimensionArg) => async (dispatch, getState) => {
  const state = getState();
  const chartState = state.chart[scenarioId] || {};
  const timedimension = timedimensionArg || chartState.timedimension || 'month';

  // 1. First update all payments
  await dispatch(updatePaymentsThunk(scenarioId));
  
  // 2. Get fresh state after payment updates
  const updatedState = getState();
  
  // 3. Use utility to build overlay-aware data with updated payments
  const {
    effectiveDataItems,
    effectiveFinancialDefs,
    effectiveFinancialsByItem
  } = buildOverlayAwareData(scenarioId, updatedState);

  // Get events for scenario
  const events = updatedState.events?.eventsByScenario?.[scenarioId] || [];
  // Generate categories for financial chart
  const categories = generateFinancialCategories(timedimension, events);

  // Flatten all financials for chart calculation using overlay utility data
  const financialEntries = Object.values(effectiveFinancialsByItem || {}).flatMap(
    itemFinancials => Object.values(itemFinancials || {})
  );

  // 4. Calculate chart data with updated payments
  const chartData = calculateChartDataFinancial({
    categories,
    financialEntries,
    financialDefs: effectiveFinancialDefs || {},
    dataItems: effectiveDataItems || {},
    timedimension,
    events
  });

  dispatch(setChartData({
    scenarioId,
    chartType: 'financial',
    data: chartData
  }));
};

export const {
  ensureScenario,
  setReferenceDate,
  setTimedimension,
  setChartToggles,
  setFilterGroups,
  setFilterQualifications,
  setChartData,
  resetScenarioChart,
  deleteScenarioChart,
} = chartSlice.actions;

export default chartSlice.reducer;