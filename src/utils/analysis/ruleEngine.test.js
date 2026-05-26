import { describe, expect, it } from 'vitest';
import { buildAnalysisMetrics, computeAnalysisInsights } from './ruleEngine';

describe('ruleEngine', () => {
  it('builds normalized metrics safely', () => {
    const result = buildAnalysisMetrics({
      dataQuality: { total: 100, missingBooking: 12 },
      latest: { childrenCount: 80 },
    });

    expect(result.missingBookingShare).toBe(12);
    expect(result.childrenCount).toBe(80);
    expect(result.net).toBe(0);
  });

  it('creates deterministic high-priority alerts for critical data', async () => {
    const insights = await computeAnalysisInsights({
      dataQuality: {
        total: 100,
        missingBooking: 15,
        missingGroup: 10,
      },
      utilization: {
        overloadSharePct: 25,
      },
      transitions: {
        corridorRemainPct: 60,
      },
      finance: {
        net: -200,
      },
    });

    expect(insights.alerts.length).toBeGreaterThan(0);
    expect(insights.topAlerts).toHaveLength(3);
    expect(insights.topAlerts[0].severity).toBe('high');
    expect(insights.stepStatements.quality).toMatch(/Datensaetze|Buchung/i);
  });

  it('returns no critical summary when inputs are stable', async () => {
    const insights = await computeAnalysisInsights({
      dataQuality: {
        total: 100,
        missingBooking: 0,
        missingGroup: 0,
      },
      utilization: {
        overloadSharePct: 2,
        meanOverloadHours: 0.2,
      },
      transitions: {
        count: 12,
        averageAgeMonths: 38,
        corridorRemainPct: 92,
      },
      ageDistribution: {
        krippePct: 20,
        regelPct: 65,
        schulePct: 15,
      },
      finance: {
        net: 1500,
        careRatio: 7.1,
        expertRatio: 72,
      },
    });

    expect(insights.alerts).toHaveLength(0);
    expect(insights.stepStatements.summary).toMatch(/Keine kritischen Alerts/i);
  });
});
