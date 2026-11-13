import { segmentMatchesMode } from '../utils/bookingUtils';
import { generateCareRatioSeries, generateExpertRatioSeries } from '../utils/chartUtils/chartUtils';
import { generateBookingDataSeries } from '../utils/chartUtils/chartUtilsWeekly';

// Weekly charts include 17:00 as a point-in-time observation; coverage uses
// half-hour intervals, so its last interval starts at 16:30.
export function coverageWeeklyData(weeklyData) {
  const categories = weeklyData.categories || [];
  const indices = categories.flatMap((category, index) => {
    const match = /^(Mo|Di|Mi|Do|Fr) (\d{1,2}):(\d{2})$/.exec(category);
    if (!match) return [];
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return minutes >= 7 * 60 && minutes < 17 * 60 ? [index] : [];
  });
  const result = { ...weeklyData, categories: indices.map((index) => categories[index]) };
  for (const key of ['demand', 'capacity', 'capacity_pedagogical', 'capacity_administrative', 'care_ratio', 'expert_ratio']) {
    const series = weeklyData[key] || [];
    result[key] = series.length ? indices.map((index) => series[index]) : [];
  }
  for (const [maxKey, seriesKey] of [['maxdemand', 'demand'], ['maxcapacity', 'capacity'], ['max_care_ratio', 'care_ratio'], ['maxexpert_ratio', 'expert_ratio']]) {
    result[maxKey] = Math.max(0, ...result[seriesKey].map((value) => Number(value) || 0));
  }
  return result;
}

export function coverageGroupMetrics(categories, demand, capacity, dataItems, groupDefs, qualificationDefs, referenceDate) {
  const pedagogicalBookings = capacity.map((booking) => ({
    ...booking,
    times: (booking.times || []).map((day) => ({
      ...day, segments: (day.segments || []).filter((segment) => segmentMatchesMode(segment, 'pedagogical')),
    })),
  }));
  return {
    demand: generateBookingDataSeries(referenceDate, demand, categories),
    capacity: generateBookingDataSeries(referenceDate, capacity, categories, 'all'),
    pedagogical: generateBookingDataSeries(referenceDate, capacity, categories, 'pedagogical'),
    careRatio: generateCareRatioSeries(categories, demand, pedagogicalBookings, dataItems, groupDefs || []),
    expertRatio: generateExpertRatioSeries(categories, pedagogicalBookings, qualificationDefs || []),
  };
}

export function coverageGroups(groupDefs, selectedGroups, demand, capacity) {
  const selected = new Set((selectedGroups || []).map(String));
  const groups = (groupDefs || [])
    .filter((group) => group?.id && (!selected.size || selected.has(String(group.id))))
    .map((group) => ({ id: String(group.id), name: group.name || 'Gruppe' }));
  const known = new Set(groups.map((group) => group.id));
  [...(demand || []), ...(capacity || [])].forEach((booking) => {
    const id = booking.groupId ? String(booking.groupId) : '__NO_GROUP__';
    if ((!selected.size || selected.has(id)) && !known.has(id)) {
      groups.push({ id, name: id === '__NO_GROUP__' ? 'Keine Gruppe' : id });
      known.add(id);
    }
  });
  if (selected.has('__NO_GROUP__') && !known.has('__NO_GROUP__')) {
    groups.push({ id: '__NO_GROUP__', name: 'Keine Gruppe' });
  }
  return groups;
}

export function coverageHeatValue(mode, demand, pedagogicalCapacity, weightedCareRatio) {
  if (mode === 'presentStaff') return pedagogicalCapacity;
  if (pedagogicalCapacity <= 0) return null;
  return mode === 'careKey' ? weightedCareRatio : demand / pedagogicalCapacity;
}

export function coverageHoursModel(demandSeries, pedagogicalSeries, modelKey) {
  const hours = (series) => (series || []).reduce((sum, value) => sum + (Number(value) || 0) * 0.5, 0);
  const weeklyChildHours = hours(demandSeries);
  const weeklyStaffHours = hours(pedagogicalSeries);
  const key = typeof modelKey === 'number' && Number.isFinite(modelKey) && modelKey > 0 ? modelKey : null;
  return {
    weeklyChildHours,
    weeklyStaffHours,
    monthlyStaffFte: weeklyStaffHours * 4.33 / 160,
    monthlyModelFte: key === null ? null : weeklyChildHours / key * 4.33 / 160,
  };
}
