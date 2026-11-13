import { timeToMinutes } from './timeUtils';

export const RESILIENCE_LIMITS = {
  runs: [100, 10000], baseAbsenceProbabilityPct: [0, 80], simulationWeeks: [4, 52],
  maxConcurrentOutages: [0, 12], minExpertRatioPct: [0, 100], maxCareRatio: [1, 30],
  minGroupHeadcount: [0, 10], maxUndercoverageSlots: [0, 200],
  maxOvertimeHoursPerEmployeePerWeek: [0, 20], maxTimeReductionHoursPerWeek: [0, 20],
  emergencyDemandReductionPct: [0, 80], contagionBoostPct: [0, 200], contagionDays: [0, 14],
  childCompensationRatePct: [0, 30],
};

export function normalizeResilienceConfig(config = {}) {
  const defaults = { runs: 1200, baseAbsenceProbabilityPct: 14, simulationWeeks: 26, maxConcurrentOutages: 3,
    minExpertRatioPct: 50, maxCareRatio: 8, minGroupHeadcount: 1, maxUndercoverageSlots: 4,
    maxOvertimeHoursPerEmployeePerWeek: 2, maxTimeReductionHoursPerWeek: 3,
    emergencyDemandReductionPct: 18, contagionBoostPct: 28, contagionDays: 3, childCompensationRatePct: 6 };
  const integers = new Set(['runs', 'baseAbsenceProbabilityPct', 'simulationWeeks', 'maxConcurrentOutages', 'minExpertRatioPct', 'maxUndercoverageSlots', 'emergencyDemandReductionPct', 'contagionBoostPct', 'contagionDays', 'childCompensationRatePct']);
  const result = { ...config };
  Object.entries(RESILIENCE_LIMITS).forEach(([key, [min, max]]) => {
    const raw = config[key];
    const parsed = raw === '' || raw == null ? defaults[key] : Number(raw);
    const value = Number.isFinite(parsed) ? parsed : defaults[key];
    result[key] = Math.max(min, Math.min(max, integers.has(key) ? Math.round(value) : value));
  });
  return result;
}

// Split bookings may allocate a fraction of a person to several groups at once.
export function buildResilienceStaff(bookings, categories, qualificationDefs, workBookings = bookings) {
  const expertKeys = new Set((qualificationDefs || []).filter((def) => def.IsExpert !== false).map((def) => def.key));
  const categoryParts = categories.map((category) => {
    const [day, time] = category.split(' ');
    return { day, minute: timeToMinutes(time) };
  });
  const people = new Map();
  for (const booking of bookings) {
    const id = String(booking.itemId);
    if (!people.has(id)) people.set(id, { id, expert: false, slots: categories.map(() => ({})), busySlots: categories.map(() => false) });
    const person = people.get(id);
    person.expert ||= (booking.qualifications || []).some((key) => expertKeys.has(key));
    for (const day of booking.times || []) {
      for (const segment of day.segments || []) {
        if (segment.category === 'administrative') continue;
        const start = timeToMinutes(segment.booking_start);
        const end = timeToMinutes(segment.booking_end);
        if (start == null || end == null || end <= start) continue;
        const share = segment.allocationSharePercent == null ? 1 : Math.max(0, Number(segment.allocationSharePercent) || 0) / 100;
        const group = String(booking.groupId || '__NO_GROUP__');
        categoryParts.forEach(({ day: name, minute }, index) => {
          if (name === day.day_name && minute >= start && minute < end) {
            person.slots[index][group] = (person.slots[index][group] || 0) + share;
          }
        });
      }
    }
  }
  // Occupancy is independent of group selection and blocks the whole overlapping slot.
  for (const booking of workBookings) {
    const person = people.get(String(booking.itemId));
    if (!person) continue;
    for (const day of booking.times || []) {
      for (const segment of day.segments || []) {
        const start = timeToMinutes(segment.booking_start);
        const end = timeToMinutes(segment.booking_end);
        const share = segment.allocationSharePercent == null ? 1 : Number(segment.allocationSharePercent) || 0;
        if (start == null || end == null || end <= start || share <= 0) continue;
        categoryParts.forEach(({ day: name, minute }, index) => {
          if (name === day.day_name && minute != null && minute < end && minute + 30 > start) person.busySlots[index] = true;
        });
      }
    }
  }
  // Overlapping bookings cannot make one person more than one head.
  for (const person of people.values()) {
    person.slots = person.slots.map((groups) => {
      const total = Object.values(groups).reduce((sum, value) => sum + value, 0);
      if (total <= 1) return groups;
      return Object.fromEntries(Object.entries(groups).map(([group, value]) => [group, value / total]));
    });
  }
  return [...people.values()];
}

