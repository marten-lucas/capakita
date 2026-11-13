import { describe, expect, it } from 'vitest';
import { buildResilienceStaff, compensateResilienceSlot, drawResilienceDay, evaluateResilienceConstraints, normalizeResilienceConfig } from './resilienceModel';

const categories = ['Mo 8:00', 'Mo 8:30', 'Di 8:00', 'Di 8:30'];
const booking = (itemId, groupId, qualifications, times) => ({ itemId, groupId, qualifications, times });
const segment = (day_name, booking_start, booking_end, allocationSharePercent) => ({ day_name, segments: [{ booking_start, booking_end, allocationSharePercent }] });
const staff = buildResilienceStaff([
  booking('a', 'g', ['expert'], [segment('Mo', '8:00', '9:00'), segment('Di', '8:00', '9:00')]),
  booking('b', 'g', [], [segment('Mo', '8:30', '9:00'), segment('Di', '8:00', '9:00')]),
], categories, [{ key: 'expert', IsExpert: true }]);

describe('Resilienzmodell', () => {
  it('akzeptiert Nullwerte und genau 100 Läufe; begrenzt entsprechend der UI', () => {
    const values = Object.fromEntries(['baseAbsenceProbabilityPct', 'maxConcurrentOutages', 'minExpertRatioPct', 'minGroupHeadcount', 'maxUndercoverageSlots', 'maxOvertimeHoursPerEmployeePerWeek', 'maxTimeReductionHoursPerWeek', 'emergencyDemandReductionPct', 'contagionBoostPct', 'contagionDays', 'childCompensationRatePct'].map((key) => [key, 0]));
    expect(normalizeResilienceConfig({ ...values, runs: 100 })).toMatchObject({ ...values, runs: 100 });
    expect(normalizeResilienceConfig({ runs: 99 }).runs).toBe(100);
    expect(normalizeResilienceConfig({ runs: 10001 }).runs).toBe(10000);
    expect(normalizeResilienceConfig({ runs: '' }).runs).toBe(1200);
  });

  it('zieht pro Person und Tag, nicht pro Slot; Ansteckung über Tage und Wochen', () => {
    const first = drawResilienceDay(staff, 0, 2, 0.5, 2, 0, 100, 2, () => 0.4);
    expect(first.absent).toEqual(new Set(['b', 'a']));
    expect(first.remaining).toBe(2);
    const args = { people: first.scheduled, absent: first.absent, groupDemand: { g: 2 }, groupMinimums: { g: 1 }, demand: 2, maxCareRatio: 8, minExpertRatioPct: 0, overtimeRemaining: { a: 4, b: 4 } };
    expect(compensateResilienceSlot({ ...args, slotIndex: 0 }).staff).toBe(0);
    expect(compensateResilienceSlot({ ...args, slotIndex: 1 }).staff).toBe(0);
    const second = drawResilienceDay(staff, 2, 2, 0.5, 2, first.remaining, 100, 2, () => 0.75);
    expect(second.absent.size).toBe(2);
    expect(second.remaining).toBe(2);
    const noNew = drawResilienceDay(staff, 0, 2, 0, 2, second.remaining, 100, 2, () => 0.5);
    expect(noNew.remaining).toBe(1);
    expect(drawResilienceDay(staff, 2, 2, 0, 2, noNew.remaining, 100, 2, () => 0.5).remaining).toBe(0);
    expect(drawResilienceDay(staff, 0, 2, 1, 0, 0, 0, 0, () => 0).absent.size).toBe(0);
    const nextWeek = drawResilienceDay(staff, 0, 2, 0.5, 2, 1, 100, 2, () => 0.75);
    expect(nextWeek.absent.size).toBe(2);
    const expired = drawResilienceDay(staff, 0, 2, 0.5, 2, 0, 100, 2, () => 0.75);
    expect(expired.absent.size).toBe(0);
  });

  it('bewertet Gruppenminimum und Fachkraftquote nach Ausfall und Mehrarbeit neu', () => {
    const args = { people: staff, slotIndex: 0, groupDemand: { g: 4 }, groupMinimums: { g: 1 }, demand: 4, maxCareRatio: 8, minExpertRatioPct: 50, overtimeRemaining: { a: 2, b: 2 } };
    const absentExpert = compensateResilienceSlot({ ...args, absent: new Set(['a']) });
    expect(absentExpert.assessment.hasGroupMinViolation).toBe(false);
    expect(absentExpert.assessment.expertIssue).toBe(true);
    expect(absentExpert.assessment.compliant).toBe(false);
    expect(absentExpert.overtimeRemaining.a).toBe(2);
    const absentAtSecondSlot = compensateResilienceSlot({ ...args, slotIndex: 1, absent: new Set(['a']) });
    expect(absentAtSecondSlot.staff).toBe(1);
    expect(absentAtSecondSlot.assessment.expertRatio).toBe(0);
    expect(absentAtSecondSlot.assessment.expertIssue).toBe(true);
    const replacement = compensateResilienceSlot({ ...args, absent: new Set(), groupMinimums: { g: 2 }, minExpertRatioPct: 50 });
    expect(replacement.used).toBe(1);
    expect(replacement.assessment.compliant).toBe(true);
    expect(replacement.assessment.expertRatio).toBe(50);
    expect(replacement.overtimeRemaining.b).toBe(1);
    const zeroBudget = compensateResilienceSlot({ ...args, absent: new Set(), groupMinimums: { g: 2 }, overtimeRemaining: { a: 0, b: 0 } });
    expect(zeroBudget.assessment.hasGroupMinViolation).toBe(true);
    expect(evaluateResilienceConstraints({ groupStaff: replacement.groupStaff, activeGroups: replacement.activeGroups, groupMinimums: { g: 2 }, staff: replacement.staff, experts: replacement.experts, demand: 30, maxCareRatio: 8, minExpertRatioPct: 50 }).careIssue).toBe(true);
  });

  it('sperrt Verwaltungs- und andere Arbeitszeit personengenau, auch anteilig und an getrennten Tagen', () => {
    const admin = { day_name: 'Mo', segments: [{ booking_start: '8:15', booking_end: '8:45', category: 'administrative' }] };
    const people = buildResilienceStaff([
      booking('a', 'g', ['expert'], [segment('Di', '8:00', '8:30')]),
      booking('b', 'g', [], [segment('Mo', '8:30', '9:00', 50)]),
      booking('c', 'g', [], [segment('Mo', '8:30', '9:00')]),
    ], categories, [{ key: 'expert', IsExpert: true }], [
      booking('a', 'h', [], [admin, segment('Di', '8:00', '8:30')]),
      booking('b', 'g', [], [segment('Mo', '8:30', '9:00', 50)]),
      booking('c', 'g', [], [segment('Mo', '8:30', '9:00')]),
    ]);
    const monday = drawResilienceDay(people, 0, 2, 0, 3, 0, 0, 0, () => 0.5);
    expect(monday.scheduled.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(people[0].slots.slice(0, 2)).toEqual([{}, {}]);
    expect(drawResilienceDay(people, 0, 2, 1, 3, 0, 0, 0, () => 0).absent).toEqual(new Set(['b', 'c', 'a']));
    const args = { people: monday.scheduled, absent: new Set(), groupDemand: { g: 2 }, groupMinimums: { g: 2 }, demand: 2, maxCareRatio: 8, minExpertRatioPct: 0, overtimeRemaining: { a: 2, b: 2, c: 2 } };
    const first = compensateResilienceSlot({ ...args, slotIndex: 0 });
    expect(first).toMatchObject({ staff: 2, experts: 0, used: 2, overtimeRemaining: { a: 2, b: 1, c: 1 } });
    const second = compensateResilienceSlot({ ...args, slotIndex: 1 });
    expect(second).toMatchObject({ staff: 1.5, experts: 0, used: 0, overtimeRemaining: { a: 2, b: 2, c: 2 } });
    expect(second.assessment.compliant).toBe(false);
    const tuesday = drawResilienceDay(people, 2, 2, 0, 3, 0, 0, 0, () => 0.5);
    expect(tuesday.scheduled.map((p) => p.id)).toEqual(['a']);
    expect(compensateResilienceSlot({ ...args, people: tuesday.scheduled, slotIndex: 3 }).used).toBe(1);
    expect(compensateResilienceSlot({ ...args, people: tuesday.scheduled, slotIndex: 3, absent: new Set(['a']) }).used).toBe(0);
  });

  it('bewahrt Teilzuordnungen und begrenzt überlappende Buchungen auf eine Person', () => {
    const people = buildResilienceStaff([
      booking('x', 'g', ['expert'], [segment('Mo', '8:00', '9:00', 50)]),
      booking('x', 'h', ['expert'], [segment('Mo', '8:00', '9:00', 50)]),
    ], categories, [{ key: 'expert', IsExpert: true }]);
    expect(people).toHaveLength(1);
    expect(people[0].slots[0]).toEqual({ g: 0.5, h: 0.5 });
    expect(people[0].slots[1]).toEqual({ g: 0.5, h: 0.5 });
  });
});
