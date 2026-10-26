import React from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, Select, Stack, Text, useMantineTheme } from '@mantine/core';
import { GroupHeader } from './HoursHistogramSlide';

/**
 * Analysis-Slide „Buchungskategorien": Verteilung der Kinder über die
 * Buchungszeitkategorien (ZEITKAT-Stundenzonen, nur Basisbuchungen),
 * filterbar nach Gruppe. Tooltip zeigt Förderrelevanz (Buchungszeitfaktor).
 */
function ZeitkatHistogramSlide({ distribution = {}, groups = [], accent }) {
  const theme = useMantineTheme();
  const [scope, setScope] = React.useState('__ALL__');

  const byGroup = distribution?.byGroup || {};
  const activeData = scope === '__ALL__'
    ? distribution?.all
    : byGroup[scope];

  const options = [
    { value: '__ALL__', label: 'Alle Gruppen' },
    ...groups.map((group) => ({ value: String(group.id), label: group.name || `Gruppe ${group.id}` })),
  ];

  const categories = (activeData?.zones || []).map((zone) => zone.label);
  const seriesData = activeData?.series || [];
  const zoneMeta = activeData?.zones || [];

  const chartOptions = React.useMemo(() => ({
    chart: { type: 'column' },
    title: { text: null },
    xAxis: {
      categories,
      title: { text: 'Buchungszeitkategorie (h/Tag)' },
      labels: { rotation: -45, style: { fontSize: '10px' } },
    },
    yAxis: {
      min: 0,
      allowDecimals: false,
      title: { text: 'Anzahl Kinder' },
    },
    plotOptions: {
      column: { pointPadding: 0.1, borderWidth: 1, groupPadding: 0.1 },
    },
    legend: { enabled: false },
    series: [
      {
        name: 'Kinder',
        data: seriesData,
        color: theme.colors.teal[6],
      },
    ],
    tooltip: {
      useHTML: true,
      formatter: function () {
        const zone = zoneMeta[this.point.index] || {};
        const factorText = zone.factor != null ? ` · Zeitfaktor ${String(zone.factor).replace('.', ',')}` : '';
        return `<b>Zone ${zone.id || '–'} (${zone.label})</b><br/>${zone.bez || ''}${factorText}<br/><b>${this.y}</b> Kinder`;
      },
    },
  }), [categories, seriesData, zoneMeta, theme]);

  const hasData = Boolean(activeData) && activeData.total > 0;

  return (
    <Stack gap="sm" h="100%" style={{ color: accent }}>
      <GroupHeader
        title="Buchungskategorien"
        hint="Kinder je Zeitkategorie (nur Basisbuchungen art 0/K) – förderrelevant nach § 19 AVBayKiBiG."
      />
      <Select
        size="xs"
        w={240}
        data={options}
        value={scope}
        onChange={(value) => setScope(value || '__ALL__')}
        aria-label="Gruppenfilter Buchungskategorien"
        allowDeselect={false}
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
