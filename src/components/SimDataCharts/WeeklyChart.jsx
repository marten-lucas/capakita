import { useMemo, useEffect, useCallback, useRef, useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { Box, useMantineTheme } from '@mantine/core';
import { useSelector } from 'react-redux';
import { formatWeeklyAxisLabel } from '../../utils/chartUtils/chartUtilsWeekly';
import { createColoredYAxis } from '../../utils/highchartsAxis';
import { selectWeeklyChartData } from '../../store/chartSelectors';

const WEEK_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const weeklySyncChannels = new Map();

function ensureSyncChannel(syncGroupKey) {
  if (!weeklySyncChannels.has(syncGroupKey)) {
    weeklySyncChannels.set(syncGroupKey, new Map());
  }

  return weeklySyncChannels.get(syncGroupKey);
}

export default function WeeklyChart({
  chartData: chartDataOverride = null,
  syncGroupKey = null,
  showRatioChart = true,
  onHoverChange = null,
  chartMode = 'split',
}) {
  const theme = useMantineTheme();
  const instanceIdRef = useRef(`weekly-${Math.random().toString(36).slice(2)}`);
  const chartRefs = useRef([]);
  const chartContainerRef = useRef(null);
  const syncInProgress = useRef(false);
  const externalSyncInProgress = useRef(false);
  const hoveredIndexRef = useRef(null);
  const hoveredPointsRef = useRef([[], []]);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const plotBandColor1 = theme.colors.gray[0];
  const plotBandColor2 = theme.colors.gray[1];
  const plotBandColorLabel = theme.black;
  const demandColor = theme.colors.blue[6];
  const capacityPedagogicalColor = theme.colors.green[6];
  const capacityAdministrativeColor = theme.colors.violet[6];
  const careRatioColor = theme.colors.red[6];
  const expertRatioColor = theme.colors.orange[6];

  const defaultChartData = useSelector(selectWeeklyChartData);
  const chartData = chartDataOverride || defaultChartData;
  const categories = useMemo(() => chartData.categories || [], [chartData.categories]);

  const displayIndex = hoveredIndex ?? 0;

  const currentLabel = categories[displayIndex] || '-';
  const currentDemand = Number(chartData.demand?.[displayIndex] || 0);
  const currentCapacityPedagogical = Number(chartData.capacity_pedagogical?.[displayIndex] || 0);
  const currentCapacityAdministrative = Number(chartData.capacity_administrative?.[displayIndex] || 0);
  const currentCareRatio = Number(chartData.care_ratio?.[displayIndex] || 0);
  const currentExpertRatio = Number(chartData.expert_ratio?.[displayIndex] || 0);

  useEffect(() => {
    onHoverChange?.({
      label: currentLabel,
      demand: currentDemand,
      capacityPedagogical: currentCapacityPedagogical,
      capacityAdministrative: currentCapacityAdministrative,
      careRatio: currentCareRatio,
      expertRatio: currentExpertRatio,
    });
  }, [onHoverChange, currentLabel, currentDemand, currentCapacityPedagogical, currentCapacityAdministrative, currentCareRatio, currentExpertRatio]);

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

    if (syncGroupKey && !externalSyncInProgress.current) {
      const listeners = weeklySyncChannels.get(syncGroupKey);
      listeners?.forEach((handlers, listenerId) => {
        if (listenerId === instanceIdRef.current) return;
        handlers.onExtremes?.({ min: event.min, max: event.max });
      });
    }
  }, [syncGroupKey]);

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

  const syncHoverForIndex = useCallback((pointIndex, browserEvent, options = {}) => {
    const { broadcast = false } = options;

    if (!Number.isFinite(pointIndex) || pointIndex < 0 || pointIndex >= categories.length) {
      clearAllHover();
      setHoveredIndex(null);
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

      chart.tooltip.refresh(sharedPoints);
      if (browserEvent) {
        const normalizedEvent = chart.pointer.normalize(browserEvent);
        chart.xAxis[0].drawCrosshair(normalizedEvent, sharedPoints[0]);
      }
    });

    if (broadcast && syncGroupKey && !externalSyncInProgress.current) {
      const listeners = weeklySyncChannels.get(syncGroupKey);
      listeners?.forEach((handlers, listenerId) => {
        if (listenerId === instanceIdRef.current) return;
        handlers.onHover?.({ pointIndex });
      });
    }
  }, [categories.length, clearAllHover, clearChartHover, syncGroupKey]);

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
        setHoveredIndex(null);
        return;
      }

      const ratio = (chartX - primaryChart.plotLeft) / primaryChart.plotWidth;
      const pointIndex = Math.max(0, Math.min(categories.length - 1, Math.round(ratio * (categories.length - 1))));
      syncHoverForIndex(pointIndex, event, { broadcast: true });
    };

    const handleLeave = () => {
      clearAllHover();

      if (syncGroupKey && !externalSyncInProgress.current) {
        const listeners = weeklySyncChannels.get(syncGroupKey);
        listeners?.forEach((handlers, listenerId) => {
          if (listenerId === instanceIdRef.current) return;
          handlers.onClear?.();
        });
      }
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
  }, [categories.length, clearAllHover, syncGroupKey, syncHoverForIndex]);

  useEffect(() => {
    if (!syncGroupKey) return undefined;

    const listeners = ensureSyncChannel(syncGroupKey);

    const applyExternalExtremes = ({ min, max }) => {
      externalSyncInProgress.current = true;
      syncInProgress.current = true;

      chartRefs.current.forEach((chart) => {
        if (!chart) return;
        chart.xAxis[0].setExtremes(min, max, false, false, { trigger: 'syncExtremes' });
      });
      chartRefs.current.forEach((chart) => chart?.redraw());

      syncInProgress.current = false;
      externalSyncInProgress.current = false;
    };

    const applyExternalHover = ({ pointIndex }) => {
      externalSyncInProgress.current = true;
      syncHoverForIndex(pointIndex, null, { force: true });
      externalSyncInProgress.current = false;
    };

    const applyExternalClear = () => {
      externalSyncInProgress.current = true;
      clearAllHover();
      setHoveredIndex(null);
      externalSyncInProgress.current = false;
    };

    listeners.set(instanceIdRef.current, {
      onExtremes: applyExternalExtremes,
      onHover: applyExternalHover,
      onClear: applyExternalClear,
    });

    return () => {
      const channel = weeklySyncChannels.get(syncGroupKey);
      channel?.delete(instanceIdRef.current);
      if (channel && channel.size === 0) {
        weeklySyncChannels.delete(syncGroupKey);
      }
    };
  }, [clearAllHover, syncGroupKey, syncHoverForIndex]);

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
        zoomType: 'xy',
        spacingTop: 20,
        spacingBottom: 28,
        spacingRight: 96,
        resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
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
        zoomType: 'xy',
        spacingTop: 20,
        spacingBottom: 28,
        spacingRight: 96,
        resetZoomButton: { position: { align: 'right', verticalAlign: 'top', x: -10, y: 10 }, relativeTo: 'plot' },
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

  const showDemandChart = chartMode === 'split' || chartMode === 'demand';
  const showKeyChart = showRatioChart && (chartMode === 'split' || chartMode === 'ratio');

  return (
    <Box ref={chartContainerRef} style={{ overflow: 'visible', height: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {showDemandChart && (
        <Box style={{ flex: chartMode === 'split' && showKeyChart ? '1 1 58%' : '1 1 100%', minHeight: 0, overflow: 'visible' }}>
          <HighchartsReact
            highcharts={Highcharts}
            options={weeklyOptions}
            callback={(chart) => registerChartRef(chart, 0)}
            containerProps={{ style: { height: '100%' } }}
          />
        </Box>
      )}

      {showKeyChart && (
        <Box style={{ flex: chartMode === 'split' && showDemandChart ? '1 1 42%' : '1 1 100%', minHeight: 0, overflow: 'visible' }}>
          <HighchartsReact
            highcharts={Highcharts}
            options={weeklyRatioOptions}
            callback={(chart) => registerChartRef(chart, 1)}
            containerProps={{ style: { height: '100%' } }}
          />
        </Box>
      )}
    </Box>
  );
}