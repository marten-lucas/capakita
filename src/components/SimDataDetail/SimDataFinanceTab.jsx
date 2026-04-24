import React from 'react';
import dayjs from 'dayjs';
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { useOverlayData } from '../../hooks/useOverlayData';
import AccordionListDetail from '../common/AccordionListDetail';
import {
  addPersonnelCostEntry,
  deletePersonnelCostEntry,
  updatePersonnelCostEntry,
} from '../../store/simFinanceSlice';
import {
  calculateChildMonthlyRevenue,
  calculateMonthlyStaffCost,
  isRecordActiveOnDate,
} from '../../utils/financeUtils';
import { calculateWorktimeFromBookings } from '../../utils/bookingUtils';

function toDateValue(value) {
  return value ? new Date(value) : null;
}

function toIsoDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return dayjs(value).format('YYYY-MM-DD');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function PersonnelCostSummary({ item }) {
  return (
    <Stack gap={2}>
      <Text fw={500}>Personalkosten</Text>
      <Text size="sm" c="dimmed">
        {Number(item.annualGrossSalary) || 0} EUR / {Number(item.employerOnCostPercent) || 0} % ab {item.validFrom || 'sofort'}
        {item.validUntil ? ` bis ${item.validUntil}` : ''}
      </Text>
    </Stack>
  );
}

function PersonnelCostDetail({ item, scenarioId, selectedItemId, dispatch }) {
  return (
    <Stack gap="sm">
      <Group grow>
        <DatePickerInput
          label="Gueltig von"
          value={toDateValue(item.validFrom)}
          onChange={(value) => dispatch(updatePersonnelCostEntry({
            scenarioId,
            itemId: selectedItemId,
            entryId: item.id,
            updates: { validFrom: toIsoDate(value) },
          }))}
          clearable
        />
        <DatePickerInput
          label="Gueltig bis"
          value={toDateValue(item.validUntil)}
          onChange={(value) => dispatch(updatePersonnelCostEntry({
            scenarioId,
            itemId: selectedItemId,
            entryId: item.id,
            updates: { validUntil: toIsoDate(value) },
          }))}
          clearable
        />
      </Group>
      <NumberInput
        label="Bruttojahresgehalt"
        value={item.annualGrossSalary}
        onChange={(value) => dispatch(updatePersonnelCostEntry({
          scenarioId,
          itemId: selectedItemId,
          entryId: item.id,
          updates: { annualGrossSalary: value ?? '' },
        }))}
        decimalScale={2}
        min={0}
        thousandSeparator="."
        decimalSeparator="," 
        suffix=" EUR"
      />
      <NumberInput
        label="AG-Nebenkosten"
        value={item.employerOnCostPercent}
        onChange={(value) => dispatch(updatePersonnelCostEntry({
          scenarioId,
          itemId: selectedItemId,
          entryId: item.id,
          updates: { employerOnCostPercent: value ?? '' },
        }))}
        decimalScale={2}
        min={0}
        max={200}
        suffix=" %"
      />
      <TextInput
        label="Notiz"
        value={item.note || ''}
        onChange={(event) => dispatch(updatePersonnelCostEntry({
          scenarioId,
          itemId: selectedItemId,
          entryId: item.id,
          updates: { note: event.currentTarget.value },
        }))}
      />
    </Stack>
  );
}

