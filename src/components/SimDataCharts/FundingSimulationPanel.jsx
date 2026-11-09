import React from 'react';
import { Accordion, ActionIcon, Badge, Box, Button, Collapse, Group, Modal, MultiSelect, NumberInput, Paper, Popover, Select, Stack, Switch, Table, Tabs, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { IconChevronDown, IconChevronRight, IconChevronUp, IconCopy, IconDeviceFloppy, IconFileText, IconInfoCircle, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { seedDefaultBayKiBiGRules, updateFundingSimulationSettings, updateScenarioFinanceSettings } from '../../store/simFinanceSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { filterBookings } from '../../utils/chartUtils/chartUtils';
import { decodeBuchungsart, getFeeBandZeitkatId, isAdebisTrue, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import {
  calculateFamilyFeePotentials,
  getFeeBandSimulationPriceKey,
  getFeeCatalogSimulationRows,
  simulateContributionChanges,
} from '../../utils/foerderSimulation';
import { calculateScenarioMonthlyFinance, isRecordActiveOnDate, pickApplicableValidityEntry, resolveGroupIdAtDate } from '../../utils/financeUtils';
import { shouldIncludeDataItemInAnalysis } from '../../utils/dataVisibility';
import { calculateAdebisMonthMetrics } from '../../utils/adebisAnalysis';
import { calculateReformForecast } from '../../utils/reformSimulation';
import FeeStaircaseEditor from '../common/FeeStaircaseEditor';
import './FundingSimulationPanel.css';



const EMPTY_FINANCE = {};
const EMPTY_GROUP_FEE_CATALOGS = {};
const formatEuro = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatSignedEuro = (value) => `${Number(value) > 0 ? '+' : ''}${formatEuro(value)}`;
const formatWeeklyHours = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h/Woche`;
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
const clonePlainData = (value) => JSON.parse(JSON.stringify(value));
const createLocalScenarioId = () => `simulation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createBaselineSimulationScenario = (year) => ({
  id: 'baseline',
  name: `Standard-Tarif ${year}`,
  data: {
    temporaryCatalogEntries: {},
    temporaryPrices: {},
    selectedGroupIds: [],
    fixedBaseYearEnabled: false,
    fixedBaseYear: year,
    potentialMonthlyBudget: 50,
  },
});

async function generateSimulationPdfReport({
  scenarioName,
  referenceDate,
  groupFilterLabel,
  baseYearLabel,
  feeRows,
  annualRows,
  annualFundingDetailRows,
  familyRows,
  omittedFamilyCount,
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const bottomMargin = 12;
  let y = 14;

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

  const drawTable = (headers, rows, widths) => {
    const drawRow = (cells, isHeader, repeatHeader = true) => {
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(isHeader ? 6.5 : 6.3);
      const padding = 1.4;
      const lineHeight = 2.8;
      const wrapped = cells.map((cell, index) => doc.splitTextToSize(String(cell ?? '–'), widths[index] - padding * 2));
      const rowHeight = Math.max(7, Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + padding * 2);
      if (y + rowHeight > pageHeight - bottomMargin) {
        doc.addPage();
        y = margin;
        if (!isHeader && repeatHeader) drawRow(headers, true, false);
      }
      let x = margin;
      widths.forEach((width, index) => {
        doc.setDrawColor(180, 190, 202);
        if (isHeader) doc.setFillColor(232, 238, 245);
        else doc.setFillColor(255, 255, 255);
        doc.rect(x, y, width, rowHeight, 'FD');
        doc.setTextColor(30, 41, 59);
        doc.text(wrapped[index], x + padding, y + padding + 2.3);
        x += width;
      });
      y += rowHeight;
    };

    drawRow(headers, true);
    rows.forEach((row) => drawRow(row, false));
    y += 4;
  };

  doc.setProperties({
    title: `Beitragsänderungssimulation – ${scenarioName}`,
    subject: 'Jahresergebnisse und Familien-Impact',
    creator: 'CapaKita',
  });
  writeText('Beitragsänderungssimulation', { size: 17, bold: true, after: 1 });
  writeText(`Szenario: ${scenarioName}`, { size: 10, bold: true, after: 1 });
  writeText(`Stichtag: ${referenceDate}   ·   Gruppenfilter: ${groupFilterLabel}   ·   ${baseYearLabel}`, { size: 8, after: 5 });

  writeText('Beitragskonfiguration', { size: 11, bold: true, after: 2 });
  if (feeRows.length) {
    drawTable(
      ['Gruppe', 'Zuschuss', 'Kategorie', 'Stunden/Tag', 'Status', 'Monatsbeitrag', '€/h-Äquivalent'],
      feeRows,
      [40, 24, 32, 25, 18, 30, 30]
    );
  } else {
    writeText('Für den aktuellen Gruppenfilter sind keine Tarifstaffeln vorhanden.', { size: 8, after: 4 });
  }

  writeText('Jahresergebnisse', { size: 11, bold: true, after: 2 });
  drawTable(
    ['Jahr', 'Zusatzförderung', 'Std./Tag Ø', 'Förderanspruch', 'Delta Förderung/Vorjahr', 'Elternbeiträge', 'Delta Beiträge (Vorjahr/Sim.)', 'Einnahmen', 'Delta Einnahmen (Vorjahr/Sim.)', 'Upgrade-Potenzial', 'Downgrade-Potenzial'],
    annualRows,
    [14, 27, 20, 27, 23, 25, 23, 25, 28, 32, 32]
  );
  writeText('Zusatzförderung – Jahreswerte nach Förderart', { size: 10, bold: true, after: 2 });
  writeText('U3-Zusatzförderung: U3-Kind-Monate × Basiswert × 2,5 %. Der reguläre U3-Gewichtungsfaktor ist darin nicht enthalten.', { size: 7, after: 2 });
  drawTable(
    ['Jahr', 'U3-Kind-Monate', 'ZusF. U3', 'U3-Bund', 'Personalbonus', 'Assistenz', 'Sprache', 'Team brutto', 'Abzug bisherig', 'Reform netto'],
    annualFundingDetailRows,
    [16, 23, 25, 27, 25, 25, 24, 31, 31, 31]
  );

  writeText('Am stärksten betroffene Familien (Stichtag)', { size: 11, bold: true, after: 2 });
  if (familyRows.length) {
    drawTable(
      ['Familie', 'Bisheriger Beitrag/Monat', 'Neuer Beitrag/Monat', 'Änderung/Monat'],
      familyRows,
      [80, 48, 48, 45]
    );
    if (omittedFamilyCount > 0) {
      writeText(`Weitere betroffene Familien nicht aufgeführt: ${omittedFamilyCount}.`, { size: 7, after: 2 });
    }
  } else {
    writeText('Am Stichtag sind keine Familien von einer Beitragsänderung betroffen.', { size: 8, after: 2 });
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
  const [draft, setDraft] = React.useState(value ?? 0);
  React.useEffect(() => setDraft(value ?? 0), [value]);

  return (
    <NumberInput
      aria-label={label}
      value={draft}
      onChange={setDraft}
      onBlur={() => onCommit(draft === '' ? 0 : Number(draft))}
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

function AnnualPotentialCell({ dailyHours, fundingChange, direction, testId }) {
  if (!(dailyHours > 0)) return <Text c="dimmed" ta="right" data-testid={testId}>–</Text>;
  const fundingColor = Math.abs(fundingChange) < 0.005
    ? 'dimmed'
    : fundingChange > 0 ? 'teal.7' : 'red.7';
  return (
    <Stack gap={0} align="flex-end" style={{ minWidth: 0 }} data-testid={testId}>
      <Text style={{ whiteSpace: 'nowrap' }}>{direction === 'upgrade' ? '+' : '−'}{formatDailyHours(dailyHours)}</Text>
      <Text
        size="xs"
        c={fundingColor}
        ta="right"
        style={{ maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }}
      >
        {formatSignedEuro(fundingChange)} / Jahr
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
  });
  const bookingsByItem = {};
  filtered.demand.forEach((booking) => {
    const itemId = String(booking.itemId);
    if (!bookingsByItem[itemId]) bookingsByItem[itemId] = {};
    bookingsByItem[itemId][String(booking.id)] = booking;
  });
  const selectedItemIds = new Set(Object.keys(bookingsByItem));
  const parentFeeSubsidyChildren = Object.entries(simulationData.dataItems || {}).flatMap(([itemId, item]) => {
    if (item?.type !== 'demand' || !shouldIncludeDataItemInAnalysis(item) || !isRecordActiveOnDate(item, referenceDate)) {
      return [];
    }
    const activeBasisBookings = Object.values(simulationData.bookingsByItem?.[itemId] || {}).filter((booking) => {
      const bookingType = booking?.buchungsart || decodeBuchungsart(booking?.rawdata?.ART);
      return bookingType?.basis !== false
        && (!booking?.startdate || booking.startdate <= referenceDate)
        && (!booking?.enddate || booking.enddate >= referenceDate);
    });
    if (activeBasisBookings.length === 0) return [];

    const latestBooking = activeBasisBookings.slice().sort((left, right) => (
      String(right?.startdate || '').localeCompare(String(left?.startdate || ''))
    ))[0];
    const groupId = resolveGroupIdAtDate(
      simulationData.groupAssignmentsByItem?.[itemId] || {},
      referenceDate,
      latestBooking?.groupId || item.groupId || null
    );
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
    parentFeeSubsidyChildren,
  };
}

function rebaseSimulationDemandToMonth(demandData, targetDate) {
  // Keep the selected base-year cohort active in the corresponding target-year month.
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

  return {
    ...demandData,
    demand: (demandData.demand || []).map(rebaseRecord),
    effectiveDataItems,
    effectiveBookingsByItem,
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

function getFamilyLabelSurname(label, familyId) {
  if (isPlaceholderFamilyLabel(label, familyId)) return '';
  const parts = String(label || '').trim().replace(/^(familie|fam\.?)[\s:]+/i, '').split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1].replace(/[,.]+$/, '') : '';
}

function buildFamilyPresentation(dataItems, isAnonymized) {
  const sourceGroups = new Map();
  const childToSourceGroup = new Map();
  Object.entries(dataItems || {}).forEach(([itemId, item]) => {
    if (item?.type !== 'demand') return;
    const familyId = String(item.familyId || '').trim();
    const familyLabel = String(item.familyLabel || '').trim();
    const surname = getItemSurname(item);
    const sourceKey = familyId
      ? familyId
      : !isPlaceholderFamilyLabel(familyLabel, familyId)
        ? `label:${familyLabel.toLowerCase()}`
        : (!isAnonymized && surname ? `surname:${surname.toLowerCase()}` : `child:${itemId}`);
    childToSourceGroup.set(String(itemId), sourceKey);
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
    const familyLabelSurname = sourceGroup.labels
      .map((label) => getFamilyLabelSurname(label, sourceGroup.sourceKey))
      .find(Boolean);
    const childSurnames = Array.from(new Set(sourceGroup.surnames));
    const mergeSurname = familyLabelSurname || (childSurnames.length === 1 ? childSurnames[0] : '');
    const groupKey = isAnonymized
      ? sourceGroup.sourceKey
      : mergeSurname
        ? `surname:${mergeSurname.toLowerCase()}`
        : sourceGroup.sourceKey;
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
  const referenceDate = useSelector((state) => state.chart?.referenceDate)
    || new Date().toISOString().slice(0, 10);
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
  const fixedBaseYearEnabled = fundingSimulationSettings.fixedBaseYearEnabled === true;
  const fixedBaseYear = fixedBaseYearEnabled
    ? Number(fundingSimulationSettings.fixedBaseYear) || currentYear
    : currentYear;
  const temporaryCatalogEntries = fundingSimulationSettings.temporaryCatalogEntries || EMPTY_FINANCE;
  const temporaryPrices = fundingSimulationSettings.temporaryPrices || EMPTY_FINANCE;
  const selectedGroupIds = React.useMemo(
    () => (Array.isArray(fundingSimulationSettings.selectedGroupIds) ? fundingSimulationSettings.selectedGroupIds : []),
    [fundingSimulationSettings.selectedGroupIds]
  );
  const potentialMonthlyBudget = Number.isFinite(Number(fundingSimulationSettings.potentialMonthlyBudget))
    ? Number(fundingSimulationSettings.potentialMonthlyBudget)
    : 50;
  const [pdfExportLoading, setPdfExportLoading] = React.useState(false);
  const [scenarioSaveOpened, setScenarioSaveOpened] = React.useState(false);
  const [scenarioNameDraft, setScenarioNameDraft] = React.useState('');
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
              [field]: Math.max(0, Number(value) || 0),
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
  const simulationCatalogs = React.useMemo(() => ({
    ...groupFeeCatalogs,
    ...temporaryCatalogEntries,
  }), [groupFeeCatalogs, temporaryCatalogEntries]);
  const effectiveFeeCatalogs = React.useMemo(() => Object.fromEntries(
    Object.entries(simulationCatalogs).map(([groupId, entries]) => [
      groupId,
      entries.map((entry) => {
        const override = temporaryPrices?.[groupId]?.[getFeeBandSimulationPriceKey(entry)];
        return Number.isFinite(Number(override))
          ? { ...entry, monthlyAmount: Number(override) }
          : entry;
      }),
    ])
  ), [simulationCatalogs, temporaryPrices]);
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
  const calculatedAnnualIncomeRows = React.useMemo(() => {
    const financeForModel = { ...financeScenario, groupFeeCatalogs };
    const reformForecast = financeScenario?.settings?.reformForecast || {};
    const legacyActualFunding = reformForecast.actualFunding || {};
    const annualFundingInputsByYear = reformForecast.annualFundingInputsByYear || {};
    const annualRows = fundingYears.map((year) => {
      const manualInputYear = fixedBaseYearEnabled ? fixedBaseYear : year;
      const manualInputDefaults = manualInputYear === 2026 ? legacyActualFunding : {};
      const manualInputsForYear = annualFundingInputsByYear[String(manualInputYear)] || {};
      const manualInputs = {
        under3Federal: Math.max(0, Number(manualInputsForYear.under3Federal
          ?? manualInputDefaults.under3Federal ?? 0) || 0),
        personnelBonus: Math.max(0, Number(manualInputsForYear.personnelBonus
          ?? manualInputDefaults.personnelBonus ?? 0) || 0),
        assistance: Math.max(0, Number(manualInputsForYear.assistance
          ?? manualInputDefaults.assistance ?? 0) || 0),
        languageSpecialists: Math.max(0, Number(manualInputsForYear.languageSpecialists
          ?? manualInputDefaults.languageSpecialists ?? 0) || 0),
      };
      const monthlyDetails = [];
      const families = new Map();
      const familyContributionImpacts = new Map();
      let contributions = 0;
      let baselineContributions = 0;
      let contributionsChange = 0;
      let annualParentFeeSubsidy = 0;
      let eligibleParentFeeSubsidyChildMonths = 0;

      Array.from({ length: 12 }, (_, monthIndex) => {
        const monthReferenceDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const monthDays = new Date(year, monthIndex + 1, 0).getDate();
        const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, monthIndex, 1));
        const basisMonthReferenceDate = `${fixedBaseYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const sourceDemandData = getSimulationDemandForDate({
          scenarioId: selectedScenarioId,
          referenceDate: fixedBaseYearEnabled ? basisMonthReferenceDate : monthReferenceDate,
          selectedGroupIds: [],
          simulationData,
        });
        const demandData = fixedBaseYearEnabled
          ? rebaseSimulationDemandToMonth(sourceDemandData, monthReferenceDate)
          : sourceDemandData;
        const monthSimulationData = fixedBaseYearEnabled ? {
          ...simulationData,
          dataItems: { ...simulationData.dataItems, ...demandData.effectiveDataItems },
          bookingsByItem: {
            ...simulationData.bookingsByItem,
            ...demandData.effectiveBookingsByItem,
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
        const monthlySimulation = simulateContributionChanges({
          demandBookings: demandData.demand,
          dataItems: monthSimulationData.dataItems,
          groupDefs,
          bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
          groupFeeCatalogs: simulationCatalogs,
          originalGroupFeeCatalogs: groupFeeCatalogs,
          parentFeeSubsidy,
          parentFeeSubsidiesByGroup: effectiveParentFeeSubsidiesByGroup,
          baselineParentFeeSubsidy: parentFeeSubsidy,
          baselineParentFeeSubsidiesByGroup: parentFeeSubsidiesByGroup,
          parentFeeSubsidyChildren: demandData.parentFeeSubsidyChildren,
          temporaryPrices,
          utilizationPercent: 0,
          referenceDate: monthReferenceDate,
        });
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
        const basisRule = pickApplicableValidityEntry(financeScenario?.bayKiBiGRules, monthReferenceDate)
          || [...(financeScenario?.bayKiBiGRules || [])]
            .sort((left, right) => String(right.validFrom || '').localeCompare(String(left.validFrom || '')))[0];
        const monthKey = monthReferenceDate.slice(0, 7);
        const adebisOverrides = financeScenario?.settings?.adebisAnalysis || {};
        const adebisMetrics = calculateAdebisMonthMetrics({
          monthlyFinance,
          simulationData: monthSimulationData,
          qualificationDefs,
          groupDefs,
          basisValue: basisRule?.baseValue,
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
        const baselineParentFeeSubsidy = monthlyParentFeeSubsidy
          - monthlySimulation.totals.deltaParentFeeSubsidy;

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

        monthlyFinance.childRows.forEach((childRow) => {
          const childId = String(childRow.itemId);
          const item = childRow.item || monthSimulationData.dataItems[childId] || {};
          const familyId = familyPresentation.keyByChildId[childId]
            || String(item.familyId || item.familyLabel || `child:${childId}`);
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
          child.annualFunding += childMetrics.weightedDailyHours
            * (Number(childRow.bayKiBiGRule?.baseValue) || adebisMetrics.basisValue) / 24;
        });

        const monthlyBaselineContributions = monthlyFinance.summary.incomeParents - baselineParentFeeSubsidy;
        baselineContributions += monthlyBaselineContributions;
        contributions += monthlyBaselineContributions + monthlySimulation.totals.deltaParentFees;
        contributionsChange += monthlySimulation.totals.deltaParentFees;
        annualParentFeeSubsidy += monthlyParentFeeSubsidy;
        eligibleParentFeeSubsidyChildMonths += monthlySimulation.totals.eligibleParentFeeSubsidyChildren;
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
        averageDailyBookingHours: meanMetric('bookingHoursDaily'),
        additionalFunding,
        totalFunding,
        contributions: contributionsRounded,
        baselineContributions: baselineContributionsRounded,
        contributionsChange: contributionsChangeRounded,
        annualParentFeeSubsidy: Math.round(annualParentFeeSubsidy * 100) / 100,
        eligibleParentFeeSubsidyChildMonths,
        totalIncome: Math.round((totalFunding + contributionsRounded) * 100) / 100,
        baselineTotalIncome: Math.round((totalFunding + baselineContributionsRounded) * 100) / 100,
        totalIncomeChange: Math.round((contributionsRounded - baselineContributionsRounded) * 100) / 100,
        monthlyDetails,
        familyTree,
        familyParentFeesById,
      };
    });
    return annualRows.map((row, index) => {
      const currentFamilyFees = row.familyParentFeesById || {};
      const previousFamilyFees = annualRows[index - 1]?.familyParentFeesById || {};
      const familyIds = new Set([...Object.keys(currentFamilyFees), ...Object.keys(previousFamilyFees)]);
      const familyImpacts = Array.from(familyIds).map((familyId) => {
        const current = currentFamilyFees[familyId];
        const previous = previousFamilyFees[familyId];
        const annualDelta = (current?.monthlyParentFeesAfter || 0) - (current?.monthlyParentFeesBefore || 0);
        const yearOverYearAnnualDelta = index === 0
          ? null
          : (current?.monthlyParentFeesBefore || 0) - (previous?.monthlyParentFeesBefore || 0);
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
      return { ...rowData, familyImpacts };
    });
  }, [
    fundingYears,
    fixedBaseYearEnabled,
    fixedBaseYear,
    financeScenario,
    groupFeeCatalogs,
    selectedScenarioId,
    simulationData,
    groupDefs,
    qualificationDefs,
    familyPresentation,
    simulationCatalogs,
    parentFeeSubsidy,
    parentFeeSubsidiesByGroup,
    effectiveParentFeeSubsidiesByGroup,
    temporaryPrices,
  ]);
  const reformForecastSettings = financeScenario?.settings?.reformForecast || {};
  const baseline2026Row = calculatedAnnualIncomeRows.find((row) => row.year === 2026);
  const reformActualFundingDefaults = {
    bookingTime: baseline2026Row?.funding || 0,
    qualityBonus: baseline2026Row?.qualityBonus || 0,
    preparatoryCourses: baseline2026Row?.preparatoryCourses || 0,
    under3Additional: baseline2026Row?.under3Additional || 0,
    under3Federal: baseline2026Row?.under3Federal || 0,
    parentFeeSubsidy: baseline2026Row?.annualParentFeeSubsidy || 0,
    assistance: baseline2026Row?.assistance || 0,
    personnelBonus: baseline2026Row?.personnelBonus || 0,
    languageSpecialists: baseline2026Row?.languageSpecialists || 0,
  };
  const reformActualFunding = {
    ...reformActualFundingDefaults,
    ...(reformForecastSettings.actualFunding || {}),
  };
  const reformForecast = calculateReformForecast({
    ...reformForecastSettings,
    actualFunding: reformActualFunding,
  }, {}, financeScenario?.bayKiBiGRules || []);
  const reformUsesFixed2026Baseline = fixedBaseYearEnabled && fixedBaseYear === 2026;
  const annualIncomeRows = React.useMemo(() => calculatedAnnualIncomeRows.map((row) => {
    const reformYear = reformForecast.results.find((result) => result.year === row.year);
    const reformGrantApplied = row.year >= 2027 && reformForecastSettings.teamGrantEligible === true;
    const existingGuidelineFunding = row.personnelBonus + row.assistance + row.languageSpecialists;
    const reformGuidelineFunding = reformGrantApplied ? (reformYear?.teamGrantNet || 0) : existingGuidelineFunding;
    const standardFundingExcludingPassThrough = row.totalFunding - row.annualParentFeeSubsidy;
    const baselineGuidelineFunding = (Number(reformActualFunding.personnelBonus) || 0)
      + (Number(reformActualFunding.assistance) || 0)
      + (Number(reformActualFunding.languageSpecialists) || 0);
    const reformProjectionFunding = reformYear
      ? reformYear.result + (row.year === 2026
        ? baselineGuidelineFunding
        : !reformGrantApplied ? existingGuidelineFunding : 0)
      : standardFundingExcludingPassThrough;
    const adjustment = reformUsesFixed2026Baseline
      ? reformProjectionFunding - standardFundingExcludingPassThrough
      : reformGuidelineFunding - existingGuidelineFunding;
    const totalFunding = Math.round((row.totalFunding + adjustment) * 100) / 100;
    const totalIncome = Math.round((totalFunding + row.contributions) * 100) / 100;
    const baselineTotalIncome = Math.round((totalFunding + row.baselineContributions) * 100) / 100;
    return {
      ...row,
      additionalFunding: Math.round((row.additionalFunding + adjustment) * 100) / 100,
      totalFunding,
      totalIncome,
      baselineTotalIncome,
      totalIncomeChange: Math.round((totalIncome - baselineTotalIncome) * 100) / 100,
      reformTeamGrant: reformYear?.teamGrant || 0,
      reformPriorGuidelineFunding: reformYear?.priorGuidelineFunding || 0,
      reformTeamGrantNet: reformYear?.teamGrantNet || 0,
      reformGrantApplied,
      reformProjectionApplied: reformUsesFixed2026Baseline,
      reformProjectionFunding: Math.round(reformProjectionFunding * 100) / 100,
    };
  }), [
    calculatedAnnualIncomeRows,
    reformForecast,
    reformForecastSettings.teamGrantEligible,
    reformUsesFixed2026Baseline,
    reformActualFunding.personnelBonus,
    reformActualFunding.assistance,
    reformActualFunding.languageSpecialists,
  ]);
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
  const currentDemandData = React.useMemo(() => getSimulationDemandForDate({
    scenarioId: selectedScenarioId,
    referenceDate,
    selectedGroupIds: [],
    simulationData,
  }), [selectedScenarioId, referenceDate, simulationData]);
  const currentSimulation = React.useMemo(() => simulateContributionChanges({
    demandBookings: currentDemandData.demand,
    dataItems: simulationData.dataItems,
    groupDefs,
    bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
    groupFeeCatalogs: simulationCatalogs,
    originalGroupFeeCatalogs: groupFeeCatalogs,
    parentFeeSubsidy,
    parentFeeSubsidiesByGroup: effectiveParentFeeSubsidiesByGroup,
    baselineParentFeeSubsidy: parentFeeSubsidy,
    baselineParentFeeSubsidiesByGroup: parentFeeSubsidiesByGroup,
    parentFeeSubsidyChildren: currentDemandData.parentFeeSubsidyChildren,
    temporaryPrices,
    utilizationPercent: 0,
    referenceDate,
  }), [
    currentDemandData,
    simulationData,
    groupDefs,
    financeScenario?.bayKiBiGRules,
    simulationCatalogs,
    groupFeeCatalogs,
    parentFeeSubsidy,
    parentFeeSubsidiesByGroup,
    effectiveParentFeeSubsidiesByGroup,
    temporaryPrices,
    referenceDate,
  ]);
  const familyPotentials = React.useMemo(() => calculateFamilyFeePotentials({
    demandBookings: currentDemandData.demand,
    dataItems: simulationData.dataItems,
    familyGroupIds: familyPresentation.keyByChildId,
    groupDefs,
    bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
    groupFeeCatalogs: simulationCatalogs,
    parentFeeSubsidy,
    parentFeeSubsidiesByGroup: effectiveParentFeeSubsidiesByGroup,
    temporaryPrices,
    referenceDate,
    monthlyBudget: potentialMonthlyBudget,
  }), [
    currentDemandData,
    simulationData,
    familyPresentation,
    groupDefs,
    financeScenario?.bayKiBiGRules,
    simulationCatalogs,
    parentFeeSubsidy,
    effectiveParentFeeSubsidiesByGroup,
    temporaryPrices,
    referenceDate,
    potentialMonthlyBudget,
  ]);
  const familyPotentialById = React.useMemo(() => new Map(
    familyPotentials.map((family) => [family.id, family])
  ), [familyPotentials]);
  const familyPotentialTotals = React.useMemo(() => familyPotentials.reduce((total, family) => ({
    upgradeWeeklyHours: total.upgradeWeeklyHours + family.potentialUpgradeWeeklyHours,
    downgradeWeeklyHours: total.downgradeWeeklyHours + family.potentialDowngradeWeeklyHours,
    upgradeWeightedDailyHours: total.upgradeWeightedDailyHours + family.potentialUpgradeWeightedDailyHours,
    downgradeWeightedDailyHours: total.downgradeWeightedDailyHours + family.potentialDowngradeWeightedDailyHours,
  }), {
    upgradeWeeklyHours: 0,
    downgradeWeeklyHours: 0,
    upgradeWeightedDailyHours: 0,
    downgradeWeightedDailyHours: 0,
  }), [familyPotentials]);
  const affectedFamilyRows = React.useMemo(() => {
    const grouped = new Map();
    currentSimulation.familyContributions.forEach((family) => {
      const familyKeys = new Set((family.childIds || []).map((childId) => (
        familyPresentation.keyByChildId[String(childId)] || `child:${childId}`
      )));
      if (familyKeys.size === 0) familyKeys.add(family.id);
      familyKeys.forEach((familyKey) => {
        if (!grouped.has(familyKey)) {
          grouped.set(familyKey, {
            id: familyKey,
            label: familyPresentation.labelByKey.get(familyKey) || family.label || familyKey,
            monthlyParentFeesBefore: 0,
            monthlyParentFeesAfter: 0,
          });
        }
        const row = grouped.get(familyKey);
        row.monthlyParentFeesBefore += family.monthlyParentFeesBefore;
        row.monthlyParentFeesAfter += family.monthlyParentFeesAfter;
      });
    });

    return Array.from(grouped.values()).map((family) => {
      const deltaMonthlyParentFees = family.monthlyParentFeesAfter - family.monthlyParentFeesBefore;
      return {
        ...family,
        deltaMonthlyParentFees,
        changePercent: family.monthlyParentFeesBefore > 0
          ? deltaMonthlyParentFees / family.monthlyParentFeesBefore * 100
          : null,
        potential: familyPotentialById.get(family.id) || {
          potentialUpgradeWeeklyHours: 0,
          potentialDowngradeWeeklyHours: 0,
        },
      };
    })
      .filter((family) => Math.abs(family.deltaMonthlyParentFees) >= 0.005)
      .sort((left, right) => Math.abs(right.deltaMonthlyParentFees) - Math.abs(left.deltaMonthlyParentFees));
  }, [currentSimulation.familyContributions, familyPresentation, familyPotentialById]);

  const setTemporaryCatalog = (groupId, nextEntries) => {
    const originalEntries = groupFeeCatalogs[groupId] || [];
    const overrides = {};
    const structuralEntries = nextEntries.map((entry) => {
      const original = originalEntries.find((candidate) => String(candidate.id) === String(entry.id));
      const originalAmount = Number(original?.monthlyAmount) || 0;
      const nextAmount = Number(entry.monthlyAmount) || 0;
      if (Math.round(originalAmount * 100) !== Math.round(nextAmount * 100)) {
        overrides[getFeeBandSimulationPriceKey(entry)] = nextAmount;
      }
      return { ...entry, monthlyAmount: original ? originalAmount : 0 };
    });
    updateFundingSimulation({
      temporaryCatalogEntries: { ...temporaryCatalogEntries, [groupId]: structuralEntries },
      temporaryPrices: { ...temporaryPrices, [groupId]: overrides },
    });
  };
  const resetTemporaryCatalog = (groupId) => {
    const keepOtherGroups = (values) => Object.fromEntries(
      Object.entries(values).filter(([id]) => id !== String(groupId))
    );
    updateFundingSimulation({
      temporaryCatalogEntries: keepOtherGroups(temporaryCatalogEntries),
      temporaryPrices: keepOtherGroups(temporaryPrices),
    });
  };
  const resetAllTemporaryCatalogs = () => {
    updateFundingSimulation({
      temporaryCatalogEntries: {},
      temporaryPrices: {},
    });
  };
  const selectedSimulationScenario = simulationScenarios.find((scenario) => scenario.id === selectedSimulationScenarioId)
    || simulationScenarios[0];
  const captureSimulationScenarioData = () => ({
    temporaryCatalogEntries: clonePlainData(temporaryCatalogEntries),
    temporaryPrices: clonePlainData(temporaryPrices),
    selectedGroupIds: [...selectedGroupIds],
    fixedBaseYearEnabled,
    fixedBaseYear,
    potentialMonthlyBudget,
  });
  const applySimulationScenario = (scenarioId) => {
    const scenario = simulationScenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) return;
    const data = scenario.data || {};
    updateFundingSimulation({
      selectedSimulationScenarioId: scenario.id,
      temporaryCatalogEntries: clonePlainData(data.temporaryCatalogEntries || {}),
      temporaryPrices: clonePlainData(data.temporaryPrices || {}),
      selectedGroupIds: [...(data.selectedGroupIds || [])],
      fixedBaseYearEnabled: data.fixedBaseYearEnabled === true,
      fixedBaseYear: Number(data.fixedBaseYear) || currentYear,
      potentialMonthlyBudget: Number.isFinite(Number(data.potentialMonthlyBudget))
        ? Number(data.potentialMonthlyBudget)
        : 50,
    });
  };
  const handleSaveSimulationScenario = () => {
    const name = scenarioNameDraft.trim();
    if (!name) return;
    const scenario = { id: createLocalScenarioId(), name, data: captureSimulationScenarioData() };
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
        temporaryCatalogEntries: {},
        temporaryPrices: {},
        selectedGroupIds: [],
        fixedBaseYearEnabled: false,
        fixedBaseYear: currentYear,
        potentialMonthlyBudget: 50,
      },
    };
    updateFundingSimulation({
      simulationScenarios: [...simulationScenarios, scenario],
      selectedSimulationScenarioId: scenario.id,
      temporaryCatalogEntries: {},
      temporaryPrices: {},
      selectedGroupIds: [],
      fixedBaseYearEnabled: false,
      fixedBaseYear: currentYear,
      potentialMonthlyBudget: 50,
    });
  };
  const handleCloneSimulationScenario = () => {
    const scenario = {
      id: createLocalScenarioId(),
      name: `${selectedSimulationScenario?.name || 'Szenario'} (Kopie)`,
      data: captureSimulationScenarioData(),
    };
    updateFundingSimulation({
      simulationScenarios: [...simulationScenarios, scenario],
      selectedSimulationScenarioId: scenario.id,
    });
  };
  const handleExportPdf = async () => {
    setPdfExportLoading(true);
    try {
      const annualRows = annualIncomeRows.map((row, index) => {
        const previous = annualIncomeRows[index - 1] || null;
        const annualBasisValueTotal = row.monthlyDetails
          .reduce((sum, month) => sum + (Number(month.basisValue) || 0), 0);
        const fundingPerWeightedDailyHour = annualBasisValueTotal / 24;
        const upgradeHours = familyPotentialTotals.upgradeWeeklyHours / 5;
        const downgradeHours = familyPotentialTotals.downgradeWeeklyHours / 5;
        return [
          row.year,
          formatEuro(row.additionalFunding),
          formatDailyHours(row.averageDailyBookingHours),
          formatEuro(row.totalFunding),
          previous ? formatSignedEuro(row.totalFunding - previous.totalFunding) : '–',
          formatEuro(row.contributions),
          `${previous ? formatSignedEuro(row.baselineContributions - previous.baselineContributions) : '–'} / ${formatSignedEuro(row.contributionsChange)} Sim.`,
          formatEuro(row.totalIncome),
          `${previous ? formatSignedEuro(row.baselineTotalIncome - previous.baselineTotalIncome) : '–'} / ${formatSignedEuro(row.totalIncomeChange)} Sim.`,
          upgradeHours > 0 ? `${formatDailyHours(upgradeHours)} · ${formatSignedEuro(upgradeHours * fundingPerWeightedDailyHour)}` : '–',
          downgradeHours > 0 ? `-${formatDailyHours(downgradeHours)} · ${formatSignedEuro(-downgradeHours * fundingPerWeightedDailyHour)}` : '–',
        ];
      });
      const annualFundingDetailRows = annualIncomeRows.map((row) => [
        row.year,
        row.monthlyDetails.reduce((sum, month) => sum + month.under3Children, 0),
        formatEuro(row.under3Additional),
        formatEuro(row.annualFundingInputs.under3Federal),
        formatEuro(row.annualFundingInputs.personnelBonus),
        formatEuro(row.annualFundingInputs.assistance),
        formatEuro(row.annualFundingInputs.languageSpecialists),
        formatEuro(row.reformTeamGrant),
        formatEuro(row.reformPriorGuidelineFunding),
        formatEuro(row.reformTeamGrantNet),
      ]);
      const feeRows = tariffGroups.flatMap((group) => {
        const subsidy = effectiveParentFeeSubsidiesByGroup[group.id] || parentFeeSubsidy;
        return ZEITKAT_CATALOG.map((zone) => {
          const entry = (effectiveFeeCatalogs[group.id] || []).find((candidate) => getFeeBandZeitkatId(candidate) === zone.id);
          const amount = Number(entry?.monthlyAmount) || 0;
          const active = Boolean(entry && entry.enabled !== false && amount > 0);
          return [
            group.name,
            `${subsidy.enabled !== false ? 'aktiv' : 'inaktiv'} · ${formatEuro(subsidy.monthlyAmount)}`,
            `ZEITKAT ${zone.id} (${zone.kurzbez}h)`,
            `${zone.maxHours} h/Tag`,
            active ? 'Aktiv' : 'Inaktiv',
            entry ? formatEuro(amount) : '–',
            entry ? `${(amount / zone.maxHours).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h` : '–',
          ];
        });
      });
      const groupFilterLabel = selectedGroupIds.length
        ? selectedGroupIds.map((groupId) => groupFilterOptions.find((option) => option.value === groupId)?.label || groupId).join(', ')
        : 'Alle Gruppen';
      const baseYearLabel = fixedBaseYearEnabled
        ? `Fixiertes Basisjahr: ${fixedBaseYear} (Kinderbestand, Buchungsstunden und Zusatzförderungen)`
        : `Kein fixiertes Basisjahr · Jahresbasis nach Buchungsdaten (Stichtagsjahr ${currentYear})`;
      const familyRows = affectedFamilyRows.slice(0, 10).map((family) => [
        family.label,
        formatEuro(family.monthlyParentFeesBefore),
        formatEuro(family.monthlyParentFeesAfter),
        formatSignedEuro(family.deltaMonthlyParentFees),
      ]);
      await generateSimulationPdfReport({
        scenarioName: selectedSimulationScenario?.name || 'Szenario',
        referenceDate,
        groupFilterLabel,
        baseYearLabel,
        feeRows,
        annualRows,
        annualFundingDetailRows,
        familyRows,
        omittedFamilyCount: Math.max(0, affectedFamilyRows.length - familyRows.length),
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
  const hasAnyZeitkatEntries = catalogEntries.some((entry) => Boolean(getFeeBandZeitkatId(entry)) && entry.enabled !== false && Number(entry.monthlyAmount) > 0);
  const hasSimulationFeeRows = categoryPriceRows.length > 0;

  return (
    <Stack
      className="funding-simulation-panel"
      gap="sm"
      h={scrollPage ? 'auto' : '100%'}
      style={{ minHeight: 0, overflow: scrollPage ? 'visible' : 'hidden' }}
      data-testid="funding-simulation-panel"
    >
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
                {fixedBaseYearEnabled ? `Basisjahr: ${fixedBaseYear} (fixiert)` : `Jahresbasis: dynamisch (${currentYear})`}
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
                {categoryPriceRows.length > 0 || Object.keys(temporaryCatalogEntries).length > 0 ? (
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
              <Text size="xs" c="dimmed">
                {fixedBaseYearEnabled
                  ? `Kinderbestand, Buchungsstunden und die vier jährlichen Zusatzförderungen (U3-Bundesmittel, Personalbonus, Assistenz, Sprachförderung) aus ${fixedBaseYear} gelten für alle Ergebnisjahre. Die übrigen Förderregeln werden weiter je Ergebnisjahr berechnet.`
                  : 'Ohne Fixierung werden Kinderbestand, Buchungsstunden und jährliche Zusatzförderungen je Ergebnisjahr ermittelt.'}
              </Text>
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
                <Text size="xs" c="dimmed">Legt fest, für welche Gruppen die Tarife angezeigt werden.</Text>
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
                        value={reformForecastSettings.approvedPlaces ?? 0}
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
                    Bei Anspruch ersetzt der Teamzuschuss ab 2027 in der bestehenden Förderanspruchssumme die bisherigen Personalbonus-, Assistenz- und Sprachförderbeträge. Mit fixiertem Basisjahr 2026 werden zusätzlich Buchungszeitenförderung, Qualitätsbonus und weitere Reformkomponenten aus den 2026-Istwerten fortgeschrieben; 2026 bleibt der Vergleichs-Ausgangspunkt. Die Teamzuschuss-Sätze je Förderjahr pflegst du unter Optionen → Förderung → BayKiBiG-Rahmen.
                  </Text>
                  <Text size="xs" fw={600}>2026-Istwerte als Reform-Basis (aus Capakita vorbelegt, bei Bedarf überschreiben)</Text>
                  <Text size="xs" c="dimmed">
                    Ein gespeicherter Reformwert hat Vorrang; andernfalls wird der Wert aus der Capakita-Jahresberechnung 2026 vorbelegt. Manuell erfasste Zusatzförderungen sind entsprechend gekennzeichnet.
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
                      const calculatedValue = Number(reformActualFundingDefaults[field]) || 0;
                      const inputValue = Number(reformActualFunding[field]) || 0;
                      const hasSavedValue = reformForecastSettings.actualFunding?.[field] != null;
                      const difference = inputValue - calculatedValue;
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
                            {sourceLabel}: {formatEuro(calculatedValue)}
                          </Text>
                          {hasSavedValue && Math.abs(difference) >= 0.005 ? (
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
          onChange={(value) => value && applySimulationScenario(value)}
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
              onClick={handleNewSimulationScenario}
              data-testid="new-simulation-scenario"
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Aktuelles Szenario klonen">
            <ActionIcon
              variant="light"
              aria-label="Szenario klonen"
              onClick={handleCloneSimulationScenario}
              data-testid="clone-simulation-scenario"
            >
              <IconCopy size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
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
                            <Text size="xs" c="dimmed">{(effectiveFeeCatalogs[group.id] || []).filter((entry) => entry.enabled !== false && Number(entry.monthlyAmount) > 0).length} Staffeln</Text>
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
                loading={pdfExportLoading}
                onClick={handleExportPdf}
                data-testid="export-simulation-pdf"
              >
                PDF exportieren
              </Button>
            </Group>
          </Group>
          <Stack className="funding-simulation-section" gap="xs">
            <Text fw={700} size="sm">Einnahmen im Jahresvergleich</Text>
            <Text size="xs" c="dimmed">
              Jahreswerte inklusive Elternbeitragszuschuss; Elternbeiträge zeigen den von Familien gezahlten Eigenanteil. Potenziale schätzen die jährliche Förderänderung bei mehr oder weniger Buchungsstunden innerhalb des Monatsbudgets.
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
                          <Table.Th ta="right" rowSpan={2}>Upgradepotential</Table.Th>
                          <Table.Th ta="right" rowSpan={2}>Downgradepotential</Table.Th>
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
                        <Table.Th ta="right">Upgradepotential</Table.Th>
                        <Table.Th ta="right">Downgradepotential</Table.Th>
                      </Table.Tr>
                    )}
                  </Table.Thead>
                  <Table.Tbody>
                    {annualIncomeRows.map((row, index) => {
                      const previous = annualIncomeRows[index - 1] || null;
                      const hourChange = previous
                        ? row.averageDailyBookingHours - previous.averageDailyBookingHours
                        : null;
                      const annualFundingInputTotal = Object.values(row.annualFundingInputs)
                        .reduce((sum, value) => sum + (Number(value) || 0), 0);
                      const previousFundingInputTotal = previous
                        ? Object.values(previous.annualFundingInputs).reduce((sum, value) => sum + (Number(value) || 0), 0)
                        : null;
                      const annualBasisValueTotal = row.monthlyDetails
                        .reduce((sum, month) => sum + (Number(month.basisValue) || 0), 0);
                      const annualFundingPerWeightedDailyHour = annualBasisValueTotal / 24;
                      const upgradePotentialFunding = familyPotentialTotals.upgradeWeightedDailyHours
                        * annualFundingPerWeightedDailyHour;
                      const downgradePotentialFunding = -familyPotentialTotals.downgradeWeightedDailyHours
                        * annualFundingPerWeightedDailyHour;
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
                              <Text>{row.year}</Text>
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
                                  label={`${label} ${row.year}`}
                                  value={row.annualFundingInputs[field]}
                                  onCommit={(value) => updateAnnualFundingInput(fixedBaseYearEnabled ? fixedBaseYear : row.year, field, value)}
                                  disabled={fixedBaseYearEnabled && row.year !== fixedBaseYear}
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
                              change={previous ? row.baselineContributions - previous.baselineContributions : null}
                              simulationChange={row.contributionsChange}
                              formatValue={formatEuro}
                              formatChange={formatSignedEuro}
                            />
                          </Table.Td>
                          <Table.Td ta="right" fw={700}>
                            <AnnualMetricCell
                              value={row.totalIncome}
                              change={previous ? row.baselineTotalIncome - previous.baselineTotalIncome : null}
                              simulationChange={row.totalIncomeChange}
                              formatValue={formatEuro}
                              formatChange={formatSignedEuro}
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            <AnnualPotentialCell
                              dailyHours={familyPotentialTotals.upgradeWeeklyHours / 5}
                              fundingChange={upgradePotentialFunding}
                              direction="upgrade"
                              testId={`annual-upgrade-potential-${row.year}`}
                            />
                          </Table.Td>
                          <Table.Td ta="right">
                            <AnnualPotentialCell
                              dailyHours={familyPotentialTotals.downgradeWeeklyHours / 5}
                              fundingChange={downgradePotentialFunding}
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
                                    {row.familyImpacts.length === 0 ? (
                                      <Text size="xs" c="dimmed">In diesem Jahr sind keine Familien von einer Beitragsänderung betroffen.</Text>
                                    ) : (
                                      <Table striped highlightOnHover withTableBorder fz="xs" data-testid={`annual-family-impact-table-${row.year}`}>
                                        <Table.Thead>
                                          <Table.Tr>
                                            <Table.Th>Familie</Table.Th>
                                            <Table.Th ta="right">Aktueller Beitrag · Ø / Monat</Table.Th>
                                            <Table.Th ta="right">Neuer Beitrag · Ø / Monat</Table.Th>
                                            <Table.Th ta="right">Änderung durch Simulation · Ø / Monat</Table.Th>
                                            <Table.Th ta="right">Änderung zum Vorjahr · Ø / Monat</Table.Th>
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

          <Stack className="funding-simulation-section" gap="xs">
            <Text fw={700} size="sm">Von Beitragsänderungen betroffene Familien · Stichtag</Text>
            {affectedFamilyRows.length === 0 ? (
              <Text size="sm" c="dimmed" data-testid="no-affected-families">
                Für die aktuellen Beitragssätze sind keine Familien von einer Beitragsänderung betroffen.
              </Text>
            ) : (
              <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder fz="xs" miw={680} data-testid="affected-families-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Familie</Table.Th>
                      <Table.Th ta="right">Beiträge / Monat</Table.Th>
                      <Table.Th ta="right">Veränderung</Table.Th>
                      <Table.Th ta="right">Veränderung %</Table.Th>
                      <Table.Th ta="right">Potential Upgrade</Table.Th>
                      <Table.Th ta="right">Potential Downgrade</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {affectedFamilyRows.map((family) => (
                      <Table.Tr key={family.id} data-testid={`affected-family-${family.id}`}>
                        <Table.Td>{family.label}</Table.Td>
                        <Table.Td ta="right">{formatEuro(family.monthlyParentFeesAfter)}</Table.Td>
                        <Table.Td ta="right">{formatSignedEuro(family.deltaMonthlyParentFees)}</Table.Td>
                        <Table.Td ta="right">{family.changePercent == null ? '–' : formatPercent(family.changePercent)}</Table.Td>
                        <Table.Td ta="right">
                          {family.potential.potentialUpgradeWeeklyHours > 0
                            ? `+${formatWeeklyHours(family.potential.potentialUpgradeWeeklyHours)}`
                            : '–'}
                        </Table.Td>
                        <Table.Td ta="right">
                          {family.potential.potentialDowngradeWeeklyHours > 0
                            ? `−${formatWeeklyHours(family.potential.potentialDowngradeWeeklyHours)}`
                            : '–'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Stack>
          <Modal
            opened={Boolean(selectedAnnualDetails)}
            onClose={() => setSelectedDetailsYear(null)}
            title={selectedAnnualDetails ? `ADEBIS-Jahresdetails ${selectedAnnualDetails.year}` : 'ADEBIS-Jahresdetails'}
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
                      Buchungszeitenförderung = BuStdGew × Basiswert ÷ 24. U3-Zusatzförderung, Qualitätsbonus und Vorkurse werden monatlich aus Buchungsdaten und den Fördersätzen der Jahresregel berechnet. Die vier jährlichen Zusatzwerte stehen in der Ergebnistabelle. Integ.-Kinder, FKQ-Istwert und Betriebstage können monatlich aus ADEBIS übernommen werden; Personalwerte beruhen sonst auf Vertragsstunden/Qualifikationen.
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
                              <Table.Td ta="right">{month.estimatedFunding > 0 ? 'Ja' : 'Nein'}</Table.Td>
                              <Table.Td ta="right">{formatEuro(month.baseFunding)}</Table.Td>
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
                              <Table.Td ta="right">{formatEuro(month.totalFunding)}</Table.Td>
                              <Table.Td ta="right">{formatEuro(month.parentFeeSubsidy)}</Table.Td>
                              <Table.Td ta="right">{formatEuro(month.basisValue)}</Table.Td>
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
                            <Table.Td>Mittelwerte / Jahressummen</Table.Td>
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
                        <Text fw={700} size="sm">ADEBIS-Jahressummen</Text>
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
                                <Table.Tr><Table.Td>Reform-Teamzuschuss (brutto)</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.reformTeamGrant)}</Table.Td></Table.Tr>
                                <Table.Tr><Table.Td>Abzug bisheriger Personal-/Assistenz-/Sprachförderung</Table.Td><Table.Td ta="right">−{formatEuro(selectedAnnualDetails.reformPriorGuidelineFunding)}</Table.Td></Table.Tr>
                                <Table.Tr fw={600}><Table.Td>Reformbedingter Teamzuschuss (netto)</Table.Td><Table.Td ta="right">{formatEuro(selectedAnnualDetails.reformTeamGrantNet)}</Table.Td></Table.Tr>
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
        </Stack>
      </Paper>
    </Stack>
  );
}

export default FundingSimulationPanel;
