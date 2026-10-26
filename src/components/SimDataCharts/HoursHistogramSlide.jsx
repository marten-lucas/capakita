import React from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, Group, MultiSelect, SegmentedControl, Stack, Text } from '@mantine/core';
import {
  generateHistogramTooltip,
  trimTrailingEmptyCategories,
} from '../../utils/chartUtils/chartUtilsHistogram';
import { GroupHeader } from './ZeitkatHistogramSlide';

/**
 * Analysis-Slide „Buchungsstunden": Verteilung der Wochen-Buchungsstunden,
 * als gestapelte Balken je Gruppe, Gruppen per MultiSelect filterbar
 * (leere Auswahl = alle Gruppen). Stunden-Ermittlung ist BETRSTD-bewusst
 * (belegung.BETRSTD vor Segment-Summe).
 */
function HoursHistogramSlide({ histogram = {}, groups = [], accent }) {
  const [selectedGroupIds, setSelectedGroupIds] = React.useState([]);
  const [viewMode, setViewMode] = React.useState('kinder');

  const byGroup = histogram?.byGroup || {};
  const sharedCategories = histogram?.all?.categories || [];

  const availableGroups = React.useMemo(() => (
    (groups || []).filter((group) => byGroup[String(group.id)])
  ), [groups, byGroup]);

  const displayedGroups = React.useMemo(() => {
    if (!selectedGroupIds.length) return availableGroups;
    return availableGroups.filter((group) => selectedGroupIds.includes(String(group.id)));
  }, [availableGroups, selectedGroupIds]);

  const seriesKey = viewMode === 'mitarbeiter' ? 'capacity_pedagogical' : 'demand';
  const yAxisTitle = viewMode === 'mitarbeiter' ? 'Anzahl Mitarbeiter (päd.)' : 'Anzahl Kinder';

  const { categories: trimmedCategories, series } = React.useMemo(() => (
    trimTrailingEmptyCategories(
      sharedCategories,
      displayedGroups.map((group) => ({
        name: group.name || `Gruppe ${group.id}`,
        data: (byGroup[String(group.id)]?.[seriesKey] || []).map((value) => Number(value) || 0),
      }))
    )
  ), [sharedCategories, displayedGroups, byGroup, seriesKey]);

  const chartOptions = React.useMemo(() => ({
    chart: { type: 'column' },
    title: { text: null },
    xAxis: {
      categories: trimmedCategories,
      title: { text: 'Stunden pro Woche' },
      labels: { rotation: -45, style: { fontSize: '10px' } },
    },
    yAxis: {
      min: 0,
      allowDecimals: false,
      title: { text: yAxisTitle },
    },
    plotOptions: {
      column: { stacking: 'normal', pointPadding: 0.05, groupPadding: 0.1, borderWidth: 1 },
    },
    legend: { align: 'center', verticalAlign: 'bottom' },
    series,
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        return generateHistogramTooltip(this.points || [], this.x);
      },
    },
  }), [trimmedCategories, series, yAxisTitle]);

  const hasData = series.length > 0 && trimmedCategories.length > 0;

  return (
    <Stack gap="sm" h="100%" style={{ color: accent }}>
      <GroupHeader
        title="Buchungsstunden"
        hint="Wochenstunden je Kind, gestapelt nach Gruppe (BETRSTD-bewusst). Leere Auswahl = alle Gruppen."
      />
      <Group gap="sm" wrap="wrap" align="flex-end">
        <MultiSelect
          size="xs"
          w={300}
          data={availableGroups.map((group) => ({ value: String(group.id), label: group.name || `Gruppe ${group.id}` }))}
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
          placeholder="Alle Gruppen"
          clearable
          searchable
          aria-label="Gruppenfilter Buchungsstunden"
        />
        <SegmentedControl
          size="xs"
          data={[
            { value: 'kinder', label: 'Kinder' },
            { value: 'mitarbeiter', label: 'Mitarbeiter (päd.)' },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      </Group>
      <Box style={{ flex: '1 1 auto', minHeight: 260 }}>
        {hasData ? (
          <HighchartsReact highcharts={Highcharts} options={chartOptions} containerProps={{ style: { height: '100%' } }} />
        ) : (
          <Text size="sm" c="dimmed">Keine Buchungsdaten für diese Auswahl.</Text>
        )}
      </Box>
    </Stack>
  );
}

export default HoursHistogramSlide;
