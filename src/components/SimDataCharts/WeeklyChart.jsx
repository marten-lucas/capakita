import React, { useMemo } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import useSimulationDataStore from '../../store/simulationDataStore';
import useChartStore from '../../store/chartStore';
// Material UI imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

export default function WeeklyChart() {
  // Store data
  const simulationData = useSimulationDataStore(state => state.simulationData);
  const groupsLookup = useSimulationDataStore(state => state.groupsLookup);
  
  // Chart store
  const {
    stichtag,
    selectedGroups,
    categories,
    setStichtag,
    setSelectedGroups,
    calculateChartData,
    getNamesForSegment,
    updateAvailableGroups
  } = useChartStore();

  // Gruppe names from lookup
  const groupKeys = Object.keys(groupsLookup);
  const groupNames = groupKeys.map(key => groupsLookup[key]);

  // Check for items without groups
  const hasNoGroup = useMemo(() => (
    simulationData.some(item =>
      (item.type === 'demand' || item.type === 'capacity') &&
      (!item.parseddata?.group || item.parseddata.group.length === 0)
    )
  ), [simulationData]);

  const allGroupNames = useMemo(() => {
    const groups = hasNoGroup ? [...groupNames, 'keine Gruppe'] : groupNames;
    // Update available groups in store (this will auto-sync selection if needed)
    updateAvailableGroups(groups);
    return groups;
  }, [groupNames, hasNoGroup, updateAvailableGroups]);

  // Calculate chart data
  const chartData = useMemo(() => 
    calculateChartData(simulationData), 
    [simulationData, selectedGroups, stichtag, calculateChartData]
  );

  const weeklyOptions = {
    chart: { type: 'line' },
    title: { text: 'Weekly Simulation' },
    xAxis: {
      categories,
      title: { text: 'Zeit' },
      labels: { step: 8 },
      plotBands: [
        // Bereiche für die Wochentage
        {
          from: 0,
          to: 19.99,
          color: 'rgba(200,200,255,0.08)',
          label: { text: 'Mo', style: { color: '#666' } }
        },
        {
          from: 20,
          to: 39.99,
          color: 'rgba(200,255,200,0.08)',
          label: { text: 'Di', style: { color: '#666' } }
        },
        {
          from: 40,
          to: 59.99,
          color: 'rgba(255,200,200,0.08)',
          label: { text: 'Mi', style: { color: '#666' } }
        },
        {
          from: 60,
          to: 79.99,
          color: 'rgba(255,255,200,0.08)',
          label: { text: 'Do', style: { color: '#666' } }
        },
        {
          from: 80,
          to: 99.99,
          color: 'rgba(200,255,255,0.08)',
          label: { text: 'Fr', style: { color: '#666' } }
        }
      ]
    },
    yAxis: [
      { // Primär: Betreuungsschlüssel
        title: { text: 'Betreuungsschlüssel' },
        min: 0,
        max: 10,
        tickInterval: 1,
        opposite: true,
        gridLineWidth: 0 // Guides ausschalten
      },
      { // Sekundär 1: Bedarf
        title: { text: 'Bedarf (Kinder)' },
        min: 0,
        max: null, // automatisch skalieren
        tickInterval: 5,
        opposite: false,
        gridLineWidth: 1 // Guides für Bedarf
      },
      { // Sekundär 2: Kapazität
        title: { text: 'Kapazität (Mitarbeiter)' },
        min: 0,
        max: chartData.maxKapazitaet,
        tickInterval: 1, // Guides wie Bedarf, aber Faktor 1
        opposite: false,
        gridLineWidth: 1 // Guides wie Bedarf
      }
    ],
    series: [
      {
        name: 'Betreuungsschlüssel',
        type: 'line',
        data: chartData.betreuungsschluessel,
        yAxis: 0,
        color: '#2b908f',
        marker: { enabled: false }
      },
      {
        name: 'Bedarf',
        type: 'area',
        data: chartData.bedarf,
        yAxis: 1,
        color: 'rgba(124,181,236,0.5)',
        fillOpacity: 0.3
      },
      {
        name: 'Kapazität',
        type: 'column',
        data: chartData.kapazitaet,
        yAxis: 2,
        color: '#90ed7d'
      }
    ],
    legend: { align: 'center', verticalAlign: 'bottom' },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        let s = `<b>${this.x}</b><br/>`;
        this.points.forEach(point => {
          let names = getNamesForSegment(simulationData, point.point.index, point.series.name);
          if (names.length > 0) {
            s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
            s += `<span style="margin-left:16px;font-size:0.95em;">${names.join(', ')}</span><br/>`;
          } else {
            s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
          }
        });
        return s;
      }
    }
  };

  return (
    <Box>
      {/* Material UI Filterformular */}
      <Box sx={{ mb: 2, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Stichtag:</Typography>
          <TextField
            type="date"
            value={stichtag}
            onChange={(e) => setStichtag(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Box>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Gruppen:</Typography>
          <FormGroup row>
            {allGroupNames.map(groupName => (
              <FormControlLabel
                key={groupName}
                control={
                  <Checkbox
                    checked={selectedGroups.includes(groupName)}
                    onChange={() => {
                      const newGroups = selectedGroups.includes(groupName)
                        ? selectedGroups.filter(g => g !== groupName)
                        : [...selectedGroups, groupName];
                      setSelectedGroups(newGroups);
                    }}
                  />
                }
                label={groupName}
              />
            ))}
          </FormGroup>
        </Box>
      </Box>
      {/* Chart */}
      <HighchartsReact highcharts={Highcharts} options={weeklyOptions} />
    </Box>
  );
}