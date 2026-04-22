import { useMemo, useEffect, useCallback, useRef } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, Stack, useMantineTheme } from '@mantine/core';
import { useSelector } from 'react-redux';
import { formatWeeklyAxisLabel, generateWeeklyChartTooltip } from '../../utils/chartUtils/chartUtilsWeekly';
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

  const plotBandColor1 = theme.colors.gray[0];
  const plotBandColor2 = theme.colors.gray[1];
  const plotBandColorLabel = theme.black;
  const demandColor = theme.colors.blue[6];
  const capacityColor = theme.colors.green[6];
  const careRatioColor = theme.colors.red[6];
  const expertRatioColor = theme.colors.orange[6];

  const chartData = useSelector(selectWeeklyChartData);
  const categories = chartData.categories || [];

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
      return;
    }

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
  }, [categories.length, clearAllHover, clearChartHover]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return undefined;

    const handlePointer = (event) => {
      const primaryChart = chartRefs.current.find(Boolean);
      if (!primaryChart || categories.length === 0) return;

      const normalizedEvent = primaryChart.pointer.normalize(event);
      const chartX = normalizedEvent.chartX;
      const insidePlot = chartX >= primaryChart.plotLeft && chartX <= (primaryChart.plotLeft + primaryChart.plotWidth);

      if (!insidePlot) {
        clearAllHover();
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
  }, [categories.length, clearAllHover, syncHoverForIndex]);

  // Optimized: Only recalculate when chartData changes
  const buildXAxis = useCallback((showTitle) => ({
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
    plotBands,
  }), [categories, majorTickPositions, plotBands, plotBandColorLabel, syncXExtremes, theme.colors.gray]);

  const weeklyOptions = useMemo(() => {
    // Ensure all data arrays are mutable copies
    const safeDemand = chartData.demand ? chartData.demand.map(val => Number(val) || 0) : [];
    const safeCapacity = chartData.capacity ? chartData.capacity.map(val => Number(val) || 0) : [];

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
          max: chartData.maxdemand || null,
          tickInterval: 5,
          opposite: false,
          gridLineWidth: 1
        }),
        createColoredYAxis({
          title: 'Kapazität (Mitarbeiter)',
          color: capacityColor,
          min: 0,
          max: chartData.maxcapacity || null,
          tickInterval: 1,
          opposite: true,
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
          name: 'Kapazität',
          type: 'column',
          data: safeCapacity,
          yAxis: 1,
          color: capacityColor,
        },
      ],
      tooltip: {
        shared: true,
        useHTML: true,
        fixed: true,
        position: {
          align: 'right',
          relativeTo: 'spacingBox',
          y: -2,
        },
        padding: 0,
        backgroundColor: 'none',
        headerFormat: '',
        shadow: false,
        style: {
          fontSize: '14px',
        },
        formatter: function () {
          const category = this.points?.[0]?.category ?? this.x;
          return generateWeeklyChartTooltip(this.points, category, categories);
        }
      },
    };
  }, [chartData, categories, buildXAxis, demandColor, capacityColor]);

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
      xAxis: buildXAxis(true),
      yAxis: [
        createColoredYAxis({
          title: 'Betreuungsschlüssel',
          color: careRatioColor,
          min: 0,
          max: chartData.max_care_ratio || null,
          tickInterval: null,
          opposite: false,
          gridLineWidth: 1
        }),
        createColoredYAxis({
          title: 'Fachkraftquote (%)',
          color: expertRatioColor,
          min: 0,
          max: chartData.maxexpert_ratio || null,
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
        shared: true,
        useHTML: true,
        fixed: true,
        position: {
          align: 'right',
          relativeTo: 'spacingBox',
          y: -2,
        },
        padding: 0,
        backgroundColor: 'none',
        headerFormat: '',
        shadow: false,
        style: {
          fontSize: '14px',
        },
        formatter: function () {
          const category = this.points?.[0]?.category ?? this.x;
          return generateWeeklyChartTooltip(this.points, category, categories);
        }
      }
    };
  }, [buildXAxis, chartData, categories, careRatioColor, expertRatioColor]);

  return (
    <Box ref={chartContainerRef}>
      <Stack gap="md">
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