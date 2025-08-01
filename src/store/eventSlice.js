import { createSlice, createSelector } from '@reduxjs/toolkit';

// Helper: get next working day (Mon-Fri)
function getNextWorkingDay(dateStr) {
  const d = new Date(dateStr);
  let day = d.getDay();
  // 0 = Sunday, 6 = Saturday
  if (day === 5) d.setDate(d.getDate() + 3); // Friday -> Monday
  else if (day === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
  else d.setDate(d.getDate() + 1); // else next day
  return d.toISOString().slice(0, 10);
}

// Extract events for a scenario from state
function extractEventsForScenario(state, scenarioId) {
  const events = [];
  const dataItems = state.simData.dataByScenario[scenarioId] || {};
  const bookingsByItem = state.simBooking.bookingsByScenario[scenarioId] || {};
  const groupsByItem = state.simGroup.groupsByScenario[scenarioId] || {};

  // Data items: presence (start/end), absences
  Object.values(dataItems).forEach(item => {
    if (item.startdate)
      events.push({
        type: item.type === 'capacity' ? 'employee_presence_start' : 'child_presence_start',
        effectiveDate: item.startdate,
        label: `${item.name} beginnt`,
        scenarioId,
        itemId: item.id,
      });
    if (item.enddate)
      events.push({
        type: item.type === 'capacity' ? 'employee_presence_end' : 'child_presence_end',
        effectiveDate: getNextWorkingDay(item.enddate),
        label: `${item.name} endet`,
        scenarioId,
        itemId: item.id,
      });
    // Absences
    (item.absences || []).forEach(abs => {
      if (abs.startdate)
        events.push({
          type: 'absence_start',
          effectiveDate: abs.startdate,
          label: `${item.name} Abwesenheit beginnt`,
          scenarioId,
          itemId: item.id,
          absenceId: abs.id,
        });
      if (abs.enddate)
        events.push({
          type: 'absence_end',
          effectiveDate: getNextWorkingDay(abs.enddate),
          label: `${item.name} Abwesenheit endet`,
          scenarioId,
          itemId: item.id,
          absenceId: abs.id,
        });
    });
  });

  // Bookings: start/end
  Object.entries(bookingsByItem).forEach(([itemId, bookings]) => {
    Object.values(bookings).forEach(booking => {
      if (booking.startdate)
        events.push({
          type: 'booking_start',
          effectiveDate: booking.startdate,
          label: `Buchung beginnt (${booking.id})`,
          scenarioId,
          itemId,
          bookingId: booking.id,
        });
      if (booking.enddate)
        events.push({
          type: 'booking_end',
          effectiveDate: getNextWorkingDay(booking.enddate),
          label: `Buchung endet (${booking.id})`,
          scenarioId,
          itemId,
          bookingId: booking.id,
        });
    });
  });

  // Group assignments: start/end
  Object.entries(groupsByItem).forEach(([itemId, assignments]) => {
    Object.values(assignments).forEach(assignment => {
      if (assignment.start)
        events.push({
          type: 'group_assignment_start',
          effectiveDate: assignment.start,
          label: `Gruppenzuweisung beginnt (${assignment.groupId})`,
          scenarioId,
          itemId,
          groupId: assignment.groupId,
          assignmentId: assignment.id,
        });
      if (assignment.end)
        events.push({
          type: 'group_assignment_end',
          effectiveDate: getNextWorkingDay(assignment.end),
          label: `Gruppenzuweisung endet (${assignment.groupId})`,
          scenarioId,
          itemId,
          groupId: assignment.groupId,
          assignmentId: assignment.id,
        });
    });
  });

  return events;
}

const initialState = {
  eventsByScenario: {},
};

const eventSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    // Manual trigger to refresh events for all scenarios
    refreshAllEvents(state, action) {
      const { simData, simBooking, simGroup } = action.payload;
      state.eventsByScenario = {};
      Object.keys(simData.dataByScenario || {}).forEach(scenarioId => {
        state.eventsByScenario[scenarioId] = extractEventsForScenario(
          { simData, simBooking, simGroup },
          scenarioId
        );
      });
    },
    // Manual trigger for one scenario
    refreshEventsForScenario(state, action) {
      const { scenarioId, simData, simBooking, simGroup } = action.payload;
      state.eventsByScenario[scenarioId] = extractEventsForScenario(
        { simData, simBooking, simGroup },
        scenarioId
      );
    },
  },
  extraReducers: (builder) => {
    // Listen to relevant actions and refresh events
    builder.addMatcher(
      (action) =>
        action.type.startsWith('simData/') ||
        action.type.startsWith('simBooking/') ||
        action.type.startsWith('simGroup/'),
      (state, action) => {
        // On any relevant change, refresh all events
        // You may optimize to only refresh affected scenario
        // For now, refresh all
        // Use a dummy state param for selectors
        // This assumes root reducer keys: simData, simBooking, simGroup
        // In real app, use thunk to dispatch refreshAllEvents after relevant actions
        // Here, just mark for refresh (UI/hook will call refreshAllEvents)
        state._needsRefresh = true;
      }
    );
  }
});

// Selector: get all events for a scenario
export const selectEventsForScenario = (state, scenarioId) =>
  state.events.eventsByScenario[scenarioId] || [];

// Selector: get consolidated events by effectiveDate
export const selectConsolidatedEventsForScenario = createSelector(
  [selectEventsForScenario],
  (events) => {
    const byDate = {};
    events.forEach(ev => {
      if (!byDate[ev.effectiveDate]) byDate[ev.effectiveDate] = [];
      byDate[ev.effectiveDate].push(ev);
    });
    // Return sorted array of { date, events }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({ date, events }));
  }
);

export const { refreshAllEvents, refreshEventsForScenario } = eventSlice.actions;

export default eventSlice.reducer;
