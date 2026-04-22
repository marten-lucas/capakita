import { useMemo, useEffect, useCallback, useRef, useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { ActionIcon, Badge, Box, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core';
import { IconPin } from '@tabler/icons-react';
import { useSelector } from 'react-redux';
import { formatWeeklyAxisLabel } from '../../utils/chartUtils/chartUtilsWeekly';
import { createColoredYAxis } from '../../utils/highchartsAxis';
import { selectWeeklyChartData } from '../../store/chartSelectors';

const WEEK_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

export default function WeeklyChart() {
  const theme = useMantineTheme();
  const chartRefs = useRef([]);
  const chartContainerRef = useRef(null);
  const syncInProgress = useRef(false);
  const hoveredIndexRef = useRef(null);
  const hoveredPointsRef = useRef([[], []]);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [pinnedIndex, setPinnedIndex] = useState(null);

  const plotBandColor1 = theme.colors.gray[0];
  const plotBandColor2 = theme.colors.gray[1];
  const plotBandColorLabel = theme.black;
  const demandColor = theme.colors.blue[6];
  const capacityPedagogicalColor = theme.colors.green[6];
  const capacityAdministrativeColor = theme.colors.violet[6];
  const careRatioColor = theme.colors.red[6];
  const expertRatioColor = theme.colors.orange[6];

  const chartData = useSelector(selectWeeklyChartData);
  const categories = useMemo(() => chartData.categories || [], [chartData.categories]);
  const displayIndex = pinnedIndex ?? hoveredIndex ?? 0;

  const currentLabel = categories[displayIndex] || '-';
  const currentDemand = Number(chartData.demand?.[displayIndex] || 0);
  const currentCapacityPedagogical = Number(chartData.capacity_pedagogical?.[displayIndex] || 0);
  const currentCapacityAdministrative = Number(chartData.capacity_administrative?.[displayIndex] || 0);
  const currentCareRatio = Number(chartData.care_ratio?.[displayIndex] || 0);
  const currentExpertRatio = Number(chartData.expert_ratio?.[displayIndex] || 0);

  const getHeadroomMax = useCallback((maxValue, { factor = 0.08, minAbs = 1, integer = false } = {}) => {
    const numericMax = Number(maxValue);
    if (!Number.isFinite(numericMax) || numericMax <= 0) return null;

    const padded = Math.max(numericMax * (1 + factor), numericMax + minAbs);
    if (integer) return Math.ceil(padded);

    return Math.round(padded * 10) / 10;
  }, []);

  const majorTickPositions = useMemo(() => {
    const slotsPerDay = Math.max(Math.floor(categories.length / 5), 0);

    if (slotsPerDay === 0) return [];

    const positions = [];

    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      for (let slotIndex = 0; slotIndex < slotsPerDay; slotIndex += 2) {
        positions.push((dayIndex * slotsPerDay) + slotIndex);
      }
    }

    return positions;
  }, [categories]);

  const slotsPerDay = useMemo(() => Math.max(Math.floor(categories.length / 5), 0), [categories]);

  const plotBands = useMemo(() => {
    if (slotsPerDay === 0) return [];

    return WEEK_DAYS.map((dayLabel, dayIndex) => {
      const from = dayIndex * slotsPerDay;
      const to = from + slotsPerDay - 0.01;

      return {
        from,
        to,
        color: dayIndex % 2 === 0 ? plotBandColor1 : plotBandColor2,
        label: { text: dayLabel, style: { color: plotBandColorLabel } },
      };
    });
  }, [slotsPerDay, plotBandColor1, plotBandColor2, plotBandColorLabel]);

  const plotBandsWithoutLabels = useMemo(() => (
    plotBands.map((band) => ({ ...band, label: undefined }))
  ), [plotBands]);

  const daySeparatorLines = useMemo(() => {
    if (slotsPerDay === 0) return [];

    const separators = [];
    for (let dayIndex = 1; dayIndex < WEEK_DAYS.length; dayIndex += 1) {
      separators.push({
        color: 'rgba(255,255,255,0.95)',
        width: 8,
        zIndex: 4,
        value: (dayIndex * slotsPerDay) - 0.5,
      });
    }

    return separators;
  }, [slotsPerDay]);

  const syncXExtremes = useCallback(function (event) {
    if (event?.trigger === 'syncExtremes' || syncInProgress.current) return;

    const sourceChart = this.chart;
    syncInProgress.current = true;

    chartRefs.current.forEach((chart) => {
      if (!chart || chart === sourceChart) return;
      chart.xAxis[0].setExtremes(event.min, event.max, false, false, { trigger: 'syncExtremes' });
    });

    chartRefs.current.forEach((chart) => {
      chart?.redraw();
    });

    syncInProgress.current = false;
  }, []);

  const registerChartRef = useCallback((chart, index) => {
    chartRefs.current[index] = chart;
  }, []);

  const clearChartHover = useCallback((chart, chartIndex) => {
    const previousPoints = hoveredPointsRef.current[chartIndex] || [];
    previousPoints.forEach((point) => point?.setState?.());
    hoveredPointsRef.current[chartIndex] = [];

    chart?.tooltip?.hide?.(0);
    chart?.xAxis?.[0]?.hideCrosshair?.();
  }, []);

  const clearAllHover = useCallback(() => {
    hoveredIndexRef.current = null;
    chartRefs.current.forEach((chart, chartIndex) => clearChartHover(chart, chartIndex));
  }, [clearChartHover]);

  const syncHoverForIndex = useCallback((pointIndex, browserEvent) => {
    if (!Number.isFinite(pointIndex) || pointIndex < 0 || pointIndex >= categories.length) {
      clearAllHover();
      if (pinnedIndex === null) setHoveredIndex(null);
      return;
    }

    if (pinnedIndex !== null) {
      return;
    }

    setHoveredIndex(pointIndex);

    if (hoveredIndexRef.current === pointIndex) {
      return;
    }

    hoveredIndexRef.current = pointIndex;

    chartRefs.current.forEach((chart, chartIndex) => {
      if (!chart) return;

      clearChartHover(chart, chartIndex);

      const sharedPoints = chart.series
        .map((series) => series.points?.find((point) => point?.x === pointIndex))
        .filter((point) => point && point.y !== null);

      if (sharedPoints.length === 0) {
        return;
      }

      sharedPoints.forEach((point) => point.setState('hover'));
      hoveredPointsRef.current[chartIndex] = sharedPoints;

      const normalizedEvent = chart.pointer.normalize(browserEvent);
      chart.tooltip.refresh(sharedPoints);
      chart.xAxis[0].drawCrosshair(normalizedEvent, sharedPoints[0]);
    });
  }, [categories.length, clearAllHover, clearChartHover, pinnedIndex]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return undefined;

    const handlePointer = (event) => {
      if (pinnedIndex !== null) return;

      const primaryChart = chartRefs.current.find(Boolean);
      if (!primaryChart || categories.length === 0) return;

      const normalizedEvent = primaryChart.pointer.normalize(event);
      const chartX = normalizedEvent.chartX;
      const insidePlot = chartX >= primaryChart.plotLeft && chartX <= (primaryChart.plotLeft + primaryChart.plotWidth);

      if (!insidePlot) {
        clearAllHover();
        setHoveredIndex(null);
        return;
      }

      const ratio = (chartX - primaryChart.plotLeft) / primaryChart.plotWidth;
      const pointIndex = Math.max(0, Math.min(categories.length - 1, Math.round(ratio * (categories.length - 1))));
      syncHoverForIndex(pointIndex, event);
    };

    const handleLeave = () => {
      clearAllHover();
    };

    ['mousemove', 'touchmove', 'touchstart'].forEach((eventType) => {
      container.addEventListener(eventType, handlePointer);
    });
    container.addEventListener('mouseleave', handleLeave);

    return () => {
      ['mousemove', 'touchmove', 'touchstart'].forEach((eventType) => {
        container.removeEventListener(eventType, handlePointer);
      });
      container.removeEventListener('mouseleave', handleLeave);
      clearAllHover();
    };
  }, [categories.length, clearAllHover, syncHoverForIndex, pinnedIndex]);

  useEffect(() => {
    if (pinnedIndex === null || categories.length === 0) return;

    const safeIndex = Math.max(0, Math.min(categories.length - 1, pinnedIndex));

    chartRefs.current.forEach((chart, chartIndex) => {
      if (!chart) return;

      clearChartHover(chart, chartIndex);
      const sharedPoints = chart.series
        .map((series) => series.points?.find((point) => point?.x === safeIndex))
        .filter((point) => point && point.y !== null);

      if (sharedPoints.length === 0) return;

      sharedPoints.forEach((point) => point.setState('hover'));
      hoveredPointsRef.current[chartIndex] = sharedPoints;
    });
  }, [categories.length, clearChartHover, pinnedIndex]);

  // Optimized: Only recalculate when chartData changes
  const buildXAxis = useCallback((showTitle, showDayLabels = true) => ({
    type: 'linear',
    min: 0,
    max: Math.max(categories.length - 1, 0),
    tickPositions: majorTickPositions,
    minorTickInterval: 1,
    minorTicks: true,
    tickLength: 8,
    tickWidth: 1,
    tickColor: plotBandColorLabel,
    minorTickLength: 5,
    minorTickWidth: 1,
    minorTickColor: theme.colors.gray[5],
    startOnTick: false,
    endOnTick: false,
    title: { text: showTitle ? 'Zeiten' : null },
    labels: {
      autoRotation: false,
      allowOverlap: true,
      crop: false,
      overflow: 'allow',
      style: { fontSize: '10px', whiteSpace: 'nowrap' },
      formatter() {
        return formatWeeklyAxisLabel(this.value, categories);
      }
    },
    events: {
      afterSetExtremes: syncXExtremes,
    },
    plotLines: daySeparatorLines,
    plotBands: showDayLabels ? plotBands : plotBandsWithoutLabels,
  }), [categories, daySeparatorLines, majorTickPositions, plotBands, plotBandsWithoutLabels, plotBandColorLabel, syncXExtremes, theme.colors.gray]);

  const weeklyOptions = useMemo(() => {
    // Ensure all data arrays are mutable copies
    const safeDemand = chartData.demand ? chartData.demand.map(val => Number(val) || 0) : [];
    const safeCapacityPedagogical = chartData.capacity_pedagogical ? chartData.capacity_pedagogical.map(val => Number(val) || 0) : [];
    const safeCapacityAdministrative = chartData.capacity_administrative ? chartData.capacity_administrative.map(val => Number(val) || 0) : [];

    return {
      chart: {
        type: 'line',
        zoomType: 'x',
        spacingTop: 20,
        spacingBottom: 20,
        spacingRight: 96,
      },
      title: { text: null },
      legend: { enabled: false },
      xAxis: buildXAxis(false),
      yAxis: [
        createColoredYAxis({
          title: 'Bedarf (Kinder)',
          color: demandColor,
          min: 0,
          max: getHeadroomMax(chartData.maxdemand, { factor: 0.1, minAbs: 1, integer: true }),
          tickInterval: 5,
          opposite: false,
          gridLineWidth: 1
        }),
        createColoredYAxis({
          title: 'Kapazität (Mitarbeiter)',
          color: capacityPedagogicalColor,
          min: 0,
          max: getHeadroomMax(chartData.maxcapacity, { factor: 0.1, minAbs: 1, integer: true }),
          tickInterval: 1,
          opposite: true,
          reversedStacks: false,
          gridLineWidth: 1
        })
      ],
      series: [
        {
          name: 'Bedarf',
          type: 'area',
          data: safeDemand,
          yAxis: 0,
          color: demandColor,
          fillOpacity: 0.3,
          marker: { enabled: false }
        },
        {
          name: 'Mitarbeiter (pädagogisch)',
          type: 'column',
          data: safeCapacityPedagogical,
          yAxis: 1,
          color: capacityPedagogicalColor,
          stacking: 'normal',
        },
        {
          name: 'Mitarbeiter (administrativ)',
          type: 'column',
          data: safeCapacityAdministrative,
          yAxis: 1,
          color: capacityAdministrativeColor,
          stacking: 'normal',
        },
      ],
      tooltip: {
        enabled: false,
      },
    };
  }, [chartData, buildXAxis, demandColor, capacityPedagogicalColor, capacityAdministrativeColor, getHeadroomMax]);

  const weeklyRatioOptions = useMemo(() => {
    const safeCareRatio = chartData.care_ratio ? chartData.care_ratio.map(val => Number(val) || 0) : [];
    const safeExpertRatio = chartData.expert_ratio ? chartData.expert_ratio.map(val => Number(val) || 0) : [];

    return {
      chart: {
        type: 'line',
        zoomType: 'x',
        spacingTop: 20,
        spacingBottom: 20,
        spacingRight: 96,
      },
      title: { text: null },
      legend: { enabled: false },
      xAxis: buildXAxis(true, false),
      yAxis: [
        createColoredYAxis({
          title: 'Betreuungsschlüssel',
          color: careRatioColor,
          min: 0,
          max: getHeadroomMax(chartData.max_care_ratio, { factor: 0.1, minAbs: 0.2 }),
          tickInterval: null,
          opposite: false,
          gridLineWidth: 1
        }),
        createColoredYAxis({
          title: 'Fachkraftquote (%)',
          color: expertRatioColor,
          min: 0,
          max: getHeadroomMax(chartData.maxexpert_ratio, { factor: 0.1, minAbs: 5, integer: true }),
          tickInterval: 10,
          opposite: true,
          gridLineWidth: 0
        })
      ],
      series: [
        {
          name: 'Betreuungsschlüssel',
          type: 'line',
          data: safeCareRatio,
          yAxis: 0,
          color: careRatioColor,
          marker: { enabled: false }
        },
        {
          name: 'Fachkraftquote',
          type: 'line',
          data: safeExpertRatio,
          yAxis: 1,
          color: expertRatioColor,
          marker: { enabled: false }
        }
      ],
      tooltip: {
        enabled: false,
      }
    };
  }, [buildXAxis, chartData, careRatioColor, expertRatioColor, getHeadroomMax]);

  return (
    <Box ref={chartContainerRef}>
      <Stack gap="md">
      <Paper withBorder radius="md" p="xs">
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
          <Group gap={6} wrap="wrap">
            <Badge variant="light" color="gray">{currentLabel}</Badge>
            <Badge variant="light" color="blue">Bedarf: {currentDemand}</Badge>
            <Badge variant="light" color="green">Päd.: {currentCapacityPedagogical}</Badge>
            <Badge variant="light" color="violet">Admin.: {currentCapacityAdministrative}</Badge>
            <Badge variant="light" color="red">Schlüssel: {currentCareRatio.toFixed(1)}</Badge>
            <Badge variant="light" color="orange">Fachkraft: {currentExpertRatio.toFixed(0)}%</Badge>
          </Group>
          <ActionIcon
            variant={pinnedIndex !== null ? 'filled' : 'light'}
            color={pinnedIndex !== null ? 'orange' : 'gray'}
            aria-label={pinnedIndex !== null ? 'Fixierung lösen' : 'Aktuelle Werte fixieren'}
            onClick={() => {
              if (pinnedIndex !== null) {
                setPinnedIndex(null);
                return;
              }

              const nextIndex = hoveredIndex ?? 0;
              setPinnedIndex(nextIndex);
            }}
          >
            <IconPin size={14} />
          </ActionIcon>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          {pinnedIndex !== null ? 'Werte fixiert' : 'Hover über das Diagramm zeigt aktuelle Werte'}
        </Text>
      </Paper>
      <Box h={250}>
        <HighchartsReact
          highcharts={Highcharts}
          options={weeklyOptions}
          callback={(chart) => registerChartRef(chart, 0)}
          containerProps={{ style: { height: '100%' } }}
        />
      </Box>
      <Box h={250}>
        <HighchartsReact
          highcharts={Highcharts}
          options={weeklyRatioOptions}
          callback={(chart) => registerChartRef(chart, 1)}
          containerProps={{ style: { height: '100%' } }}
        />
      </Box>
      </Stack>
    </Box>
  );
}