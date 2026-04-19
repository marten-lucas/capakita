function monthsBetween(dateOfBirth, referenceDate) {
  const birth = new Date(dateOfBirth);
  const ref = new Date(referenceDate);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime()) || birth > ref) {
    return null;
  }

  let months = (ref.getFullYear() - birth.getFullYear()) * 12;
  months += ref.getMonth() - birth.getMonth();

  if (ref.getDate() < birth.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function buildAgeBins(maxMonths) {
  const cappedMax = Math.max(36, Math.ceil(maxMonths / 3) * 3);
  const labels = [];

  for (let start = 0; start <= cappedMax; start += 3) {
    const end = start + 2;
    labels.push(`${start}-${end}`);
  }

  return labels;
}

export function calculateChartDataAgeHistogram(referenceDate, selectedGroups, { dataByScenario, groupsByScenario, scenarioId }) {
  const dataItems = Object.values(dataByScenario?.[scenarioId] || {}).filter((item) => item?.type === 'demand');
  const groupAssignments = groupsByScenario?.[scenarioId] || {};

  const visibleChildren = dataItems.filter((item) => {
    const startOk = !item.startdate || item.startdate <= referenceDate;
    const endOk = !item.enddate || item.enddate >= referenceDate;
    if (!startOk || !endOk) return false;

    const assignments = Object.values(groupAssignments[item.id] || {});
    const activeAssignment = assignments.find((assignment) => {
      const assignStartOk = !assignment.start || assignment.start <= referenceDate;
      const assignEndOk = !assignment.end || assignment.end >= referenceDate;
      return assignStartOk && assignEndOk;
    });

    const groupId = activeAssignment?.groupId || item.groupId || '';

    if (!selectedGroups?.length) return true;
    if (!groupId && selectedGroups.includes('__NO_GROUP__')) return true;
    return selectedGroups.includes(String(groupId));
  });

  const agesInMonths = visibleChildren
    .map((child) => {
      if (child.dateofbirth) {
        return monthsBetween(child.dateofbirth, referenceDate);
      }

      const ageYears = Number(child.rawdata?.ALTER);
      return Number.isFinite(ageYears) ? Math.max(0, Math.round(ageYears * 12)) : null;
    })
    .filter((value) => value !== null);

  if (agesInMonths.length === 0) {
    return {
      categories: [],
      series: [],
      maxCount: 0,
    };
  }

  const categories = buildAgeBins(Math.max(...agesInMonths));
  const series = new Array(categories.length).fill(0);

  agesInMonths.forEach((ageInMonths) => {
    const binIndex = Math.floor(ageInMonths / 3);
    if (series[binIndex] !== undefined) {
      series[binIndex] += 1;
    }
  });

  return {
    categories,
    series,
    maxCount: Math.max(...series, 0),
  };
}
