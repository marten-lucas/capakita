import { configureStore } from '@reduxjs/toolkit';
import simScenarioReducer from './simScenarioSlice';
import simDataReducer from './simDataSlice';
import simBookingReducer from './simBookingSlice';
import simGroupReducer from './simGroupSlice';
import simQualificationReducer from './simQualificationSlice';
import simFinancialsReducer from './simFinancialsSlice';
import simOverlayReducer from './simOverlaySlice';
import chartReducer from './chartSlice';
import eventReducer from './eventSlice';

const store = configureStore({
  reducer: {
    simScenario: simScenarioReducer,
    simData: simDataReducer,
    simBooking: simBookingReducer,
    simGroup: simGroupReducer,
    simQualification: simQualificationReducer,
    simFinancials: simFinancialsReducer,
    simOverlay: simOverlayReducer,
    chart: chartReducer,
    events: eventReducer,
  },
});

export default store;
