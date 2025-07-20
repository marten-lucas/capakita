import React, { useMemo, useEffect, useCallback } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import useSimScenarioStore from '../../store/simScenarioStore';
import useChartStore from '../../store/chartStore';
import useAppSettingsStore from '../../store/appSettingsStore';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

export default function MidtermChart({ hideFilters = false, scenario }) {

  // Log scenario input and start of chart data processing
  // Move this log to the function body so it always runs first
  console.log('[MidtermChart] Step 1: Received scenario prop:', scenario);

  // Always use the scenario prop's simulation data for charting
  const simulationData = useMemo(() => {
    if (scenario) {
      const state = useSimScenarioStore.getState();
      let data = [];
      if (typeof state.getEffectiveSimulationData === 'function') {
        data = state.getEffectiveSimulationData(scenario.id);
      } else {
        data = scenario.simulationData ?? [];
      }
      console.log('[MidtermChart] Step 2: Loaded simulationData for scenario:', data);
      return data;
    }
    return [];
  }, [scenario]);

  // Use groups and qualifications from appSettingsStore
  const groups = useAppSettingsStore(state => state.groups);
  const qualifications = useAppSettingsStore(state => state.qualifications);

  // Chart store
  const {
    midtermTimeDimension,
    midtermSelectedGroups,
    midtermSelectedQualifications,
    setMidtermTimeDimension,
    setMidtermSelectedGroups,
    setMidtermSelectedQualifications,
    calculateMidtermChartData,
    updateAvailableGroups,
    updateAvailableQualifications
  } = useChartStore();

  // Use group names from appSettingsStore groups
  const groupNames = useMemo(() => {
    return groups.map(g => g.name);
  }, [groups]);

  const hasNoGroup = useMemo(() => (
    simulationData.some(item =>
      (item.type === 'demand' || item.type === 'capacity') &&
      (!item.parseddata?.group || item.parseddata.group.length === 0)
    )
  ), [simulationData]);

  const allGroupNames = useMemo(() => {
    const groupsList = hasNoGroup ? [...groupNames, 'keine Gruppe'] : groupNames;
    updateAvailableGroups(groupsList);
    return groupsList;
  }, [groupNames, hasNoGroup, updateAvailableGroups]);

  // Use qualification keys from appSettingsStore for filter
  const qualificationKeys = useMemo(() => {
    return qualifications.map(q => q.key);
  }, [qualifications]);

  const allQualificationNames = useMemo(() => {
    updateAvailableQualifications(qualificationKeys);
    return qualificationKeys;
  }, [qualificationKeys, updateAvailableQualifications]);

  // Initialize selections if empty
  useEffect(() => {
    if (midtermSelectedGroups.length === 0 && allGroupNames.length > 0) {
      setMidtermSelectedGroups(allGroupNames);
    }
  }, [allGroupNames, midtermSelectedGroups.length, setMidtermSelectedGroups]);

  useEffect(() => {
    if (midtermSelectedQualifications.length === 0 && allQualificationNames.length > 0) {
      setMidtermSelectedQualifications(allQualificationNames);
    }
  }, [allQualificationNames, midtermSelectedQualifications.length, setMidtermSelectedQualifications]);

  // Stable reference for chart data calculation
  const getChartData = useCallback((midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications) => {
    return calculateMidtermChartData(simulationData, midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications);
  }, [simulationData, calculateMidtermChartData]);

  // Calculate chart data with proper dependencies
  const chartData = useMemo(() => {
    console.log('[MidtermChart] Step 3: Preparing chart data with filters:', {
      midtermTimeDimension,
      midtermSelectedGroups,
      midtermSelectedQualifications
    });
    const result = getChartData(midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications);
    console.log('[MidtermChart] Step 4: Resulting chartData:', result);
    return result;
  }, [getChartData, midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications]);

  // Add console log to verify group and qualification filters
  React.useEffect(() => {
    console.log('MidtermChart chartData:', chartData);
    if (
      chartData &&
      Array.isArray(chartData.categories) &&
      chartData.categories.length === 0
    ) {
      console.warn('MidtermChart: chartData is empty. Inputs:', {
        simulationData,
        midtermTimeDimension,
        midtermSelectedGroups,
        midtermSelectedQualifications
      });
      // Log unique values for group and qualification in simulationData for debugging
      const groupNamesSet = new Set();
      const qualificationSet = new Set();
      simulationData.forEach(item => {
        // Groups
        if (item.parseddata?.group && Array.isArray(item.parseddata.group)) {
          item.parseddata.group.forEach(g => {
            if (g.name) groupNamesSet.add(g.name);
          });
        } else if (!item.parseddata?.group || item.parseddata.group.length === 0) {
          groupNamesSet.add('keine Gruppe');
        }
        // Qualifications
        if (item.type === 'capacity') {
          const q = item.parseddata?.qualification;
          if (q) qualificationSet.add(q);
        }
      });
      console.log('MidtermChart: unique group names in simulationData:', Array.from(groupNamesSet));
      console.log('MidtermChart: unique qualifications in simulationData:', Array.from(qualificationSet));
    }
  }, [chartData, simulationData, midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications]);

  // Chart options
  const midtermOptions = useMemo(() => ({
    chart: { type: 'column' },
    title: { text: `Midterm Simulation - ${midtermTimeDimension}` },
    xAxis: { 
      categories: chartData.categories,
      title: { text: 'Zeitraum' }
    },
    yAxis: [
      { // Primary: Bedarf
        title: { text: 'Bedarf (Stunden)' },
        min: 0,
        max: null,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      },
      { // Secondary: Kapazität
        title: { text: 'Kapazität (Stunden)' },
        min: 0,
        max: chartData.maxKapazitaet,
        tickInterval: null,
        opposite: false,
        gridLineWidth: 1
      },
      { // Tertiary: BayKiBig Anstellungsschlüssel
        title: { text: 'BayKiBig Anstellungsschlüssel (Nenner)' },
        min: 0,
        max: chartData.maxAnstellungsschluessel,
        tickInterval: null,
        opposite: true,
        gridLineWidth: 0
      },
      { // Quaternary: Fachkraftquote
        title: { text: 'Fachkraftquote (%)' },
        min: 0,
        max: chartData.maxFachkraftquote,
        tickInterval: 10,
        opposite: true,
        gridLineWidth: 0
      }
    ],
    series: [
      {
        name: 'Bedarf',
        type: 'area',
        data: chartData.bedarf,
        yAxis: 0,
        color: 'rgba(124,181,236,0.8)',
        fillOpacity: 0.6,
        marker: { enabled: false }
      },
      {
        name: 'Kapazität',
        type: 'area',
        data: chartData.kapazitaet,
        yAxis: 1,
        color: '#90ed7d',
        fillOpacity: 0.6,
        marker: { enabled: false }
      },
      {
        name: 'BayKiBig Anstellungsschlüssel',
        type: 'line',
        data: chartData.baykibigAnstellungsschluessel?.map(item => {
          if (!item || item.totalBookingHours === 0) return 0;
          return item.totalStaffHours > 0 ? item.totalBookingHours / item.totalStaffHours : 0;
        }),
        yAxis: 2,
        color: '#f45b5b',
        marker: { enabled: false }
      },
      {
        name: 'BayKiBig Fachkraftquote',
        type: 'line',
        data: chartData.baykibigAnstellungsschluessel?.map(item => {
          return item?.fachkraftQuotePercent || 0;
        }),
        yAxis: 3,
        color: '#ff9800',
        marker: { enabled: false }
      }
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        let s = `<b>${this.x}</b><br/>`;
        this.points.forEach(point => {
          if (point.series.name.includes('BayKiBig')) {
            const baykibigData = chartData.baykibigAnstellungsschluessel[point.point.index];
            if (baykibigData) {
              if (point.series.name.includes('Anstellungsschlüssel')) {
                const schluessel = baykibigData.totalStaffHours > 0 ? baykibigData.totalBookingHours / baykibigData.totalStaffHours : 0;
                s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> 1:${schluessel.toFixed(1)}<br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Buchungsstunden: ${baykibigData.totalBookingHours.toFixed(1)}h, Personalstunden: ${baykibigData.totalStaffHours.toFixed(1)}h</span><br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Erforderlich: 1:11 oder besser</span><br/>`;
              }
              if (point.series.name.includes('Fachkraftquote')) {
                s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${baykibigData.fachkraftQuotePercent.toFixed(1)}%<br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Fachkraftstunden: ${baykibigData.fachkraftHours.toFixed(1)}h, Gesamtstunden: ${baykibigData.totalStaffHours.toFixed(1)}h</span><br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Erforderlich: 50% oder mehr</span><br/>`;
              }
            }
          } else {
            s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y.toFixed(1)}h<br/>`;
          }
        });
        return s;
      }
    }
  }), [chartData, midtermTimeDimension]);

  // Filter Form
  return (
    <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Filter Form */}
      {!hideFilters && (
        <Box sx={{ mb: 2, display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Zeitdimension:</Typography>
            <ToggleButtonGroup
              value={midtermTimeDimension}
              exclusive
              onChange={(e, newDimension) => {
                if (newDimension !== null) {
                  setMidtermTimeDimension(newDimension);
                }
              }}
              size="small"
            >
              <ToggleButton value="Wochen">Wochen</ToggleButton>
              <ToggleButton value="Monate">Monate</ToggleButton>
              <ToggleButton value="Jahre">Jahre</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Gruppen:</Typography>
            <FormGroup row>
              {allGroupNames.map(groupName => (
                <FormControlLabel
                  key={groupName}
                  control={
                    <Checkbox
                      checked={midtermSelectedGroups.includes(groupName)}
                      onChange={() => {
                        const newGroups = midtermSelectedGroups.includes(groupName)
                          ? midtermSelectedGroups.filter(g => g !== groupName)
                          : [...midtermSelectedGroups, groupName];
                        setMidtermSelectedGroups(newGroups);
                      }}
                    />
                  }
                  label={groupName}
                />
              ))}
            </FormGroup>
          </Box>
          
          <Box>
            <Typography variant="body1" sx={{ mb: 1 }}>Qualifikationen:</Typography>
            <FormGroup row>
              {allQualificationNames.map(qualification => {
                const displayName =
                  qualifications.find(q => q.key === qualification)?.name || qualification;
                return (
                  <FormControlLabel
                    key={qualification}
                    control={
                      <Checkbox
                        checked={midtermSelectedQualifications.includes(qualification)}
                        onChange={() => {
                          const newQualifications = midtermSelectedQualifications.includes(qualification)
                            ? midtermSelectedQualifications.filter(q => q !== qualification)
                            : [...midtermSelectedQualifications, qualification];
                          setMidtermSelectedQualifications(newQualifications);
                        }}
                      />
                    }
                    label={displayName}
                  />
                );
              })}
            </FormGroup>
          </Box>
        </Box>
      )}

      {/* Chart */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <HighchartsReact highcharts={Highcharts} options={midtermOptions} />
      </Box>

      {/* Debug Logs */}
      <Box sx={{ display: 'none' }}>
        {console.log('midtermSelectedGroups:', midtermSelectedGroups)}
        {console.log('midtermSelectedQualifications:', midtermSelectedQualifications)}
      </Box>
    </Box>
  );
}

 
