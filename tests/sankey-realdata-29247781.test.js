import path from 'path';
import { test, expect } from '@playwright/test';

const importZip = path.resolve(process.cwd(), 'tests/testdata/kita-anonym-29247781.zip');

test('realdata 29247781 populates sankey transitions after import', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Daten importieren/i }).click();
  const importDialog = page.getByRole('dialog', { name: 'Datenimport-Wizard' });
  await expect(importDialog).toBeVisible();

  await importDialog.locator('input[type="file"]').setInputFiles(importZip);
  await importDialog.getByRole('button', { name: /Datei analysieren/i }).click();
  await importDialog.getByRole('button', { name: /Weiter zur Vorschau/i }).click();
  await importDialog.getByRole('button', { name: /Import ausführen/i }).click();

  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__APP_STORE, { timeout: 10000 });

  const metrics = await page.evaluate(() => {
    const store = window.__APP_STORE;
    const state = store.getState();

    const scenarioId = state.simScenario?.selectedScenarioId;
    const today = '2026-06-11';

    store.dispatch({ type: 'chart/setReferenceDate', payload: { scenarioId, date: today } });
    store.dispatch({ type: 'ui/setActivePage', payload: 'visu' });
    store.dispatch({ type: 'ui/setAnalysisSubPage', payload: 'compare' });

    const nextState = store.getState();
    const dataItems = nextState.simData?.dataByScenario?.[scenarioId] || {};
    const groupsByItem = nextState.simGroup?.groupsByScenario?.[scenarioId] || {};
    const events = nextState.events?.eventsByScenario?.[scenarioId] || [];
    const groupDefs = nextState.simGroup?.groupDefsByScenario?.[scenarioId] || [];

    const demandNow = Object.values(dataItems).filter((item) => (
      item
      && item.type === 'demand'
      && item.archived !== true
      && (!item.startdate || String(item.startdate) <= today)
      && (!item.enddate || String(item.enddate) >= today)
    ));

    const sortByDate = (arr) => [...arr].sort((a, b) => {
      const d = String(a?.effectiveDate || a?.start || '').localeCompare(String(b?.effectiveDate || b?.start || ''));
      if (d !== 0) return d;
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });

    const byItemTransitions = new Map();
    events
      .filter((ev) => ev && ev.enabled !== false && ev.type === 'auto_group_transition' && ev.entityType === 'demand' && ev.effectiveDate >= today)
      .forEach((ev) => {
        const id = String(ev.entityId || '');
        if (!id) return;
        const current = byItemTransitions.get(id) || [];
        current.push(ev);
        byItemTransitions.set(id, current);
      });

    byItemTransitions.forEach((arr, id) => byItemTransitions.set(id, sortByDate(arr)));

    const autoByItem = new Map();
    events
      .filter((ev) => ev && ev.enabled !== false && ev.type === 'auto_group_transition' && ev.entityType === 'demand')
      .forEach((ev) => {
        const id = String(ev.entityId || '');
        if (!id) return;
        const current = autoByItem.get(id) || [];
        current.push(ev);
        autoByItem.set(id, current);
      });
    autoByItem.forEach((arr, id) => autoByItem.set(id, sortByDate(arr)));

    const stageToGroup = {
      kita: String((groupDefs.find((g) => String(g?.type || '').toLowerCase().includes('regel') || String(g?.name || '').toLowerCase().includes('kita'))?.id) || '__AUTO_STAGE_KITA__'),
      school: String((groupDefs.find((g) => String(g?.type || '').toLowerCase().includes('schul') || String(g?.name || '').toLowerCase().includes('schul'))?.id) || '__AUTO_STAGE_SCHOOL__'),
    };

    const currentGroup = (itemId, fallback) => {
      const rawAssignments = groupsByItem?.[itemId];
      const assignmentsArray = Array.isArray(rawAssignments)
        ? rawAssignments
        : (rawAssignments && typeof rawAssignments === 'object' ? Object.values(rawAssignments) : []);
      const assignments = sortByDate(assignmentsArray.filter(Boolean));
      let current = fallback ? String(fallback) : '';
      assignments.forEach((a) => {
        const s = String(a.start || '');
        const e = String(a.end || '');
        if ((!s || s <= today) && (!e || e >= today) && a.groupId) {
          current = String(a.groupId);
        }
      });
      return current;
    };

    const resolveProjectedGroup = (item, date) => {
      const itemId = String(item?.id || '');
      const base = currentGroup(itemId, item?.groupId || '');
      const transitions = autoByItem.get(itemId) || [];
      const applicable = transitions.filter((ev) => String(ev?.effectiveDate || '') <= String(date));
      const last = applicable.length ? applicable[applicable.length - 1] : null;
      const stage = String(last?.metadata?.targetStage || '').toLowerCase();
      const projected = stageToGroup[stage] || null;
      return projected || base || '__NO_GROUP__';
    };

    const groupCountAtDate = (groupId, date) => demandNow.reduce((sum, item) => {
      if (!item) return sum;
      if (item.startdate && String(item.startdate) > String(date)) return sum;
      if (item.enddate && String(item.enddate) < String(date)) return sum;
      const resolved = resolveProjectedGroup(item, date);
      return String(resolved) === String(groupId) ? sum + 1 : sum;
    }, 0);

    const schoolGroupId = stageToGroup.school;
    const fuchsGroupId = String((groupDefs.find((g) => String(g?.name || '').toLowerCase() === 'fuchsgruppe')?.id) || '');
    const schoolAtAug31 = schoolGroupId ? groupCountAtDate(schoolGroupId, '2026-08-31') : null;
    const schoolAtSep01 = schoolGroupId ? groupCountAtDate(schoolGroupId, '2026-09-01') : null;
    const fuchsAtAug31 = fuchsGroupId ? groupCountAtDate(fuchsGroupId, '2026-08-31') : null;
    const fuchsAtSep01 = fuchsGroupId ? groupCountAtDate(fuchsGroupId, '2026-09-01') : null;
    const autoSchoolSep01 = events.filter((ev) => ev && ev.enabled !== false && ev.type === 'auto_group_transition' && ev.entityType === 'demand' && ev.effectiveDate === '2026-09-01' && String(ev?.metadata?.targetStage || '').toLowerCase() === 'school').length;

    const projectedTransitions = demandNow.reduce((sum, item) => {
      const itemId = String(item.id || '');
      const base = currentGroup(itemId, item.groupId || '');
      const transitions = byItemTransitions.get(itemId) || [];
      if (!transitions.length) return sum;
      const firstTarget = String(transitions[0]?.metadata?.targetStage || '').toLowerCase();
      const projected = stageToGroup[firstTarget] || base;
      return projected && projected !== base ? sum + 1 : sum;
    }, 0);

    return {
      scenarioId,
      today,
      activeChildren: demandNow.length,
      autoTransitionsFuture: events.filter((ev) => ev && ev.enabled !== false && ev.type === 'auto_group_transition' && ev.entityType === 'demand' && ev.effectiveDate >= today).length,
      projectedTransitions,
      schoolGroupId,
      fuchsGroupId,
      schoolAtAug31,
      schoolAtSep01,
      fuchsAtAug31,
      fuchsAtSep01,
      autoSchoolSep01,
    };
  });

  console.log('Sankey metrics', metrics);

  expect(metrics.autoTransitionsFuture, `Expected future auto transitions: ${JSON.stringify(metrics)}`).toBeGreaterThan(0);
  expect(metrics.projectedTransitions, `Expected projected transition candidates: ${JSON.stringify(metrics)}`).toBeGreaterThan(0);
  expect(metrics.autoSchoolSep01, `Expected school auto transitions on 2026-09-01: ${JSON.stringify(metrics)}`).toBeGreaterThan(0);
  expect(metrics.fuchsAtSep01, `Expected Fuchsgruppe to decrease at school transition date: ${JSON.stringify(metrics)}`).toBeLessThan(metrics.fuchsAtAug31);
  expect(metrics.schoolAtSep01, `Expected Schulgruppe to increase at school transition date: ${JSON.stringify(metrics)}`).toBeGreaterThan(metrics.schoolAtAug31);

  await expect(page.getByTestId('analysis-clean-sheet')).toBeVisible();
  await expect(page.locator('.analysis-stage-content')).toBeVisible();
  await page.locator('.analysis-stage-content .analysis-coverage-carousel-nav').last().click();
  await page.locator('.analysis-stage-content .analysis-coverage-carousel-nav').last().click();
  await expect(page.locator('.highcharts-sankey-series .highcharts-link').first()).toBeVisible();

  await page.screenshot({ path: 'test-results/sankey-realdata-29247781.png', fullPage: true });
});
