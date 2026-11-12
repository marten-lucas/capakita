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

export function getForecastGroupRank(groupIdRaw, groupMeta = {}, exitGroupId = '__AUTO_STAGE_EXIT__') {
  const groupId = String(groupIdRaw || '');
  const type = String(groupMeta.type || '').toLowerCase();
  const name = String(groupMeta.name || '').trim().toLowerCase();

  if (groupId === String(exitGroupId) || type.includes('exit') || name.includes('aus einrichtung')) return 3;
  if (groupId === '__NO_GROUP__') return 4;
  if (type.includes('kripp') || type.includes('u3') || /^(krippe|krippengruppe|u3)(?:$|[\s_-])/.test(name)) return 0;
  if (type.includes('regel') || type.includes('kita') || type.includes('vorschul') || /^(regel|kita|kindergarten|vorschul)(?:$|[\s_-])/.test(name)) return 1;
  if (type.includes('schul') || type.includes('hort') || /^(schulkind(?:gruppe|betreuung)?|schulgruppe|schule|hort(?:gruppe)?)(?:$|[\s_-])/.test(name)) return 2;
  return 1;
}

export function allocateFillUpCandidates(candidates = [], availablePlaces = Infinity) {
  const ordered = [...candidates].sort((left, right) => (
    Number(left.gradePriority || Number.MAX_SAFE_INTEGER) - Number(right.gradePriority || Number.MAX_SAFE_INTEGER)
    || Number(right.siblingPriority || 0) - Number(left.siblingPriority || 0)
    || Number(left.dataOrder || 0) - Number(right.dataOrder || 0)
  ));
  const placeCount = Number.isFinite(Number(availablePlaces))
    ? Math.max(0, Math.floor(Number(availablePlaces)))
    : ordered.length;
  return {
    accepted: ordered.slice(0, placeCount),
    rejected: ordered.slice(placeCount),
  };
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
