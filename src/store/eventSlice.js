import { createSlice, createSelector } from '@reduxjs/toolkit';

// Helper: get next working day (Mon-Fri)
function getNextWorkingDay(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
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

    // Helper: create event object
    function createEvent({
        id,
        effectiveDate,
        sourceDate,
        type,
        category,
        entityType,
        entityId,
        entityName,
        relatedId = null,
        description,
        metadata = {}
    }) {
        return {
            id,
            scenarioId,
            effectiveDate,
            sourceDate,
            type,
            category,
            entityType,
            entityId,
            entityName,
            relatedId,
            description,
            metadata
        };
    }

    // Data items: presence (start/end), absences
    Object.entries(dataItems).forEach(([itemKey, item]) => {
        const entityType = item.type === 'capacity' ? 'capacity' : 'demand';
        const entityName = item.name;

        if (item.startdate) {
            events.push(
                createEvent({
                    id: `presence_start_${itemKey}`,
                    effectiveDate: item.startdate,
                    sourceDate: item.startdate,
                    type: 'presence_start',
                    category: 'presence',
                    entityType,
                    entityId: itemKey,
                    entityName,
                    description: `${entityName} beginnt Anwesenheit`
                })
            );
        }
        if (item.enddate) {
            const nextDay = getNextWorkingDay(item.enddate);
            if (nextDay) {
                events.push(
                    createEvent({
                        id: `presence_end_${itemKey}`,
                        effectiveDate: nextDay,
                        sourceDate: item.enddate,
                        type: 'presence_end',
                        category: 'presence',
                        entityType,
                        entityId: itemKey,
                        entityName,
                        description: `${entityName} endet Anwesenheit`
                    })
                );
            }
        }
        // Absences
        (item.absences || []).forEach((abs, absIndex) => {
            const absenceId = abs.id || `absence_${absIndex}`;
            if (abs.start || abs.startdate) {
                const startDate = abs.start || abs.startdate;
                events.push(
                    createEvent({
                        id: `absence_start_${itemKey}_${absenceId}`,
                        effectiveDate: startDate,
                        sourceDate: startDate,
                        type: 'absence_start',
                        category: 'absence',
                        entityType,
                        entityId: itemKey,
                        entityName,
                        relatedId: absenceId,
                        description: `${entityName} Abwesenheit beginnt`
                    })
                );
            }
            if (abs.end || abs.enddate) {
                const endDate = abs.end || abs.enddate;
                const nextDay = getNextWorkingDay(endDate);
                if (nextDay) {
                    events.push(
                        createEvent({
                            id: `absence_end_${itemKey}_${absenceId}`,
                            effectiveDate: nextDay,
                            sourceDate: endDate,
                            type: 'absence_end',
                            category: 'absence',
                            entityType,
                            entityId: itemKey,
                            entityName,
                            relatedId: absenceId,
                            description: `${entityName} Abwesenheit endet`
                        })
                    );
                }
            }
        });
    });

    // Bookings: start/end
    Object.entries(bookingsByItem).forEach(([itemId, bookings]) => {
        Object.values(bookings).forEach(booking => {
            if (booking.startdate) {
                events.push(
                    createEvent({
                        id: `booking_start_${itemId}_${booking.id}`,
                        effectiveDate: booking.startdate,
                        sourceDate: booking.startdate,
                        type: 'booking_start',
                        category: 'booking',
                        entityType: 'demand',
                        entityId: itemId,
                        entityName: booking.name || 'Unbekannt',
                        relatedId: booking.id,
                        description: `Buchung beginnt (${booking.id})`,
                        metadata: { bookingTimes: booking.times || [] }
                    })
                );
            }
            if (booking.enddate) {
                const nextDay = getNextWorkingDay(booking.enddate);
                if (nextDay) {
                    events.push(
                        createEvent({
                            id: `booking_end_${itemId}_${booking.id}`,
                            effectiveDate: nextDay,
                            sourceDate: booking.enddate,
                            type: 'booking_end',
                            category: 'booking',
                            entityType: 'demand',
                            entityId: itemId,
                            entityName: booking.name || 'Unbekannt',
                            relatedId: booking.id,
                            description: `Buchung endet (${booking.id})`,
                            metadata: { bookingTimes: booking.times || [] }
                        })
                    );
                }
            }
        });
    });

    // Group assignments: start/end
    Object.entries(groupsByItem).forEach(([itemId, assignments]) => {
        Object.values(assignments).forEach(assignment => {
            if (assignment.start) {
                events.push(
                    createEvent({
                        id: `group_assignment_start_${itemId}_${assignment.id}`,
                        effectiveDate: assignment.start,
                        sourceDate: assignment.start,
                        type: 'group_assignment_start',
                        category: 'group_assignment',
                        entityType: 'demand',
                        entityId: itemId,
                        entityName: assignment.name || 'Unbekannt',
                        relatedId: assignment.id,
                        description: `Gruppenzuweisung beginnt (${assignment.groupId})`,
                        metadata: { groupId: assignment.groupId, groupName: assignment.groupName }
                    })
                );
            }
            if (assignment.end) {
                const nextDay = getNextWorkingDay(assignment.end);
                if (nextDay) {
                    events.push(
                        createEvent({
                            id: `group_assignment_end_${itemId}_${assignment.id}`,
                            effectiveDate: nextDay,
                            sourceDate: assignment.end,
                            type: 'group_assignment_end',
                            category: 'group_assignment',
                            entityType: 'demand',
                            entityId: itemId,
                            entityName: assignment.name || 'Unbekannt',
                            relatedId: assignment.id,
                            description: `Gruppenzuweisung endet (${assignment.groupId})`,
                            metadata: { groupId: assignment.groupId, groupName: assignment.groupName }
                        })
                    );
                }
            }
        });
    });



    return events;
}

