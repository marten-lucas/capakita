import { configureStore } from '@reduxjs/toolkit';
import simScenarioReducer from './simScenarioSlice';
import simDataReducer from './simDataSlice';
import simBookingReducer from './simBookingSlice';
import simGroupReducer from './simGroupSlice';
import simQualificationReducer from './simQualificationSlice';
import simFinancialsReducer from './simFinancialsSlice';
import chartReducer from './chartSlice';

const store = configureStore({
  reducer: {
    simScenario: simScenarioReducer,
    simData: simDataReducer,
    simBooking: simBookingReducer,
    simGroup: simGroupReducer,
    simQualification: simQualificationReducer,
    simFinancials: simFinancialsReducer,
    chart: chartReducer,
  },
});

export default store;
