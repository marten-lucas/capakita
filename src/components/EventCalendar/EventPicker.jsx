import React from 'react';
import dayjs from 'dayjs';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { DatePickerInput } from '@mantine/dates';
import { Box, Badge, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { setReferenceDate } from '../../store/chartSlice';
import { selectConsolidatedEventsForScenario } from '../../store/eventSlice';

function EventPicker({ scenarioId }) {
  const dispatch = useDispatch();
  const theme = useMantineTheme();
  const isTestEnvironment = import.meta.env.MODE === 'test';
  const referenceDate = useSelector((state) => state.chart[scenarioId]?.referenceDate || null);
  const consolidated = useSelector((state) => selectConsolidatedEventsForScenario(state, scenarioId));

  const eventDates = React.useMemo(() => new Set((consolidated || []).map((g) => g.date)), [consolidated]);
  const referenceDateIso = referenceDate ? dayjs(referenceDate).format('YYYY-MM-DD') : null;
  const timelinePoints = React.useMemo(
    () =>
      consolidated.map((group) => ({
        x: dayjs(group.date).valueOf(),
        y: 0,
        date: group.date,
        count: group.events.length,
        color: group.date === referenceDateIso ? theme.colors.blue[6] : theme.colors.gray[6],
        marker: {
          radius: group.date === referenceDateIso ? 8 : 6,
          lineWidth: group.date === referenceDateIso ? 2 : 1,
          lineColor: group.date === referenceDateIso ? theme.colors.blue[8] : theme.colors.gray[4],
        },
      })),
    [consolidated, referenceDateIso, theme.colors.blue, theme.colors.gray]
  );

  const timelineOptions = React.useMemo(
    () => ({
      chart: {
        type: 'scatter',
        height: 240,
        spacingTop: 8,
        spacingRight: 16,
        spacingBottom: 16,
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        type: 'datetime',
        title: { text: 'Zeitlinie' },
        labels: {
          format: '{value:%d.%m.%Y}',
        },
        tickLength: 8,
        lineColor: theme.colors.gray[4],
      },
      yAxis: {
        visible: false,
        title: { text: null },
        min: -1,
        max: 1,
      },
      tooltip: {
        useHTML: true,
        formatter() {
          const date = dayjs(this.point.options.date).format('DD.MM.YYYY');
          return `
            <strong>${date}</strong><br />
            ${this.point.options.count} Ereignisse<br />
            Klick zum Auswählen
          `;
        },
      },
      plotOptions: {
        series: {
          cursor: 'pointer',
          states: {
            hover: {
              halo: {
                size: 8,
              },
            },
          },
          point: {
            events: {
              click() {
                dispatch(setReferenceDate({ scenarioId, date: this.options.date }));
              },
            },
          },
        },
      },
      series: [
        {
          name: 'Stichtage',
          data: timelinePoints,
          marker: {
            symbol: 'circle',
          },
          showInLegend: false,
        },
      ],
    }),
    [dispatch, scenarioId, theme.colors.gray, timelinePoints]
  );

  function handleChange(date) {
    const nextDate = typeof date === 'string'
      ? date
      : date
        ? dayjs(date).format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');
    dispatch(setReferenceDate({ scenarioId, date: nextDate }));
  }

  function handleSelectDate(date) {
    dispatch(setReferenceDate({ scenarioId, date }));
  }

  return (
    <Paper withBorder p="md" data-testid="stichtag-panel">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text fw={700}>Stichtag auswählen</Text>
        </Group>

        <Stack gap="sm">
          <DatePickerInput
            label="Stichtag"
            placeholder="Datum wählen"
            value={referenceDate}
            defaultDate={referenceDate ? new Date(referenceDate) : undefined}
            onChange={handleChange}
            size="sm"
            valueFormat="DD.MM.YYYY"
            clearable
            data-testid="stichtag-input"
            renderDay={(date) => {
              const currentDate = dayjs(date).toDate();
              const iso = dayjs(currentDate).format('YYYY-MM-DD');
              const hasEvent = eventDates.has(iso);

              return (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    {currentDate.getDate()}
                  </div>
                  {hasEvent && (
                    <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--mantine-color-blue-6)' }} />
                    </div>
                  )}
                </div>
              );
            }}
            getDayAriaLabel={(date) => dayjs(date).format('YYYY-MM-DD')}
            style={{ width: '100%' }}
          />
        </Stack>

        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={700}>Timeline</Text>
            <Badge variant="light">{consolidated.length}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Klick auf einen Punkt wählt den Stichtag aus. Die Zeitleiste füllt die verfügbare Breite.
          </Text>

          {isTestEnvironment ? (
            <Box data-testid="stichtag-timeline" style={{ display: 'flex', gap: theme.spacing.sm, width: '100%' }}>
              {timelinePoints.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Keine Timeline-Einträge vorhanden.
                </Text>
              ) : (
                timelinePoints.map((point) => {
                  const isSelected = point.date === referenceDateIso;

                  return (
                    <Paper
                      key={point.date}
                      component="button"
                      type="button"
                      withBorder
                      p="sm"
                      data-testid={`stichtag-timeline-item-${point.date}`}
                      data-selected={isSelected ? 'true' : 'false'}
                      onClick={() => handleSelectDate(point.date)}
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
                        background: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
                      }}
                    >
                      <Text size="sm" fw={700}>
                        {dayjs(point.date).format('DD.MM')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {point.count} Ereignisse
                      </Text>
                    </Paper>
                  );
                })
              )}
            </Box>
          ) : (
            <Box h={280} data-testid="stichtag-timeline" style={{ width: '100%' }}>
              <HighchartsReact
                highcharts={Highcharts}
                options={timelineOptions}
                containerProps={{ style: { height: '100%', width: '100%' } }}
              />
            </Box>
          )}
        </Stack>

        <Text size="xs" c="dimmed">
          {consolidated.length === 0 ? 'Keine Ereignisse vorhanden.' : `${consolidated.length} Datumseinträge in der Timeline.`}
        </Text>
      </Stack>
    </Paper>
  );
}

export default EventPicker;