const eventSlice = createSlice({
    name: 'events',
    initialState: {
        eventsByScenario: {},
        _needsRefresh: false,
    },
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
            state._needsRefresh = false; // Clear refresh flag after refreshing
        },
        // Manual trigger for one scenario
        refreshEventsForScenario(state, action) {
            const { scenarioId, simData, simBooking, simGroup } = action.payload;
            state.eventsByScenario[scenarioId] = extractEventsForScenario(
                { simData, simBooking, simGroup },
                scenarioId
            );
            state._needsRefresh = false; // Clear refresh flag after refreshing
        },
    },
    extraReducers: (builder) => {
        // Listen to relevant actions and mark for refresh
        builder.addMatcher(
            (action) =>
                action.type.startsWith('simData/') ||
                action.type.startsWith('simBooking/') ||
                action.type.startsWith('simGroup/'),
            (state) => {
                state._needsRefresh = true; // Mark for refresh
            }
        );
    },
});

// Selector: get all events for a scenario
export const selectEventsForScenario = createSelector(
    [(state) => state.events?.eventsByScenario || {}, (state, scenarioId) => scenarioId],
    (eventsByScenario, scenarioId) => {
        if (!scenarioId) return [];
        return eventsByScenario[scenarioId] || [];
    }
);

// Selector: get consolidated events by effectiveDate (future only)
export const selectConsolidatedEventsForScenario = createSelector(
    [selectEventsForScenario],
    (events) => {
        if (!events || events.length === 0) return [];
        const today = new Date().toISOString().slice(0, 10);
        // Helper: is event ongoing (started in past, no end event)
        function isOngoing(ev) {
            // Only applies to group_assignment_start, child_presence_start, employee_presence_start, booking_start
            if (
                ev.type === 'group_assignment_start' ||
                ev.type === 'child_presence_start' ||
                ev.type === 'employee_presence_start' ||
                ev.type === 'booking_start'
            ) {
                // Find corresponding end event for this item
                const endType =
                    ev.type === 'group_assignment_start' ? 'group_assignment_end'
                        : ev.type === 'child_presence_start' ? 'child_presence_end'
                            : ev.type === 'employee_presence_start' ? 'employee_presence_end'
                                : ev.type === 'booking_start' ? 'booking_end'
                                    : null;
                if (!endType) return false;
                // Find end event for this item
                const hasEnd = events.some(e =>
                    e.type === endType &&
                    e.itemId === ev.itemId &&
                    (e.groupId ? e.groupId === ev.groupId : true) &&
                    (e.bookingId ? e.bookingId === ev.bookingId : true) &&
                    (e.assignmentId ? e.assignmentId === ev.assignmentId : true) &&
                    e.effectiveDate >= today
                );
                // If no end event in the future, and start is in the past, it's ongoing
                return !hasEnd && ev.effectiveDate <= today;
            }
            return false;
        }

        // Filter: future events or ongoing events
        const filteredEvents = events.filter(ev =>
            ev.effectiveDate >= today || isOngoing(ev)
        );

        const byDate = {};
        filteredEvents.forEach(ev => {
            if (!byDate[ev.effectiveDate]) byDate[ev.effectiveDate] = [];
            byDate[ev.effectiveDate].push(ev);
        });
        return Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, events]) => ({ date, events }));
    }
);

export const { refreshAllEvents, refreshEventsForScenario } = eventSlice.actions;
export default eventSlice.reducer;

