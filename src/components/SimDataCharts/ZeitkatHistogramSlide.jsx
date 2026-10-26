import React from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, Group, MultiSelect, Stack, Text, useMantineTheme } from '@mantine/core';
import { trimTrailingEmptyCategories } from '../../utils/chartUtils/chartUtilsHistogram';

export function GroupHeader({ title, hint }) {
  return (
    <Stack gap={2}>
      <Text fw={700} size="sm">{title}</Text>
      {hint ? <Text size="xs" c="dimmed">{hint}</Text> : null}
    </Stack>
  );
}

/**
 * Analysis-Slide „Buchungskategorien": Verteilung der Kinder über die
 * Buchungszeitkategorien (ZEITKAT-Stundenzonen, nur Basisbuchungen art 0/K),
 * als gestapelte Balken je Gruppe, Gruppen per MultiSelect filterbar
 * (leere Auswahl = alle Gruppen). Leere Zonen am Ende werden ausgeblendet.
 * Tooltip zeigt die Förderrelevanz (Buchungszeitfaktor).
 */
function ZeitkatHistogramSlide({ distribution = {}, groups = [], accent }) {
  const theme = useMantineTheme();
  const [selectedGroupIds, setSelectedGroupIds] = React.useState([]);

  const byGroup = distribution?.byGroup || {};
  const allZones = distribution?.all?.zones || [];

  const availableGroups = React.useMemo(() => (
    (groups || []).filter((group) => byGroup[String(group.id)])
  ), [groups, byGroup]);

  const displayedGroups = React.useMemo(() => {
    if (!selectedGroupIds.length) return availableGroups;
    return availableGroups.filter((group) => selectedGroupIds.includes(String(group.id)));
  }, [availableGroups, selectedGroupIds]);

  const { categories: trimmedLabels, series, count: trimmedCount } = React.useMemo(() => (
    trimTrailingEmptyCategories(
      allZones.map((zone) => zone.label),
      displayedGroups.map((group) => ({
        name: group.name || `Gruppe ${group.id}`,
        data: (byGroup[String(group.id)]?.series || []).map((value) => Number(value) || 0),
      }))
    )
  ), [allZones, displayedGroups, byGroup]);

  const trimmedZoneMeta = allZones.slice(0, trimmedCount);

  const chartOptions = React.useMemo(() => ({
    chart: { type: 'column' },
    title: { text: null },
    xAxis: {
      categories: trimmedLabels,
      title: { text: 'Buchungszeitkategorie (h/Tag)' },
      labels: { rotation: -45, style: { fontSize: '10px' } },
    },
    yAxis: {
      min: 0,
      allowDecimals: false,
      title: { text: 'Anzahl Kinder' },
    },
    plotOptions: {
      column: { stacking: 'normal', pointPadding: 0.05, groupPadding: 0.1, borderWidth: 1 },
    },
    legend: { align: 'center', verticalAlign: 'bottom' },
    series,
    tooltip: {
      useHTML: true,
      formatter: function () {
        const zone = trimmedZoneMeta[this.point?.index] || trimmedZoneMeta[0] || {};
        const factorText = zone.factor != null ? ` · Zeitfaktor ${String(zone.factor).replace('.', ',')}` : '';
        return `<b>Zone ${zone.id || '–'} (${zone.label})</b><br/>${zone.bez || ''}${factorText}<br/><b>${this.point?.y ?? this.y}</b> Kinder (${this.series?.name || ''})`;
      },
    },
  }), [trimmedLabels, series, trimmedZoneMeta, theme]);

  const total = (distribution?.all?.total ?? 0);
  const hasData = series.length > 0 && total > 0;

  return (
    <Stack gap="sm" h="100%" style={{ color: accent }}>
      <GroupHeader
        title="Buchungskategorien"
        hint="Kinder je Zeitkategorie (nur Basisbuchungen art 0/K), gestapelt nach Gruppe – förderrelevant nach § 19 AVBayKiBiG. Leere Auswahl = alle Gruppen."
      />
      <MultiSelect
        size="xs"
        w={300}
        data={availableGroups.map((group) => ({ value: String(group.id), label: group.name || `Gruppe ${group.id}` }))}
        value={selectedGroupIds}
        onChange={setSelectedGroupIds}
        placeholder="Alle Gruppen"
        clearable
        searchable
        aria-label="Gruppenfilter Buchungskategorien"
      />
      <Box style={{ flex: '1 1 auto', minHeight: 260 }}>
        {hasData ? (
          <HighchartsReact highcharts={Highcharts} options={chartOptions} containerProps={{ style: { height: '100%' } }} />
        ) : (
          <Text size="sm" c="dimmed">Keine Buchungskategorien für diese Auswahl.</Text>
        )}
      </Box>
    </Stack>
  );
}

export default ZeitkatHistogramSlide;
