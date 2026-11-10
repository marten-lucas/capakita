import { ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { findFeeEntryForZeitkat } from '../../utils/financeUtils';

export function buildSimulationFeePdfRows({
  tariffGroups = [],
  groupFeeCatalogs = {},
  effectiveFeeCatalogs = {},
  parentFeeSubsidiesByGroup = {},
  parentFeeSubsidy = {},
  referenceDate,
}) {
  return tariffGroups.flatMap((group) => {
    const subsidy = parentFeeSubsidiesByGroup[group.id] || parentFeeSubsidy;
    return ZEITKAT_CATALOG.map((zone) => {
      const baselineEntry = findFeeEntryForZeitkat(groupFeeCatalogs[group.id] || [], zone.id, referenceDate);
      const simulatedEntry = findFeeEntryForZeitkat(effectiveFeeCatalogs[group.id] || [], zone.id, referenceDate);
      const baselineAmount = Number(baselineEntry?.monthlyAmount) || 0;
      const simulatedAmount = Number(simulatedEntry?.monthlyAmount) || 0;
      return {
        groupName: group.name,
        subsidy,
        category: `ZEITKAT ${zone.id} (${zone.kurzbez}h)`,
        hours: zone.maxHours,
        baselineAmount,
        simulatedAmount,
        baselineActive: Boolean(baselineEntry),
        simulatedActive: Boolean(simulatedEntry),
        delta: Math.round((simulatedAmount - baselineAmount) * 100) / 100,
      };
    });
  }).filter((row) => row.baselineActive || row.simulatedActive);
}

export function buildAnnualFamilyImpactPdfGroups(annualIncomeRows = []) {
  return annualIncomeRows
    .map((row) => ({
      year: row.year,
      families: (row.familyImpacts || []).map((family) => ({
        label: family.label,
        averageMonthlyParentFeesBefore: family.averageMonthlyParentFeesBefore,
        averageMonthlyParentFeesAfter: family.averageMonthlyParentFeesAfter,
        averageMonthlyDelta: family.averageMonthlyDelta,
        averageMonthlyYearOverYearDelta: family.averageMonthlyYearOverYearDelta,
        yearOverYearAnnualDelta: family.yearOverYearAnnualDelta,
      })),
    }))
    .filter((group) => group.families.length > 0);
}
