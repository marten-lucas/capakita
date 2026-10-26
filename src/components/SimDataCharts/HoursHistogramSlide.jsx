import React from 'react';
import { Box, Select, Stack, Text } from '@mantine/core';
import BookingHistogram from './BookingHistogram';

/**
 * Analysis-Slide „Buchungsstunden": Verteilung der Wochen-Buchungsstunden je Kind,
 * filterbar nach Gruppe (eigene Auswahl im Slide + globaler Chart-Filter).
 * Stunden-Ermittlung ist BETRSTD-bewusst (belegung.BETRSTD vor Segment-Summe).
 */
function HoursHistogramSlide({ histogram = {}, groups = [], accent }) {
  const [scope, setScope] = React.useState('__ALL__');

  const byGroup = histogram?.byGroup || {};
  const activeData = scope === '__ALL__'
    ? histogram?.all
    : byGroup[scope];

  const options = [
    { value: '__ALL__', label: 'Alle Gruppen' },
    ...groups.map((group) => ({ value: String(group.id), label: group.name || `Gruppe ${group.id}` })),
  ];

  const hasData = activeData && Array.isArray(activeData.categories) && activeData.categories.length > 0;

  return (
    <Stack gap="sm" h="100%" style={{ color: accent }}>
      <GroupHeader
        title="Buchungsstunden"
        hint="Verteilung der Wochenstunden je Kind (BETRSTD-bewusst)."
      />
      <Select
        size="xs"
        w={240}
        data={options}
        value={scope}
        onChange={(value) => setScope(value || '__ALL__')}
        aria-label="Gruppenfilter Buchungsstunden"
        allowDeselect={false}
      />
      <Box style={{ flex: '1 1 auto', minHeight: 260 }}>
        {hasData ? (
          <BookingHistogram compact chartData={activeData} />
        ) : (
          <Text size="sm" c="dimmed">Keine Buchungsdaten für diese Auswahl.</Text>
        )}
      </Box>
    </Stack>
  );
}

export function GroupHeader({ title, hint }) {
  return (
    <Stack gap={2}>
      <Text fw={700} size="sm">{title}</Text>
      {hint ? <Text size="xs" c="dimmed">{hint}</Text> : null}
    </Stack>
  );
}

export default HoursHistogramSlide;
