import React, { useMemo, useEffect, useCallback } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import useSimulationDataStore from '../../store/simulationDataStore';
import useChartStore from '../../store/chartStore';
import useAppSettingsStore from '../../store/appSettingsStore';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

export default function MidtermChart() {
  // Store data
  const simulationData = useSimulationDataStore(state => state.simulationData);
  // const groupsLookup = useSimulationDataStore(state => state.groupsLookup);
  const groupsLookup = useAppSettingsStore(state => state.getGroupsLookup());
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

  // Use only AppSettingsStore groups
  const groupNames = useMemo(() => {
    const groupKeys = Object.keys(groupsLookup);
    return groupKeys.map(key => groupsLookup[key]);
  }, [groupsLookup]);

  const hasNoGroup = useMemo(() => (
    simulationData.some(item =>
      (item.type === 'demand' || item.type === 'capacity') &&
      (!item.parseddata?.group || item.parseddata.group.length === 0)
    )
  ), [simulationData]);

  const allGroupNames = useMemo(() => {
    const groups = hasNoGroup ? [...groupNames, 'keine Gruppe'] : groupNames;
    updateAvailableGroups(groups);
    return groups;
  }, [groupNames, hasNoGroup, updateAvailableGroups]);

  // Use qualification keys from app settings for filter
  const qualificationNames = useMemo(() => {
    if (qualifications && qualifications.length > 0) {
      return qualifications.map(q => q.key);
    }
    // fallback: extract from simulationData if not set
    const qualificationSet = new Set();
    simulationData.forEach(item => {
      if (item.type === 'capacity') {
        const qualification = item.parseddata?.qualification || 'keine Qualifikation';
        qualificationSet.add(qualification);
      }
    });
    return Array.from(qualificationSet).sort();
  }, [qualifications, simulationData]);

  // Update available qualifications
  const allQualificationNames = useMemo(() => {
    updateAvailableQualifications(qualificationNames);
    return qualificationNames;
  }, [qualificationNames, updateAvailableQualifications]);

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
  const chartData = useMemo(() => 
    getChartData(midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications), 
    [getChartData, midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications]
  );

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

  return (
    <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Filter Form */}
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

      {/* Chart */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <HighchartsReact highcharts={Highcharts} options={midtermOptions} />
      </Box>
    </Box>
  );
}
