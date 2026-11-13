import React from 'react';
import { Accordion, ActionIcon, Alert, Badge, Box, Button, Collapse, Group, Modal, MultiSelect, NumberInput, Paper, Popover, SegmentedControl, Select, Stack, Switch, Table, Tabs, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { BarChart } from '@mantine/charts';
import { IconChevronDown, IconChevronRight, IconChevronUp, IconCopy, IconDeviceFloppy, IconFileText, IconInfoCircle, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { seedDefaultBayKiBiGRules, updateFundingSimulationSettings, updateScenarioFinanceSettings } from '../../store/simFinanceSlice';
import { selectForecastEventsAvailable } from '../../store/eventSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { filterBookings, sumWeightedBookingHours } from '../../utils/chartUtils/chartUtils';
import { buildForecastFinanceMonth } from '../../utils/forecastFinance';
import { buildForecastInflow, getForecastGroupAssignments } from '../../utils/forecastUtils';
import { buildForecastFillUp, limitForecastInflow } from '../../utils/forecastUtilsModel';
import { decodeBuchungsart, getFeeBandZeitkatId, getZeitkatZoneIndex, isAdebisTrue, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import {
  calculateFamilyFeePotentials,

  getFeeBandSimulationPriceKey,
  getFeeBandSimulationPriceOverride,
  getFeeCatalogSimulationRows,
  isParentFeeSubsidyEligible,
  simulateContributionChanges,
} from '../../utils/foerderSimulation';
import { calculateChildMonthlyRevenue, calculateScenarioMonthlyFinance, isRecordActiveOnDate, pickApplicableValidityEntry, resolveGroupIdAtDate, resolveGroupIdsAtDate } from '../../utils/financeUtils';
import { shouldIncludeDataItemInAnalysis } from '../../utils/dataVisibility';
import { calculateAdebisMonthMetrics } from '../../utils/adebisAnalysis';
import { calculateAdebisMonthlyBaseFunding } from '../../utils/adebisFinance';
import { calculateReformForecast } from '../../utils/reformSimulation';
import { applyTariffOverlay, updateTariffOverlayGroup } from '../../utils/simulationTariffOverlay';
import FeeStaircaseEditor from '../common/FeeStaircaseEditor';
import { buildAnnualFamilyImpactPdfGroups, buildSavedScenarioFinancialComparisonRows, buildSimulationFeePdfRows, invalidReformInputs, qualifySavedScenarioRows, resolveManualFundingInputs, SAVED_SCENARIO_FINANCIAL_FIELDS, summarizeSimulationDiagnostics } from './simulationPdfUtils';
import { buildFamilyImpactHistogramData } from './familyImpactHistogram';
import { buildAggregateSimulationSnapshot, buildStandaloneSimulationHtml } from './simulationHtmlExport';
import './FundingSimulationPanel.css';



const EMPTY_FINANCE = {};
const EMPTY_EVENTS = [];
const STOCK_MODE_LABELS = { legacy: 'Bisheriger Monatsbestand', known: 'Bekannte Bestände', projected: 'Projizierte Bestände' };
const FORECAST_GAP_LABELS = {
  'unknown-group': 'Gruppe ungeklärt', 'unknown-stage': 'Betreuungsstufe ungeklärt',
  'conflicting-group-stage': 'Gruppentyp und Betreuungsstufe widersprüchlich', 'missing-basis-booking': 'Basisbuchung fehlt',
  'ambiguous-basis-booking': 'Mehrere Basisbuchungen', 'missing-booking-hours': 'Buchungszeiten fehlen',
  'ambiguous-booking-groups': 'Buchungsgruppen ungeklärt', 'missing-zeitkat': 'ZEITKAT fehlt',
  'missing-tariff': 'Tarif fehlt', 'missing-baseline-tariff': 'Ausgangstarif fehlt',
  'missing-booking': 'Basisbuchung fehlt', 'no-booking-hours': 'Buchungszeiten fehlen',
  'missing-demand-booking': 'Basisbuchung nicht in der Finanzberechnung', 'anonymous-inflow': 'Anonymer Zulauf',
  'invalid-fill-up-capacity': 'Auffüllen: Gesamtkapazität oder Schulkindgruppe ungeklärt',
  'missing-or-invalid-input': 'Forecast-Eingabe fehlt oder ist ungültig', 'invalid-item': 'Kinddaten ungültig',
  'invalid-group': 'Gruppendaten ungültig', 'invalid-event': 'Ereignisdaten ungültig',
  'invalid-group-assignments': 'Gruppenzuordnung ungültig',
};
const EMPTY_GROUP_FEE_CATALOGS = {};
const FAMILY_HISTOGRAM_COLORS = ['blue.6', 'teal.6', 'orange.6', 'grape.6', 'cyan.6', 'pink.6'];
const formatEuro = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatSignedEuro = (value) => `${Number(value) > 0 ? '+' : ''}${formatEuro(value)}`;

const formatDailyHours = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h/Tag`;
const formatHours = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
const formatPercent = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const formatAnalysisNumber = (value, digits = 2) => value == null
  ? '–'
  : Number(value).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatSignedHours = (value) => `${Number(value || 0) > 0 ? '+' : ''}${formatHours(value)}`;
const formatZeitkatList = (zeitkatIds = []) => zeitkatIds.map((zeitkatId) => {
  const zone = ZEITKAT_CATALOG.find((item) => item.id === String(zeitkatId));
  return zone ? `ZEITKAT ${zone.id} (${zone.kurzbez}h)` : `ZEITKAT ${zeitkatId}`;
}).join(', ') || '–';
function describeLegacyCategoryPrices(temporaryPrices, groupLabels) {
  if (!temporaryPrices || typeof temporaryPrices !== 'object' || Array.isArray(temporaryPrices)) return [];
  return Object.entries(temporaryPrices).flatMap(([groupId, prices]) => {
    if (!prices || typeof prices !== 'object' || Array.isArray(prices)) return [];
    const categories = ZEITKAT_CATALOG.filter((zone) => Object.hasOwn(prices, zone.id)).map((zone) => zone.id);
    return categories.length ? [`${groupLabels.get(String(groupId)) || groupId}: ${formatZeitkatList(categories)}`] : [];
  });
}

const legacyCategoryPriceExplanation = 'Alte Kategorie-Overrides können für alle Tarifversionen der genannten Kategorien gelten, auch für später hinzugefügte Versionen. Versionsbezogene Overrides haben Vorrang. Es erfolgt keine automatische Migration; bitte Ergebnisse und gespeicherte Szenarien prüfen.';
const catalogSnapshotExplanation = 'Ältere Gruppen-Snapshots ersetzen den aktuellen Workspace-Katalog für die betroffene Gruppe. Spätere Änderungen sowie neue oder entfernte Tarifversionen werden nicht automatisch übernommen. Der Ausgangstarif stammt aus dem aktuellen Workspace-Katalog; eine gemeinsame aktuelle Tarifbasis für beide Szenarien ist nicht garantiert. Keine automatische Migration. Staffeln und Ergebnisse prüfen; Zurücksetzen verwirft die simulierten Staffeln und Preise.';
const overlayExplanation = 'Neue Sicherungen enthalten Tarifänderungen, Tarifanzeigefilter, Bestandsmodell, Basisjahr-Einstellung, Zulaufoption und Budget. In Altformaten können Einstellungen fehlen und werden durch Standardwerte ersetzt. Versionierte Tarif-Overlays sichern nur bearbeitete Tarifpositionen. Unveränderte Tarife und gemeinsame Kinder-, Buchungs-, Ereignis-, Förder-, Zuschuss- und Reformdaten sowie Stichtag und Forecast-Gruppenfilter stammen aus dem aktuellen Workspace. Ergebnisse sind keine historischen Sicherungen. Bei geänderten oder fehlenden Tarifversionen muss das Overlay geprüft und gegebenenfalls zurückgesetzt werden.';
function describeCatalogSnapshots(entries, groupLabels) {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return [];
  return Object.keys(entries).map((groupId) => groupLabels.get(String(groupId)) || String(groupId));
}

const isValidFundingValue = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
  && Number.isFinite(Number(value)) && Number(value) >= 0;
const formatAvailableEuro = (value) => isValidFundingValue(value) ? formatEuro(value) : 'Nicht verfügbar';
const workbookComparisonExplanation = 'Separates Modell des aktiven Arbeitsstands für 2026–2029, nicht der ausgewählten A/B-Szenarien: Förderung und gegebenenfalls überschriebener 2026-Zuschuss als Ausgangswert; ab 2027 entweder reduzierte Elternbeiträge oder zusätzliche Elternzahlung in Höhe des gesamten 2026-Zuschusses. Die Beträge enthalten keine sonstigen Elternbeiträge und sind keine tatsächlichen Einnahmen, keine kindbezogene Finanzrechnung oder Auszahlungszusagen. Tarifänderungen, monatlicher Bestand und das konfigurierte Zuschussende werden für diese pauschalen Varianten nicht neu simuliert. Basiswerte und Teamzuschusssätze folgen den Förderregeln und ihren Rückfallwerten; unterjährige Wechsel werden nicht aufgeteilt. Die Vorlage nimmt den Zuschusswegfall ab 2027 an; keine rechtliche Bestätigung. Fehlende Basis- oder Zuschussangaben und ungültige Teamzuschusssätze machen Werte nicht verfügbar.';
function formatWorkbookComparisonRow({ year, values }) {
  const change = (value) => year === 2026 ? '–' : value == null ? 'Nicht verfügbar' : formatSignedEuro(value);
  return [String(year), formatAvailableEuro(year === 2026 ? values?.baselineTotal : values?.reducedTotal),
    change(values?.reducedChange), formatAvailableEuro(year === 2026 ? values?.baselineTotal : values?.additionalTotal),
    change(values?.additionalChange)];
}
function describeTeamGrantRates(row) {
  if (!row.reformGrantApplied) return null;
  const formatRate = (key) => `${formatAvailableEuro(row.reformTeamRates?.[key])} (${row.reformTeamRateSources?.[key] || 'nicht verfügbar'})`;
  return `${row.year}: erste 50 Plätze ${formatRate('first50')}, weitere Plätze ${formatRate('remaining100')} je Platz/Jahr${row.reformTeamRatesValidForYear === false ? ' – Gültigkeit für das gesamte Jahr nicht nachgewiesen' : ''}`;
}
const validScenarioV2 = (data) => Object.hasOwn(data, 'tariffOverlay')
  && Object.hasOwn(data, 'temporaryCatalogEntries') && Object.hasOwn(data, 'temporaryPrices')
  && Array.isArray(data.selectedGroupIds) && typeof data.fixedBaseYearEnabled === 'boolean'
  && Number.isInteger(data.fixedBaseYear) && ['legacy', 'known', 'projected'].includes(data.stockMode)
  && typeof data.forecastInflowEnabled === 'boolean' && Object.hasOwn(data, 'potentialMonthlyBudget');
const describeScenarioFormat = (scenario) => scenario?.data?.schemaVersion == null ? 'Altformat'
  : scenario.data.schemaVersion === 2 ? (validScenarioV2(scenario.data) ? 'Overlay-Format v2' : 'Ungültiges Overlay-Format v2') : `Unbekanntes Format ${String(scenario.data.schemaVersion)}`;
const clonePlainData = (value) => JSON.parse(JSON.stringify(value));
const createLocalScenarioId = () => `simulation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const hasValidBirthDate = (item) => {
  const text = String(item?.dateofbirth || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
};
const createBaselineSimulationScenario = (year) => ({
  id: 'baseline',
  name: `Standard-Tarif ${year}`,
  data: {
    temporaryCatalogEntries: {},
    temporaryPrices: {},
    selectedGroupIds: [],
    fixedBaseYearEnabled: false,
    fixedBaseYear: year,
    stockMode: 'legacy',
    forecastInflowEnabled: false,
    potentialMonthlyBudget: 50,
  },
});

async function generateSimulationPdfReport({
  scenarioName,
  scenarioFormat,
  hasUnsavedScenarioChanges,
  referenceDate,
  groupFilterLabel,
  baseYearLabel,
  feeRows,
  annualRows,
  annualFundingDetailRows,
  familyYearGroups,
  potentialMonthlyBudget,
  missingTariffYears,
  potentialTariffYears,
  potentialBookingYears,
  subsidyExceedsTariffYears,
  activeLegacyPrices,
  comparisonLegacyPrices,
  activeCatalogSnapshots,
  comparisonCatalogSnapshots,
  scenarioComparison,
  workbookComparisonRows,
  forecastSummary,
  incompleteYears,
  unusableBookingYears,
  activeChildrenCoveragePartialYears,
  missingFundingRuleYears,
  missingBirthDateYears,
  reformBaselineIncompleteYears,
  reformYearUnavailableYears,
  missingManualFundingYears,
  invalidReformInputYears,
  teamGrantRateSummary,
  includeFamilyList,
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const bottomMargin = 12;
  let y = 14;

  const ensureSpace = (height) => {
    if (y + height > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (value, { size = 8, bold = false, color = [35, 45, 60], after = 2, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(value ?? ''), pageWidth - margin * 2 - indent);
    const lineHeight = size * 0.45;
    lines.forEach((line) => {
      if (y + lineHeight > pageHeight - bottomMargin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + indent, y + lineHeight);
      y += lineHeight;
    });
    y += after;
  };

  const drawTable = (headers, rows, widths, alignments = [], style = {}) => {
    const {
      fontSize = 7.2,
      headerFontSize = 7.2,
      padding = 1.4,
      lineHeight = 2.8,
      minRowHeight = 7,
    } = style;
    const drawRow = (cells, isHeader, repeatHeader = true) => {
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(isHeader ? headerFontSize : fontSize);
      const wrapped = cells.map((cell, index) => doc.splitTextToSize(String(cell ?? '–'), widths[index] - padding * 2));
      const rowHeight = Math.max(minRowHeight, Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + padding * 2);
      if (y + rowHeight > pageHeight - bottomMargin) {
        doc.addPage();
        y = margin;
        if (!isHeader && repeatHeader) drawRow(headers, true, false);
      }
      // A repeated header changes the document font; restore the row's own style.
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(isHeader ? headerFontSize : fontSize);
      let x = margin;
      widths.forEach((width, index) => {
        doc.setDrawColor(180, 190, 202);
        if (isHeader) doc.setFillColor(232, 238, 245);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, y, width, rowHeight, 'FD');
        doc.setTextColor(30, 41, 59);
        const alignment = alignments[index] || 'left';
        const textX = alignment === 'right' ? x + width - padding : x + padding;
        doc.text(wrapped[index], textX, y + padding + 2.3, {
          align: alignment,
          lineHeightFactor: lineHeight / ((isHeader ? headerFontSize : fontSize) * 25.4 / 72),
        });
        x += width;
      });
      y += rowHeight;
    };

    // Keep a table header with at least the beginning of its data.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(headerFontSize);
    const headerLines = Math.max(...headers.map((cell, index) => doc.splitTextToSize(String(cell ?? '–'), widths[index] - padding * 2).length));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const firstRowLines = rows.length ? Math.max(...rows[0].map((cell, index) => doc.splitTextToSize(String(cell ?? '–'), widths[index] - padding * 2).length)) : 0;
    const firstRowHeight = rows.length ? Math.max(minRowHeight, firstRowLines * lineHeight + padding * 2) : 0;
    ensureSpace(Math.max(minRowHeight, headerLines * lineHeight + padding * 2) + firstRowHeight);
    drawRow(headers, true);
    rows.forEach((row) => drawRow(row, false));
    y += 4;
  };

  const drawFeeColumnChart = (rows) => {
    if (rows.length === 0) {
      writeText('Für den aktuellen Gruppenfilter sind keine Tarifstaffeln vorhanden.', { size: 8, after: 4 });
      return;
    }

    const axisWidth = 12;
    const plotX = margin + axisWidth;
    const plotWidth = pageWidth - margin * 2 - axisWidth;
    const plotHeight = 25;

    let plotTop;
    let plotBottom;
    const slotWidth = plotWidth / rows.length;
    const barWidth = Math.min(11, slotWidth * 0.42);
    const scaleMaximum = Math.max(50, Math.ceil(Math.max(...rows.flatMap((row) => [row.baselineAmount, row.simulatedAmount])) / 50) * 50);
    const groupNames = Array.from(new Set(rows.map((row) => row.groupName)));
    const subsidies = Array.from(new Set(rows.map((row) => {
      const subsidy = row.subsidy || {};
      return subsidy.enabled === false
        ? `${row.groupName}: Zuschuss inaktiv`
        : `${row.groupName}: Zuschuss ${formatEuro(subsidy.monthlyAmount)} / Kind / Monat bis ${formatBookingDate(subsidy.endDate, 'unbegrenzt')}`;
    })));

    writeText('Graue Markierung = alter Beitrag · blaue Säule = neuer Beitrag · Rot/Grün = Änderung', { size: 7, color: [90, 100, 115], after: 0.5 });
    writeText(`Elternbeitragszuschuss: ${subsidies.join(' · ')}`, { size: 7, color: [90, 100, 115], after: 1 });
    plotTop = y + 3;
    plotBottom = plotTop + plotHeight;
    doc.setDrawColor(205, 213, 223);
    doc.setLineWidth(0.35);
    [0, 0.5, 1].forEach((fraction) => {
      const gridY = plotBottom - plotHeight * fraction;
      doc.line(plotX, gridY, plotX + plotWidth, gridY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 110, 125);
      doc.text(`${Math.round(scaleMaximum * fraction).toLocaleString('de-DE')} €`, margin + axisWidth - 1.5, gridY + 1.5, { align: 'right' });
    });

    const categoryFontSize = 6.5;
    const detailFontSize = 6.5;
    rows.forEach((row, index) => {
      const slotLeft = plotX + index * slotWidth;
      const centerX = slotLeft + slotWidth / 2;
      const barX = centerX - barWidth / 2;
      const baselineY = plotBottom - Math.max(0, Math.min(1, row.baselineAmount / scaleMaximum)) * plotHeight;
      const simulatedY = plotBottom - Math.max(0, Math.min(1, row.simulatedAmount / scaleMaximum)) * plotHeight;
      const changed = row.delta != null && Math.abs(row.delta) >= 0.005;
      const increase = row.delta > 0;
      const changeColor = increase ? [190, 55, 55] : [20, 130, 95];
      const changeFill = increase ? [225, 103, 98] : [73, 170, 129];

      if (row.simulatedActive && simulatedY < plotBottom) {
        doc.setFillColor(52, 120, 205);
        doc.rect(barX, simulatedY, barWidth, plotBottom - simulatedY, 'F');
      }
      if (changed) {
        doc.setFillColor(...changeFill);
        doc.rect(barX, Math.min(baselineY, simulatedY), barWidth, Math.max(0.8, Math.abs(baselineY - simulatedY)), 'F');
      }
      if (row.baselineAmount != null) {
        doc.setDrawColor(90, 100, 115);
        doc.setLineWidth(0.6);
        doc.line(centerX - Math.min(8, slotWidth * 0.32), baselineY, centerX + Math.min(8, slotWidth * 0.32), baselineY);
      }
      if (changed) {
        doc.setDrawColor(...changeColor);
        doc.setLineWidth(0.5);
        doc.rect(barX, simulatedY, barWidth, Math.max(0.8, plotBottom - simulatedY), 'S');
      } else if (row.simulatedActive) {
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.45);
        doc.rect(barX, simulatedY, barWidth, plotBottom - simulatedY, 'S');
      }

      const zoneLabel = rows.length > 12
        ? `${row.category.match(/ZEITKAT\s+(\d+)/)?.[1] || row.category} · G${groupNames.indexOf(row.groupName) + 1}`
        : row.category.replace(/^ZEITKAT\s+/, '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(categoryFontSize);
      const labelLines = doc.splitTextToSize(zoneLabel, Math.max(5, slotWidth - 1));
      const textLineHeight = Math.max(2.1, categoryFontSize * 0.42);
      let textY = plotBottom + 2;
      doc.setTextColor(35, 45, 60);
      doc.text(labelLines, centerX, textY + textLineHeight, { align: 'center' });
      textY += labelLines.length * textLineHeight + 0.3;
      doc.setFontSize(detailFontSize);
      const oldLabel = row.baselineAmount != null ? formatEuro(row.baselineAmount) : '–';
      const newLabel = row.simulatedAmount != null ? formatEuro(row.simulatedAmount) : '–';
      const euroPerHour = row.simulatedAmount != null && row.hours > 0 ? `${formatEuro(row.simulatedAmount / row.hours)}/h` : '–';
      doc.setTextColor(100, 110, 125);
      doc.text(`Alt ${oldLabel}`, centerX, textY + textLineHeight, { align: 'center' });
      textY += textLineHeight;
      doc.setTextColor(35, 45, 60);
      doc.text(`Neu ${newLabel}`, centerX, textY + textLineHeight, { align: 'center' });
      textY += textLineHeight;
      if (changed) doc.setTextColor(...changeColor);
      else doc.setTextColor(100, 110, 125);
      doc.text(euroPerHour, centerX, textY + textLineHeight, { align: 'center' });
    });

    const labelLineHeight = Math.max(2.1, categoryFontSize * 0.42);
    const longestLabelLines = Math.max(...rows.map((row) => {
      const label = rows.length > 12
        ? `${row.category.match(/ZEITKAT\s+(\d+)/)?.[1] || row.category} · G${groupNames.indexOf(row.groupName) + 1}`
        : row.category.replace(/^ZEITKAT\s+/, '');
      return doc.splitTextToSize(label, Math.max(5, slotWidth - 1)).length;
    }));
    y = plotBottom + 2 + longestLabelLines * labelLineHeight + 3 * labelLineHeight + 2;
  };

  doc.setProperties({
    title: `Beitragsänderungssimulation – ${scenarioName}`,
    subject: 'Jahresergebnisse und Familien-Impact',
    creator: 'CapaKita',
  });
  writeText('Beitragsänderungssimulation', { size: 17, bold: true, after: 1 });
  writeText(`Szenario: ${scenarioName} – aktiver Arbeitsstand${hasUnsavedScenarioChanges ? ' (ungesicherte Szenarioänderungen)' : ' (Szenario-Einstellungen gesichert)'}`, { size: 10, bold: true, after: 1 });
  writeText(`Szenarioformat: ${scenarioFormat}. ${overlayExplanation}`, { size: 8, after: 1 });
  writeText(`Stichtag: ${referenceDate}   ·   Tarif-Anzeige: ${groupFilterLabel}   ·   ${baseYearLabel}`, { size: 8, after: 5 });

  writeText('Modellannahme: Der konfigurierte Zuschuss wird vollständig als Einnahme angesetzt, auch wenn er den Tarif übersteigt. Tatsächliche Auszahlung und Abrechnung sind gesondert zu prüfen.', { size: 8, after: 2 });
  writeText(includeFamilyList ? 'Vertraulich: Dieses PDF enthält Familienbezeichnungen und individuelle Beitragsänderungen. Weitergabe und Schutz prüfen.' : 'Datensparsame Ausgabe ohne Familienliste; Gruppen- und Szenarionamen sowie Gesamtsummen bleiben enthalten und können Rückschlüsse erlauben.', { size: 8, after: 2 });
  if (activeLegacyPrices.length) writeText(`Warnung – aktive Simulation: ${legacyCategoryPriceExplanation} Betroffen: ${activeLegacyPrices.join('; ')}.`, { size: 8, bold: true, after: 2 });
  if (comparisonLegacyPrices.length) writeText(`Warnung – gespeicherter Szenariovergleich: ${legacyCategoryPriceExplanation} Betroffen: ${comparisonLegacyPrices.join('; ')}.`, { size: 8, bold: true, after: 2 });
  if (activeCatalogSnapshots.length) writeText(`Warnung – Tarif-Snapshot im aktiven Arbeitsstand: ${catalogSnapshotExplanation} Betroffene Gruppen: ${activeCatalogSnapshots.join(', ')}.`, { size: 8, bold: true, after: 2 });
  if (comparisonCatalogSnapshots.length) writeText(`Warnung – Tarif-Snapshots im Szenariovergleich: ${catalogSnapshotExplanation} Betroffen: ${comparisonCatalogSnapshots.join('; ')}.`, { size: 8, bold: true, after: 2 });
  if (incompleteYears.length) writeText(`Unvollständige Jahreswerte (mit * markiert): ${incompleteYears.join(', ')}. Angezeigte Beträge und Potenziale sind Modell-/Teilwerte, keine vollständigen Jahresergebnisse.`, { size: 8, bold: true, after: 2 });
  if (unusableBookingYears.length) writeText(`Kinder ohne Basisbuchung oder auswertbare Buchungszeiten (Kind-Monate): ${unusableBookingYears.join(', ')}. Diese Fälle können auch in der Tarifdiagnose enthalten sein.`, { size: 8, bold: true, after: 2 });
  if (activeChildrenCoveragePartialYears.length) writeText(`Erfassung aktiver Kinder bzw. Diagnosen unvollständig (Monate): ${activeChildrenCoveragePartialYears.join(', ')}.`, { size: 8, bold: true, after: 2 });
  if (missingFundingRuleYears.length) writeText(`Keine gültige Förderregel mit positivem Basiswert (Monate): ${missingFundingRuleYears.join(', ')}.`, { size: 8, bold: true, after: 2 });
  if (missingBirthDateYears.length) writeText(`Normalisiertes Geburtsdatum fehlt oder ist ungültig (Kind-Monate): ${missingBirthDateYears.join(', ')}; Altersgewichtung und Zuschussberechtigung sind nicht gesichert.`, { size: 8, bold: true, after: 2 });
  if (reformBaselineIncompleteYears.length) writeText(`Reformbasis 2026 unvollständig oder nicht verfügbar: ${reformBaselineIncompleteYears.join(', ')}.`, { size: 8, bold: true, after: 2 });
  if (reformYearUnavailableYears.length) writeText(`Kein Reformmodell für diese Jahre verfügbar: ${reformYearUnavailableYears.join(', ')}.`, { size: 8, bold: true, after: 2 });
  if (missingManualFundingYears.length) writeText(`Manuelle Förderangaben fehlen oder sind ungültig: ${missingManualFundingYears.join('; ')}. Fehlende Eingaben fließen nur als Ersatz-Null in die markierten Teilwerte ein.`, { size: 8, bold: true, after: 2 });
  if (invalidReformInputYears.length) writeText(`Reformeingaben fehlen oder sind ungültig: ${invalidReformInputYears.join('; ')}. Bei ungültigen Teamzuschuss-Eingaben wird die vorreformierte Förderung als Teilwert angezeigt.`, { size: 8, bold: true, after: 2 });
  if (teamGrantRateSummary.length) {
    writeText('Teamzuschuss-Sätze zum 1. Januar: Gültige Regelwerte haben Vorrang; fehlende Einzelwerte verwenden die ADEBIS-Jahresvorgaben 2026–2029. Unterjährige Wechsel werden nicht aufgeteilt. Modellannahmen, keine rechtliche Bestätigung.', { size: 8, after: 1 });
    teamGrantRateSummary.forEach((line) => writeText(line, { size: 7, after: 1 }));
  }
  writeText('Monatswerte, Monats- und Familienaufschlüsselungen sowie Potenziale sind vor der Reform berechnet; die Reformkorrektur erfolgt nur auf Jahresebene. Monatssummen entsprechen daher nicht zwingend dem Jahresförderanspruch.', { size: 8, after: 2 });
  if (forecastSummary) forecastSummary.forEach((line) => writeText(line, { size: 8, after: 1 }));
  if (missingTariffYears.length) writeText(`Unvollständige Beitragsberechnung (Kind-Monate): ${missingTariffYears.join(', ')}. Betroffene Beiträge fehlen; Elternbeiträge und Einnahmen sind Teilsummen. Auch wegen Abwesenheit herausgefilterte Buchungen werden als Lücke gemeldet.`, { size: 8, bold: true, after: 2 });
  if (potentialTariffYears.length) writeText(`Potenziale unvollständig: fehlende Ausgangs- oder Nachbartarife (Kind/Kategorie/Monat): ${potentialTariffYears.join(', ')}.`, { size: 8, bold: true, after: 2 });
  if (potentialBookingYears.length) writeText(`Potenziale unvollständig: Buchungszeiten oder Zeitsegmente fehlen (Buchung/Richtung/Monat): ${potentialBookingYears.join(', ')}. BETRSTD allein erlaubt keinen berechenbaren Wechsel.`, { size: 8, bold: true, after: 2 });
  if (subsidyExceedsTariffYears.length) writeText(`Zuschuss höher als Tarif (Kind-Monate): ${subsidyExceedsTariffYears.join(', ')}. Tatsächliche Auszahlung ungeklärt.`, { size: 8, bold: true, after: 2 });
  ensureSpace(30);
  writeText('Jahresergebnisse', { size: 11, bold: true, after: 2 });
  drawTable(
    ['Jahr', 'Zusatzförderung', 'Buchungsstunden / Tag (Ø)', 'Förderanspruch', 'Elternbeiträge', 'Einnahmen', `Upgrade-Potenzial\nBudget ${formatEuro(potentialMonthlyBudget)} / Familie / Monat`, `Downgrade-Potenzial\nBudget ${formatEuro(potentialMonthlyBudget)} / Familie / Monat`],
    annualRows,
    [14, 27, 35, 35, 34, 34, 49, 49],
    ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right']
  );
  writeText(`Potenziale werden für jeden Monatsbestand des jeweiligen Jahres separat berechnet; Stunden sind der Durchschnitt über zwölf Monate (Wochenstunden geteilt durch fünf), Geldbeträge die Summe der Monatsänderungen. Indikativ, ohne Kapazitäts- oder Verhaltensprognose; enthalten sind Förderungs- und Elternbeitragsänderungen. Budget je Familie und Monat: ${formatEuro(potentialMonthlyBudget)}. Vorjahresvergleich: angezeigtes Szenario; Simulation: Vergleich zum Basistarif im selben Jahr.`, { size: 7, color: [90, 100, 115], after: 3 });
  if (workbookComparisonRows) {
    ensureSpace(70);
    writeText('Indikativer Jahresvergleich nach Excel-Vorlage', { size: 11, bold: true, after: 2 });
    writeText(workbookComparisonExplanation, { size: 8, after: 2 });
    drawTable(['Jahr', 'Reduzierte Beiträge: Gesamt', 'Änderung zum Vorjahr', 'Zusätzliche Elternzahlung: Gesamt', 'Änderung zum Vorjahr'],
      workbookComparisonRows, [17, 67, 47, 90, 56], ['left', 'right', 'right', 'right', 'right']);
  }
  if (scenarioComparison) ensureSpace(35);
  if (scenarioComparison?.unavailable) {
    writeText(`Vergleich gespeicherter Szenarien: A: ${scenarioComparison.leftName} (${scenarioComparison.leftFormat}) · B: ${scenarioComparison.rightName} (${scenarioComparison.rightFormat}). Einstellungen fehlen, sind ungültig oder ein Tarif-Overlay ist nicht anwendbar; ein Vergleich ist nicht möglich. ${overlayExplanation}`, { size: 9, bold: true, after: 2 });
  } else if (scenarioComparison) {
    writeText('Vergleich gespeicherter Szenarien – Jahresergebnisse', { size: 11, bold: true, after: 2 });
    writeText(`A: ${scenarioComparison.leftName} (${scenarioComparison.leftBase}) · B: ${scenarioComparison.rightName} (${scenarioComparison.rightBase}). Beide werden mit aktuellen gemeinsamen Kinder-, Buchungs-, Ereignis-, Zuschuss-, Förder- und Reformdaten neu berechnet; historische gemeinsame Daten sind nicht gesichert. Versionierte Overlays ändern nur gespeicherte Tarifpositionen; alte Gruppen-Snapshots ersetzen die jeweiligen Gruppenstaffeln. Unvollständige Jahre: kein Vergleichswert. Vollständigkeit bezieht sich auf erkannte Datenlücken, nicht auf rechtliche oder fachliche Prüfung. Der nominale Zuschuss ist bereits in der Förderung enthalten; die tatsächliche Auszahlung ist nicht zugesichert. Fehlende oder ungültige manuelle Förderwerte sowie geschätzter Zulauf machen den Vergleichswert nicht verfügbar. ${scenarioComparison.sharedAssumptions}${scenarioComparison.subsidyExceedsTariff ? ' Zuschüsse über Tarif: tatsächliche Auszahlung ungeklärt.' : ''}`, { size: 8, after: 2 });
    if (scenarioComparison.teamGrantRateSummary.length) {
      writeText('Teamzuschuss-Sätze zum 1. Januar: gültige Förderregel oder ADEBIS-Jahresvorgabe; unterjährige Wechsel sind nicht aufgeteilt. Modellannahmen, rechtlich zu prüfen.', { size: 7, after: 1 });
      scenarioComparison.teamGrantRateSummary.forEach((line) => writeText(line, { size: 7, after: 1 }));
    }
    if (!scenarioComparison.rows.length) writeText('Keine Förderjahre für einen Vergleich verfügbar.', { size: 8, after: 1 });
    drawTable(['Jahr', 'Jahreswert', 'A', 'B', 'B minus A'], scenarioComparison.rows.flatMap((row) => SAVED_SCENARIO_FINANCIAL_FIELDS.map(({ key, label }) => {
      const value = row.values[key];
      return [row.year, label, value.baseline == null ? 'Nicht verfügbar' : formatEuro(value.baseline),
        value.scenario == null ? 'Nicht verfügbar' : formatEuro(value.scenario),
        value.delta == null ? 'Nicht verfügbar' : formatSignedEuro(value.delta)];
    })), [20, 74, 61, 61, 61], ['left', 'left', 'right', 'right', 'right']);
    scenarioComparison.rows.forEach((row) => {
      if (!row.leftComplete || !row.rightComplete) writeText(`${row.year}: ${[!row.leftComplete ? `A: ${row.leftReasons.join(', ')}` : '', !row.rightComplete ? `B: ${row.rightReasons.join(', ')}` : ''].filter(Boolean).join(' · ')}`, { size: 7, after: 1 });
    });
  }
  if (!feeRows.length) drawFeeColumnChart([]);
  Array.from(new Set(feeRows.map((row) => row.groupName))).forEach((groupName) => {
    const groupRows = feeRows.filter((row) => row.groupName === groupName);
    for (let index = 0; index < groupRows.length; index += 6) {
      // Keep the heading, legend and chart together, including wrapped group names.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const headingLines = doc.splitTextToSize(`Tarife: ${groupName}`, pageWidth - margin * 2).length;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const subsidy = groupRows[index].subsidy || {};
      const subsidyLabel = subsidy.enabled === false
        ? `${groupName}: Zuschuss inaktiv`
        : `${groupName}: Zuschuss ${formatEuro(subsidy.monthlyAmount)} / Kind / Monat bis ${formatBookingDate(subsidy.endDate, 'unbegrenzt')}`;
      const subsidyLines = doc.splitTextToSize(`Elternbeitragszuschuss: ${subsidyLabel}`, pageWidth - margin * 2).length;
      ensureSpace(headingLines * 4.05 + subsidyLines * 3.15 + 60);
      writeText(`Tarife: ${groupName}`, { size: 9, bold: true, after: 1 });
      drawFeeColumnChart(groupRows.slice(index, index + 6));
    }
  });

  ensureSpace(30);
  writeText('Zusatzförderung – Jahreswerte nach Förderart', { size: 10, bold: true, after: 2 });
  writeText('U3-Zusatzförderung: U3-Kind-Monate × Basiswert × 2,5 %. Der reguläre U3-Gewichtungsfaktor ist darin nicht enthalten.', { size: 7, after: 2 });
  drawTable(
    ['Jahr', 'U3-Kind-Monate', 'ZusF. U3', 'U3-Bund', 'Personalbonus', 'Assistenz', 'Sprache', 'Team brutto', 'Bisherig', 'Änderung netto'],
    annualFundingDetailRows,
    [16, 23, 25, 27, 25, 25, 24, 31, 31, 31],
    ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right']
  );

  if (!includeFamilyList) {
    writeText('Familienliste aus Datenschutzgründen nicht enthalten.', { size: 8, after: 2 });
  } else {
  ensureSpace(30);
  writeText('Betroffene Familien nach Jahr', { size: 11, bold: true, after: 2 });
  if (familyYearGroups.length) {
    writeText('Die Jahreszeilen aus dem Web-Drilldown sind im PDF je Jahr aufgeklappt dargestellt.', { size: 7, color: [90, 100, 115], after: 2 });
    familyYearGroups.forEach(({ year, families }) => {
      ensureSpace(24);
      writeText(`${year} · ${families.length} betroffene Familien`, { size: 9, bold: true, after: 1 });
      const familyRows = families.map((family) => [
        year,
        family.label,
        formatEuro(family.averageMonthlyParentFeesBefore),
        formatEuro(family.averageMonthlyParentFeesAfter),
        formatSignedEuro(family.averageMonthlyDelta),
        family.averageMonthlyYearOverYearDelta == null ? '–' : formatSignedEuro(family.averageMonthlyYearOverYearDelta),
        family.yearOverYearAnnualDelta == null ? '–' : formatSignedEuro(family.yearOverYearAnnualDelta),
      ]);
      drawTable(
        ['Jahr', 'Familie', 'Beitrag alt Ø/Mo.', 'Beitrag neu Ø/Mo.', 'Simulation Ø/Mo.', 'Vorjahr Ø/Mo.', 'Vorjahr/Jahr'],
        familyRows,
        [18, 43, 43, 43, 43, 43, 44],
        ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
        { fontSize: 7, headerFontSize: 7, padding: 1, lineHeight: 3, minRowHeight: 6 }
      );
    });
  } else {
    writeText(incompleteYears.length ? 'Keine vollständigen Familienvergleiche enthalten; unvollständige Jahre sind ausgeschlossen.' : 'In den Jahresvergleichen sind keine Familien mit Beitragsänderungen enthalten.', { size: 8, after: 2 });
  }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 110, 125);
    doc.text(`Seite ${page}/${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }
  const fileBase = scenarioName.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß-]+/g, '-').replace(/^-+|-+$/g, '') || 'Szenario';
  doc.save(`Capakita-Beitragssimulation-${fileBase}.pdf`);
}

function formatBookingDate(value, fallback) {
  const dateText = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return fallback;
  const [year, month, day] = dateText.split('-').map(Number);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function getBookingValidityLabels(bookings, year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const labels = new Set();
  Object.values(bookings || {}).forEach((booking) => {
    const bookingType = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
    if (bookingType?.basis === false) return;
    const startdate = String(booking?.startdate || '').slice(0, 10);
    const enddate = String(booking?.enddate || '').slice(0, 10);
    if ((startdate && startdate > yearEnd) || (enddate && enddate < yearStart)) return;
    const zeitkatId = String(booking?.rawdata?.ZEITKAT || '').trim();
    const zeitkat = zeitkatId ? formatZeitkatList([zeitkatId]) : 'ZEITKAT fehlt';
    labels.add(`${zeitkat}: ${formatBookingDate(startdate, 'sofort')} – ${formatBookingDate(enddate, 'unbegrenzt')}`);
  });
  return Array.from(labels).sort((left, right) => left.localeCompare(right, 'de'));
}



function AnnualFundingInput({ label, value, onCommit, testId, disabled = false }) {
  const [draft, setDraft] = React.useState(value ?? '');
  React.useEffect(() => setDraft(value ?? ''), [value]);

  return (
    <NumberInput
      aria-label={label}
      value={draft}
      onChange={setDraft}
      onBlur={() => onCommit(draft === '' ? '' : Number(draft))}
      disabled={disabled}
      min={0}
      decimalScale={2}
      thousandSeparator="."
      decimalSeparator=","
      suffix=" €"
      size="xs"
      w={118}
      data-testid={testId}
    />
  );
}

function AnnualMetricCell({
  value,
  change,
  simulationChange,
  formatValue,
  formatChange,
  changeLabel = 'zum Vorjahr',
  simulationChangeLabel = 'Simulation',
}) {
  const getChangeColor = (amount) => amount == null || Math.abs(amount) < 0.005
    ? 'dimmed'
    : amount > 0 ? 'teal.7' : 'red.7';
  return (
    <Stack gap={0} align="flex-end" style={{ minWidth: 0 }}>
      <Text style={{ whiteSpace: 'nowrap' }}>{formatValue(value)}</Text>
      {change == null ? null : (
        <Text
          size="xs"
          c={getChangeColor(change)}
          ta="right"
          style={{ maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }}
        >
          {formatChange(change)} {changeLabel}
        </Text>
      )}
      {simulationChange == null ? null : (
        <Text
          size="xs"
          c={getChangeColor(simulationChange)}
          ta="right"
          style={{ maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }}
        >
          {formatChange(simulationChange)} {simulationChangeLabel}
        </Text>
      )}
    </Stack>
  );
}

function AnnualPotentialCell({ dailyHours, fundingChange, parentFeeChange = 0, direction, testId }) {
  if (!(dailyHours > 0)) return <Text c="dimmed" ta="right" data-testid={testId}>–</Text>;
  const totalIncomeChange = fundingChange + parentFeeChange;
  const incomeColor = Math.abs(totalIncomeChange) < 0.005
    ? 'dimmed'
    : totalIncomeChange > 0 ? 'teal.7' : 'red.7';
  return (
    <Stack gap={0} align="flex-end" style={{ minWidth: 0 }} data-testid={testId}>
      <Text style={{ whiteSpace: 'nowrap' }}>{direction === 'upgrade' ? '+' : '−'}{formatDailyHours(dailyHours)}</Text>
      <Text
        size="xs"
        c={incomeColor}
        ta="right"
        title={`Förderung ${formatSignedEuro(fundingChange)} / Jahr · Elternbeiträge ${formatSignedEuro(parentFeeChange)} / Jahr`}
        style={{ maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }}
      >
        {formatSignedEuro(totalIncomeChange)} Einnahmen/Jahr
      </Text>
    </Stack>
  );
}

function getConfiguredFundingYears(rules, currentYear) {
  const years = new Set();
  (rules || []).forEach((rule) => {
    if (!(Number(rule?.baseValue) > 0)) return;
    const startYear = /^\d{4}/.test(String(rule.validFrom || ''))
      ? Number(String(rule.validFrom).slice(0, 4))
      : currentYear;
    const endYear = /^\d{4}/.test(String(rule.validUntil || ''))
      ? Number(String(rule.validUntil).slice(0, 4))
      : startYear;
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < currentYear) return;
    for (let year = Math.max(currentYear, startYear); year <= endYear; year += 1) years.add(year);
  });
  return Array.from(years).sort((left, right) => left - right);
}


function getSimulationDemandForDate({ scenarioId, referenceDate, selectedGroupIds, simulationData }) {
  const normalizedScenarioId = String(scenarioId);
  const filtered = filterBookings({
    bookingsByScenario: { [normalizedScenarioId]: simulationData.bookingsByItem },
    dataByScenario: { [normalizedScenarioId]: simulationData.dataItems },
    qualificationAssignmentsByScenario: { [normalizedScenarioId]: simulationData.qualificationAssignmentsByItem },
    overlaysByScenario: {},
    scenarioId: normalizedScenarioId,
    referenceDate,
    selectedGroups: selectedGroupIds,
    selectedQualifications: [],
    groupsByScenario: { [normalizedScenarioId]: simulationData.groupAssignmentsByItem },
    includeTimelessFeeBookings: true,
  });
  const bookingsByItem = {};
  filtered.demand.forEach((booking) => {
    const itemId = String(booking.itemId);
    if (!bookingsByItem[itemId]) bookingsByItem[itemId] = {};
    bookingsByItem[itemId][String(booking.id)] = booking;
  });
  const selectedItemIds = new Set(Object.keys(bookingsByItem));
  const activeChildren = Object.entries(simulationData.dataItems || {}).flatMap(([itemId, item]) => {
    if (item?.type !== 'demand' || !shouldIncludeDataItemInAnalysis(item) || !isRecordActiveOnDate(item, referenceDate)) {
      return [];
    }
    const activeBasisBookings = Object.values(simulationData.bookingsByItem?.[itemId] || {}).filter((booking) => {
      const bookingType = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
      return bookingType?.basis !== false
        && (!booking?.startdate || booking.startdate <= referenceDate)
        && (!booking?.enddate || booking.enddate >= referenceDate);
    });
    const latestBooking = activeBasisBookings.slice().sort((left, right) => (
      String(right?.startdate || '').localeCompare(String(left?.startdate || ''))
    ))[0];
    const groupId = resolveGroupIdAtDate(
      simulationData.groupAssignmentsByItem?.[itemId] || {},
      referenceDate,
      latestBooking?.groupId || item.groupId || null
    );
    if (selectedGroupIds.length && !selectedGroupIds.includes(String(groupId || '__NO_GROUP__'))) return [];
    const groupHasSchoolChildBooking = activeBasisBookings.some(
      (booking) => isAdebisTrue(booking?.rawdata?.SCHULKIND)
    );
    return [{
      itemId,
      item,
      groupId: String(groupId || ''),
      bookings: activeBasisBookings,
      isSchoolChild: groupHasSchoolChildBooking,
    }];
  });
  return {
    demand: filtered.demand,
    effectiveDataItems: Object.fromEntries(Object.entries(simulationData.dataItems || {}).filter(([itemId]) => selectedItemIds.has(itemId))),
    effectiveBookingsByItem: bookingsByItem,
    effectiveGroupAssignmentsByItem: simulationData.groupAssignmentsByItem,
    activeChildren,
    parentFeeSubsidyChildren: activeChildren.filter((child) => child.bookings.length > 0),
  };
}

// The forecast adapter deliberately excludes unknown hours. Recover only fee inputs
// for which every other forecast and tariff check succeeded; keep its gap intact.
function includeForecastTimelessFeeBookings(forecast, simulationData) {
  forecast.diagnostics.gaps.forEach((gap) => {
    if (gap.itemId == null || gap.reasons.length !== 1 || gap.reasons[0] !== 'missing-booking-hours') return;
    const itemId = String(gap.itemId);
    const item = simulationData.dataItems[itemId];
    const activeBookings = Object.entries(simulationData.bookingsByItem[itemId] || {}).filter(([, booking]) => {
      const type = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
      return type?.basis !== false && isRecordActiveOnDate(booking, forecast.monthDate);
    });
    if (activeBookings.length !== 1) return;
    const [bookingId, booking] = activeBookings[0];
    if (getZeitkatZoneIndex(String(booking?.rawdata?.ZEITKAT || '').trim()) < 0) return;
    const financeBooking = { ...booking, itemId, groupId: gap.groupId };
    forecast.demand.push(financeBooking);
    forecast.effectiveDataItems[itemId] = item;
    forecast.effectiveBookingsByItem[itemId] = { [bookingId]: financeBooking };
    forecast.effectiveGroupAssignmentsByItem[itemId] = simulationData.groupAssignmentsByItem[itemId] || {};
    forecast.parentFeeSubsidyChildren.push({ itemId, item, groupId: gap.groupId, bookings: [financeBooking], isSchoolChild: isAdebisTrue(booking.rawdata?.SCHULKIND) });
  });
  return forecast;
}

function effectiveCatalogsForSimulation(catalogs, prices) {
  return Object.fromEntries(Object.entries(catalogs).map(([groupId, entries]) => [groupId, entries.map((entry) => {
    const override = getFeeBandSimulationPriceOverride(entry, prices?.[groupId]);
    return override !== undefined ? { ...entry, monthlyAmount: Number(override) } : entry;
  })]));
}

function savedScenarioCalculationOptions(scenario, groupFeeCatalogs, currentYear) {
  const data = scenario?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.schemaVersion === 2 && !validScenarioV2(data)) return null;
  if (data.fixedBaseYearEnabled != null && typeof data.fixedBaseYearEnabled !== 'boolean') return null;
  if (data.forecastInflowEnabled != null && typeof data.forecastInflowEnabled !== 'boolean') return null;
  const fixedBaseYearEnabled = data.fixedBaseYearEnabled === true;
  const fixedBaseYear = fixedBaseYearEnabled ? Number(data.fixedBaseYear) : currentYear;
  if (!Number.isInteger(fixedBaseYear) || fixedBaseYear < 1 || fixedBaseYear > 9999) return null;
  if (data.stockMode != null && !['legacy', 'known', 'projected'].includes(data.stockMode)) return null;
  if (data.temporaryCatalogEntries != null && (typeof data.temporaryCatalogEntries !== 'object' || Array.isArray(data.temporaryCatalogEntries))) return null;
  if (data.temporaryPrices != null && (typeof data.temporaryPrices !== 'object' || Array.isArray(data.temporaryPrices))) return null;
  if (data.schemaVersion != null && data.schemaVersion !== 2) return null;
  const resolved = applyTariffOverlay({ ...groupFeeCatalogs, ...(data.temporaryCatalogEntries || {}) }, data.tariffOverlay);
  if (resolved.conflicts.length) return null;
  const simulationCatalogs = resolved.catalogs;
  if (Object.values(simulationCatalogs).some((entries) => !Array.isArray(entries) || entries.some((entry) => !entry || typeof entry !== 'object'))) return null;
  const temporaryPrices = data.temporaryPrices || {};
  if (Object.values(temporaryPrices).some((prices) => !prices || typeof prices !== 'object' || Array.isArray(prices)
    || Object.values(prices).some((value) => !(typeof value === 'number' || (typeof value === 'string' && value.trim())) || !Number.isFinite(Number(value)) || Number(value) < 0))) return null;
  if (data.potentialMonthlyBudget != null && !(typeof data.potentialMonthlyBudget === 'number' || (typeof data.potentialMonthlyBudget === 'string' && data.potentialMonthlyBudget.trim()))) return null;
  const budget = data.potentialMonthlyBudget == null ? 50 : Number(data.potentialMonthlyBudget);
  if (!Number.isFinite(budget) || budget < 0 || budget > 500) return null;
  const stockMode = data.stockMode || 'legacy';
  return {
    fixedBaseYearEnabled, fixedBaseYear, stockMode,
    forecastInflowEnabled: data.forecastInflowEnabled === true,
    simulationCatalogs, temporaryPrices, potentialMonthlyBudget: budget,
    effectiveFeeCatalogs: effectiveCatalogsForSimulation(simulationCatalogs, temporaryPrices),
    baseLabel: fixedBaseYearEnabled ? `Basisjahr ${fixedBaseYear} fixiert` : STOCK_MODE_LABELS[stockMode],
  };
}

function rebaseSimulationDemandToMonth(demandData, targetDate, baseReferenceDate) {
  // Keep the selected base-year cohort and its group assignments active in each target month.
  const [year, month] = String(targetDate).slice(0, 7).split('-').map(Number);
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const rebaseRecord = (record) => ({ ...record, startdate: targetDate, enddate: monthEnd });
  const effectiveDataItems = Object.fromEntries(Object.entries(demandData.effectiveDataItems || {}).map(([itemId, item]) => [
    itemId,
    rebaseRecord(item),
  ]));
  const effectiveBookingsByItem = Object.fromEntries(Object.entries(demandData.effectiveBookingsByItem || {}).map(([itemId, bookings]) => [
    itemId,
    Object.fromEntries(Object.entries(bookings || {}).map(([bookingId, booking]) => [bookingId, rebaseRecord(booking)])),
  ]));
  const effectiveGroupAssignmentsByItem = Object.fromEntries(
    Object.entries(demandData.effectiveGroupAssignmentsByItem || {}).map(([itemId, assignments]) => {
      const activeAssignment = Object.entries(assignments || {})
        .filter(([, assignment]) => (!assignment.start || assignment.start <= baseReferenceDate)
          && (!assignment.end || assignment.end >= baseReferenceDate))
        .sort(([, left], [, right]) => String(right.start || '').localeCompare(String(left.start || '')))[0];
      if (!activeAssignment) return [itemId, {}];
      const [assignmentId, assignment] = activeAssignment;
      return [itemId, {
        [assignmentId]: { ...assignment, start: targetDate, end: monthEnd },
      }];
    })
  );

  return {
    ...demandData,
    demand: (demandData.demand || []).map(rebaseRecord),
    effectiveDataItems,
    effectiveBookingsByItem,
    effectiveGroupAssignmentsByItem,
    activeChildren: (demandData.activeChildren || []).map((child) => ({
      ...child,
      item: rebaseRecord(child.item || {}),
      bookings: (child.bookings || []).map(rebaseRecord),
    })),
    parentFeeSubsidyChildren: (demandData.parentFeeSubsidyChildren || []).map((child) => ({
      ...child,
      item: rebaseRecord(child.item || {}),
      bookings: (child.bookings || []).map(rebaseRecord),
    })),
  };
}

function getFundingYearOptions(rules, currentYear) {
  const years = new Set([currentYear]);
  (rules || []).forEach((rule) => {
    const startYear = /^\d{4}/.test(String(rule?.validFrom || ''))
      ? Number(String(rule.validFrom).slice(0, 4))
      : currentYear;
    const endYear = /^\d{4}/.test(String(rule?.validUntil || ''))
      ? Number(String(rule.validUntil).slice(0, 4))
      : startYear;
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear || endYear - startYear > 50) return;
    for (let year = startYear; year <= endYear; year += 1) years.add(year);
  });
  return Array.from(years).sort((left, right) => left - right)
    .map((year) => ({ value: String(year), label: String(year) }));
}

function getItemSurname(item) {
  const rawData = item?.rawdata || {};
  const directSurname = [item?.familyName, item?.lastName, item?.surname, rawData.NACHNAME, rawData.NAME]
    .map((value) => String(value || '').trim())
    .find(Boolean);
  if (directSurname) return directSurname;

  const fullName = String(item?.name || rawData.FNAME || '').trim();
  if (fullName.includes(',')) return fullName.split(',')[0].trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isPlaceholderFamilyLabel(label, familyId) {
  const normalized = String(label || '').trim().toLowerCase();
  return !normalized
    || normalized === String(familyId || '').trim().toLowerCase()
    || /^familie\s*\((erzber|haushalt)\)$/.test(normalized);
}


function buildFamilyPresentation(dataItems, isAnonymized) {
  const sourceGroups = new Map();

  Object.entries(dataItems || {}).forEach(([itemId, item]) => {
    if (item?.type !== 'demand') return;
    const familyId = String(item.familyId || '').trim();
    const familyLabel = String(item.familyLabel || '').trim();
    const surname = getItemSurname(item);
    const sourceKey = familyId || `child:${itemId}`;
    if (!sourceGroups.has(sourceKey)) {
      sourceGroups.set(sourceKey, {
        sourceKey,
        children: [],
        labels: [],
        surnames: [],
        sortKey: String(item?.adebisId?.id || itemId),
      });
    }
    const group = sourceGroups.get(sourceKey);
    group.children.push(String(itemId));
    if (!isPlaceholderFamilyLabel(familyLabel, familyId)) group.labels.push(familyLabel);
    if (surname) group.surnames.push(surname);
    group.sortKey = [group.sortKey, String(item?.adebisId?.id || itemId)]
      .sort((left, right) => left.localeCompare(right, 'de', { numeric: true }))[0];
  });

  const groups = new Map();
  const keyByChildId = {};
  sourceGroups.forEach((sourceGroup) => {
    const groupKey = sourceGroup.sourceKey;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        labels: [],
        surnames: [],
        sortKey: sourceGroup.sortKey,
      });
    }
    const group = groups.get(groupKey);
    group.labels.push(...sourceGroup.labels);
    group.surnames.push(...sourceGroup.surnames);
    group.sortKey = [group.sortKey, sourceGroup.sortKey]
      .sort((left, right) => left.localeCompare(right, 'de', { numeric: true }))[0];
    sourceGroup.children.forEach((childId) => { keyByChildId[childId] = groupKey; });
  });

  const sortedGroups = Array.from(groups.values()).sort((left, right) => (
    left.sortKey.localeCompare(right.sortKey, 'de', { numeric: true })
  ));
  const labelByKey = new Map(sortedGroups.map((group, index) => {
    if (isAnonymized) return [group.key, `Familie ${index + 1}`];
    const existingLabel = group.labels.find(Boolean);
    if (existingLabel) return [group.key, existingLabel];
    const surnames = Array.from(new Set(group.surnames));
    if (surnames.length > 0) return [group.key, `Familie ${surnames.join(' / ')}`];
    return [group.key, `Familie ${index + 1}`];
  }));
  return { keyByChildId, labelByKey };
}


const DEFAULT_PARENT_FEE_SUBSIDY = {
  enabled: true,
  monthlyAmount: 100,
  endDate: '2026-12-31',
};

function FundingSimulationPanel({ scrollPage = false }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const selectedScenario = useSelector((state) => (state.simScenario?.scenarios || [])
    .find((scenario) => String(scenario.id) === String(selectedScenarioId)));
  const isAnonymizedScenario = selectedScenario?.importedAnonymized === true;
  const financeByScenario = useSelector((state) => state.simFinance?.financeByScenario || {});
  const financeScenario = financeByScenario[String(selectedScenarioId)] || EMPTY_FINANCE;
  const referenceDate = useSelector((state) => state.chart?.[selectedScenarioId]?.referenceDate || state.chart?.referenceDate)
    || new Date().toISOString().slice(0, 10);
  const forecastGroups = useSelector((state) => state.chart?.[selectedScenarioId]?.filter?.Groups || EMPTY_EVENTS);
  const forecastEvents = useSelector((state) => state.events?.eventsByScenario?.[selectedScenarioId] || EMPTY_EVENTS);
  const forecastEventsAvailable = useSelector((state) => selectForecastEventsAvailable(state, selectedScenarioId));
  const currentYear = Number(referenceDate.slice(0, 4));
  const fundingSimulationSettings = financeScenario?.settings?.fundingSimulation || EMPTY_FINANCE;
  const storedSimulationScenarios = fundingSimulationSettings.simulationScenarios;
  const simulationScenarios = Array.isArray(storedSimulationScenarios) && storedSimulationScenarios.length > 0
    ? storedSimulationScenarios
    : [createBaselineSimulationScenario(currentYear)];
  const storedSelectedSimulationScenarioId = fundingSimulationSettings.selectedSimulationScenarioId;
  const selectedSimulationScenarioId = simulationScenarios.some((scenario) => scenario.id === storedSelectedSimulationScenarioId)
    ? storedSelectedSimulationScenarioId
    : simulationScenarios[0].id;
  const selectedSimulationScenario = simulationScenarios.find((scenario) => scenario.id === selectedSimulationScenarioId)
    || simulationScenarios[0];
  const unsupportedScenario = selectedSimulationScenario?.data?.schemaVersion != null
    && (selectedSimulationScenario.data.schemaVersion !== 2 || !validScenarioV2(selectedSimulationScenario.data));
  const fixedBaseYearEnabled = fundingSimulationSettings.fixedBaseYearEnabled === true;
  const stockMode = ['known', 'projected'].includes(fundingSimulationSettings.stockMode) ? fundingSimulationSettings.stockMode : 'legacy';
  const forecastInflowEnabled = fundingSimulationSettings.forecastInflowEnabled === true;
  const fixedBaseYear = fixedBaseYearEnabled
    ? Number(fundingSimulationSettings.fixedBaseYear) || currentYear
    : currentYear;
  const temporaryCatalogEntries = fundingSimulationSettings.temporaryCatalogEntries || EMPTY_FINANCE;
  const tariffOverlay = fundingSimulationSettings.tariffOverlay || null;
  const temporaryPrices = fundingSimulationSettings.temporaryPrices || EMPTY_FINANCE;
  const selectedGroupIds = React.useMemo(
    () => (Array.isArray(fundingSimulationSettings.selectedGroupIds) ? fundingSimulationSettings.selectedGroupIds : []),
    [fundingSimulationSettings.selectedGroupIds]
  );
  const potentialMonthlyBudget = Number.isFinite(Number(fundingSimulationSettings.potentialMonthlyBudget))
    ? Number(fundingSimulationSettings.potentialMonthlyBudget)
    : 50;
  const [pdfExportLoading, setPdfExportLoading] = React.useState(false);
  const [pendingHtmlExport, setPendingHtmlExport] = React.useState(null);
  const [scenarioSaveOpened, setScenarioSaveOpened] = React.useState(false);
  const [scenarioNameDraft, setScenarioNameDraft] = React.useState('');
  const [pendingScenarioAction, setPendingScenarioAction] = React.useState(null);
  const [pdfPrivacyOpened, setPdfPrivacyOpened] = React.useState(false);
  const [pdfIncludeFamilies, setPdfIncludeFamilies] = React.useState(false);
  const [comparisonLeftId, setComparisonLeftId] = React.useState(null);
  const [comparisonRightId, setComparisonRightId] = React.useState(null);
  const {
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupDefs,
    getEffectiveGroupAssignments,
    getEffectiveQualificationAssignments,
    getEffectiveQualificationDefs,
  } = useOverlayData();
  const [selectedDetailsYear, setSelectedDetailsYear] = React.useState(null);
  const [expandedFamilyYear, setExpandedFamilyYear] = React.useState(null);
  const [detailsTab, setDetailsTab] = React.useState('adebis');
  const [groupFamilies, setGroupFamilies] = React.useState(true);
  const [showAnnualFundingInputs, setShowAnnualFundingInputs] = React.useState(false);
  const [familyHistogramMode, setFamilyHistogramMode] = React.useState('total');
  const updateFundingSimulation = React.useCallback((updates) => {
    if (!selectedScenarioId) return;
    dispatch(updateFundingSimulationSettings({ scenarioId: selectedScenarioId, updates }));
  }, [dispatch, selectedScenarioId]);
  const updateAdebisMonthlyOverride = React.useCallback((field, monthKey, value) => {
    const adebisAnalysis = financeScenario?.settings?.adebisAnalysis || {};
    dispatch(updateScenarioFinanceSettings({
      scenarioId: selectedScenarioId,
      updates: {
        adebisAnalysis: {
          ...adebisAnalysis,
          [field]: {
            ...(adebisAnalysis[field] || {}),
            [monthKey]: value === '' || value == null
              ? null
              : Number(String(value).trim().replace(',', '.')),
          },
        },
      },
    }));
  }, [dispatch, financeScenario?.settings?.adebisAnalysis, selectedScenarioId]);
  const updateAnnualFundingInput = React.useCallback((year, field, value) => {
    const reformForecast = financeScenario?.settings?.reformForecast || {};
    const annualFundingInputsByYear = reformForecast.annualFundingInputsByYear || {};
    dispatch(updateScenarioFinanceSettings({
      scenarioId: selectedScenarioId,
      updates: {
        reformForecast: {
          ...reformForecast,
          annualFundingInputsByYear: {
            ...annualFundingInputsByYear,
            [String(year)]: {
              ...(annualFundingInputsByYear[String(year)] || {}),
              [field]: value === '' ? '' : Math.max(0, Number(value) || 0),
            },
          },
        },
      },
    }));
  }, [dispatch, financeScenario?.settings?.reformForecast, selectedScenarioId]);
  const updateReformForecastSetting = React.useCallback((field, value) => {
    const reformForecast = financeScenario?.settings?.reformForecast || {};
    const numericValue = value === '' || value == null
      ? null
      : Number(String(value).trim().replace(',', '.'));
    dispatch(updateScenarioFinanceSettings({
      scenarioId: selectedScenarioId,
      updates: {
        reformForecast: {
          ...reformForecast,
          [field]: Number.isFinite(numericValue) ? numericValue : value,
        },
      },
    }));
  }, [dispatch, financeScenario?.settings?.reformForecast, selectedScenarioId]);

  const updateReformEligibility = React.useCallback((enabled) => {
    const reformForecast = financeScenario?.settings?.reformForecast || {};
    dispatch(updateScenarioFinanceSettings({
      scenarioId: selectedScenarioId,
      updates: { reformForecast: { ...reformForecast, teamGrantEligible: enabled } },
    }));
  }, [dispatch, financeScenario?.settings?.reformForecast, selectedScenarioId]);
  const updateReformActualFunding = React.useCallback((field, value) => {
    const reformForecast = financeScenario?.settings?.reformForecast || {};
    const actualFunding = reformForecast.actualFunding || {};
    const numericValue = value === '' || value == null
      ? null
      : Number(String(value).trim().replace(',', '.'));
    dispatch(updateScenarioFinanceSettings({
      scenarioId: selectedScenarioId,
      updates: {
        reformForecast: {
          ...reformForecast,
          actualFunding: {
            ...actualFunding,
            [field]: Number.isFinite(numericValue) ? numericValue : value,
          },
        },
      },
    }));
  }, [dispatch, financeScenario?.settings?.reformForecast, selectedScenarioId]);

  React.useEffect(() => {
    if (selectedScenarioId) dispatch(seedDefaultBayKiBiGRules({ scenarioId: selectedScenarioId }));
  }, [selectedScenarioId, dispatch]);

  const groupFeeCatalogs = financeScenario?.groupFeeCatalogs || EMPTY_GROUP_FEE_CATALOGS;
  const parentFeeSubsidy = financeScenario?.parentFeeSubsidy || DEFAULT_PARENT_FEE_SUBSIDY;
  const parentFeeSubsidiesByGroup = financeScenario?.parentFeeSubsidiesByGroup || EMPTY_FINANCE;
  const groupDefs = getEffectiveGroupDefs();
  const qualificationDefs = getEffectiveQualificationDefs();
  const effectiveParentFeeSubsidiesByGroup = React.useMemo(() => {
    const groupIds = new Set([
      ...(groupDefs || []).map((group) => String(group.id)),
      ...Object.keys(parentFeeSubsidiesByGroup),
      ...Object.keys(groupFeeCatalogs),
    ]);
    return Object.fromEntries(Array.from(groupIds).map((groupId) => {
      const saved = parentFeeSubsidiesByGroup[groupId] || parentFeeSubsidy;
      return [groupId, { ...saved, enabled: saved.enabled !== false }];
    }));
  }, [groupDefs, parentFeeSubsidiesByGroup, parentFeeSubsidy, groupFeeCatalogs]);
  const simulationData = React.useMemo(() => {
    const dataItems = getEffectiveDataItems();
    const bookingsByItem = {};
    const groupAssignmentsByItem = {};
    const qualificationAssignmentsByItem = {};
    Object.keys(dataItems || {}).forEach((itemId) => {
      bookingsByItem[itemId] = getEffectiveBookings(itemId);
      groupAssignmentsByItem[itemId] = getEffectiveGroupAssignments(itemId);
      qualificationAssignmentsByItem[itemId] = Object.fromEntries(
        (getEffectiveQualificationAssignments(itemId) || []).map((assignment, index) => [String(index), assignment])
      );
    });
    return { dataItems, bookingsByItem, groupAssignmentsByItem, qualificationAssignmentsByItem };
  }, [
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupAssignments,
    getEffectiveQualificationAssignments,
  ]);
  const familyPresentation = React.useMemo(
    () => buildFamilyPresentation(simulationData.dataItems, isAnonymizedScenario),
    [simulationData.dataItems, isAnonymizedScenario]
  );
  const forecastInputs = React.useMemo(() => {
    const selected = new Set(forecastGroups.map(String));
    const history = Object.values(simulationData.dataItems || {}).filter((item) => item?.type === 'demand' && shouldIncludeDataItemInAnalysis(item));
    const children = history.filter((item) => {
      if (item.enddate && item.enddate < referenceDate) return false;
      if (!selected.size) return true;
      const date = item.startdate && item.startdate > referenceDate ? item.startdate : referenceDate;
      const assignments = simulationData.groupAssignmentsByItem[String(item.id)] || {};
      const ids = resolveGroupIdsAtDate(assignments, date, getForecastGroupAssignments(assignments).length ? null : item.groupId);
      return ids.length ? ids.some((id) => selected.has(String(id))) : selected.has('__NO_GROUP__');
    });
    const admissions = history.filter((item) => item.startdate && item.startdate <= referenceDate);
    const years = new Set(admissions.map((item) => String(item.startdate).slice(0, 4)));
    const sample = years.size
      ? `${admissions.length} Aufnahmedatensätze in ${years.size} Jahren; gerundetes Mittel ${Math.round(admissions.length / years.size)} pro Jahr`
      : 'keine berücksichtigten Aufnahmedatensätze; kein Mittel berechenbar';
    const inflowBasis = `Zulauf-Datengrundlage bis ${referenceDate}: ${sample}. Nur nicht archivierte Kinder mit zulässigem Status; archivierte und andere Status sind ausgeschlossen. Jahre ohne berücksichtigte Aufnahmen zählen nicht, das Stichtagsjahr nur bis zum Stichtag. Datensätze werden nicht auf doppelte Aufnahmen geprüft; die Historie kann unvollständig sein. Bekannte spätere Aufnahmen werden im jeweiligen Jahr angerechnet; ergänzt wird am 1. September für drei Jahre Krippe, höchstens sechs Folgejahre.`;
    const canEstimateInflow = selected.size === 0 && admissions.length > 0;
    const fillUp = buildForecastFillUp({ referenceDate, children: history, groups: groupDefs || [], assignmentsByChild: simulationData.groupAssignmentsByItem, events: forecastEvents });
    const inflow = canEstimateInflow ? limitForecastInflow({ inflow: buildForecastInflow({ referenceDate, history, futureAdmissions: children }), children: history, capacity: fillUp.capacity }) : [];
    return { dataItems: Object.fromEntries(children.map((item) => [String(item.id), item])), inflow, fillUp, canEstimateInflow, inflowBasis, filtered: selected.size > 0 };
  }, [forecastGroups, simulationData, referenceDate, groupDefs, forecastEvents]);

  const groupFilterOptions = React.useMemo(() => [
    ...(groupDefs || []).map((group) => ({ value: String(group.id), label: group.name || String(group.id) })),
    { value: '__NO_GROUP__', label: 'Ohne Gruppe' },
  ], [groupDefs]);
  const groupLabels = React.useMemo(() => new Map(
    (groupDefs || []).map((group) => [String(group.id), group.name || String(group.id)])
  ), [groupDefs]);

  const categoryPriceRows = React.useMemo(() => {
    const rows = getFeeCatalogSimulationRows(groupFeeCatalogs, groupLabels, referenceDate);
    if (selectedGroupIds.length === 0) return rows;
    const selectedGroupIdSet = new Set(selectedGroupIds);
    return rows.filter((row) => selectedGroupIdSet.has(row.groupId));
  }, [groupFeeCatalogs, groupLabels, referenceDate, selectedGroupIds]);
  const resolvedTariffOverlay = React.useMemo(() => applyTariffOverlay({
    ...groupFeeCatalogs,
    ...temporaryCatalogEntries,
  }, tariffOverlay), [groupFeeCatalogs, temporaryCatalogEntries, tariffOverlay]);
  const activeTariffConflicts = unsupportedScenario ? ['Unbekannte Szenarioversion'] : resolvedTariffOverlay.conflicts;
  const simulationCatalogs = resolvedTariffOverlay.catalogs;
  const effectiveFeeCatalogs = React.useMemo(
    () => effectiveCatalogsForSimulation(simulationCatalogs, temporaryPrices),
    [simulationCatalogs, temporaryPrices]
  );
  const tariffGroups = React.useMemo(() => {
    const groupIds = new Set([
      ...(groupDefs || []).map((group) => String(group.id)),
      ...Object.keys(groupFeeCatalogs || {}).map(String),
    ]);
    return Array.from(groupIds)
      .filter((groupId) => selectedGroupIds.length === 0 || selectedGroupIds.includes(groupId))
      .filter((groupId) => (groupFeeCatalogs[groupId] || []).length > 0)
      .map((groupId) => ({
        id: groupId,
        name: groupLabels.get(groupId) || groupId,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'de'));
  }, [groupDefs, groupFeeCatalogs, groupLabels, selectedGroupIds]);

  const baseYearOptions = React.useMemo(
    () => getFundingYearOptions(financeScenario?.bayKiBiGRules, currentYear),
    [financeScenario?.bayKiBiGRules, currentYear]
  );
  const fundingYears = React.useMemo(
    () => getConfiguredFundingYears(financeScenario?.bayKiBiGRules, currentYear),
    [financeScenario?.bayKiBiGRules, currentYear]
  );
  const calculateAnnualIncomeRows = React.useCallback(({ fixedBaseYearEnabled, fixedBaseYear, stockMode, forecastInflowEnabled, simulationCatalogs, effectiveFeeCatalogs, temporaryPrices, potentialMonthlyBudget }) => {
    const financeForModel = { ...financeScenario, groupFeeCatalogs };
    const reformForecast = financeScenario?.settings?.reformForecast || {};
    const familyProfilesById = new Map();
    const yearsToCalculate = fixedBaseYearEnabled && fixedBaseYear === 2026
      ? [...new Set([2026, ...fundingYears])].sort((a, b) => a - b) : fundingYears;
    const annualRows = yearsToCalculate.map((year) => {
      const manualInputYear = fixedBaseYearEnabled ? fixedBaseYear : year;
      const { values: annualFundingInputValues, missing: missingManualFunding } = resolveManualFundingInputs(manualInputYear, reformForecast);
      const manualInputs = Object.fromEntries(Object.entries(annualFundingInputValues).map(([key, value]) => [key, isValidFundingValue(value) ? Number(value) : 0]));
      const monthlyDetails = [];
      const families = new Map();
      const familyContributionImpacts = new Map();
      const familyFeeProfilesById = new Map();
      const annualPotential = {
        upgradeDailyHours: 0, downgradeDailyHours: 0,
        upgradeFunding: 0, downgradeFunding: 0,
        upgradeParentFees: 0, downgradeParentFees: 0,
      };
      let contributions = 0;
      let baselineContributions = 0;
      let contributionsChange = 0;
      let annualParentFeeSubsidy = 0;
      let eligibleParentFeeSubsidyChildMonths = 0;
      let missingTariffChildMonths = 0;
      let subsidyExceedsTariffChildMonths = 0;
      let missingPotentialTariffs = 0;
      let incompletePotentialBookings = 0;
      let feeCalculationComplete = true;
      let forecastComplete = true;
      let unusableBookingChildMonths = 0;
      let activeChildrenCoveragePartialMonths = 0;
      let missingFundingRuleMonths = 0;
      let missingBirthDateChildMonths = 0;
      const forecastGapsByKey = new Map();
      let forecastKnownChildMonths = 0;
      let forecastProjectedChildMonths = 0;
      let forecastUnknownChildMonths = 0;
      let outsideForecastMonths = 0;

      Array.from({ length: 12 }, (_, monthIndex) => {
        const monthReferenceDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const monthDays = new Date(year, monthIndex + 1, 0).getDate();
        const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, monthIndex, 1));
        const basisMonthReferenceDate = `${fixedBaseYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const useForecast = !fixedBaseYearEnabled && stockMode !== 'legacy';
        const sourceDemandData = useForecast ? includeForecastTimelessFeeBookings(buildForecastFinanceMonth({
          mode: stockMode, referenceDate, monthDate: monthReferenceDate,
          dataItems: forecastInputs.dataItems,
          bookingsByItem: simulationData.bookingsByItem,
          groupAssignmentsByItem: simulationData.groupAssignmentsByItem,
          groups: groupDefs, events: forecastEvents,
          inflow: stockMode === 'projected' && forecastInflowEnabled ? forecastInputs.inflow : [],
          groupFeeCatalogs: effectiveFeeCatalogs, fillUp: forecastInputs.fillUp, inflowCapacityChecked: true,
        }), simulationData) : getSimulationDemandForDate({
          scenarioId: selectedScenarioId,
          referenceDate: fixedBaseYearEnabled ? basisMonthReferenceDate : monthReferenceDate,
          selectedGroupIds: [],
          simulationData,
        });
        const monthForecastGaps = new Map();
        const addForecastGap = (gap) => {
          const key = gap.itemId != null ? `child:${gap.itemId}` : gap.input != null ? `input:${gap.input}:${gap.index ?? ''}` : `inflow:${gap.inflowIndex}`;
          if (!monthForecastGaps.has(key)) monthForecastGaps.set(key, { itemId: gap.itemId ?? null, input: gap.input ?? null, reasons: new Set() });
          (gap.reasons || []).forEach((reason) => monthForecastGaps.get(key).reasons.add(reason));
        };
        if (useForecast) {
          sourceDemandData.activeChildren = sourceDemandData.states.map((state) => {
            const itemId = String(state.itemId);
            const item = forecastInputs.dataItems[itemId];
            const bookings = Object.values(simulationData.bookingsByItem[itemId] || {}).filter((booking) => {
              const type = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
              return type?.basis !== false && isRecordActiveOnDate(booking, monthReferenceDate);
            });
            return { itemId, item, groupId: state.groupId || '', bookings };
          });
          forecastKnownChildMonths += sourceDemandData.counts.known;
          forecastProjectedChildMonths += sourceDemandData.counts.projected;
          forecastUnknownChildMonths += sourceDemandData.counts.unknown;
          if (!sourceDemandData.diagnostics.complete) forecastComplete = false;
          sourceDemandData.diagnostics.gaps.forEach(addForecastGap);
          if (monthReferenceDate < referenceDate) { outsideForecastMonths += 1; forecastComplete = false; }
          if (stockMode === 'projected' && (!forecastEventsAvailable || (forecastInflowEnabled && (!forecastInputs.canEstimateInflow || year > currentYear)))) forecastComplete = false;
        }
        const demandData = fixedBaseYearEnabled
          ? rebaseSimulationDemandToMonth(sourceDemandData, monthReferenceDate, basisMonthReferenceDate)
          : sourceDemandData;
        missingBirthDateChildMonths += (demandData.activeChildren || []).filter((child) => !hasValidBirthDate(child.item)).length;
        const monthSimulationData = fixedBaseYearEnabled ? {
          ...simulationData,
          dataItems: { ...simulationData.dataItems, ...demandData.effectiveDataItems },
          bookingsByItem: {
            ...simulationData.bookingsByItem,
            ...demandData.effectiveBookingsByItem,
          },
          groupAssignmentsByItem: {
            ...simulationData.groupAssignmentsByItem,
            ...demandData.effectiveGroupAssignmentsByItem,
          },
        } : simulationData;
        const monthlyFinance = calculateScenarioMonthlyFinance({
          referenceDate: monthReferenceDate,
          ...demandData,
          effectiveGroupDefs: groupDefs,
          financeScenario: financeForModel,
          applyZeitkatFactor: true,
          deriveZeitkatFactor: true,
        });
        // Zero-priced timeless bookings may not produce a finance row, but still
        // belong in the family tree and its fee profile.
        const financeChildIds = new Set(monthlyFinance.childRows.map((row) => String(row.itemId)));
        (demandData.demand || []).forEach((booking) => {
          const itemId = String(booking.itemId);
          if (financeChildIds.has(itemId) || sumWeightedBookingHours(booking) > 0) return;
          const item = demandData.effectiveDataItems[itemId];
          if (!item) return;
          const childFinance = calculateChildMonthlyRevenue({
            item, bookings: Object.values(demandData.effectiveBookingsByItem[itemId] || {}),
            groupAssignments: demandData.effectiveGroupAssignmentsByItem[itemId] || {},
            groupDefs, financeScenario: financeForModel, referenceDate: monthReferenceDate,
            applyZeitkatFactor: true, deriveZeitkatFactor: true,
          });
          monthlyFinance.childRows.push({ itemId, item, ...childFinance });
          financeChildIds.add(itemId);
        });
        const monthlySimulation = simulateContributionChanges({
          demandBookings: demandData.demand,
          dataItems: monthSimulationData.dataItems,
          familyGroupIds: familyPresentation.keyByChildId,
          groupDefs,
          bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
          groupFeeCatalogs: simulationCatalogs,
          originalGroupFeeCatalogs: groupFeeCatalogs,
          parentFeeSubsidy,
          parentFeeSubsidiesByGroup: effectiveParentFeeSubsidiesByGroup,
          baselineParentFeeSubsidy: parentFeeSubsidy,
          baselineParentFeeSubsidiesByGroup: parentFeeSubsidiesByGroup,
          parentFeeSubsidyChildren: demandData.parentFeeSubsidyChildren,
          activeChildren: demandData.activeChildren,
          temporaryPrices,
          utilizationPercent: 0,
          referenceDate: monthReferenceDate,
        });
        const diagnostics = monthlySimulation.diagnostics;
        const diagnosticSummary = summarizeSimulationDiagnostics(diagnostics);
        if (!diagnosticSummary.feeCalculationComplete) feeCalculationComplete = false;
        missingTariffChildMonths += diagnosticSummary.missingTariffs.length;
        unusableBookingChildMonths += diagnosticSummary.childrenWithoutBookingHours.length;
        const forecastCoveragePartial = useForecast && (monthReferenceDate < referenceDate
          || sourceDemandData.diagnostics.gaps.some((gap) => gap.itemId == null)
          || (stockMode === 'projected' && (!forecastEventsAvailable || (forecastInflowEnabled && (!forecastInputs.canEstimateInflow || year > currentYear)))));
        if (!diagnosticSummary.activeChildrenComplete || forecastCoveragePartial
          || (!diagnosticSummary.bookingHoursComplete && diagnosticSummary.childrenWithoutBookingHours.length === 0)) {
          activeChildrenCoveragePartialMonths += 1;
        }
        if (useForecast) {
          diagnosticSummary.missingTariffs.forEach((gap) => {
            const reasons = [gap.reason || 'missing-tariff'];
            if (gap.missingBaseline && gap.reason === 'missing-tariff') reasons.push('missing-baseline-tariff');
            addForecastGap({ itemId: gap.itemId, reasons });
          });
          diagnosticSummary.childrenWithoutBookingHours.forEach((gap) => addForecastGap({ itemId: gap.itemId, reasons: [gap.reason] }));
          monthForecastGaps.forEach((gap, key) => {
            const annualKey = gap.itemId != null ? key : gap.input != null ? `input:${gap.input}` : 'anonymous-inflow';
            if (!forecastGapsByKey.has(annualKey)) forecastGapsByKey.set(annualKey, { itemId: gap.itemId, input: gap.input, count: 0, reasons: new Set() });
            const entry = forecastGapsByKey.get(annualKey);
            entry.count += 1;
            gap.reasons.forEach((reason) => entry.reasons.add(reason));
          });
        }

        subsidyExceedsTariffChildMonths += diagnostics?.subsidyExceedsTariff?.length || 0;
        (monthlySimulation.familyContributions || []).forEach((family) => {
          const familyKey = (family.childIds || [])
            .map((childId) => familyPresentation.keyByChildId[String(childId)])
            .find(Boolean) || String(family.id);
          if (!familyContributionImpacts.has(familyKey)) {
            familyContributionImpacts.set(familyKey, {
              id: familyKey,
              label: familyPresentation.labelByKey.get(familyKey) || family.label || familyKey,
              monthlyParentFeesBefore: 0,
              monthlyParentFeesAfter: 0,
            });
          }
          const impact = familyContributionImpacts.get(familyKey);
          impact.monthlyParentFeesBefore += Number(family.monthlyParentFeesBefore) || 0;
          impact.monthlyParentFeesAfter += Number(family.monthlyParentFeesAfter) || 0;
        });
        const applicableBasisRule = pickApplicableValidityEntry(financeScenario?.bayKiBiGRules, monthReferenceDate);
        if (!applicableBasisRule || !(Number(applicableBasisRule.baseValue) > 0)) missingFundingRuleMonths += 1;
        const basisRule = applicableBasisRule;
        const monthKey = monthReferenceDate.slice(0, 7);
        const adebisOverrides = financeScenario?.settings?.adebisAnalysis || {};
        const adebisMetrics = calculateAdebisMonthMetrics({
          monthlyFinance,
          simulationData: monthSimulationData,
          qualificationDefs,
          groupDefs,
          basisValue: basisRule?.baseValue ?? 0,
          qualityBonusBenchmark: basisRule?.qualityBonusBenchmark ?? 0,
          under3AdditionalFactor: basisRule?.under3AdditionalFactor ?? 0.025,
          under3ChildrenOverride: adebisOverrides.under3ChildrenByMonth?.[monthKey],
          under3AdditionalOverride: adebisOverrides.under3AdditionalByMonth?.[monthKey],
          activeBasisChildRecords: demandData.parentFeeSubsidyChildren,
          preparatoryCoursePerChild: basisRule?.preparatoryCoursePerChild ?? 0,
          integratedChildrenOverride: adebisOverrides.integratedChildrenByMonth?.[monthKey],
          expertRatioPercentOverride: adebisOverrides.expertRatioPercentByMonth?.[monthKey],
          operatingDaysOverride: adebisOverrides.operatingDaysByMonth?.[monthKey],
          referenceDate: monthReferenceDate,
        });
        const monthlyBaseFunding = adebisMetrics.estimatedFunding;
        const monthlyUnder3Federal = manualInputs.under3Federal / 12;
        const monthlyPersonnelBonus = manualInputs.personnelBonus / 12;
        const monthlyAssistance = manualInputs.assistance / 12;
        const monthlyLanguageSpecialists = manualInputs.languageSpecialists / 12;
        const monthlyAdditionalFunding = adebisMetrics.preparatoryCourses
          + adebisMetrics.under3Additional
          + monthlyUnder3Federal
          + adebisMetrics.qualityBonus
          + monthlyPersonnelBonus
          + monthlyAssistance
          + monthlyLanguageSpecialists;
        const monthlyParentFeeSubsidy = monthlySimulation.totals.policyParentFeeSubsidy;
        const monthlyPotentials = calculateFamilyFeePotentials({
          demandBookings: demandData.demand,
          dataItems: monthSimulationData.dataItems,
          familyGroupIds: familyPresentation.keyByChildId,
          groupDefs,
          bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
          groupFeeCatalogs: simulationCatalogs,
          parentFeeSubsidy,
          parentFeeSubsidiesByGroup: effectiveParentFeeSubsidiesByGroup,
          temporaryPrices,
          referenceDate: monthReferenceDate,
          monthlyBudget: potentialMonthlyBudget,
        });
        monthlyPotentials.forEach((family) => {
          missingPotentialTariffs += family.diagnostics?.missingTariffs?.length || 0;
          incompletePotentialBookings += family.diagnostics?.incompleteBookings?.length || 0;
          annualPotential.upgradeDailyHours += family.potentialUpgradeWeeklyHours / 5 / 12;
          annualPotential.downgradeDailyHours += family.potentialDowngradeWeeklyHours / 5 / 12;
          annualPotential.upgradeFunding += calculateAdebisMonthlyBaseFunding(family.potentialUpgradeWeightedDailyHours, adebisMetrics.basisValue) ?? 0;
          annualPotential.downgradeFunding -= calculateAdebisMonthlyBaseFunding(family.potentialDowngradeWeightedDailyHours, adebisMetrics.basisValue) ?? 0;
          annualPotential.upgradeParentFees += family.potentialUpgradeMonthlyParentFeeChange;
          annualPotential.downgradeParentFees += family.potentialDowngradeMonthlyParentFeeChange;
        });

        monthlyDetails.push({
          month: monthName,
          monthIndex,
          ...adebisMetrics,
          weeklyHours: adebisMetrics.weeklyBookingHours,
          baseFunding: monthlyBaseFunding,
          preparatoryCourses: adebisMetrics.preparatoryCourses,
          under3Additional: adebisMetrics.under3Additional,
          under3Federal: monthlyUnder3Federal,
          qualityBonus: adebisMetrics.qualityBonus,
          personnelBonus: monthlyPersonnelBonus,
          assistance: monthlyAssistance,
          languageSpecialists: monthlyLanguageSpecialists,
          totalFunding: monthlyBaseFunding + monthlyAdditionalFunding + monthlyParentFeeSubsidy,
          parentFeeSubsidy: monthlyParentFeeSubsidy,
        });

        const subsidyChildById = new Map((demandData.parentFeeSubsidyChildren || []).map((child) => [
          String(child.itemId),
          child,
        ]));
        monthlyFinance.childRows.forEach((childRow) => {
          const childId = String(childRow.itemId);
          const item = childRow.item || monthSimulationData.dataItems[childId] || {};
          const familyId = familyPresentation.keyByChildId[childId]
            || String(item.familyId || item.familyLabel || `child:${childId}`);
          const profileFamilyKey = familyId;
          const subsidyChild = subsidyChildById.get(childId);
          const subsidyGroupId = String(subsidyChild?.groupId || childRow.groupId || item.groupId || '');
          const subsidyGroup = groupDefs.find((group) => String(group.id) === subsidyGroupId) || null;
          const subsidyEligible = Boolean(subsidyChild && isParentFeeSubsidyEligible(
            item,
            subsidyGroup,
            subsidyChild.bookings || [],
            monthReferenceDate
          ));
          if (!familyFeeProfilesById.has(profileFamilyKey)) {
            familyFeeProfilesById.set(profileFamilyKey, Array.from({ length: 12 }, () => new Map()));
          }
          const monthlyFeeProfile = familyFeeProfilesById.get(profileFamilyKey)[monthIndex];
          const profileBandKey = JSON.stringify([
            String(childRow.groupId || item.groupId || ''),
            String(childRow.zeitkatId || ''),
            subsidyEligible,
          ]);
          monthlyFeeProfile.set(profileBandKey, (monthlyFeeProfile.get(profileBandKey) || 0) + 1);
          if (!families.has(familyId)) {
            families.set(familyId, {
              id: familyId,
              label: familyPresentation.labelByKey.get(familyId) || item.familyLabel || item.familyId || item.name || familyId,
              children: new Map(),
            });
          }
          const family = families.get(familyId);
          if (!family.children.has(childId)) {
            family.children.set(childId, {
              id: childId,
              name: item.name || childId,
              bookingValidities: getBookingValidityLabels(
                simulationData.bookingsByItem?.[childId],
                fixedBaseYearEnabled ? fixedBaseYear : year
              ),
              groupNames: new Set(),
              zeitkatIds: new Set(),
              annualBookingHours: 0,
              weeklyHoursAcrossMonths: 0,
              annualFunding: 0,
            });
          }
          const child = family.children.get(childId);
          const groupName = groupDefs.find((group) => String(group.id) === String(childRow.groupId))?.name;
          child.groupNames.add(groupName || 'Ohne Gruppe');
          if (childRow.zeitkatId) child.zeitkatIds.add(String(childRow.zeitkatId));
          const childMetrics = adebisMetrics.childrenById[childId] || { weeklyHours: 0, weightedDailyHours: 0 };
          child.annualBookingHours += childMetrics.weeklyHours * monthDays / 7;
          child.weeklyHoursAcrossMonths += childMetrics.weeklyHours;
          child.annualFunding += calculateAdebisMonthlyBaseFunding(childMetrics.weightedDailyHours, adebisMetrics.basisValue) ?? 0;
        });

        const monthlyBaselineContributions = monthlySimulation.familyContributions
          .reduce((sum, family) => sum + family.monthlyParentFeesBefore, 0);
        const monthlyContributions = monthlySimulation.familyContributions
          .reduce((sum, family) => sum + family.monthlyParentFeesAfter, 0);
        baselineContributions += monthlyBaselineContributions;
        contributions += monthlyContributions;
        contributionsChange += monthlyContributions - monthlyBaselineContributions;
        annualParentFeeSubsidy += monthlyParentFeeSubsidy;

        eligibleParentFeeSubsidyChildMonths += monthlySimulation.totals.eligibleParentFeeSubsidyChildren;
      });
      familyFeeProfilesById.forEach((monthlyProfiles, familyKey) => {
        if (!familyProfilesById.has(familyKey)) familyProfilesById.set(familyKey, { years: {} });
        familyProfilesById.get(familyKey).years[String(year)] = monthlyProfiles.map((bands) => (
          Array.from(bands.entries()).map(([key, childCount]) => {
            const [groupId, zeitkatId, subsidyEligible] = JSON.parse(key);
            return {
              groupId,
              zeitkatId,
              childCount,
              subsidyEligibleChildCount: subsidyEligible ? childCount : 0,
            };
          }).sort((left, right) => `${left.groupId}|${left.zeitkatId}|${left.subsidyEligibleChildCount}`
            .localeCompare(`${right.groupId}|${right.zeitkatId}|${right.subsidyEligibleChildCount}`))
        ));
      });

      const meanMetric = (field) => monthlyDetails.length
        ? monthlyDetails.reduce((sum, month) => sum + (Number(month[field]) || 0), 0) / monthlyDetails.length
        : 0;
      const qualifiedMonthCount = monthlyDetails.filter((month) => month.expertRatioPercent != null).length;
      const meanExpertRatio = qualifiedMonthCount
        ? monthlyDetails.reduce((sum, month) => sum + (Number(month.expertRatioPercent) || 0), 0) / qualifiedMonthCount
        : 0;
      const qualityBonusEligible = meanMetric('employmentKey') <= 11
        && meanExpertRatio >= 50
        && meanMetric('overTwentyHoursPercent') > 50;
      if (!qualityBonusEligible) {
        monthlyDetails.forEach((month) => {
          month.totalFunding -= month.qualityBonus;
          month.qualityBonus = 0;
        });
      }
      const baseFunding = Math.round(monthlyDetails.reduce((sum, month) => sum + month.baseFunding, 0) * 100) / 100;
      const preparatoryCourses = Math.round(monthlyDetails.reduce((sum, month) => sum + month.preparatoryCourses, 0) * 100) / 100;
      const under3Additional = Math.round(monthlyDetails.reduce((sum, month) => sum + month.under3Additional, 0) * 100) / 100;
      const qualityBonus = Math.round(monthlyDetails.reduce((sum, month) => sum + month.qualityBonus, 0) * 100) / 100;
      const under3Federal = manualInputs.under3Federal;
      const personnelBonus = manualInputs.personnelBonus;
      const assistance = manualInputs.assistance;
      const languageSpecialists = manualInputs.languageSpecialists;
      const additionalFunding = Math.round((preparatoryCourses + under3Additional + under3Federal + qualityBonus
        + personnelBonus + assistance + languageSpecialists) * 100) / 100;
      const totalFunding = Math.round((baseFunding + additionalFunding + annualParentFeeSubsidy) * 100) / 100;
      const contributionsChangeRounded = Math.round(contributionsChange * 100) / 100;
      const baselineContributionsRounded = Math.round(baselineContributions * 100) / 100;
      const contributionsRounded = Math.round(contributions * 100) / 100;
      const familyParentFeesById = Object.fromEntries(Array.from(familyContributionImpacts.values()).map((family) => [
        family.id,
        {
          id: family.id,
          label: family.label,
          monthlyParentFeesBefore: Math.round(family.monthlyParentFeesBefore * 100) / 100,
          monthlyParentFeesAfter: Math.round(family.monthlyParentFeesAfter * 100) / 100,
        },
      ]));
      const familyTree = Array.from(families.values()).map((family) => {
        const children = Array.from(family.children.values()).map((child) => ({
          ...child,
          annualBookingHours: Math.round(child.annualBookingHours * 100) / 100,
          averageDailyHours: Math.round((child.weeklyHoursAcrossMonths / 60) * 100) / 100,
          groupNames: Array.from(child.groupNames).sort((left, right) => left.localeCompare(right, 'de')),
          zeitkatIds: Array.from(child.zeitkatIds).sort((left, right) => {
            const leftIndex = ZEITKAT_CATALOG.findIndex((zone) => zone.id === left);
            const rightIndex = ZEITKAT_CATALOG.findIndex((zone) => zone.id === right);
            return leftIndex - rightIndex;
          }),
          annualFunding: Math.round(child.annualFunding * 100) / 100,
        })).sort((left, right) => left.name.localeCompare(right.name, 'de'));
        return {
          id: family.id,
          label: family.label,
          children,
          annualBookingHours: Math.round(children.reduce((sum, child) => sum + child.annualBookingHours, 0) * 100) / 100,
          annualFunding: Math.round(children.reduce((sum, child) => sum + child.annualFunding, 0) * 100) / 100,
          averageDailyHours: Math.round(children.reduce((sum, child) => sum + child.averageDailyHours, 0) * 100) / 100,
        };
      }).sort((left, right) => left.label.localeCompare(right.label, 'de'));
      return {
        year,
        funding: baseFunding,
        preparatoryCourses,
        under3Additional,
        under3Federal,
        qualityBonus,
        personnelBonus,
        assistance,
        languageSpecialists,
        annualFundingInputs: manualInputs,
        annualFundingInputValues,
        missingManualFunding,
        averageDailyBookingHours: meanMetric('bookingHoursDaily'),
        additionalFunding,
        totalFunding,
        contributions: contributionsRounded,
        baselineContributions: baselineContributionsRounded,
        contributionsChange: contributionsChangeRounded,
        annualParentFeeSubsidy: Math.round(annualParentFeeSubsidy * 100) / 100,
        // Both tariffs use the same nominal subsidy policy; the API's delta is
        // tariff-limited relief, not a change to the nominal subsidy income.
        annualParentFeeSubsidyChange: 0,
        eligibleParentFeeSubsidyChildMonths,
        feeCalculationComplete,
        missingTariffChildMonths,
        subsidyExceedsTariffChildMonths,
        missingPotentialTariffs,
        incompletePotentialBookings,
        unusableBookingChildMonths,
        activeChildrenCoveragePartialMonths,
        missingFundingRuleMonths,
        missingBirthDateChildMonths,
        forecastComplete,
        outsideForecastMonths,
        forecastKnownChildMonths,
        forecastProjectedChildMonths,
        forecastUnknownChildMonths,
        forecastGaps: Array.from(forecastGapsByKey.values(), (gap) => ({ ...gap, reasons: Array.from(gap.reasons) })),
        yearComplete: feeCalculationComplete && forecastComplete && unusableBookingChildMonths === 0 && activeChildrenCoveragePartialMonths === 0 && missingFundingRuleMonths === 0 && missingBirthDateChildMonths === 0 && missingManualFunding.length === 0,
        totalIncome: Math.round((totalFunding + contributionsRounded) * 100) / 100,
        baselineTotalIncome: Math.round((totalFunding + baselineContributionsRounded) * 100) / 100,
        totalIncomeChange: Math.round((contributionsRounded - baselineContributionsRounded) * 100) / 100,
        monthlyDetails,
        familyTree,
        annualPotential,
        familyParentFeesById,
      };
    });
    const emptyMonths = Array.from({ length: 12 }, () => []);
    const profileClasses = new Map();
    familyProfilesById.forEach((familyProfile) => {
      const years = Object.fromEntries(fundingYears.map((profileYear) => [
        String(profileYear),
        familyProfile.years[String(profileYear)] || emptyMonths,
      ]));
      const signature = JSON.stringify(years);
      if (!profileClasses.has(signature)) {
        profileClasses.set(signature, { familyCount: 0, years });
      }
      profileClasses.get(signature).familyCount += 1;
    });
    const allProfileClasses = Array.from(profileClasses.values());
    const minimumFamilyCount = 5;
    const familyProfileData = {
      totalFamilies: familyProfilesById.size,
      minimumFamilyCount,
      suppressedFamilyCount: allProfileClasses
        .filter((profile) => profile.familyCount < minimumFamilyCount)
        .reduce((sum, profile) => sum + profile.familyCount, 0),
      profiles: allProfileClasses.filter((profile) => profile.familyCount >= minimumFamilyCount),
    };
    return annualRows.map((row, index) => {
      const currentFamilyFees = row.familyParentFeesById || {};
      const previousFamilyFees = annualRows[index - 1]?.familyParentFeesById || {};
      const familyIds = new Set([...Object.keys(currentFamilyFees), ...Object.keys(previousFamilyFees)]);
      const familyImpacts = Array.from(familyIds).map((familyId) => {
        const current = currentFamilyFees[familyId];
        const previous = previousFamilyFees[familyId];
        const annualDelta = (current?.monthlyParentFeesAfter || 0) - (current?.monthlyParentFeesBefore || 0);
        const yearOverYearAnnualDelta = !row.yearComplete || index === 0 || !annualRows[index - 1].yearComplete || annualRows[index - 1].year !== row.year - 1
          ? null
          : (current?.monthlyParentFeesAfter || 0) - (previous?.monthlyParentFeesAfter || 0);
        return {
          id: familyId,
          label: current?.label || previous?.label || familyId,
          monthlyParentFeesBefore: current?.monthlyParentFeesBefore || 0,
          monthlyParentFeesAfter: current?.monthlyParentFeesAfter || 0,
          averageMonthlyParentFeesBefore: (current?.monthlyParentFeesBefore || 0) / 12,
          averageMonthlyParentFeesAfter: (current?.monthlyParentFeesAfter || 0) / 12,
          averageMonthlyDelta: annualDelta / 12,
          annualDelta,
          averageMonthlyYearOverYearDelta: yearOverYearAnnualDelta == null ? null : yearOverYearAnnualDelta / 12,
          yearOverYearAnnualDelta,
        };
      }).filter((family) => Math.abs(family.annualDelta) >= 0.005
        || (family.yearOverYearAnnualDelta != null && Math.abs(family.yearOverYearAnnualDelta) >= 0.005))
        .sort((left, right) => Math.max(Math.abs(right.annualDelta), Math.abs(right.yearOverYearAnnualDelta || 0))
          - Math.max(Math.abs(left.annualDelta), Math.abs(left.yearOverYearAnnualDelta || 0)));
      const rowData = { ...row };
      delete rowData.familyParentFeesById;
      return {
        ...rowData,
        familyImpacts,
        ...(index === 0 ? { familyProfileData } : {}),
      };
    });
  }, [
    fundingYears,
    financeScenario,
    groupFeeCatalogs,
    selectedScenarioId,
    simulationData,
    groupDefs,
    qualificationDefs,
    familyPresentation,
    parentFeeSubsidy,
    parentFeeSubsidiesByGroup,
    effectiveParentFeeSubsidiesByGroup,
    forecastInputs,
    forecastEvents,
    forecastEventsAvailable,
    referenceDate,
    currentYear,
  ]);
  const calculatedAnnualIncomeRows = React.useMemo(() => calculateAnnualIncomeRows({
    fixedBaseYearEnabled, fixedBaseYear, stockMode, forecastInflowEnabled, simulationCatalogs, effectiveFeeCatalogs, temporaryPrices, potentialMonthlyBudget,
  }), [calculateAnnualIncomeRows, fixedBaseYearEnabled, fixedBaseYear, stockMode, forecastInflowEnabled, simulationCatalogs, effectiveFeeCatalogs, temporaryPrices, potentialMonthlyBudget]);
  const calculateReformRows = React.useCallback((calculatedRows, fixedEnabled, baseYear) => {
    const settings = financeScenario?.settings?.reformForecast || {};
    const baseline2026Row = calculatedRows.find((row) => row.year === 2026);
    const actualDefaults = {
      bookingTime: baseline2026Row?.funding ?? null,
      qualityBonus: baseline2026Row?.qualityBonus ?? null,
      preparatoryCourses: baseline2026Row?.preparatoryCourses ?? null,
      under3Additional: baseline2026Row?.under3Additional ?? null,
      under3Federal: baseline2026Row?.under3Federal ?? null,
      parentFeeSubsidy: baseline2026Row?.annualParentFeeSubsidy ?? null,
      assistance: baseline2026Row?.assistance ?? null,
      personnelBonus: baseline2026Row?.personnelBonus ?? null,
      languageSpecialists: baseline2026Row?.languageSpecialists ?? null,
    };
    const actualFunding = { ...actualDefaults, ...(settings.actualFunding || {}) };
    const modelActualFunding = Object.fromEntries(Object.entries(actualFunding).map(([key, value]) => {
      return [key, isValidFundingValue(value) ? Number(value) : 0];
    }));
    const forecast = calculateReformForecast({ ...settings, actualFunding: modelActualFunding }, {}, financeScenario?.bayKiBiGRules || []);
    const usesFixed2026Baseline = fixedEnabled && baseYear === 2026;
    const rows = calculatedRows.map((row) => {
    const reformYear = forecast.results.find((result) => result.year === row.year);
    const reformGrantApplied = row.year >= 2027 && settings.teamGrantEligible === true;
    const existingGuidelineFunding = row.personnelBonus + row.assistance + row.languageSpecialists;
    const reformGuidelineFunding = reformGrantApplied && reformYear?.teamGrant != null ? reformYear.teamGrant : existingGuidelineFunding;
    const standardFundingExcludingPassThrough = row.totalFunding - row.annualParentFeeSubsidy;
    const baselineGuidelineFunding = modelActualFunding.personnelBonus
      + modelActualFunding.assistance + modelActualFunding.languageSpecialists;
    const reformProjectionFunding = reformYear?.result ?? standardFundingExcludingPassThrough;
    const adjustment = usesFixed2026Baseline
      ? reformProjectionFunding - standardFundingExcludingPassThrough
      : reformGuidelineFunding - existingGuidelineFunding;
    const priorGuidelineFunding = usesFixed2026Baseline ? baselineGuidelineFunding : existingGuidelineFunding;
    const invalidInputs = invalidReformInputs(actualFunding, settings, usesFixed2026Baseline, reformGrantApplied, row.year);
    if (usesFixed2026Baseline && Object.hasOwn(settings, 'actualFunding')
      && (!settings.actualFunding || typeof settings.actualFunding !== 'object' || Array.isArray(settings.actualFunding))) invalidInputs.push('2026-Istwerte');
    if (reformGrantApplied && reformYear?.grantInputsValid === false) invalidInputs.push('Teamzuschuss-Sätze oder genehmigte Plätze');
    const totalFunding = Math.round((row.totalFunding + adjustment) * 100) / 100;
    const totalIncome = Math.round((totalFunding + row.contributions) * 100) / 100;
    const baselineTotalIncome = Math.round((totalFunding - row.annualParentFeeSubsidyChange + row.baselineContributions) * 100) / 100;
    return {
      ...row,
      additionalFunding: Math.round((row.additionalFunding + adjustment) * 100) / 100,
      totalFunding,
      totalIncome,
      baselineTotalIncome,
      totalIncomeChange: Math.round((totalIncome - baselineTotalIncome) * 100) / 100,
      reformTeamGrant: reformGrantApplied ? reformYear?.teamGrant ?? null : 0,
      reformPriorGuidelineFunding: reformGrantApplied ? priorGuidelineFunding : 0,
      reformTeamGrantNet: reformGrantApplied ? (reformYear?.teamGrant == null ? null : reformYear.teamGrant - priorGuidelineFunding) : 0,
      reformTeamRates: reformYear?.teamGrantRates,
      reformTeamRateSources: reformYear?.teamGrantRateSources,
      reformTeamRatesValidForYear: reformYear?.teamGrantRatesValidForYear,
      invalidReformInputs: invalidInputs,
      reformGrantApplied,
      reformProjectionApplied: usesFixed2026Baseline,
      reformProjectionFunding: Math.round(reformProjectionFunding * 100) / 100,
      reformBaselineIncomplete: usesFixed2026Baseline && !baseline2026Row?.yearComplete,
      reformYearUnavailable: (usesFixed2026Baseline || reformGrantApplied) && !reformYear,
      yearComplete: row.yearComplete && (!usesFixed2026Baseline || Boolean(baseline2026Row?.yearComplete))
        && (!(usesFixed2026Baseline || reformGrantApplied) || Boolean(reformYear)) && invalidInputs.length === 0,
    };
    });
    const validBaseline = usesFixed2026Baseline && Boolean(baseline2026Row?.yearComplete)
      && isValidFundingValue(actualFunding.parentFeeSubsidy)
      && (!Object.hasOwn(settings, 'actualFunding') || (settings.actualFunding && typeof settings.actualFunding === 'object' && !Array.isArray(settings.actualFunding)));
    const workbookRows = forecast.results.map((result) => {
      const grantApplied = result.year >= 2027 && settings.teamGrantEligible === true;
      const valid = validBaseline && result.grantInputsValid
        && invalidReformInputs(actualFunding, settings, true, grantApplied, result.year).length === 0;
      return { year: result.year, values: valid ? result.workbookComparison : null };
    });
    return { rows: rows.filter((row) => fundingYears.includes(row.year)), actualDefaults, actualFunding, workbookRows };
  }, [financeScenario, fundingYears]);
  const reformForecastSettings = financeScenario?.settings?.reformForecast || {};
  const activeReform = React.useMemo(() => calculateReformRows(calculatedAnnualIncomeRows, fixedBaseYearEnabled, fixedBaseYear), [calculateReformRows, calculatedAnnualIncomeRows, fixedBaseYearEnabled, fixedBaseYear]);
  const annualIncomeRows = activeTariffConflicts.length ? EMPTY_EVENTS : activeReform.rows;
  const workbookComparisonRows = fixedBaseYearEnabled && fixedBaseYear === 2026
    ? activeReform.workbookRows.map(({ year, values }) => formatWorkbookComparisonRow({ year, values: activeTariffConflicts.length ? null : values }))
    : null;
  const reformActualFundingDefaults = activeReform.actualDefaults;
  const reformActualFunding = activeReform.actualFunding;
  const comparisonLeft = simulationScenarios.find((scenario) => scenario.id === comparisonLeftId);
  const comparisonRight = simulationScenarios.find((scenario) => scenario.id === comparisonRightId);
  const activeLegacyPrices = describeLegacyCategoryPrices(temporaryPrices, groupLabels);
  const activeCatalogSnapshots = describeCatalogSnapshots(temporaryCatalogEntries, groupLabels);
  const comparisonCatalogSnapshots = [['A', comparisonLeft], ['B', comparisonRight]].flatMap(([side, scenario]) => {
    if (!scenario) return [];
    const groups = describeCatalogSnapshots(scenario.data?.temporaryCatalogEntries, groupLabels);
    return groups.length ? [`${side}: ${scenario.name} (${groups.join(', ')})`] : [];
  });
  const comparisonLegacyPrices = [
    ['A', comparisonLeft], ['B', comparisonRight],
  ].flatMap(([side, scenario]) => {
    if (!scenario) return [];
    const descriptions = describeLegacyCategoryPrices(scenario.data?.temporaryPrices, groupLabels);
    return descriptions.length ? [`${side}: ${scenario.name} (${descriptions.join('; ')})`] : [];
  });
  const scenarioComparison = React.useMemo(() => {
    if (!comparisonLeft || !comparisonRight) return null;
    const leftOptions = savedScenarioCalculationOptions(comparisonLeft, groupFeeCatalogs, currentYear);
    const rightOptions = savedScenarioCalculationOptions(comparisonRight, groupFeeCatalogs, currentYear);
    if (!leftOptions || !rightOptions) return { unavailable: true, leftName: comparisonLeft.name, rightName: comparisonRight.name, leftFormat: describeScenarioFormat(comparisonLeft), rightFormat: describeScenarioFormat(comparisonRight) };
    const run = (options) => qualifySavedScenarioRows(
      calculateReformRows(calculateAnnualIncomeRows(options), options.fixedBaseYearEnabled, options.fixedBaseYear).rows,
      options, financeScenario?.settings?.reformForecast,
    );
    const left = run(leftOptions);
    const right = run(rightOptions);
    return {
      leftName: comparisonLeft.name, rightName: comparisonRight.name,
      sharedAssumptions: `Stichtag ${referenceDate}; Forecast-Gruppenfilter: ${forecastGroups.length ? forecastGroups.map((id) => groupLabels.get(String(id)) || String(id)).join(', ') : 'alle Gruppen'}. Der Forecast-Filter gilt nur für bekannte und projizierte Bestände; bisherige und fixierte Bestände umfassen alle Gruppen. Der gespeicherte Gruppenfilter beschränkt nur die Tarifanzeige, nicht die Jahreswerte. Ereignisse: ${forecastEventsAvailable ? 'verfügbar' : 'nicht verfügbar oder nicht aktualisiert'}.`,
      leftBase: `${describeScenarioFormat(comparisonLeft)} · ${leftOptions.baseLabel}${!leftOptions.fixedBaseYearEnabled && leftOptions.stockMode === 'projected' ? ` · Zulauf ${leftOptions.forecastInflowEnabled ? 'an' : 'aus'}` : ''}`,
      rightBase: `${describeScenarioFormat(comparisonRight)} · ${rightOptions.baseLabel}${!rightOptions.fixedBaseYearEnabled && rightOptions.stockMode === 'projected' ? ` · Zulauf ${rightOptions.forecastInflowEnabled ? 'an' : 'aus'}` : ''}`,
      rows: buildSavedScenarioFinancialComparisonRows(left, right),
      teamGrantRateSummary: [['A', left], ['B', right]].flatMap(([side, rows]) => rows.map((row) => {
        const description = describeTeamGrantRates(row);
        return description ? `${side}: ${description}` : null;
      }).filter(Boolean)),
      subsidyExceedsTariff: left.some((row) => row.subsidyExceedsTariffChildMonths > 0)
        || right.some((row) => row.subsidyExceedsTariffChildMonths > 0),
    };
  }, [comparisonLeft, comparisonRight, currentYear, groupFeeCatalogs, calculateAnnualIncomeRows, calculateReformRows, financeScenario, referenceDate, forecastGroups, groupLabels, forecastEventsAvailable]);
  const familyImpactHistogram = React.useMemo(
    () => buildFamilyImpactHistogramData(annualIncomeRows.filter((row) => row.yearComplete), familyHistogramMode),
    [annualIncomeRows, familyHistogramMode]
  );
  const familyImpactHistogramSeries = familyImpactHistogram.series.map((year, index) => ({
    name: year,
    color: FAMILY_HISTOGRAM_COLORS[index % FAMILY_HISTOGRAM_COLORS.length],
  }));
  const selectedAnnualDetails = annualIncomeRows.find((row) => row.year === selectedDetailsYear) || null;
  const selectedAnnualDetailTotals = selectedAnnualDetails?.monthlyDetails.reduce((total, row) => ({
    children: total.children + row.children,
    under3Children: total.under3Children + row.under3Children,
    overTwentyHoursChildren: total.overTwentyHoursChildren + (row.overTwentyHoursPercent * row.children / 100),
    integratedChildren: total.integratedChildren + (Number(row.integratedChildren) || 0),
    expertRatioPercent: total.expertRatioPercent + (Number(row.expertRatioPercent) || 0),
    expertRatioMonths: total.expertRatioMonths + (row.expertRatioPercent == null ? 0 : 1),
    operatingDays: total.operatingDays + (Number(row.operatingDays) || 0),
    weeklyHours: total.weeklyHours + row.weeklyHours,
    bookingHoursDaily: total.bookingHoursDaily + row.bookingHoursDaily,
    weightedBookingHoursDaily: total.weightedBookingHoursDaily + row.weightedBookingHoursDaily,
    staffHours: total.staffHours + row.staffHours,
    expertStaffHours: total.expertStaffHours + row.expertStaffHours,
    minimumExpertHours: total.minimumExpertHours + row.minimumExpertHours,
    expertHoursDelta: total.expertHoursDelta + row.expertHoursDelta,
    basisFunding: total.basisFunding + row.baseFunding,
    preparatoryCourses: total.preparatoryCourses + row.preparatoryCourses,
    under3Additional: total.under3Additional + row.under3Additional,
    under3Federal: total.under3Federal + row.under3Federal,
    qualityBonus: total.qualityBonus + row.qualityBonus,
    totalFunding: total.totalFunding + row.totalFunding,
    parentFeeSubsidy: total.parentFeeSubsidy + row.parentFeeSubsidy,
  }), {
    children: 0,
    under3Children: 0,
    overTwentyHoursChildren: 0,
    integratedChildren: 0,
    expertRatioPercent: 0,
    expertRatioMonths: 0,
    operatingDays: 0,
    weeklyHours: 0,
    bookingHoursDaily: 0,
    weightedBookingHoursDaily: 0,
    staffHours: 0,
    expertStaffHours: 0,
    minimumExpertHours: 0,
    expertHoursDelta: 0,
    basisFunding: 0,
    preparatoryCourses: 0,
    under3Additional: 0,
    under3Federal: 0,
    qualityBonus: 0,
    totalFunding: 0,
    parentFeeSubsidy: 0,
  });
  const selectedAnnualFamilyTotals = selectedAnnualDetails?.familyTree.reduce((total, family) => ({
    annualBookingHours: total.annualBookingHours + family.annualBookingHours,
    annualFunding: total.annualFunding + family.annualFunding,
    averageDailyHours: total.averageDailyHours + family.averageDailyHours,
    children: total.children + family.children.length,
  }), {
    annualBookingHours: 0,
    annualFunding: 0,
    averageDailyHours: 0,
    children: 0,
  });

  const setTemporaryCatalog = (groupId, nextEntries) => {
    if (activeTariffConflicts.length) return;
    const originalEntries = groupFeeCatalogs[groupId] || [];
    // Preserve legacy snapshots/overrides as-is; do not silently reinterpret them.
    if (!Object.hasOwn(temporaryCatalogEntries, groupId) && !Object.hasOwn(temporaryPrices, groupId)) {
      const groups = { ...(tariffOverlay?.groups || {}) };
      const operations = updateTariffOverlayGroup(originalEntries, nextEntries, groups[groupId]);
      if (operations.length) Object.defineProperty(groups, groupId, { value: operations, enumerable: true, writable: true, configurable: true });
      else delete groups[groupId];
      updateFundingSimulation({ tariffOverlay: { version: 1, groups } });
      return;
    }
    const overrides = { ...(temporaryPrices[groupId] || {}) };
    const previousEntries = effectiveFeeCatalogs[groupId] || [];
    const currentEntries = simulationCatalogs[groupId] || [];
    const structuralEntries = nextEntries.map((entry) => {
      const key = getFeeBandSimulationPriceKey(entry);
      const original = originalEntries.find((candidate) => getFeeBandSimulationPriceKey(candidate) === key);
      const current = currentEntries.find((candidate) => getFeeBandSimulationPriceKey(candidate) === key);
      const previous = previousEntries.find((candidate) => getFeeBandSimulationPriceKey(candidate) === key);
      const baseAmount = Number(current?.monthlyAmount ?? original?.monthlyAmount) || 0;
      const nextAmount = Number(entry.monthlyAmount) || 0;
      const previousAmount = Number(previous?.monthlyAmount) || 0;
      if (Math.round(previousAmount * 100) !== Math.round(nextAmount * 100)) {
        const legacyKey = getFeeBandZeitkatId(entry) || `band:${String(entry?.id || '')}`;
        const legacyOverride = getFeeBandSimulationPriceOverride(entry, { [legacyKey]: overrides[legacyKey] });
        if (Math.round(baseAmount * 100) === Math.round(nextAmount * 100) && legacyOverride === undefined) {
          delete overrides[key];
        } else {
          overrides[key] = nextAmount;
        }
      }
      return { ...entry, monthlyAmount: current ? current.monthlyAmount : original ? original.monthlyAmount : 0 };
    });
    if (Object.hasOwn(temporaryCatalogEntries, groupId)) {
      updateFundingSimulation({
        temporaryCatalogEntries: { ...temporaryCatalogEntries, [groupId]: structuralEntries },
        temporaryPrices: { ...temporaryPrices, [groupId]: overrides },
      });
    } else {
      const groups = { ...(tariffOverlay?.groups || {}) };
      const operations = updateTariffOverlayGroup(originalEntries, structuralEntries, groups[groupId]);
      if (operations.length) Object.defineProperty(groups, groupId, { value: operations, enumerable: true, writable: true, configurable: true });
      else delete groups[groupId];
      updateFundingSimulation({ tariffOverlay: { version: 1, groups }, temporaryPrices: { ...temporaryPrices, [groupId]: overrides } });
    }
  };
  const resetTemporaryCatalog = (groupId) => {
    const keepOtherGroups = (values) => Object.fromEntries(
      Object.entries(values).filter(([id]) => id !== String(groupId))
    );
    updateFundingSimulation({
      temporaryCatalogEntries: keepOtherGroups(temporaryCatalogEntries),
      temporaryPrices: keepOtherGroups(temporaryPrices),
      tariffOverlay: tariffOverlay?.version === 1 ? { version: 1, groups: keepOtherGroups(tariffOverlay.groups) } : null,
    });
  };
  const resetAllTemporaryCatalogs = () => {
    updateFundingSimulation({
      temporaryCatalogEntries: {},
      temporaryPrices: {},
      tariffOverlay: null,
    });
  };
  const captureSimulationScenarioData = () => ({
    tariffOverlay: clonePlainData(tariffOverlay),
    temporaryCatalogEntries: clonePlainData(temporaryCatalogEntries),
    temporaryPrices: clonePlainData(temporaryPrices),
    selectedGroupIds: [...selectedGroupIds],
    fixedBaseYearEnabled,
    fixedBaseYear,
    stockMode,
    forecastInflowEnabled,
    potentialMonthlyBudget,
  });
  const hasUnsavedScenarioChanges = JSON.stringify(captureSimulationScenarioData()) !== JSON.stringify({
    tariffOverlay: selectedSimulationScenario?.data?.tariffOverlay || null,
    temporaryCatalogEntries: selectedSimulationScenario?.data?.temporaryCatalogEntries || {},
    temporaryPrices: selectedSimulationScenario?.data?.temporaryPrices || {},
    selectedGroupIds: selectedSimulationScenario?.data?.selectedGroupIds || [],
    fixedBaseYearEnabled: selectedSimulationScenario?.data?.fixedBaseYearEnabled === true,
    fixedBaseYear: selectedSimulationScenario?.data?.fixedBaseYearEnabled === true
      ? Number(selectedSimulationScenario.data.fixedBaseYear) || currentYear : currentYear,
    stockMode: ['known', 'projected'].includes(selectedSimulationScenario?.data?.stockMode) ? selectedSimulationScenario.data.stockMode : 'legacy',
    forecastInflowEnabled: selectedSimulationScenario?.data?.forecastInflowEnabled === true,
    potentialMonthlyBudget: Number.isFinite(Number(selectedSimulationScenario?.data?.potentialMonthlyBudget))
      ? Number(selectedSimulationScenario.data.potentialMonthlyBudget) : 50,
  });
  const applySimulationScenario = (scenarioId) => {
    const scenario = simulationScenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) return;
    const data = scenario.data || {};
    if (data.schemaVersion != null && (data.schemaVersion !== 2 || !validScenarioV2(data))) {
      notifications.show({ title: 'Szenario nicht unterstützt', message: 'Unbekanntes oder ungültiges Szenarioformat; die Sicherung bleibt unverändert.', color: 'red' });
      return;
    }
    updateFundingSimulation({
      selectedSimulationScenarioId: scenario.id,
      tariffOverlay: clonePlainData(data.tariffOverlay || null),
      temporaryCatalogEntries: clonePlainData(data.temporaryCatalogEntries || {}),
      temporaryPrices: clonePlainData(data.temporaryPrices || {}),
      selectedGroupIds: [...(data.selectedGroupIds || [])],
      fixedBaseYearEnabled: data.fixedBaseYearEnabled === true,
      fixedBaseYear: Number(data.fixedBaseYear) || currentYear,
      stockMode: ['known', 'projected'].includes(data.stockMode) ? data.stockMode : 'legacy',
      forecastInflowEnabled: data.forecastInflowEnabled === true,
      potentialMonthlyBudget: Number.isFinite(Number(data.potentialMonthlyBudget))
        ? Number(data.potentialMonthlyBudget)
        : 50,
    });
  };
  const handleSaveSimulationScenario = () => {
    const name = scenarioNameDraft.trim();
    if (!name) return;
    if (activeTariffConflicts.length) return;
    const scenario = { id: createLocalScenarioId(), name, data: { schemaVersion: 2, ...captureSimulationScenarioData() } };
    updateFundingSimulation({
      simulationScenarios: [...simulationScenarios, scenario],
      selectedSimulationScenarioId: scenario.id,
    });
    setScenarioSaveOpened(false);
    notifications.show({ title: 'Szenario gespeichert', message: `„${name}“ wird im gemeinsamen Workspace gespeichert.`, color: 'teal' });
  };
  const handleNewSimulationScenario = () => {
    const scenario = {
      id: createLocalScenarioId(),
      name: `Neues Szenario ${simulationScenarios.length}`,
      data: {
        schemaVersion: 2,
        tariffOverlay: null,
        temporaryCatalogEntries: {},
        temporaryPrices: {},
        selectedGroupIds: [],
        fixedBaseYearEnabled: false,
        fixedBaseYear: currentYear,
        stockMode: 'legacy',
        forecastInflowEnabled: false,
        potentialMonthlyBudget: 50,
      },
    };
    updateFundingSimulation({
      simulationScenarios: [...simulationScenarios, scenario],
      selectedSimulationScenarioId: scenario.id,
      tariffOverlay: null,
      temporaryCatalogEntries: {},
      temporaryPrices: {},
      selectedGroupIds: [],
      fixedBaseYearEnabled: false,
      fixedBaseYear: currentYear,
      stockMode: 'legacy',
      forecastInflowEnabled: false,
      potentialMonthlyBudget: 50,
    });
  };
  const handleCloneSimulationScenario = () => {
    if (activeTariffConflicts.length) return;
    const scenario = {
      id: createLocalScenarioId(),
      name: `${selectedSimulationScenario?.name || 'Szenario'} (Kopie)`,
      data: { schemaVersion: 2, ...captureSimulationScenarioData() },
    };
    updateFundingSimulation({
      simulationScenarios: [...simulationScenarios, scenario],
      selectedSimulationScenarioId: scenario.id,
    });
  };
  const requestScenarioAction = (action) => {
    if (hasUnsavedScenarioChanges) setPendingScenarioAction(() => action);
    else action();
  };
  const handleExportHtml = () => {
    if (activeTariffConflicts.length) return;
    if ((!fixedBaseYearEnabled && stockMode !== 'legacy') || annualIncomeRows.some((row) => !row.yearComplete)) {
      notifications.show({ title: 'HTML-Export nicht möglich', message: 'Forecast-Bestände oder unvollständige Daten werden vom HTML-Export nicht unterstützt.', color: 'orange' });
      return;
    }
    try {
      const snapshot = buildAggregateSimulationSnapshot({
        annualIncomeRows,
        familyProfileData: annualIncomeRows.find((row) => row.familyProfileData)?.familyProfileData,
        groupDefs,
        groupFeeCatalogs,
        simulationCatalogs,
        effectiveFeeCatalogs,
        temporaryPrices,
        parentFeeSubsidy,
        effectiveParentFeeSubsidiesByGroup,
        referenceDate,
        fixedBaseYearEnabled,
        fixedBaseYear,
        potentialMonthlyBudget,
      });
      setPendingHtmlExport(snapshot);
    } catch (error) {
      notifications.show({
        title: 'HTML-Export fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Die HTML-Datei konnte nicht erstellt werden.',
        color: 'red',
      });
    }
  };
  const handleConfirmHtmlExport = () => {
    if (!pendingHtmlExport) return;
    try {
      const html = buildStandaloneSimulationHtml(pendingHtmlExport);
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `capakita-beitragssimulation-${pendingHtmlExport.referenceMonth || 'export'}.html`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPendingHtmlExport(null);
      notifications.show({ title: 'HTML exportiert', message: 'Die datensparsame Simulation wurde heruntergeladen.', color: 'teal' });
    } catch (error) {
      notifications.show({
        title: 'HTML-Export fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Die HTML-Datei konnte nicht erstellt werden.',
        color: 'red',
      });
    }
  };
  const handleExportPdf = async () => {
    if (activeTariffConflicts.length) return;
    setPdfExportLoading(true);
    try {
      const annualRows = annualIncomeRows.map((row, index) => {
        const previous = row.yearComplete && annualIncomeRows[index - 1]?.year === row.year - 1 && annualIncomeRows[index - 1]?.yearComplete ? annualIncomeRows[index - 1] : null;
        const upgradeHours = row.annualPotential.upgradeDailyHours;
        const downgradeHours = row.annualPotential.downgradeDailyHours;
        const upgradeFundingChange = row.annualPotential.upgradeFunding;
        const downgradeFundingChange = row.annualPotential.downgradeFunding;
        const upgradeParentFeeChange = row.annualPotential.upgradeParentFees;
        const downgradeParentFeeChange = row.annualPotential.downgradeParentFees;
        const formatPotential = (hours, totalIncomeChange, direction) => (
          hours > 0
            ? `${direction === 'upgrade' ? '+' : '-'}${formatDailyHours(hours)}\n${formatSignedEuro(totalIncomeChange)} Einnahmen/Jahr`
            : '–'
        );
        const formatAnnualMetric = (value, yearChange, simulationChange = null) => [
          formatEuro(value),
          ...(yearChange == null ? [] : [`${formatSignedEuro(yearChange)} zum Vorjahr`]),
          ...(simulationChange == null ? [] : [`${formatSignedEuro(simulationChange)} Simulation`]),
        ].join('\n');
        const hourChange = previous
          ? row.averageDailyBookingHours - previous.averageDailyBookingHours
          : null;
        return [
          row.yearComplete ? row.year : `${row.year}*`,
          formatEuro(row.additionalFunding),
          [formatDailyHours(row.averageDailyBookingHours), ...(hourChange == null ? [] : [`${formatSignedHours(hourChange)} zum Vorjahr`])].join('\n'),
          formatAnnualMetric(row.totalFunding, previous ? row.totalFunding - previous.totalFunding : null),
          formatAnnualMetric(
            row.contributions,
            previous ? row.contributions - previous.contributions : null,
            row.yearComplete ? row.contributionsChange : null
          ),
          formatAnnualMetric(
            row.totalIncome,
            previous ? row.totalIncome - previous.totalIncome : null,
            row.yearComplete ? row.totalIncomeChange : null
          ),
          formatPotential(upgradeHours, upgradeFundingChange + upgradeParentFeeChange, 'upgrade'),
          formatPotential(downgradeHours, downgradeFundingChange + downgradeParentFeeChange, 'downgrade'),
        ];
      });
      const annualFundingDetailRows = annualIncomeRows.map((row) => [
        row.yearComplete ? row.year : `${row.year}*`,
        row.monthlyDetails.reduce((sum, month) => sum + month.under3Children, 0),
        formatEuro(row.under3Additional),
        ...['under3Federal', 'personnelBonus', 'assistance', 'languageSpecialists'].map((key) => {
          const value = row.annualFundingInputValues[key];
          return isValidFundingValue(value) ? formatEuro(value) : 'Nicht verfügbar';
        }),
        formatAvailableEuro(row.reformTeamGrant),
        formatEuro(row.reformPriorGuidelineFunding),
        row.reformTeamGrantNet == null ? 'Nicht verfügbar' : formatEuro(row.reformTeamGrantNet),
      ]);
      const feeRows = buildSimulationFeePdfRows({
        tariffGroups,
        groupFeeCatalogs,
        effectiveFeeCatalogs,
        parentFeeSubsidiesByGroup: effectiveParentFeeSubsidiesByGroup,
        parentFeeSubsidy,
        referenceDate,
      });
      const groupFilterLabel = selectedGroupIds.length
        ? selectedGroupIds.map((groupId) => groupFilterOptions.find((option) => option.value === groupId)?.label || groupId).join(', ')
        : 'Alle Gruppen';
      const baseYearLabel = fixedBaseYearEnabled
        ? `Fixiertes Basisjahr: ${fixedBaseYear} (Kinderbestand, Buchungsstunden und Zusatzförderungen)`
        : `${STOCK_MODE_LABELS[stockMode]} · Monatsanfang (Stichtag ${referenceDate})`;
      const familyYearGroups = pdfIncludeFamilies ? buildAnnualFamilyImpactPdfGroups(annualIncomeRows.filter((row) => row.yearComplete)) : [];
      const forecastSummary = !fixedBaseYearEnabled && stockMode !== 'legacy' ? [
        `Forecast: ${STOCK_MODE_LABELS[stockMode]}, Monatsanfang; ${forecastInputs.filtered ? 'Forecast-Gruppenfilter aktiv' : 'alle Gruppen'}. Zahlen vor Stichtag nicht durch die Prognose abgedeckt.`,
        ...(stockMode === 'projected' ? [`Zulaufoption im Panel unabhängig von der Forecast-Ansicht: ${forecastInflowEnabled ? (forecastInputs.canEstimateInflow ? 'eingeschaltet, Historienheuristik bis sechs Jahre; anonymer Zulauf finanziell nicht berechenbar; zukünftige Jahreswerte unvollständig, auch ohne erzeugten anonymen Zulauf' : 'nicht abschätzbar') : 'ausgeschaltet'}. Ereignisse: ${forecastEventsAvailable ? 'verfügbar' : 'nicht verfügbar oder nicht aktualisiert'}.`, forecastInputs.inflowBasis] : []),
        ...annualIncomeRows.map((row) => {
          const reasons = [...new Set(row.forecastGaps.flatMap((gap) => gap.reasons).map((reason) => FORECAST_GAP_LABELS[reason] || reason))];
          return `${row.year}: bekannt ${row.forecastKnownChildMonths}, projiziert ${row.forecastProjectedChildMonths}, ungeklärt ${row.forecastUnknownChildMonths} Kind-Monate; ${row.forecastGaps.reduce((sum, gap) => sum + (gap.input == null ? gap.count : 0), 0)} nicht berechenbare Kind-Monate${reasons.length ? ` (${reasons.join(', ')})` : ''}${row.outsideForecastMonths ? `; ${row.outsideForecastMonths} Monate vor Stichtag` : ''}${stockMode === 'projected' && forecastInflowEnabled && row.year > currentYear + 6 ? '; Zulaufhorizont überschritten' : ''}.`;
        }),
      ] : null;
      await generateSimulationPdfReport({
        scenarioName: selectedSimulationScenario?.name || 'Szenario',
        scenarioFormat: describeScenarioFormat(selectedSimulationScenario),
        hasUnsavedScenarioChanges,
        referenceDate,
        groupFilterLabel,
        baseYearLabel,
        feeRows,
        annualRows,
        annualFundingDetailRows,
        familyYearGroups,
        potentialMonthlyBudget,
        missingTariffYears: annualIncomeRows.filter((row) => !row.feeCalculationComplete)
          .map((row) => `${row.year}: ${row.missingTariffChildMonths || 'Diagnose fehlt'}`),
        potentialTariffYears: annualIncomeRows.filter((row) => row.missingPotentialTariffs > 0)
          .map((row) => `${row.year}: ${row.missingPotentialTariffs}`),
        potentialBookingYears: annualIncomeRows.filter((row) => row.incompletePotentialBookings > 0)
          .map((row) => `${row.year}: ${row.incompletePotentialBookings}`),
        subsidyExceedsTariffYears: annualIncomeRows.filter((row) => row.subsidyExceedsTariffChildMonths > 0)
          .map((row) => `${row.year}: ${row.subsidyExceedsTariffChildMonths}`),
        activeLegacyPrices,
        comparisonLegacyPrices,
        activeCatalogSnapshots,
        comparisonCatalogSnapshots,
        scenarioComparison,
        workbookComparisonRows,
        forecastSummary,
        incompleteYears: annualIncomeRows.filter((row) => !row.yearComplete).map((row) => String(row.year)),
        unusableBookingYears: annualIncomeRows.filter((row) => row.unusableBookingChildMonths > 0).map((row) => `${row.year}: ${row.unusableBookingChildMonths}`),
        activeChildrenCoveragePartialYears: annualIncomeRows.filter((row) => row.activeChildrenCoveragePartialMonths > 0).map((row) => `${row.year}: ${row.activeChildrenCoveragePartialMonths}`),
        missingFundingRuleYears: annualIncomeRows.filter((row) => row.missingFundingRuleMonths > 0).map((row) => `${row.year}: ${row.missingFundingRuleMonths}`),
        missingBirthDateYears: annualIncomeRows.filter((row) => row.missingBirthDateChildMonths > 0).map((row) => `${row.year}: ${row.missingBirthDateChildMonths}`),
        reformBaselineIncompleteYears: annualIncomeRows.filter((row) => row.reformBaselineIncomplete).map((row) => String(row.year)),
        reformYearUnavailableYears: annualIncomeRows.filter((row) => row.reformYearUnavailable).map((row) => String(row.year)),
        missingManualFundingYears: annualIncomeRows.filter((row) => row.missingManualFunding.length).map((row) => `${row.year}: ${row.missingManualFunding.join(', ')}`),
        invalidReformInputYears: annualIncomeRows.filter((row) => row.invalidReformInputs.length).map((row) => `${row.year}: ${row.invalidReformInputs.join(', ')}`),
        teamGrantRateSummary: annualIncomeRows.map(describeTeamGrantRates).filter(Boolean),
        includeFamilyList: pdfIncludeFamilies,
      });
      notifications.show({ title: 'PDF exportiert', message: 'Der Simulationsbericht wurde heruntergeladen.', color: 'teal' });
    } catch (error) {
      notifications.show({
        title: 'PDF-Export fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Der Bericht konnte nicht erstellt werden.',
        color: 'red',
      });
    } finally {
      setPdfExportLoading(false);
    }
  };

  const hasRule = (financeScenario?.bayKiBiGRules || []).some((rule) => Number(rule.baseValue) > 0);
  const catalogEntries = Object.values(groupFeeCatalogs).flatMap((entries) => (Array.isArray(entries) ? entries : []));
  const hasAnyZeitkatEntries = catalogEntries.some((entry) => Boolean(getFeeBandZeitkatId(entry)) && entry.enabled !== false && entry.monthlyAmount != null && entry.monthlyAmount !== '' && Number.isFinite(Number(entry.monthlyAmount)) && Number(entry.monthlyAmount) >= 0);
  const hasSimulationFeeRows = categoryPriceRows.length > 0;

  return (
    <Stack
      className="funding-simulation-panel"
      gap="sm"
      h={scrollPage ? 'auto' : '100%'}
      style={{ minHeight: 0, overflow: scrollPage ? 'visible' : 'hidden' }}
      data-testid="funding-simulation-panel"
    >
      {activeTariffConflicts.length ? (
        <Alert color="red" title="Tarif-Overlay nicht anwendbar" data-testid="tariff-overlay-conflict">
          Tarifversion fehlt, ist mehrdeutig oder wurde verändert, oder das Szenarioformat ist unbekannt: {activeTariffConflicts.join(', ')}. Ergebnisse und Exporte sind gesperrt. Bitte Szenario wechseln oder betroffene Gruppen zurücksetzen und Änderungen erneut eingeben; die gespeicherten Szenarien bleiben erhalten.
        </Alert>
      ) : null}
      {activeLegacyPrices.length ? (
        <Alert color="orange" title="Alte versionsübergreifende Tarifpreise in der aktiven Simulation" data-testid="active-legacy-prices-warning">
          {legacyCategoryPriceExplanation} Betroffen: {activeLegacyPrices.join('; ')}.
        </Alert>
      ) : null}
      {activeCatalogSnapshots.length ? (
        <Alert color="orange" title="Tarif-Snapshot im aktiven Arbeitsstand" data-testid="active-catalog-snapshot-warning">
          {catalogSnapshotExplanation} Betroffene Gruppen: {activeCatalogSnapshots.join(', ')}.
        </Alert>
      ) : null}
      <Accordion
        variant="separated"
        radius="md"
        transitionDuration={0}
        className="funding-simulation-settings"
        data-testid="simulation-settings-panel"
      >
        <Accordion.Item value="setup">
          <Accordion.Control>
            <Group gap="xs" wrap="wrap">
              <Text fw={700} size="sm">Simulation von Beitragsänderungen</Text>
              <Badge size="xs" color="gray" variant="light">
                {selectedGroupIds.length === 1
                  ? groupFilterOptions.find((option) => option.value === selectedGroupIds[0])?.label || selectedGroupIds[0]
                  : selectedGroupIds.length > 1 ? `${selectedGroupIds.length} Gruppen` : 'Alle Gruppen'}
              </Badge>
              <Badge size="xs" color="blue" variant="light">
                {fixedBaseYearEnabled ? `Basisjahr: ${fixedBaseYear} (fixiert)` : `${STOCK_MODE_LABELS[stockMode]} (${currentYear})`}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap" data-testid="temporary-category-prices-header">
                <Stack gap={2}>
                  <Text fw={700} size="sm">Simulationseinstellungen</Text>
                  <Text size="xs" c="dimmed">Stichtag {formatBookingDate(referenceDate, referenceDate)} · Simulationsänderungen werden im gemeinsamen Workspace gespeichert</Text>
                </Stack>
                {categoryPriceRows.length > 0 || Object.keys(temporaryCatalogEntries).length > 0 || tariffOverlay ? (
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconRefresh size={14} />}
                    onClick={resetAllTemporaryCatalogs}
                    title="Alle simulierten Beitragsstaffeln auf Ausgangswerte zurücksetzen"
                    data-testid="reset-all-temporary-prices"
                  >
                    Alle zurücksetzen
                  </Button>
                ) : null}
              </Group>
              <Group align="flex-end" gap="md" wrap="wrap">
                <Switch
                  label="Basisjahr für Betreuungsstunden fixieren"
                  checked={fixedBaseYearEnabled}
                  onChange={(event) => updateFundingSimulation({
                    fixedBaseYearEnabled: event.currentTarget.checked,
                    fixedBaseYear: event.currentTarget.checked ? currentYear : fixedBaseYear,
                  })}
                  data-testid="fixed-base-year-toggle"
                />
                <Select
                  label="Fixiertes Basisjahr"
                  data={[{ value: 'none', label: 'Keins' }, ...baseYearOptions]}
                  value={fixedBaseYearEnabled ? String(fixedBaseYear) : 'none'}
                  onChange={(value) => {
                    if (!value || value === 'none') {
                      updateFundingSimulation({ fixedBaseYearEnabled: false, fixedBaseYear: currentYear });
                      return;
                    }
                    updateFundingSimulation({ fixedBaseYear: Number(value), fixedBaseYearEnabled: true });
                  }}
                  w={150}
                  data-testid="fixed-base-year-select"
                />
              </Group>
              <Select
                label="Bestandsmodell ohne fixiertes Basisjahr"
                data={[{ value: 'legacy', label: 'Bisheriger Monatsbestand (ohne Forecast)' }, { value: 'known', label: 'Bekannte Bestände (Forecast)' }, { value: 'projected', label: 'Projizierte Bestände (Forecast)' }]}
                value={stockMode}
                onChange={(value) => value && updateFundingSimulation({ stockMode: value })}
                disabled={fixedBaseYearEnabled}
                w={340}
                data-testid="simulation-stock-mode"
              />
              {!fixedBaseYearEnabled && stockMode === 'projected' ? (
                <Switch label="Synthetischen Zulauf zusätzlich ansetzen" checked={forecastInflowEnabled}
                  onChange={(event) => updateFundingSimulation({ forecastInflowEnabled: event.currentTarget.checked })}
                  data-testid="simulation-forecast-inflow" />
              ) : null}
              <Text size="xs" c="dimmed">
                {fixedBaseYearEnabled
                  ? `Kinderbestand, Buchungsstunden und die vier jährlichen Zusatzförderungen (U3-Bundesmittel, Personalbonus, Assistenz, Sprachförderung) aus ${fixedBaseYear} gelten für alle Ergebnisjahre. Die übrigen Förderregeln werden weiter je Ergebnisjahr berechnet.`
                  : stockMode === 'legacy' ? 'Ohne Fixierung werden Kinderbestand, Buchungsstunden und jährliche Zusatzförderungen je Ergebnisjahr ermittelt.'
                    : 'Forecast: Monatsanfang, szenariobezogener Stichtag, effektive Daten, Gruppenfilter und Ereignisse wie in der Prognose. Nicht zuordenbare Kinder werden nicht finanziell berechnet. Werte vor dem Stichtag sind nicht durch die Prognose abgedeckt.'}
              </Text>
              {!fixedBaseYearEnabled && stockMode === 'projected' ? (
                <Text size="xs" c="orange" data-testid="forecast-configuration-notice">
                  Die Zulauf-Einstellung der Forecast-Ansicht ist hier nicht verfügbar; dieser Schalter gilt unabhängig. {forecastInflowEnabled
                    ? forecastInputs.canEstimateInflow ? 'Geschätzter Zulauf nach gleicher Historienheuristik (bis sechs Jahre); bei gültiger Gesamtkapazität nur bei durchgehend freiem Platz neben allen bekannten Kindern, sonst nicht kapazitätsgeprüft. Ohne konkrete Gruppen, Buchungen und Tarife finanziell nicht berechenbar.' : 'Zulauf nicht abschätzbar: historische Aufnahmedaten fehlen oder ein Forecast-Gruppenfilter ist aktiv.'
                    : 'Synthetischer Zulauf ist hier ausgeschaltet; der Bestand kann dadurch unvollständig sein.'} {!forecastEventsAvailable ? 'Forecast-Ereignisse sind nicht verfügbar oder noch nicht aktualisiert.' : ''}
                </Text>
              ) : null}
              {!fixedBaseYearEnabled && stockMode === 'projected' ? (
                <Text size="xs" c="orange" data-testid="simulation-inflow-basis-setting">{forecastInputs.inflowBasis} {forecastInputs.filtered ? 'Bei aktivem Forecast-Gruppenfilter wird kein Zulauf simuliert.' : ''} {forecastInflowEnabled ? 'Zukünftige Jahreswerte bleiben auch ohne erzeugten anonymen Zulauf unvollständig.' : ''}</Text>
              ) : null}
              <Group justify="space-between" align="flex-end" wrap="wrap">
                <Text size="xs" c="dimmed">Grenzwert für die Familien-Impact-Auswertung</Text>
                <NumberInput
                  label="Budgetänderung pro Familie / Monat"
                  value={potentialMonthlyBudget}
                  onChange={(value) => updateFundingSimulation({ potentialMonthlyBudget: Math.max(0, Number(value) || 0) })}
                  min={0}
                  max={500}
                  step={5}
                  decimalScale={2}
                  thousandSeparator="."
                  decimalSeparator=","
                  suffix=" EUR"
                  w={230}
                  data-testid="family-potential-budget"
                />
              </Group>
              {!hasRule || !hasSimulationFeeRows ? (
                <Group gap="xs" align="flex-start">
                  {!hasRule ? (
                    <Badge color="orange" variant="light" className="funding-simulation-warning" data-testid="simulation-missing-funding-rule">
                      Keine BayKiBiG-Förderregel mit positivem Basiswert konfiguriert (Optionen → Förderregel).
                    </Badge>
                  ) : null}
                  {!hasSimulationFeeRows ? (
                    <Badge color="orange" variant="light" className="funding-simulation-warning">
                      {!catalogEntries.length
                        ? 'Keine Beitragsstaffeln im Capakita-Datenspeicher gefunden. JSON-Katalog unter Optionen → Beiträge importieren.'
                        : hasAnyZeitkatEntries
                          ? `ZEITKAT-Beitragssätze sind vorhanden, aber am Stichtag ${referenceDate} nicht gültig. Bitte die Gültigkeitszeiträume in Optionen → Beiträge prüfen.`
                          : 'Der gespeicherte Katalog enthält keine verwendbaren Beitragsstaffeln für den ausgewählten Stichtag.'}
                    </Badge>
                  ) : null}
                </Group>
              ) : null}
              <Stack className="funding-simulation-filter" gap="xs">
                <Text size="sm" fw={600}>Gruppenfilter</Text>
                <MultiSelect
                  aria-label="Gruppen für Tarif-Einstellungen"
                  placeholder="Alle Gruppen"
                  data={groupFilterOptions}
                  value={selectedGroupIds}
                  onChange={(value) => updateFundingSimulation({ selectedGroupIds: value })}
                  searchable
                  clearable
                  data-testid="simulation-group-filter"
                />
                <Text size="xs" c="dimmed">Legt fest, für welche Gruppen die Tarife angezeigt werden. Der bisherige und der fixierte Bestand umfassen alle Gruppen; im Forecast-Modus gilt stattdessen der Gruppenfilter der Forecast-Ansicht.</Text>
              </Stack>
              <Paper withBorder p="sm" radius="sm" data-testid="reform-simulation-settings">
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Stack gap={2}>
                      <Text size="sm" fw={700}>BayKiBiG-Förderreform</Text>
                      <Text size="xs" c="dimmed">Reformannahmen werden in dieselben Jahresergebnisse eingerechnet. Mit fixiertem Basisjahr 2026 wird das 2026-Ist als Förderbasis fortgeschrieben; ohne diese Fixierung bleiben die jahresspezifischen Kinder- und Buchungsdaten maßgeblich.</Text>
                    </Stack>
                    <Group gap="md" align="flex-end" wrap="wrap">
                      <NumberInput
                        label="Genehmigte Plätze"
                        value={reformForecastSettings.approvedPlaces ?? ''}
                        onChange={(value) => updateReformForecastSetting('approvedPlaces', value)}
                        min={0}
                        decimalScale={0}
                        w={150}
                        data-testid="reform-approved-places"
                      />
                      <Switch
                        label="Anspruch auf Teamzuschuss"
                        checked={reformForecastSettings.teamGrantEligible === true}
                        onChange={(event) => updateReformEligibility(event.currentTarget.checked)}
                        data-testid="reform-team-grant-eligible"
                      />
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Mit fixiertem Basisjahr 2026 folgt die Jahresprojektion der Berechnungsvorlage (2. Lesung): Buchungszeiten und Vorkurse werden mit dem Basiswert, der Qualitätsbonus mit den Jahreswerten fortgeschrieben. U3-Zusatz und U3-Bundesmittel sowie bisherige Assistenz-, Personalbonus- und Sprachförderung stehen nur im Ausgangsjahr; ab 2027 wird bei aktivierter Option stattdessen der Teamzuschuss angesetzt. Ohne fixiertes Basisjahr wird bei aktivierter Option der Teamzuschuss anstelle der jeweiligen jährlichen Richtlinienbeträge angesetzt; andernfalls bleiben diese bestehen. Elternbeitragszuschüsse und Tarifänderungen sind separat zu prüfen. Die Teamzuschuss-Sätze je Förderjahr pflegst du unter Optionen → Förderung → BayKiBiG-Rahmen. Fehlen dort gültige Einzelwerte, werden die ADEBIS-Jahresvorgaben 2026–2029 verwendet; unterjährige Wechsel werden nicht aufgeteilt. Vorlagen- und Modellannahmen, keine rechtliche Bestätigung.
                  </Text>
                  <Text size="xs" fw={600}>2026-Istwerte als Reform-Basis (aus Capakita vorbelegt, bei Bedarf überschreiben)</Text>
                  <Text size="xs" c="dimmed">
                    Ein gespeicherter Reformwert hat Vorrang; andernfalls wird der Wert aus der Capakita-Jahresberechnung 2026 vorbelegt. Diese Werte sind Modellwerte und keine bestätigten Istwerte. Manuell erfasste Zusatzförderungen sind entsprechend gekennzeichnet. Fehlende Angaben bleiben unvollständig.
                  </Text>
                  <Group gap="xs" align="flex-end" wrap="wrap">
                    {[
                      ['bookingTime', 'Buchungszeitenförderung', 'Capakita-Berechnung'],
                      ['qualityBonus', 'Qualitätsbonus', 'Capakita-Berechnung'],
                      ['preparatoryCourses', 'Vorkurse', 'Capakita-Berechnung'],
                      ['under3Additional', 'U3-Zusatzförderung', 'Capakita-Berechnung'],
                      ['under3Federal', 'U3-Bundesmittel', 'Capakita-Jahreswert (manuell)'],
                      ['parentFeeSubsidy', 'Elternbeitragszuschuss', 'Capakita-Berechnung'],
                      ['assistance', 'Assistenz', 'Capakita-Jahreswert (manuell)'],
                      ['personnelBonus', 'Personalbonus', 'Capakita-Jahreswert (manuell)'],
                      ['languageSpecialists', 'Sprachfachkräfte', 'Capakita-Jahreswert (manuell)'],
                    ].map(([field, label, sourceLabel]) => {
                      const calculatedValue = reformActualFundingDefaults[field];
                      const rawValue = reformActualFunding[field];
                      const inputValue = isValidFundingValue(rawValue) ? Number(rawValue) : '';
                      const hasSavedValue = Object.hasOwn(reformForecastSettings.actualFunding || {}, field);
                      const difference = inputValue !== '' && calculatedValue != null ? inputValue - calculatedValue : null;
                      return (
                        <Stack key={field} gap={2} w={160}>
                          <NumberInput
                            label={label}
                            value={inputValue}
                            onChange={(value) => updateReformActualFunding(field, value)}
                            min={0}
                            decimalScale={2}
                            data-testid={`reform-actual-${field}`}
                          />
                          <Text size="xs" c="dimmed" data-testid={`reform-actual-comparison-${field}`}>
                            {sourceLabel}: {calculatedValue == null ? 'Nicht verfügbar' : formatEuro(calculatedValue)}
                          </Text>
                          {hasSavedValue && difference != null && Math.abs(difference) >= 0.005 ? (
                            <Text size="xs" c={difference > 0 ? 'orange' : 'red'} data-testid={`reform-actual-difference-${field}`}>
                              Abweichung: {formatSignedEuro(difference)}
                            </Text>
                          ) : null}
                        </Stack>
                      );
                    })}
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Group className="funding-simulation-scenario-manager" justify="space-between" align="flex-end" wrap="wrap" data-testid="simulation-scenario-manager">
        <Select
          label="Szenario"
          size="xs"
          data={simulationScenarios.map((scenario) => ({ value: scenario.id, label: scenario.name }))}
          value={selectedSimulationScenarioId}
          onChange={(value) => value && value !== selectedSimulationScenarioId && requestScenarioAction(() => applySimulationScenario(value))}
          w={280}
          data-testid="simulation-scenario-select"
        />
        <Group gap={4} wrap="nowrap">
          <Popover opened={scenarioSaveOpened} onChange={setScenarioSaveOpened} position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <ActionIcon
                variant="light"
                color="blue"
                aria-label="Szenario speichern unter neuem Namen"
                title="Aktuelle Simulation als Szenario speichern"
                disabled={activeTariffConflicts.length > 0}
                onClick={() => {
                  setScenarioNameDraft(`${selectedSimulationScenario?.name || 'Szenario'} (Kopie)`);
                  setScenarioSaveOpened(true);
                }}
                data-testid="save-simulation-scenario"
              >
                <IconDeviceFloppy size={16} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <TextInput
                  label="Name des Szenarios"
                  value={scenarioNameDraft}
                  onChange={(event) => setScenarioNameDraft(event.currentTarget.value)}
                  data-testid="simulation-scenario-name"
                />
                <Button size="xs" onClick={handleSaveSimulationScenario} disabled={!scenarioNameDraft.trim()} data-testid="confirm-save-simulation-scenario">
                  Speichern
                </Button>
              </Stack>
            </Popover.Dropdown>
          </Popover>
          <Tooltip label="Neues Szenario mit Ausgangswerten">
            <ActionIcon
              variant="light"
              aria-label="Neues Szenario"
              onClick={() => requestScenarioAction(handleNewSimulationScenario)}
              data-testid="new-simulation-scenario"
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Aktuelles Szenario klonen">
            <ActionIcon
              variant="light"
              aria-label="Szenario klonen"
              disabled={activeTariffConflicts.length > 0}
              onClick={handleCloneSimulationScenario}
              data-testid="clone-simulation-scenario"
            >
              <IconCopy size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Text size="xs" c={hasUnsavedScenarioChanges ? 'orange' : 'dimmed'} data-testid="simulation-scenario-save-status">
        {hasUnsavedScenarioChanges ? 'Änderungen noch nicht als Szenario gesichert. Der Workspace speichert den aktuellen Arbeitsstand.' : 'Szenario-Einstellungen gesichert.'} Gesichert werden Tarifänderungen, Tarifanzeigefilter, Bestandsmodell, Basisjahr, Zulaufoption und Budget; alte Gruppen-Snapshots bleiben erhalten. {overlayExplanation}
      </Text>
      <Modal opened={Boolean(pendingScenarioAction)} onClose={() => setPendingScenarioAction(null)} title="Ungesicherte Szenarioänderungen" centered transitionProps={{ duration: 0 }}>
        <Stack gap="sm">
          <Text>Beim Wechsel gehen die noch nicht als Szenario gesicherten Einstellungen verloren. Zuvor über „Szenario speichern“ sichern?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingScenarioAction(null)}>Abbrechen</Button>
            <Button color="orange" onClick={() => { const action = pendingScenarioAction; setPendingScenarioAction(null); action?.(); }} data-testid="discard-scenario-changes">Änderungen verwerfen</Button>
          </Group>
        </Stack>
      </Modal>
      <Paper
        className="funding-simulation-modeler"
        withBorder
        p="sm"
        radius="md"
        style={{ minWidth: 0, flex: '0 0 auto' }}
        data-testid="simulation-modeler-panel"
      >
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap">
            <Text fw={700} size="sm">Interaktiver Visual Modeler · Beiträge pro Zeitkategorie</Text>
            <Text size="xs" c="dimmed">Gruppe: {selectedGroupIds.length === 1 ? groupLabels.get(selectedGroupIds[0]) || selectedGroupIds[0] : 'Gruppenweise'}</Text>
          </Group>
          {tariffGroups.length > 0 ? (
            <Carousel
              withControls={tariffGroups.length > 1}
              withIndicators={false}
              slideSize="100%"
              slideGap="sm"
              emblaOptions={{ loop: false, align: 'start' }}
              data-testid="simulation-tariff-groups"
            >
              {tariffGroups.map((group) => {
                const storedSubsidy = parentFeeSubsidiesByGroup[group.id] || parentFeeSubsidy;
                return (
                  <Carousel.Slide key={group.id} data-testid={`simulation-tariff-slide-${group.id}`}>
                    <Stack gap="xs">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Stack gap={0}>
                          <Group gap="xs" wrap="nowrap">
                            <Text fw={600}>{group.name}</Text>
                            <Text size="xs" c="dimmed">{(effectiveFeeCatalogs[group.id] || []).filter((entry) => entry.enabled !== false && entry.monthlyAmount != null && entry.monthlyAmount !== '' && Number.isFinite(Number(entry.monthlyAmount)) && Number(entry.monthlyAmount) >= 0).length} Staffeln</Text>
                          </Group>
                          <Text size="xs" c="dimmed" data-testid={`simulation-parent-fee-subsidy-amount-${group.id}`}>
                            Elternbeitragszuschuss: {formatEuro(storedSubsidy.monthlyAmount)} / Kind / Monat · gilt bis {formatBookingDate(storedSubsidy.endDate, 'unbegrenzt')}
                          </Text>
                        </Stack>

                      </Group>
                      <FeeStaircaseEditor
                        entries={effectiveFeeCatalogs[group.id] || []}
                        originalEntries={groupFeeCatalogs[group.id] || []}
                        referenceDate={referenceDate}
                        simulation
                        onChangeEntries={(nextEntries) => setTemporaryCatalog(group.id, nextEntries)}
                        onResetAll={() => resetTemporaryCatalog(group.id)}
                      />
                    </Stack>
                  </Carousel.Slide>
                );
              })}
            </Carousel>
          ) : (
            <Text size="xs" c="dimmed">Es gibt für den ausgewählten Stichtag keine ZEITKAT- oder Wochenstunden-Beitragsstaffeln.</Text>
          )}
        </Stack>
      </Paper>
      <Paper
        className="funding-simulation-results"
        withBorder
        p="sm"
        radius="md"
        style={scrollPage
          ? { minWidth: 0, width: '100%', flex: '0 0 auto', overflow: 'visible' }
          : { minWidth: 0, minHeight: 0, width: '100%', flex: '1 1 0', overflow: 'auto' }}
        data-testid="simulation-results-panel"
      >
        <Stack gap="sm" style={{ minHeight: 0 }}>
          <Group className="funding-simulation-results-heading" justify="space-between" align="center" wrap="wrap">
            <Title order={3}>Ergebnis der Jahre & Familien-Impact</Title>
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="dimmed">Stichtag {formatBookingDate(referenceDate, referenceDate)}</Text>
              <Button
                size="xs"
                variant="outline"
                leftSection={<IconFileText size={15} />}
                onClick={handleExportHtml}
                disabled={activeTariffConflicts.length > 0}
                data-testid="export-simulation-html"
              >
                HTML exportieren
              </Button>
              <Button
                size="xs"
                variant="outline"
                leftSection={<IconFileText size={15} />}
                loading={pdfExportLoading}
                disabled={activeTariffConflicts.length > 0}
                onClick={() => setPdfPrivacyOpened(true)}
                data-testid="export-simulation-pdf"
              >
                PDF exportieren
              </Button>
            </Group>
          </Group>
          <Paper withBorder p="sm" radius="sm" data-testid="saved-scenario-comparison">
            <Stack gap="xs">
              <Text fw={700} size="sm">Gespeicherte Szenarien vergleichen</Text>
              <Text size="xs" c="dimmed">{overlayExplanation} Alte Gruppen-Snapshots ersetzen die jeweiligen Gruppenstaffeln. Ungesicherte Änderungen am Arbeitsstand fließen nicht ein. Fehlende oder ungültige manuelle Förderwerte sowie geschätzter Zulauf machen den Vergleichswert nicht verfügbar. Der nominale Zuschuss ist bereits in der Förderung enthalten; seine tatsächliche Auszahlung ist nicht zugesichert. Die Vollständigkeitsprüfung deckt nur erkannte Datenlücken ab und ersetzt keine fachliche oder rechtliche Prüfung.</Text>
              <Text size="xs" data-testid="comparison-scenario-formats">{[['A', comparisonLeft], ['B', comparisonRight]].filter(([, scenario]) => scenario).map(([side, scenario]) => `${side}: ${scenario.name} – ${describeScenarioFormat(scenario)}`).join(' · ')}</Text>
              <Group align="flex-end" wrap="wrap">
                <Select label="Szenario A" value={comparisonLeftId} onChange={setComparisonLeftId} data={simulationScenarios.map((scenario) => ({ value: scenario.id, label: scenario.name }))} clearable data-testid="comparison-scenario-a" />
                <Select label="Szenario B" value={comparisonRightId} onChange={setComparisonRightId} data={simulationScenarios.map((scenario) => ({ value: scenario.id, label: scenario.name }))} clearable data-testid="comparison-scenario-b" />
              </Group>
              {comparisonLegacyPrices.length ? (
                <Alert color="orange" title="Alte versionsübergreifende Tarifpreise im Szenariovergleich" data-testid="comparison-legacy-prices-warning">
                  {legacyCategoryPriceExplanation} Betroffen: {comparisonLegacyPrices.join('; ')}.
                </Alert>
              ) : null}
              {comparisonCatalogSnapshots.length ? (
                <Alert color="orange" title="Tarif-Snapshots im Szenariovergleich" data-testid="comparison-catalog-snapshot-warning">
                  {catalogSnapshotExplanation} Betroffen: {comparisonCatalogSnapshots.join('; ')}.
                </Alert>
              ) : null}
              {scenarioComparison?.unavailable ? <Text c="orange" size="sm">Szenario-Einstellungen fehlen, sind ungültig oder ein Tarif-Overlay ist nicht anwendbar; ein Vergleich ist nicht möglich.</Text> : null}
              {scenarioComparison && !scenarioComparison.unavailable ? (
                <>
                  <Text size="xs" c="dimmed">A: {scenarioComparison.leftBase} · B: {scenarioComparison.rightBase}. Unterschiedliche Bestandsmodelle und Basisjahre ändern den Monatsbestand und schränken die Vergleichbarkeit ein. Forecast-Zulaufoptionen sind getrennt von der Forecast-Ansicht gespeichert. {scenarioComparison.sharedAssumptions}</Text>
                  {scenarioComparison.teamGrantRateSummary.length ? <Text size="xs" c="dimmed" data-testid="comparison-team-grant-rates">Teamzuschuss-Sätze zum 1. Januar je Platz/Jahr (Förderregel oder ADEBIS-Jahresvorgabe; unterjährige Wechsel nicht aufgeteilt): {scenarioComparison.teamGrantRateSummary.join(' · ')}</Text> : null}
                  {scenarioComparison.subsidyExceedsTariff ? <Text size="xs" c="orange">In mindestens einem Szenario übersteigt der Zuschuss den Tarif; die tatsächliche Auszahlung ist ungeklärt.</Text> : null}
                  {scenarioComparison.rows.length === 0 ? <Text size="xs" c="orange">Keine Förderjahre für einen Vergleich verfügbar.</Text> : null}
                  <Table withTableBorder withColumnBorders fz="xs" data-testid="saved-scenario-comparison-table">
                    <Table.Thead><Table.Tr><Table.Th>Jahr</Table.Th><Table.Th>Jahreswert</Table.Th><Table.Th ta="right">A</Table.Th><Table.Th ta="right">B</Table.Th><Table.Th ta="right">B minus A</Table.Th></Table.Tr></Table.Thead>
                    {scenarioComparison.rows.map((row) => <Table.Tbody key={row.year} data-testid={`saved-scenario-comparison-${row.year}`}>
                      {SAVED_SCENARIO_FINANCIAL_FIELDS.map(({ key, label }, index) => {
                        const value = row.values[key];
                        return <Table.Tr key={key}>
                          <Table.Td>{index === 0 ? row.year : ''}</Table.Td><Table.Td>{label}</Table.Td>
                          <Table.Td ta="right">{value.baseline == null ? 'Nicht verfügbar' : formatEuro(value.baseline)}</Table.Td>
                          <Table.Td ta="right">{value.scenario == null ? 'Nicht verfügbar' : formatEuro(value.scenario)}</Table.Td>
                          <Table.Td ta="right">{value.delta == null ? 'Nicht verfügbar' : formatSignedEuro(value.delta)}</Table.Td>
                        </Table.Tr>;
                      })}
                      {!row.leftComplete || !row.rightComplete ? <Table.Tr><Table.Td colSpan={5}><Text size="xs" c="orange">{[!row.leftComplete ? `A: ${row.leftReasons.join(', ')}` : '', !row.rightComplete ? `B: ${row.rightReasons.join(', ')}` : ''].filter(Boolean).join(' · ')}</Text></Table.Td></Table.Tr> : null}
                    </Table.Tbody>)}
                  </Table>
                  <Text size="xs" c="dimmed">Unvollständige Jahresergebnisse werden nicht verglichen. Der ausgewählte Vergleich wird in den PDF-Bericht aufgenommen.</Text>
                </>
              ) : null}
            </Stack>
          </Paper>
          {workbookComparisonRows ? (
            <Paper withBorder p="sm" radius="sm" data-testid="workbook-annual-comparison">
              <Stack gap="xs">
                <Text fw={700} size="sm">Indikativer Jahresvergleich nach Excel-Vorlage</Text>
                <Text size="xs" c="dimmed">{workbookComparisonExplanation} Im PDF-Bericht enthalten.</Text>
                {activeTariffConflicts.length ? <Text size="xs" c="orange">Das aktive Tarif-Overlay ist nicht anwendbar; die Basiswerte sind nicht verfügbar.</Text> : null}
                <Table withTableBorder withColumnBorders fz="xs">
                  <Table.Thead><Table.Tr><Table.Th>Jahr</Table.Th><Table.Th ta="right">Reduzierte Beiträge: Gesamt</Table.Th><Table.Th ta="right">Änderung zum Vorjahr</Table.Th><Table.Th ta="right">Zusätzliche Elternzahlung: Gesamt</Table.Th><Table.Th ta="right">Änderung zum Vorjahr</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>{workbookComparisonRows.map(([year, ...cells]) => (
                    <Table.Tr key={year} data-testid={`workbook-comparison-${year}`}>
                      <Table.Td>{year}</Table.Td>{cells.map((cell, index) => <Table.Td key={index} ta="right">{cell}</Table.Td>)}
                    </Table.Tr>
                  ))}</Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          ) : null}
          <Stack className="funding-simulation-section" gap="xs">
            <Text fw={700} size="sm">Einnahmen im Jahresvergleich</Text>
            <Text size="xs" c="dimmed">Basisförderung: gewichtete Tagesstunden × gültiger Jahresbasiswert / 24 je Monat. Kinddetail und Finanzchart zeigen Bruttobeiträge und Basisförderung; hier kommen Beitragszuschuss, Zusatzförderungen und gegebenenfalls Reformkorrektur hinzu. Manuelle Jahreszusatzbeträge werden nur zur Monatsdarstellung gleichmäßig auf zwölf Monate verteilt. ZEITKAT-Wechselbeträge sind ein separates Faktor-Modell und nicht die ADEBIS-Stundenbasis.</Text>
            {annualIncomeRows.some((row) => !row.yearComplete) ? (
              <Text size="sm" c="orange" data-testid="simulation-incomplete-years">
                Unvollständige Jahreswerte: {annualIncomeRows.filter((row) => !row.yearComplete).map((row) => row.year).join(', ')}. Angezeigte Beträge und Potenziale sind nur Modell-/Teilwerte, keine vollständigen Jahresergebnisse; Vergleiche können irreführen.
              </Text>
            ) : null}
            {annualIncomeRows.some((row) => row.missingManualFunding.length || row.invalidReformInputs.length) ? (
              <Text size="sm" c="orange" data-testid="simulation-missing-reform-inputs">
                Fehlende oder ungültige Förder- bzw. Reformeingaben: {annualIncomeRows.filter((row) => row.missingManualFunding.length || row.invalidReformInputs.length).map((row) => `${row.year}: ${[...row.missingManualFunding, ...row.invalidReformInputs].join(', ')}`).join(' · ')}. Fehlende manuelle Förderangaben werden für die angezeigten Teilwerte ersatzweise als 0 berechnet. Bei ungültigen Teamzuschuss-Eingaben wird die vorreformierte Förderung als Teilwert angezeigt; diese Ergebnisse sind nicht vollständig.
              </Text>
            ) : null}
            {annualIncomeRows.some((row) => row.reformGrantApplied) ? <Text size="xs" c="dimmed" data-testid="simulation-team-grant-rates">Teamzuschuss-Sätze zum 1. Januar je Platz/Jahr (Förderregel oder ADEBIS-Jahresvorgabe; unterjährige Wechsel nicht aufgeteilt): {annualIncomeRows.map(describeTeamGrantRates).filter(Boolean).join(' · ')}. Modellannahmen, rechtlich zu prüfen.</Text> : null}
            {annualIncomeRows.some((row) => row.missingFundingRuleMonths > 0) ? (
              <Text size="sm" c="orange" data-testid="simulation-missing-monthly-rule">Keine gültige Förderregel mit positivem Basiswert: {annualIncomeRows.filter((row) => row.missingFundingRuleMonths > 0).map((row) => `${row.year}: ${row.missingFundingRuleMonths} Monate`).join(' · ')}. Berechnungen mit Ersatzregeln sind vorläufig.</Text>
            ) : null}
            {annualIncomeRows.some((row) => row.missingBirthDateChildMonths > 0) ? (
              <Text size="sm" c="orange" data-testid="simulation-missing-birthdate">Normalisiertes Geburtsdatum fehlt oder ist ungültig: {annualIncomeRows.filter((row) => row.missingBirthDateChildMonths > 0).map((row) => `${row.year}: ${row.missingBirthDateChildMonths} Kind-Monate`).join(' · ')}. Altersgewichtung und Zuschussberechtigung sind nicht gesichert.</Text>
            ) : null}
            {annualIncomeRows.some((row) => row.reformBaselineIncomplete) ? (
              <Text size="sm" c="orange" data-testid="simulation-incomplete-reform-baseline">Die Reformbasis 2026 ist unvollständig oder nicht verfügbar; die darauf beruhenden Jahreswerte sind nicht vergleichbar.</Text>
            ) : null}
            {annualIncomeRows.some((row) => row.reformYearUnavailable) ? (
              <Text size="sm" c="orange" data-testid="simulation-missing-reform-year">Für diese Jahre ist kein Reformmodell verfügbar: {annualIncomeRows.filter((row) => row.reformYearUnavailable).map((row) => row.year).join(', ')}. Die angezeigten Ersatzwerte sind nicht vergleichbar.</Text>
            ) : null}
            {annualIncomeRows.some((row) => row.unusableBookingChildMonths > 0) ? (
              <Text size="sm" c="orange" data-testid="simulation-timeless-bookings">Kinder ohne Basisbuchung oder auswertbare Buchungszeiten (unabhängig vom Zuschuss): {annualIncomeRows.filter((row) => row.unusableBookingChildMonths > 0).map((row) => `${row.year}: ${row.unusableBookingChildMonths} Kind-Monate`).join(' · ')}. Diese Kinder können in den Summen fehlen; Fälle können auch in der Tarifdiagnose enthalten sein.</Text>
            ) : null}
            {annualIncomeRows.some((row) => row.activeChildrenCoveragePartialMonths > 0) ? (
              <Text size="sm" c="orange" data-testid="simulation-partial-active-children">Erfassung aktiver Kinder bzw. Diagnosen unvollständig: {annualIncomeRows.filter((row) => row.activeChildrenCoveragePartialMonths > 0).map((row) => `${row.year}: ${row.activeChildrenCoveragePartialMonths} Monate`).join(' · ')}. Ergebnisse und Vergleiche sind nicht vollständig.</Text>
            ) : null}
            {!fixedBaseYearEnabled && stockMode !== 'legacy' ? (
              <Stack gap={2} data-testid="forecast-finance-diagnostics">
                <Text size="xs" c="dimmed">{STOCK_MODE_LABELS[stockMode]} · Monatsanfang · {forecastInputs.filtered ? 'Forecast-Gruppenfilter aktiv' : 'alle Gruppen'}. Summen umfassen nur finanziell zuordenbare Kinder; Jahreswerte können unvollständig sein. Offene Beginne gelten als bereits anwesend, offene Enden als fortdauernd; beides ist nicht gesichert. Auffüllangebote sind keine verbindlichen Gruppenzuordnungen und ohne solche nicht finanziell berechenbar. HTML-Export unterstützt diese Bestandsmodelle nicht.</Text>
                {stockMode === 'projected' ? <Text size="xs" c="orange">Zulaufkonfiguration der Forecast-Ansicht nicht verfügbar; Panel-Option: {forecastInflowEnabled ? (forecastInputs.canEstimateInflow ? 'eigene Historienheuristik, höchstens sechs Jahre' : 'Zulauf nicht abschätzbar') : 'ausgeschaltet'}. {!forecastEventsAvailable ? 'Ereignisse nicht verfügbar oder nicht aktualisiert.' : ''}</Text> : null}
                {stockMode === 'projected' ? <Text size="xs" c="orange" data-testid="simulation-inflow-basis">{forecastInputs.inflowBasis} {forecastInputs.filtered ? 'Bei aktivem Forecast-Gruppenfilter wird kein Zulauf simuliert.' : ''} {forecastInflowEnabled ? 'Zukünftige Jahreswerte bleiben auch ohne erzeugten anonymen Zulauf unvollständig.' : ''}</Text> : null}
                {annualIncomeRows.map((row) => <Box key={row.year} data-testid={`forecast-finance-year-${row.year}`}>
                  <Text size="xs" c={row.yearComplete ? 'dimmed' : 'orange'}>{row.year}: bekannt {row.forecastKnownChildMonths}, projiziert {row.forecastProjectedChildMonths}, ungeklärt {row.forecastUnknownChildMonths} Kind-Monate · {row.forecastGaps.reduce((sum, gap) => sum + (gap.input == null ? gap.count : 0), 0)} nicht berechenbare Kind-Monate{row.outsideForecastMonths ? ` · ${row.outsideForecastMonths} Monate vor Stichtag` : ''}{stockMode === 'projected' && forecastInflowEnabled && row.year > currentYear + 6 ? ' · Zulaufhorizont überschritten' : ''}{row.yearComplete ? '' : ' · unvollständig'}</Text>
                  {row.forecastGaps.map((gap, index) => <Text key={gap.itemId || `inflow-${index}`} size="xs" c="orange">{gap.input != null ? `Forecast-Eingabe ${gap.input}` : gap.itemId == null ? 'Anonymer Zulauf' : isAnonymizedScenario ? (familyPresentation.labelByKey.get(familyPresentation.keyByChildId[String(gap.itemId)]) || 'Anonymisiertes Kind') : (simulationData.dataItems[String(gap.itemId)]?.name || 'Kind')}: {gap.count} {gap.input != null ? 'Hinweise' : 'Kind-Monate'} · {[...new Set(gap.reasons.map((reason) => FORECAST_GAP_LABELS[reason] || reason))].join(', ')}</Text>)}
                </Box>)}
              </Stack>
            ) : null}
            {annualIncomeRows.some((row) => !row.feeCalculationComplete) ? (
              <Text size="sm" c="orange" data-testid="simulation-missing-tariffs">
                Unvollständige Beitragsberechnung: {annualIncomeRows.filter((row) => !row.feeCalculationComplete).map((row) => `${row.year}: ${row.missingTariffChildMonths ? `${row.missingTariffChildMonths} Kind-Monate` : 'Diagnose fehlt'}`).join(' · ')}. Betroffene Beiträge fehlen; Elternbeiträge und Einnahmen sind Teilsummen, Familienauswertung und Potenziale unvollständig. Auch wegen Abwesenheit herausgefilterte Buchungen werden als Lücke gemeldet. Tarife und Buchungen prüfen.
              </Text>
            ) : null}
            {annualIncomeRows.some((row) => row.incompletePotentialBookings > 0) ? (
              <Text size="sm" c="orange" data-testid="simulation-incomplete-potential-bookings">
                Potenziale unvollständig: Buchungszeiten oder Zeitsegmente fehlen (Buchung/Richtung/Monat): {annualIncomeRows.filter((row) => row.incompletePotentialBookings > 0).map((row) => `${row.year}: ${row.incompletePotentialBookings}`).join(' · ')}. BETRSTD allein erlaubt keinen berechenbaren Upgrade oder Downgrade; ein Strich bedeutet nicht zwingend, dass kein Potenzial besteht.
              </Text>
            ) : null}
            {annualIncomeRows.some((row) => row.missingPotentialTariffs > 0) ? (
              <Text size="sm" c="orange" data-testid="simulation-missing-potential-tariffs">
                Potenziale unvollständig: fehlende Ausgangs- oder Nachbartarife (Kind/Kategorie/Monat): {annualIncomeRows.filter((row) => row.missingPotentialTariffs > 0).map((row) => `${row.year}: ${row.missingPotentialTariffs}`).join(' · ')}. Ein Strich bedeutet daher nicht zwingend, dass kein Potenzial besteht.
              </Text>
            ) : null}
            {annualIncomeRows.some((row) => row.subsidyExceedsTariffChildMonths > 0) ? (
              <Text size="sm" c="orange" data-testid="simulation-subsidy-exceeds-tariff">
                Zuschuss höher als Tarif: {annualIncomeRows.filter((row) => row.subsidyExceedsTariffChildMonths > 0).map((row) => `${row.year}: ${row.subsidyExceedsTariffChildMonths} Kind-Monate`).join(' · ')}. Die tatsächliche Auszahlung ist ungeklärt.
              </Text>
            ) : null}
            <Text size="xs" c="dimmed">
              Jahreswerte inklusive Elternbeitragszuschuss; Elternbeiträge zeigen den nicht negativen Eigenanteil je Kind. Die volle konfigurierte Zuschusssumme wird auch bei höherem Zuschuss als Tarif als Einnahme angesetzt: eine ungeprüfte Modellannahme, keine Zusage zur tatsächlichen Auszahlung oder Abrechnung. Bei Zuschusswegfall zahlen Eltern den bisherigen Tarif selbst. Die Vorjahreswerte vergleichen das jeweils angezeigte Szenario; Simulation bezeichnet die Änderung gegenüber dem unveränderten Tarif im selben Jahr. Upgrade- und Downgradepotenziale werden für jeden Monatsbestand des jeweiligen Jahres separat berechnet: die Stunden sind der Durchschnitt über zwölf Monate (Wochenstunden geteilt durch fünf), die Geldbeträge die Summe der Monatsänderungen. Die Potenziale und Familien-Förderdetails sind vorreformierte Modellwerte; die Reformkorrektur erfolgt nur auf Jahresebene. Es sind indikative Möglichkeiten, keine prognostizierten Wechsel; Kapazität und tatsächliches Verhalten bleiben unberücksichtigt.
            </Text>
            {annualIncomeRows.length === 0 ? (
              <Text size="sm" c="dimmed" data-testid="no-funding-years">
                Für das aktuelle oder kommende Jahr ist keine BayKiBiG-Förderregel mit positivem Basiswert hinterlegt.
              </Text>
            ) : (
              <Paper className="funding-simulation-table-scroll" withBorder radius="sm" style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs" verticalSpacing="xs" miw={showAnnualFundingInputs ? 1440 : 0} style={{ width: '100%', tableLayout: 'fixed' }} data-testid="annual-income-results">
                  <Table.Thead>
                    {showAnnualFundingInputs ? (
                      <>
                        <Table.Tr>
                          <Table.Th rowSpan={2}>Jahr</Table.Th>
                          <Table.Th colSpan={4}>
                            <Group justify="flex-end" gap="xs" wrap="nowrap">
                              <Text size="xs">Zusatzförderung / Jahr</Text>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="blue"
                                aria-label="Zusatzförderungsspalten ausblenden"
                                title="Einzelspalten ausblenden"
                                onClick={() => setShowAnnualFundingInputs(false)}
                                data-testid="annual-funding-inputs-toggle"
                              >
                                <IconChevronUp size={14} />
                              </ActionIcon>
                            </Group>
                          </Table.Th>
                          <Table.Th ta="right" rowSpan={2}>Buchungsstunden / Tag (Ø Jahr)</Table.Th>
                          <Table.Th ta="right" rowSpan={2}>{reformForecastSettings.teamGrantEligible === true ? 'Förderanspruch inkl. Teamzuschuss' : 'Förderanspruch'}</Table.Th>
                          <Table.Th ta="right" rowSpan={2}>Elternbeiträge</Table.Th>
                          <Table.Th ta="right" rowSpan={2}>Einnahmen</Table.Th>
                          <Table.Th ta="right" rowSpan={2}>
                            <Stack gap={0} align="flex-end">
                              <Text size="xs">Upgradepotenzial</Text>
                              <Text size="xs" c="dimmed">Budget {formatEuro(potentialMonthlyBudget)} / Familie / Monat</Text>
                            </Stack>
                          </Table.Th>
                          <Table.Th ta="right" rowSpan={2}>
                            <Stack gap={0} align="flex-end">
                              <Text size="xs">Downgradepotenzial</Text>
                              <Text size="xs" c="dimmed">Budget {formatEuro(potentialMonthlyBudget)} / Familie / Monat</Text>
                            </Stack>
                          </Table.Th>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Th ta="right">U3-Bundesmittel</Table.Th>
                          <Table.Th ta="right">Personalbonus</Table.Th>
                          <Table.Th ta="right">Assistenz</Table.Th>
                          <Table.Th ta="right">Sprachförderung</Table.Th>
                        </Table.Tr>
                      </>
                    ) : (
                      <Table.Tr>
                        <Table.Th>Jahr</Table.Th>
                        <Table.Th ta="right">
                          <Group justify="flex-end" gap="xs" wrap="nowrap">
                            <Text size="xs">Zusatzförderung gesamt / Jahr</Text>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="blue"
                              aria-label="Zusatzförderungsspalten einblenden"
                              title="Einzelspalten bearbeiten"
                              onClick={() => setShowAnnualFundingInputs(true)}
                              data-testid="annual-funding-inputs-toggle"
                            >
                              <IconChevronDown size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Th>
                        <Table.Th ta="right">Buchungsstunden / Tag (Ø Jahr)</Table.Th>
                        <Table.Th ta="right">{reformForecastSettings.teamGrantEligible === true ? 'Förderanspruch inkl. Teamzuschuss' : 'Förderanspruch'}</Table.Th>
                        <Table.Th ta="right">Elternbeiträge</Table.Th>
                        <Table.Th ta="right">Einnahmen</Table.Th>
                        <Table.Th ta="right">
                          <Stack gap={0} align="flex-end">
                            <Text size="xs">Upgradepotenzial</Text>
                            <Text size="xs" c="dimmed">Budget {formatEuro(potentialMonthlyBudget)} / Familie / Monat</Text>
                          </Stack>
                        </Table.Th>
                        <Table.Th ta="right">
                          <Stack gap={0} align="flex-end">
                            <Text size="xs">Downgradepotenzial</Text>
                            <Text size="xs" c="dimmed">Budget {formatEuro(potentialMonthlyBudget)} / Familie / Monat</Text>
                          </Stack>
                        </Table.Th>
                      </Table.Tr>
                    )}
                  </Table.Thead>
                  <Table.Tbody>
                    {annualIncomeRows.map((row, index) => {
                      const previous = row.yearComplete && annualIncomeRows[index - 1]?.year === row.year - 1 && annualIncomeRows[index - 1]?.yearComplete ? annualIncomeRows[index - 1] : null;
                      const hourChange = previous
                        ? row.averageDailyBookingHours - previous.averageDailyBookingHours
                        : null;
                      const annualFundingInputTotal = Object.values(row.annualFundingInputs)
                        .reduce((sum, value) => sum + (Number(value) || 0), 0);
                      const previousFundingInputTotal = previous
                        ? Object.values(previous.annualFundingInputs).reduce((sum, value) => sum + (Number(value) || 0), 0)
                        : null;
                      const upgradePotentialFunding = row.annualPotential.upgradeFunding;
                      const downgradePotentialFunding = row.annualPotential.downgradeFunding;
                      return (
                        <React.Fragment key={row.year}>
                          <Table.Tr data-testid={`annual-income-row-${row.year}`}>
                          <Table.Td>
                            <Group gap={4} wrap="nowrap">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                aria-label={`Familien-Details für ${row.year} ${expandedFamilyYear === row.year ? 'schließen' : 'öffnen'}`}
                                aria-expanded={expandedFamilyYear === row.year}
                                title={`Betroffene Familien ${row.year}`}
                                onClick={() => setExpandedFamilyYear((current) => current === row.year ? null : row.year)}
                                data-testid={`annual-family-impact-toggle-${row.year}`}
                              >
                                {expandedFamilyYear === row.year ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                              </ActionIcon>
                              <Stack gap={0}><Text>{row.year}</Text>{!row.yearComplete ? <Text size="xs" c="orange">unvollständig</Text> : null}</Stack>
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                aria-label={`ADEBIS-Details für ${row.year}`}
                                title={`Jahresdetails ${row.year}`}
                                onClick={() => {
                                  setDetailsTab('adebis');
                                  setSelectedDetailsYear(row.year);
                                }}
                                data-testid={`annual-income-details-${row.year}`}
                              >
                                <IconInfoCircle size={16} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                          {showAnnualFundingInputs ? ([
                            ['under3Federal', 'U3-Bundesmittel'],
                            ['personnelBonus', 'Personalbonus'],
                            ['assistance', 'Assistenzkräfte-Fördersumme'],
                            ['languageSpecialists', 'Sprachförderung-Fördersumme'],
                          ].map(([field, label]) => (
                            <Table.Td ta="right" key={field}>
                              <Stack gap={0} align="flex-end">
                                <AnnualFundingInput
                                  label={`${label} ${fixedBaseYearEnabled && !fundingYears.includes(fixedBaseYear) ? `${fixedBaseYear} (Basis für ${row.year})` : row.year}`}
                                  value={row.annualFundingInputValues[field] ?? ''}
                                  onCommit={(value) => updateAnnualFundingInput(fixedBaseYearEnabled ? fixedBaseYear : row.year, field, value)}
                                  disabled={fixedBaseYearEnabled && row.year !== fixedBaseYear && (fundingYears.includes(fixedBaseYear) || index !== 0)}
                                  testId={`annual-funding-input-${row.year}-${field}`}
                                />
                                {previous ? (
                                  <Text size="xs" c="dimmed" data-testid={`annual-funding-input-change-${row.year}-${field}`}>
                                    {formatSignedEuro((Number(row.annualFundingInputs[field]) || 0) - (Number(previous.annualFundingInputs[field]) || 0))} zum Vorjahr
                                  </Text>
                                ) : null}
                              </Stack>
                            </Table.Td>
                          ))) : (
                            <Table.Td ta="right" data-testid={`annual-funding-input-total-${row.year}`}>
                              <AnnualMetricCell
                                value={annualFundingInputTotal}
                                change={previousFundingInputTotal == null ? null : annualFundingInputTotal - previousFundingInputTotal}
                                formatValue={formatEuro}
                                formatChange={formatSignedEuro}
                              />
                            </Table.Td>
                          )}
                          <Table.Td ta="right" data-testid={`annual-booking-hours-${row.year}`}>
                            <AnnualMetricCell
                              value={row.averageDailyBookingHours}
                              change={hourChange}
                              formatValue={formatDailyHours}
                              formatChange={(value) => `${value > 0 ? '+' : ''}${formatDailyHours(value)}`}
                            />
                          </Table.Td>
                          <Table.Td ta="right" fw={700} data-testid={`annual-funding-${row.year}`}>
                            <AnnualMetricCell
                              value={row.totalFunding}
                              change={previous ? row.totalFunding - previous.totalFunding : null}
                              formatValue={formatEuro}
                              formatChange={formatSignedEuro}
                            />
                          </Table.Td>
                          <Table.Td ta="right" data-testid={`annual-contributions-${row.year}`}>
                            <AnnualMetricCell
                              value={row.contributions}
                              change={previous ? row.contributions - previous.contributions : null}
                              simulationChange={row.yearComplete ? row.contributionsChange : null}
                              formatValue={formatEuro}
                              formatChange={formatSignedEuro}
                            />
                          </Table.Td>
                          <Table.Td ta="right" fw={700}>
                            <AnnualMetricCell
                              value={row.totalIncome}
                              change={previous ? row.totalIncome - previous.totalIncome : null}
                              simulationChange={row.yearComplete ? row.totalIncomeChange : null}
                              formatValue={formatEuro}
                              formatChange={formatSignedEuro}
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            <AnnualPotentialCell
                              dailyHours={row.annualPotential.upgradeDailyHours}
                              fundingChange={upgradePotentialFunding}
                              parentFeeChange={row.annualPotential.upgradeParentFees}
                              direction="upgrade"
                              testId={`annual-upgrade-potential-${row.year}`}
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            <AnnualPotentialCell
                              dailyHours={row.annualPotential.downgradeDailyHours}
                              fundingChange={downgradePotentialFunding}
                              parentFeeChange={row.annualPotential.downgradeParentFees}
                              direction="downgrade"
                              testId={`annual-downgrade-potential-${row.year}`}
                            />
                          </Table.Td>
                          </Table.Tr>
                          <Table.Tr data-testid={`annual-family-impact-row-${row.year}`}>
                            <Table.Td colSpan={showAnnualFundingInputs ? 11 : 8} p={0}>
                              <Collapse expanded={expandedFamilyYear === row.year}>
                                <Box p="sm" bg="gray.0">
                                  <Stack gap="xs">
                                    <Text size="sm" fw={700}>Betroffene Familien {row.year}</Text>
                                    {!row.yearComplete ? (
                                      <Text size="xs" c="orange">Familienvergleich nicht verfügbar, weil das Jahresergebnis unvollständig ist.</Text>
                                    ) : row.familyImpacts.length === 0 ? (
                                      <Text size="xs" c="dimmed">In diesem Jahr sind keine Familien von einer Beitragsänderung betroffen.</Text>
                                    ) : (
                                      <Table striped highlightOnHover withTableBorder fz="xs" data-testid={`annual-family-impact-table-${row.year}`}>
                                        <Table.Thead>
                                          <Table.Tr>
                                            <Table.Th>Familie</Table.Th>
                                            <Table.Th ta="right">Aktueller Beitrag · Ø / Monat</Table.Th>
                                            <Table.Th ta="right">Neuer Beitrag · Ø / Monat</Table.Th>
                                            <Table.Th ta="right">Änderung durch Simulation · Ø / Monat</Table.Th>
                                            <Table.Th ta="right">Szenario zum Vorjahr · Ø / Monat</Table.Th>
                                          </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                          {row.familyImpacts.map((family) => (
                                            <Table.Tr key={family.id} data-testid={`annual-family-impact-${row.year}-${family.id}`}>
                                              <Table.Td>{family.label}</Table.Td>
                                              <Table.Td ta="right">{formatEuro(family.averageMonthlyParentFeesBefore)}</Table.Td>
                                              <Table.Td ta="right">{formatEuro(family.averageMonthlyParentFeesAfter)}</Table.Td>
                                              <Table.Td
                                                ta="right"
                                                c={family.averageMonthlyDelta > 0.005 ? 'red.7' : family.averageMonthlyDelta < -0.005 ? 'teal.7' : 'dimmed'}
                                                title={`Simulationsdelta im Jahr: ${formatSignedEuro(family.annualDelta)}`}
                                              >
                                                {formatSignedEuro(family.averageMonthlyDelta)}
                                              </Table.Td>
                                              <Table.Td
                                                ta="right"
                                                c={family.averageMonthlyYearOverYearDelta > 0.005 ? 'red.7' : family.averageMonthlyYearOverYearDelta < -0.005 ? 'teal.7' : 'dimmed'}
                                                title={family.yearOverYearAnnualDelta == null
                                                  ? 'Kein Vorjahr im Vergleich'
                                                  : `Veränderung zum Vorjahr im Jahr: ${formatSignedEuro(family.yearOverYearAnnualDelta)}`}
                                              >
                                                {family.averageMonthlyYearOverYearDelta == null
                                                  ? '–'
                                                  : formatSignedEuro(family.averageMonthlyYearOverYearDelta)}
                                              </Table.Td>
                                            </Table.Tr>
                                          ))}
                                        </Table.Tbody>
                                      </Table>
                                    )}
                                  </Stack>
                                </Box>
                              </Collapse>
                            </Table.Td>
                          </Table.Tr>
                        </React.Fragment>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Stack>

          <Paper withBorder p="sm" radius="md" data-testid="family-impact-histogram-section">
            <Stack gap="xs">
              <Group justify="space-between" align="center" wrap="wrap">
                <Stack gap={0}>
                  <Text fw={700} size="sm">Beitragsänderungen betroffener Familien</Text>
                  <Text size="xs" c="dimmed">Durchschnittliche Monatsänderung je Familie: Die Summe beider Deltas addiert Simulation im aktuellen Jahr und Veränderung des simulierten Beitrags zum Vorjahr; diese Effekte können sich überschneiden. Unvollständige Jahre sind ausgeschlossen. Durchschnitt und Median beziehen sich auf betroffene Familien.</Text>
                </Stack>
                <SegmentedControl
                  size="xs"
                  value={familyHistogramMode}
                  onChange={setFamilyHistogramMode}
                  data={[
                    { label: 'Summe beider Deltas', value: 'total' },
                    { label: 'Szenario zum Vorjahr', value: 'yearOverYear' },
                    { label: 'Simulation', value: 'simulation' },
                  ]}
                  data-testid="family-impact-histogram-mode"
                />
              </Group>
              {familyImpactHistogramSeries.length === 0 ? (
                <Text size="sm" c="dimmed" data-testid="family-impact-histogram-empty">
                  {annualIncomeRows.some((row) => !row.yearComplete)
                    ? 'Keine Familienänderungen aus vollständigen Jahren verfügbar; unvollständige Jahre sind ausgeschlossen.'
                    : familyHistogramMode === 'simulation'
                      ? 'Die aktuelle Tarifsimulation ändert noch keine Familienbeiträge. Verändere oben einen Tarif, um die Verteilung neu zu berechnen.'
                      : 'Im ausgewählten Vergleich sind keine Familienbeitragsänderungen enthalten.'}
                </Text>
              ) : (
                <Box
                  data-testid="family-impact-histogram-chart"
                  data-histogram-summary={familyImpactHistogram.series.map((year) => (
                    `${year}:${familyImpactHistogram.data.map((row) => row[year] || 0).join(',')}`
                  )).join(';')}
                >
                  <Group gap="xs" align="center" wrap="wrap" mb="xs" data-testid="family-impact-histogram-statistics">
                    {familyImpactHistogram.series.map((year, index) => {
                      const statistics = familyImpactHistogram.statisticsByYear[year];
                      return (
                        <Group key={year} gap="xs" wrap="wrap" data-testid={`family-impact-histogram-statistics-${year}`}>
                          <Badge color={FAMILY_HISTOGRAM_COLORS[index % FAMILY_HISTOGRAM_COLORS.length]} variant="light">{year}</Badge>
                          <Text size="xs" data-testid={`family-impact-histogram-average-${year}`}>
                            <span aria-hidden="true" style={{ display: 'inline-block', width: 14, borderTop: '2px dashed var(--mantine-color-blue-6)', marginRight: 5, verticalAlign: 'middle' }} />
                            Durchschnitt: {formatSignedEuro(statistics.average)} ({statistics.averageRange})
                          </Text>
                          <Text size="xs" data-testid={`family-impact-histogram-median-${year}`}>
                            <span aria-hidden="true" style={{ display: 'inline-block', width: 14, borderTop: '2px dashed var(--mantine-color-orange-6)', marginRight: 5, verticalAlign: 'middle' }} />
                            Median: {formatSignedEuro(statistics.median)} ({statistics.medianRange})
                          </Text>
                        </Group>
                      );
                    })}
                  </Group>
                  <BarChart
                    data={familyImpactHistogram.data}
                    dataKey="range"
                    series={familyImpactHistogramSeries}
                    orientation="horizontal"
                    h={280}
                    maxBarWidth={34}
                    withLegend
                    withTooltip
                    yAxisLabel="Anzahl Familien"
                    xAxisLabel="Änderung des Elternbeitrags je Familie / Monat"
                    valueFormatter={(value) => `${Number(value).toLocaleString('de-DE')} Familien`}
                  />
                </Box>
              )}
            </Stack>
          </Paper>

          <Modal
            opened={Boolean(selectedAnnualDetails)}
            onClose={() => setSelectedDetailsYear(null)}
            title={selectedAnnualDetails ? `ADEBIS-Jahresdetails ${selectedAnnualDetails.year}${selectedAnnualDetails.yearComplete ? '' : ' – unvollständig'}` : 'ADEBIS-Jahresdetails'}
            size="90%"
            centered
            data-testid="adebis-year-details-modal"
          >
            {selectedAnnualDetails ? (
              <Tabs value={detailsTab} onChange={(value) => setDetailsTab(value || 'adebis')}>
                <Tabs.List>
                  <Tabs.Tab value="adebis">ADEBIS-Teilergebnisse</Tabs.Tab>
                  <Tabs.Tab value="families">Familienbaum</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="adebis" pt="md">
                  <Stack gap="sm">
                    <Text size="xs" c="dimmed">
                      Monatswerte und ihre Summen sind vorreformierte Modellwerte; Reformkorrekturen erfolgen nur auf Jahresebene. Die Monatssumme muss daher nicht dem Jahresförderanspruch entsprechen. Buchungszeitenförderung = BuStdGew × Basiswert ÷ 24. U3-Zusatzförderung, Qualitätsbonus und Vorkurse werden monatlich aus Buchungsdaten und den Fördersätzen der Jahresregel berechnet. Die vier jährlichen Zusatzwerte stehen in der Ergebnistabelle. Integ.-Kinder, FKQ-Istwert und Betriebstage können monatlich aus ADEBIS übernommen werden; Personalwerte beruhen sonst auf Vertragsstunden/Qualifikationen.
                    </Text>
                    <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                      <Table striped withTableBorder fz="xs" miw={1900} data-testid="adebis-monthly-details-table">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Monat</Table.Th>
                            <Table.Th ta="right">Kinder</Table.Th>
                            <Table.Th ta="right">U3-Kinder / Monat</Table.Th>
                            <Table.Th ta="right">integ.</Table.Th>
                            <Table.Th ta="right">% &gt; 3 Std.</Table.Th>
                            <Table.Th ta="right">BuStd / Tag</Table.Th>
                            <Table.Th ta="right">BuStdGew / Tag</Table.Th>
                            <Table.Th ta="right">ArbStd</Table.Th>
                            <Table.Th ta="right">ArbStdFK</Table.Th>
                            <Table.Th ta="right">MindStdFK</Table.Th>
                            <Table.Th ta="right">FK +/-</Table.Th>
                            <Table.Th ta="right">FKQ</Table.Th>
                            <Table.Th ta="right">AS</Table.Th>
                            <Table.Th ta="right">Förderung</Table.Th>
                            <Table.Th ta="right">vorauss. Förderung</Table.Th>
                            <Table.Th ta="right">Vorkurse</Table.Th>
                            <Table.Th ta="right">ZusF. U3</Table.Th>
                            <Table.Th ta="right">U3-Bundesmittel</Table.Th>
                            <Table.Th ta="right">Q-Bonus</Table.Th>
                            <Table.Th ta="right">Förd. ges. inkl. EB-Zuschuss</Table.Th>
                            <Table.Th ta="right">EB-Zuschuss</Table.Th>
                            <Table.Th ta="right">Basiswert</Table.Th>
                            <Table.Th ta="right">Betriebstage</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {selectedAnnualDetails.monthlyDetails.map((month) => (
                            <Table.Tr key={month.month}>
                              <Table.Td>{month.month}</Table.Td>
                              <Table.Td ta="right">{month.children}</Table.Td>
                              <Table.Td ta="right">
                                <NumberInput
                                  aria-label={`U3-Kinder ${month.month}`}
                                  value={month.under3ChildrenOverride ?? month.under3Children}
                                  onChange={(value) => updateAdebisMonthlyOverride('under3ChildrenByMonth', `${selectedAnnualDetails.year}-${String(month.monthIndex + 1).padStart(2, '0')}`, value)}
                                  min={0}
                                  decimalScale={0}
                                  w={76}
                                  size="xs"
                                  data-testid={`adebis-under3-children-${selectedAnnualDetails.year}-${month.monthIndex + 1}`}
                                />
                              </Table.Td>
                              <Table.Td ta="right">
                                <NumberInput
                                  aria-label={`Integrationskinder ${month.month}`}
                                  value={month.integratedChildren ?? ''}
                                  onChange={(value) => updateAdebisMonthlyOverride('integratedChildrenByMonth', `${selectedAnnualDetails.year}-${String(selectedAnnualDetails.monthlyDetails.indexOf(month) + 1).padStart(2, '0')}`, value)}
                                  min={0}
                                  max={month.children}
                                  decimalScale={0}
                                  w={76}
                                  size="xs"
                                />
                              </Table.Td>
                              <Table.Td ta="right">{formatPercent(month.overTwentyHoursPercent)}</Table.Td>
                              <Table.Td ta="right">{formatAnalysisNumber(month.bookingHoursDaily)}</Table.Td>
                              <Table.Td ta="right">{formatAnalysisNumber(month.weightedBookingHoursDaily)}</Table.Td>
                              <Table.Td ta="right">{formatAnalysisNumber(month.staffHours)}</Table.Td>
                              <Table.Td ta="right">{formatAnalysisNumber(month.expertStaffHours)}</Table.Td>
                              <Table.Td ta="right">{formatAnalysisNumber(month.minimumExpertHours)}</Table.Td>
                              <Table.Td ta="right">{formatSignedHours(month.expertHoursDelta)}</Table.Td>
                              <Table.Td ta="right">
                                <NumberInput
                                  aria-label={`FKQ ${month.month}`}
                                  value={month.expertRatioPercent ?? ''}
                                  onChange={(value) => updateAdebisMonthlyOverride('expertRatioPercentByMonth', `${selectedAnnualDetails.year}-${String(selectedAnnualDetails.monthlyDetails.indexOf(month) + 1).padStart(2, '0')}`, value)}
                                  min={0}
                                  max={100}
                                  decimalScale={2}
                                  suffix=" %"
                                  w={96}
                                  size="xs"
                                />
                              </Table.Td>
                              <Table.Td ta="right">{formatAnalysisNumber(month.employmentKey)}</Table.Td>
                              <Table.Td ta="right">{month.baseFunding == null ? 'Ungeklärt' : month.estimatedFunding > 0 ? 'Ja' : 'Nein'}</Table.Td>
                              <Table.Td ta="right">{month.baseFunding == null ? 'Ungeklärt' : formatEuro(month.baseFunding)}</Table.Td>
                              <Table.Td ta="right">{formatEuro(month.preparatoryCourses)}</Table.Td>
                              <Table.Td ta="right">
                                <NumberInput
                                  aria-label={`U3-Zusatzförderung ${month.month}`}
                                  value={month.under3AdditionalOverride ?? month.under3Additional}
                                  onChange={(value) => updateAdebisMonthlyOverride('under3AdditionalByMonth', `${selectedAnnualDetails.year}-${String(month.monthIndex + 1).padStart(2, '0')}`, value)}
                                  min={0}
                                  decimalScale={2}
                                  fixedDecimalScale
                                  suffix=" €"
                                  w={112}
                                  size="xs"
                                  data-testid={`adebis-under3-amount-${selectedAnnualDetails.year}-${month.monthIndex + 1}`}
                                />
                              </Table.Td>
                              <Table.Td ta="right">{formatEuro(month.under3Federal)}</Table.Td>
                              <Table.Td ta="right">{formatEuro(month.qualityBonus)}</Table.Td>
                              <Table.Td ta="right">{month.baseFunding == null ? 'Ungeklärt' : formatEuro(month.totalFunding)}</Table.Td>
                              <Table.Td ta="right">{formatEuro(month.parentFeeSubsidy)}</Table.Td>
                              <Table.Td ta="right">{month.baseFunding == null ? 'Ungeklärt' : formatEuro(month.basisValue)}</Table.Td>
                              <Table.Td ta="right">
                                <NumberInput
                                  aria-label={`Betriebstage ${month.month}`}
                                  value={month.operatingDays ?? ''}
                                  onChange={(value) => updateAdebisMonthlyOverride('operatingDaysByMonth', `${selectedAnnualDetails.year}-${String(selectedAnnualDetails.monthlyDetails.indexOf(month) + 1).padStart(2, '0')}`, value)}
                                  min={0}
                                  max={31}
                                  decimalScale={0}
                                  w={76}
                                  size="xs"
                                />
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                        <Table.Tfoot>
                          <Table.Tr fw={700} data-testid="adebis-monthly-total">
                            <Table.Td>Mittelwerte / Jahressummen (vor Reform)</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetailTotals.children / selectedAnnualDetails.monthlyDetails.length, 1)}</Table.Td>
                            <Table.Td ta="right">{selectedAnnualDetailTotals.under3Children}</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetailTotals.integratedChildren / selectedAnnualDetails.monthlyDetails.length, 1)}</Table.Td>
                            <Table.Td ta="right">{formatPercent(selectedAnnualDetailTotals.children ? selectedAnnualDetailTotals.overTwentyHoursChildren / selectedAnnualDetailTotals.children * 100 : 0)}</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetailTotals.bookingHoursDaily / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetailTotals.weightedBookingHoursDaily / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetailTotals.staffHours / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetailTotals.expertStaffHours / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetailTotals.minimumExpertHours / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">{formatSignedHours(selectedAnnualDetailTotals.expertHoursDelta / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">{selectedAnnualDetailTotals.expertRatioMonths ? formatPercent(selectedAnnualDetailTotals.expertRatioPercent / selectedAnnualDetailTotals.expertRatioMonths) : '–'}</Table.Td>
                            <Table.Td ta="right">{formatAnalysisNumber(selectedAnnualDetails.monthlyDetails.reduce((sum, month) => sum + (Number(month.employmentKey) || 0), 0) / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">–</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetailTotals.basisFunding)}</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetailTotals.preparatoryCourses)}</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetailTotals.under3Additional)}</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetailTotals.under3Federal)}</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetailTotals.qualityBonus)}</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetailTotals.totalFunding)}</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetailTotals.parentFeeSubsidy)}</Table.Td>
                            <Table.Td ta="right">{formatEuro(selectedAnnualDetails.monthlyDetails.reduce((sum, month) => sum + month.basisValue, 0) / selectedAnnualDetails.monthlyDetails.length)}</Table.Td>
                            <Table.Td ta="right">{selectedAnnualDetailTotals.operatingDays || '–'}</Table.Td>
                          </Table.Tr>
                        </Table.Tfoot>
                      </Table>
                    </Paper>
                    <Paper withBorder radius="sm" p="sm" data-testid="adebis-annual-summary">
                      <Stack gap="xs">
                        <Text fw={700} size="sm">ADEBIS-Jahressummen und Reformkorrektur</Text>
                        <Text size="xs" c="dimmed">
                          Die U3-Zusatzförderung wird monatlich als U3-Kind-Monate × Basiswert × 2,5 % berechnet; der Faktor 2,0 der regulären Buchungszeitenförderung wird dafür nicht verwendet. U3-Kinder zählen bei aktiver Basisbuchung auch ohne auswertbare Stunden. Die ADEBIS-Monatswerte für U3-Kinder und FUNTER3 können überschrieben werden. Qualitätsbonus und Vorkurse sind ebenfalls Monatssummen; übrige Zusatzwerte werden als Jahreswerte erfasst.
                        </Text>
                        <Table withTableBorder fz="sm">
                          <Table.Tbody>
                            {selectedAnnualDetails.reformProjectionApplied ? (
                              <Table.Tr fw={600} data-testid="reform-projection-funding">
                                <Table.Td>Reformmodell aus fixiertem Basisjahr 2026 (ohne Elternbeitragszuschuss)</Table.Td>
                                <Table.Td ta="right">{formatEuro(selectedAnnualDetails.reformProjectionFunding)}</Table.Td>
                              </Table.Tr>
                            ) : null}
                            <Table.Tr><Table.Td>Basisförderung nach Buchungszeiten</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.funding)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>Förderung Vorkurse</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.preparatoryCourses)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>Zusatzförderung U3</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.under3Additional)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>U3-Bundesmittel</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.under3Federal)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>Qualitätsbonus</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.qualityBonus)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>Personalbonus</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.personnelBonus)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>Fördersumme Assistenzkräfte</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.assistance)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>Fördersumme Sprachfachkräfte</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.languageSpecialists)}</Table.Td></Table.Tr>
                            {selectedAnnualDetails.reformGrantApplied ? (
                              <>
                                <Table.Tr><Table.Td>Reform-Teamzuschuss (brutto)</Table.Td><Table.Td ta="right">{formatAvailableEuro(selectedAnnualDetails.reformTeamGrant)}</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td>Abzug bisheriger Personal-/Assistenz-/Sprachförderung</Table.Td><Table.Td ta="right">−{formatEuro(selectedAnnualDetails.reformPriorGuidelineFunding)}</Table.Td></Table.Tr>
                                <Table.Tr fw={600}><Table.Td>Änderung gegenüber bisheriger Förderung (Teamzuschuss netto)</Table.Td><Table.Td ta="right">{selectedAnnualDetails.reformTeamGrantNet == null ? 'Nicht verfügbar' : formatEuro(selectedAnnualDetails.reformTeamGrantNet)}</Table.Td></Table.Tr>
                              </>
                            ) : null}
                            <Table.Tr fw={700} data-testid="adebis-total-funding-row"><Table.Td>Gesamtsumme Förderanspruch inkl. Elternbeitragszuschuss</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.totalFunding)}</Table.Td></Table.Tr>
                            <Table.Tr><Table.Td>Davon Elternbeitragszuschuss ({selectedAnnualDetails.eligibleParentFeeSubsidyChildMonths} Kind-Monate)</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.annualParentFeeSubsidy)}</Table.Td></Table.Tr>
                          </Table.Tbody>
                        </Table>
                      </Stack>
                    </Paper>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="families" pt="md">
                  <Stack gap="sm">
                    <Text size="xs" c="dimmed">Die familienbezogene Buchungszeitenförderung ist vorreformiert; eine Reformkorrektur wird nur im Jahresergebnis ausgewiesen.</Text>
                    <Group justify="flex-end">
                      <Switch
                        label="Kinder nach Familie gruppieren"
                        checked={groupFamilies}
                        onChange={(event) => setGroupFamilies(event.currentTarget.checked)}
                        data-testid="family-tree-group-toggle"
                      />
                    </Group>
                    {selectedAnnualDetails.familyTree.length === 0 ? (
                      <Text size="sm" c="dimmed">Für dieses Jahr wurden keine aktiven Kinder mit Buchungsdaten gefunden.</Text>
                    ) : (
                      <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                        <Table striped withTableBorder fz="xs" miw={1240} data-testid="family-tree-table">
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Familie</Table.Th>
                              <Table.Th>Kind</Table.Th>
                              <Table.Th>Gruppe</Table.Th>
                              <Table.Th>ZEITKAT</Table.Th>
                              <Table.Th>Buchung gültig von – bis</Table.Th>
                              <Table.Th ta="right">Buchungsstunden / Jahr</Table.Th>
                              <Table.Th ta="right">Ø Buchungsstunden / Tag</Table.Th>
                              <Table.Th ta="right">Förderung nach Buchungszeiten / Jahr</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {groupFamilies ? selectedAnnualDetails.familyTree.flatMap((family) => [
                              <Table.Tr key={`family-${family.id}`} fw={700} data-testid={`family-tree-family-${family.id}`}>
                                <Table.Td>{family.label}</Table.Td>
                                <Table.Td>{family.children.length} {family.children.length === 1 ? 'Kind' : 'Kinder'}</Table.Td>
                                <Table.Td colSpan={3} c="dimmed">Familienübersicht</Table.Td>
                                <Table.Td ta="right">{formatHours(family.annualBookingHours)}</Table.Td>
                                <Table.Td ta="right">{formatDailyHours(family.averageDailyHours)}</Table.Td>
                                <Table.Td ta="right">{formatEuro(family.annualFunding)}</Table.Td>
                              </Table.Tr>,
                              ...family.children.map((child) => (
                                <Table.Tr key={`${family.id}-${child.id}`} data-testid={`family-tree-child-${child.id}`}>
                                  <Table.Td />
                                  <Table.Td><Text pl="md">↳ {child.name}</Text></Table.Td>
                                  <Table.Td>{child.groupNames.join(', ') || '–'}</Table.Td>
                                  <Table.Td>{formatZeitkatList(child.zeitkatIds)}</Table.Td>
                                  <Table.Td>
                                    <Stack gap={2}>
                                      {child.bookingValidities.length > 0
                                        ? child.bookingValidities.map((validity) => <Text size="xs" key={validity}>{validity}</Text>)
                                        : <Text size="xs" c="dimmed">Keine Buchung im Jahr</Text>}
                                    </Stack>
                                  </Table.Td>
                                  <Table.Td ta="right">{formatHours(child.annualBookingHours)}</Table.Td>
                                  <Table.Td ta="right">{formatDailyHours(child.averageDailyHours)}</Table.Td>
                                  <Table.Td ta="right">{formatEuro(child.annualFunding)}</Table.Td>
                                </Table.Tr>
                              )),
                            ]) : selectedAnnualDetails.familyTree.flatMap((family) => family.children.map((child) => (
                              <Table.Tr key={`${family.id}-${child.id}`} data-testid={`family-tree-child-${child.id}`}>
                                <Table.Td>{family.label}</Table.Td>
                                <Table.Td>{child.name}</Table.Td>
                                <Table.Td>{child.groupNames.join(', ') || '–'}</Table.Td>
                                <Table.Td>{formatZeitkatList(child.zeitkatIds)}</Table.Td>
                                <Table.Td>
                                  <Stack gap={2}>
                                    {child.bookingValidities.length > 0
                                      ? child.bookingValidities.map((validity) => <Text size="xs" key={validity}>{validity}</Text>)
                                      : <Text size="xs" c="dimmed">Keine Buchung im Jahr</Text>}
                                  </Stack>
                                </Table.Td>
                                <Table.Td ta="right">{formatHours(child.annualBookingHours)}</Table.Td>
                                <Table.Td ta="right">{formatDailyHours(child.averageDailyHours)}</Table.Td>
                                <Table.Td ta="right">{formatEuro(child.annualFunding)}</Table.Td>
                              </Table.Tr>
                            ))) }
                          </Table.Tbody>
                          <Table.Tfoot>
                            <Table.Tr fw={700} data-testid="family-tree-total">
                              <Table.Td colSpan={2}>Gesamtsumme · {selectedAnnualFamilyTotals.children} Kinder</Table.Td>
                              <Table.Td colSpan={3} />
                              <Table.Td ta="right">{formatHours(selectedAnnualFamilyTotals.annualBookingHours)}</Table.Td>
                              <Table.Td ta="right">{formatDailyHours(selectedAnnualFamilyTotals.averageDailyHours)}</Table.Td>
                              <Table.Td ta="right">{formatEuro(selectedAnnualFamilyTotals.annualFunding)}</Table.Td>
                            </Table.Tr>
                          </Table.Tfoot>
                        </Table>
                      </Paper>
                    )}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            ) : null}
          </Modal>
          <Modal opened={pdfPrivacyOpened} onClose={() => setPdfPrivacyOpened(false)} title="Datenschutz prüfen – PDF-Export" closeButtonProps={{ 'aria-label': 'PDF-Dialog schließen' }} centered>
            <Stack gap="sm">
              <Switch label="Familienliste mit individuellen Beiträgen aufnehmen" checked={pdfIncludeFamilies} onChange={(event) => setPdfIncludeFamilies(event.currentTarget.checked)} data-testid="pdf-include-families" />
              <Text>{pdfIncludeFamilies ? 'Das unverschlüsselte PDF enthält Familienbezeichnungen und individuelle Beitragsänderungen sowie Gruppen- und Szenarionamen.' : 'Das unverschlüsselte PDF enthält keine Familienliste, aber Gruppen- und Szenarionamen sowie Gesamtsummen; Rückschlüsse können möglich sein.'} Nur berechtigt und geschützt weitergeben.</Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setPdfPrivacyOpened(false)}>Abbrechen</Button>
                <Button onClick={() => { setPdfPrivacyOpened(false); handleExportPdf(); }} data-testid="confirm-export-simulation-pdf">PDF herunterladen</Button>
              </Group>
            </Stack>
          </Modal>
          <Modal
            opened={Boolean(pendingHtmlExport)}
            onClose={() => setPendingHtmlExport(null)}
            title="Datenschutz prüfen – HTML-Export"
            centered
            size="md"
            data-testid="html-export-preview"
          >
            {pendingHtmlExport ? (
              <Stack gap="sm">
                <Text>
                  Die HTML-Datei ist unverschlüsselt. Sie enthält keine Namen, Familien- oder Kind-IDs, Geburtsdaten oder Einzelbuchungen; exportiert werden nur aggregierte Tarifprofile.
                </Text>
                <Text size="sm" c="dimmed">
                  {pendingHtmlExport.groups.length} neutrale Gruppen · {pendingHtmlExport.privacy.includedProfileClasses} Profilgruppen ab {pendingHtmlExport.privacy.minimumFamilyCount} Familien · {pendingHtmlExport.privacy.suppressedFamilyCount} Familienprofile unterdrückt
                </Text>
                <Text size="sm" c="dimmed">
                  Unterdrückte Profile bleiben bei Änderungen auf ihrem Export-Ausgangswert und werden nicht neu berechnet. Jahresgesamtsummen und Histogramm zeigen die Tarifauswirkung daher nur für aufgeschlüsselte Profile. Die Datei läuft lokal und benötigt keine Internetverbindung.
                </Text>
                <Text size="sm" c="orange">Die HTML-Simulation setzt den konfigurierten Zuschuss auch oberhalb des Tarifs als Einnahme an; die tatsächliche Auszahlung ist ungeklärt. Bei späteren Tarifänderungen in der Datei müssen fehlende Tarife gesondert geprüft werden.</Text>
                <Group justify="flex-end" mt="sm">
                  <Button variant="default" onClick={() => setPendingHtmlExport(null)}>Abbrechen</Button>
                  <Button onClick={handleConfirmHtmlExport} data-testid="confirm-export-simulation-html">HTML herunterladen</Button>
                </Group>
              </Stack>
            ) : null}
          </Modal>
        </Stack>
      </Paper>
    </Stack>
  );
}

export default FundingSimulationPanel;