function SimDataFinanceTab() {
  const dispatch = useDispatch();
  const scenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector((state) => state.simScenario.selectedItems?.[scenarioId]);
  const referenceDate = useSelector((state) => state.chart?.[scenarioId]?.referenceDate || dayjs().format('YYYY-MM-DD'));
  const financeScenario = useSelector((state) => state.simFinance.financeByScenario[scenarioId] || {
    settings: { partialAbsenceThresholdDays: 42, partialAbsenceEmployerSharePercent: 0 },
    bayKiBiGRules: [],
    groupFeeCatalogs: {},
    itemFinances: {},
  });
  const {
    getEffectiveDataItem,
    getEffectiveBookings,
    getEffectiveGroupAssignments,
    getEffectiveGroupDefs,
  } = useOverlayData();

  const item = getEffectiveDataItem(selectedItemId);
  if (!item) return null;

  const effectiveBookings = Object.values(getEffectiveBookings(selectedItemId) || {});

  const itemFinance = financeScenario.itemFinances?.[selectedItemId] || {
    personnelCostHistory: [],
  };

  if (item.type === 'demand') {
    const childFinance = calculateChildMonthlyRevenue({
      item,
      bookings: effectiveBookings,
      groupAssignments: getEffectiveGroupAssignments(selectedItemId),
      groupDefs: getEffectiveGroupDefs(),
      financeScenario,
      referenceDate,
    });

    return (
      <Stack gap="md">
        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Text fw={600}>Automatische Einnahmen zum Stichtag</Text>
            <Text size="sm" c="dimmed">
              Grundlage ist der Stichtag {referenceDate} mit den aktuell gueltigen Gruppen- und Finanzstammdaten.
            </Text>
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text>Durchschnittliche Wochenstunden</Text>
              <Text fw={600}>{childFinance.weeklyHours.toFixed(1)} h</Text>
            </Group>
            <Group justify="space-between">
              <Text>Elternbeitrag</Text>
              <Text fw={600}>{formatCurrency(childFinance.parentFeeAmount)}</Text>
            </Group>
            <Group justify="space-between">
              <Text>BayKiBiG-Foerderung</Text>
              <Text fw={600}>{formatCurrency(childFinance.bayKiBiGAmount)}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={600}>Gesamteinnahmen</Text>
              <Text fw={700}>{formatCurrency(childFinance.totalAmount)}</Text>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  const staffFinance = calculateMonthlyStaffCost({
    item,
    itemFinance,
    referenceDate,
    partialAbsenceThresholdDays: financeScenario.settings?.partialAbsenceThresholdDays ?? 42,
    partialAbsenceEmployerSharePercent: financeScenario.settings?.partialAbsenceEmployerSharePercent ?? 0,
  });

  const activeStaffBookings = effectiveBookings.filter((booking) => isRecordActiveOnDate(booking, referenceDate));
  const weeklyPedagogicalHours = calculateWorktimeFromBookings(activeStaffBookings, { mode: 'pedagogical' });
  const weeklyAdministrativeHours = calculateWorktimeFromBookings(activeStaffBookings, { mode: 'administrative' });

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Personalkosten zum Stichtag</Text>
          <Group justify="space-between">
            <Text>Wochenarbeitszeit (paedagogisch)</Text>
            <Text fw={600}>{weeklyPedagogicalHours.toFixed(1)} h</Text>
          </Group>
          <Group justify="space-between">
            <Text>Wochenarbeitszeit (administrativ)</Text>
            <Text fw={600}>{weeklyAdministrativeHours.toFixed(1)} h</Text>
          </Group>
          <Group justify="space-between">
            <Text>Monatliche Basiskosten</Text>
            <Text fw={600}>{formatCurrency(staffFinance.baseMonthlyCost)}</Text>
          </Group>
          <Group justify="space-between">
            <Text>Anwesenheitsfaktor</Text>
            <Text fw={600}>{(staffFinance.absenceCostFactor * 100).toFixed(0)} %</Text>
          </Group>
          <Group justify="space-between">
            <Text fw={600}>Monatliche Personalkosten</Text>
            <Text fw={700}>{formatCurrency(staffFinance.adjustedMonthlyCost)}</Text>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={600}>Personalkosten</Text>
              <Text size="sm" c="dimmed">Historie mit Bruttojahresgehalt und AG-Nebenkosten. Der Rest bleibt unveraendert.</Text>
            </div>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => dispatch(addPersonnelCostEntry({
                scenarioId,
                itemId: selectedItemId,
                entry: { validFrom: '', validUntil: '', annualGrossSalary: '', employerOnCostPercent: '' },
              }))}
            >
              Personalkosten-Eintrag
            </Button>
          </Group>
          <AccordionListDetail
            items={itemFinance.personnelCostHistory || []}
            SummaryComponent={({ item: historyItem }) => (
              <PersonnelCostSummary item={historyItem} />
            )}
            DetailComponent={({ item: historyItem }) => (
              <PersonnelCostDetail item={historyItem} scenarioId={scenarioId} selectedItemId={selectedItemId} dispatch={dispatch} />
            )}
            emptyText="Noch kein Personalkosten-Eintrag hinterlegt."
            onDelete={(_, historyItem) => dispatch(deletePersonnelCostEntry({
              scenarioId,
              itemId: selectedItemId,
              entryId: historyItem.id,
            }))}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}

export default SimDataFinanceTab;