// An absence lasts one operating day; the boost applies to the following N operating days.
export function drawResilienceDay(people, slotStart, slotsPerDay, probability, cap, remaining, boost, duration, random) {
  const scheduled = people.filter((person) => person.slots.slice(slotStart, slotStart + slotsPerDay).some((groups, offset) => Object.keys(groups).length > 0 || person.busySlots?.[slotStart + offset]));
  const chance = Math.min(1, Math.max(0, probability * (remaining > 0 ? 1 + boost / 100 : 1)));
  const candidates = scheduled.filter(() => random() < chance);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const absent = new Set(candidates.slice(0, cap).map((person) => person.id));
  return { scheduled, absent, remaining: absent.size ? duration : Math.max(0, remaining - 1) };
}

export function evaluateResilienceConstraints({ groupStaff, activeGroups, groupMinimums, staff, experts, demand, maxCareRatio, minExpertRatioPct }) {
  const minimumStaffRequired = activeGroups.reduce((sum, group) => sum + groupMinimums[group], 0);
  const hasGroupMinViolation = activeGroups.some((group) => (groupStaff[group] || 0) + 1e-9 < groupMinimums[group]);
  const careRatio = staff > 0 ? demand / staff : (demand > 0 ? Infinity : 0);
  const expertRatio = staff > 0 ? experts / staff * 100 : 0;
  const headcountIssue = staff + 1e-9 < minimumStaffRequired;
  const careIssue = careRatio > maxCareRatio;
  const expertIssue = staff > 0 && expertRatio + 1e-9 < minExpertRatioPct;
  return { minimumStaffRequired, hasGroupMinViolation, careRatio, expertRatio, headcountIssue, careIssue, expertIssue,
    compliant: !headcountIssue && !hasGroupMinViolation && !careIssue && !expertIssue };
}

// More hours use available, non-absent people scheduled that day, at most once per slot.
export function compensateResilienceSlot({ people, absent, slotIndex, groupDemand, groupMinimums, demand, maxCareRatio, minExpertRatioPct, overtimeRemaining }) {
  const groupStaff = {};
  const plannedGroups = new Set();
  let staff = 0;
  let experts = 0;
  for (const person of people) {
    const groups = person.slots[slotIndex];
    Object.keys(groups).forEach((group) => plannedGroups.add(group));
    if (absent.has(person.id)) continue;
    const contribution = Object.values(groups).reduce((sum, value) => sum + value, 0);
    staff += contribution;
    if (person.expert) experts += contribution;
    Object.entries(groups).forEach(([group, value]) => { groupStaff[group] = (groupStaff[group] || 0) + value; });
  }
  const activeGroups = Object.keys(groupMinimums).filter((group) => (groupDemand[group] || 0) > 0 || plannedGroups.has(group));
  const assess = () => evaluateResilienceConstraints({ groupStaff, activeGroups, groupMinimums, staff, experts, demand, maxCareRatio, minExpertRatioPct });
  let assessment = assess();
  let used = 0;
  const remaining = { ...overtimeRemaining };
  const candidates = people.filter((person) => !absent.has(person.id) && !person.busySlots?.[slotIndex] && !Object.keys(person.slots[slotIndex]).length && (remaining[person.id] || 0) >= 1);
  while (!assessment.compliant && candidates.length) {
    const expertNeeded = assessment.expertIssue;
    const candidateIndex = expertNeeded ? candidates.findIndex((person) => person.expert) : 0;
    if (candidateIndex < 0) break;
    const person = candidates.splice(candidateIndex, 1)[0];
    const group = activeGroups.find((id) => (groupStaff[id] || 0) + 1e-9 < groupMinimums[id])
      || activeGroups.reduce((best, id) => !best || (groupDemand[id] || 0) > (groupDemand[best] || 0) ? id : best, null);
    if (!group) break;
    groupStaff[group] = (groupStaff[group] || 0) + 1;
    staff += 1;
    if (person.expert) experts += 1;
    remaining[person.id] -= 1;
    used += 1;
    assessment = assess();
  }
  return { groupStaff, activeGroups, staff, experts, assessment, overtimeRemaining: remaining, used };
}
