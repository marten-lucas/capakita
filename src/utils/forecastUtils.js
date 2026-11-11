export function getForecastGroupAssignments(assignments) {
  if (Array.isArray(assignments)) return assignments;
  if (!assignments || typeof assignments !== 'object') return [];
  return Object.values(assignments).filter((assignment) => assignment && typeof assignment === 'object');
}

export function getFutureGroupAssignmentDates(assignments, referenceDate) {
  return getForecastGroupAssignments(assignments)
    .map((assignment) => String(assignment.start || ''))
    .filter((dateIso) => dateIso && dateIso >= String(referenceDate || ''));
}

export function shouldProjectAutoTransition(assignments, transitionDate, dateIso) {
  const transitionDateIso = String(transitionDate || '');
  const targetDateIso = String(dateIso || '');
  if (!transitionDateIso || !targetDateIso || transitionDateIso > targetDateIso) return false;

  // A real assignment at or after the projected transition is the more specific source of truth.
  return !getForecastGroupAssignments(assignments).some((assignment) => {
    const assignmentStart = String(assignment.start || '');
    return assignmentStart && assignmentStart >= transitionDateIso && assignmentStart <= targetDateIso;
  });
}
