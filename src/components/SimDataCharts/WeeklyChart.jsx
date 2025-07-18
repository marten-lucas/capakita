import { useMemo, useCallback } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import useSimScenarioStore from '../../store/simScenarioStore';
import useChartStore from '../../store/chartStore';
import useAppSettingsStore from '../../store/appSettingsStore';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

export default function WeeklyChart() {
  // Scenario selection state in chartStore
  const scenarios = useSimScenarioStore(state => state.scenarios);
  const chartSelectedScenarioId = useChartStore(state => state.weeklySelectedScenarioId);
  const setWeeklySelectedScenarioId = useChartStore(state => state.setWeeklySelectedScenarioId);

  // Get simulationData for selected scenario
  const simulationData = useSimScenarioStore(state => {
    const scenario = state.scenarios.find(s => s.id === chartSelectedScenarioId);
    return scenario?.simulationData ?? [];
  });

  const groupsLookup = useAppSettingsStore(state => state.getGroupsLookup());
  const qualifications = useAppSettingsStore(state => state.qualifications);
  
  // Chart store - explizit extrahieren für useMemo
  const {
    stichtag,
    selectedGroups,
    selectedQualifications,
    categories,
    setStichtag,
    setSelectedGroups,
    setSelectedQualifications,
    calculateChartData,
    getNamesForSegment,
    updateAvailableGroups,
    updateAvailableQualifications
  } = useChartStore();

  // Extract dates of interest from simulation data with change information
  const datesOfInterest = useMemo(() => {
    const dateChanges = new Map();
    const today = new Date().toISOString().split('T')[0];
    
    const addChange = (date, type, name) => {
      if (!dateChanges.has(date)) {
        dateChanges.set(date, { date, changes: [] });
      }
      dateChanges.get(date).changes.push({ type, name });
    };
    
    const addDayToDate = (dateStr) => {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0];
    };
    
    simulationData.forEach(item => {
      const itemType = item.type === 'demand' ? 'Kind' : 'Mitarbeiter';
      
      // Item start/end dates
      if (item.parseddata?.startdate) {
        const startDate = item.parseddata.startdate.split('.').reverse().join('-');
        addChange(startDate, `Neu: ${itemType}`, item.name);
      }
      if (item.parseddata?.enddate) {
        const endDate = item.parseddata.enddate.split('.').reverse().join('-');
        const effectiveEndDate = addDayToDate(endDate);
        addChange(effectiveEndDate, `Verabschiedung: ${itemType}`, item.name);
      }
      
      // Group start/end dates
      if (item.parseddata?.group) {
        item.parseddata.group.forEach(group => {
          if (group.start) {
            const groupStart = group.start.split('.').reverse().join('-');
            addChange(groupStart, `Gruppenwechsel: ${itemType}`, `${item.name} → ${group.name}`);
          }
          if (group.end) {
            const groupEnd = group.end.split('.').reverse().join('-');
            const effectiveGroupEnd = addDayToDate(groupEnd);
            addChange(effectiveGroupEnd, `Gruppenwechsel: ${itemType}`, `${item.name} verlässt ${group.name}`);
          }
        });
      }
      
      // Booking start/end dates
      if (item.parseddata?.booking) {
        item.parseddata.booking.forEach(booking => {
          if (booking.startdate) {
            const bookingStart = booking.startdate.split('.').reverse().join('-');
            addChange(bookingStart, `Buchungsänderung: ${itemType}`, `${item.name} neue Zeiten`);
          }
          if (booking.enddate) {
            const bookingEnd = booking.enddate.split('.').reverse().join('-');
            const effectiveBookingEnd = addDayToDate(bookingEnd);
            addChange(effectiveBookingEnd, `Buchungsänderung: ${itemType}`, `${item.name} Zeiten enden`);
          }
        });
      }
      
      // Pause start/end dates
      if (item.parseddata?.paused?.enabled) {
        if (item.parseddata.paused.start) {
          addChange(item.parseddata.paused.start, `Pause: ${itemType}`, `${item.name} beginnt Pause`);
        }
        if (item.parseddata.paused.end) {
          const effectivePauseEnd = addDayToDate(item.parseddata.paused.end);
          addChange(effectivePauseEnd, `Pause: ${itemType}`, `${item.name} beendet Pause`);
        }
      }
    });
    
    // Filter future dates and sort
    return Array.from(dateChanges.values())
      .filter(item => item.date > today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [simulationData]);

  // Optimized: Only recalculate when groupsLookup changes
  const groupNames = useMemo(() => {
    const groupKeys = Object.keys(groupsLookup);
    return groupKeys.map(key => groupsLookup[key]);
  }, [groupsLookup]);

  // Optimized: Only check when simulationData changes
  const hasNoGroup = useMemo(() => (
    simulationData.some(item =>
      (item.type === 'demand' || item.type === 'capacity') &&
      (!item.parseddata?.group || item.parseddata.group.length === 0)
    )
  ), [simulationData]);

  // Optimized: Only recalculate when dependencies actually change
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

  // Stable reference for chart data calculation
  const getChartData = useCallback((stichtag, selectedGroups, selectedQualifications) => {
    return calculateChartData(simulationData, stichtag, selectedGroups, selectedQualifications);
  }, [simulationData, calculateChartData]);

  // Optimized: Use stable callback with explicit filter dependency
  const chartData = useMemo(() => 
    getChartData(stichtag, selectedGroups, selectedQualifications), 
    [getChartData, stichtag, selectedGroups, selectedQualifications]
  );

  // Optimized: Only recalculate when chartData changes
  const weeklyOptions = useMemo(() => ({
    chart: { type: 'line' },
    title: { text: 'Weekly Simulation' },
    xAxis: {
      categories,
      title: { text: 'Zeit' },
      labels: { 
        step: 1,
        formatter: function() {
          const [, time] = this.value.split(' ');
          // Zeige nur Labels für 7:00, 9:00, 11:00, 13:00, 15:00
          if (time === '7:00' || time === '9:00' || time === '11:00' || time === '13:00' || time === '15:00') {
            return time;
          }
          return '';
        }
      },
      plotBands: [
        // Bereiche für die Wochentage
        {
          from: 0,
          to: 20.99, // 21 Segmente pro Tag (7:00-17:00)
          color: 'rgba(120,144,156,0.1)', // Blaugrau
          label: { text: 'Mo', style: { color: '#666' } }
        },
        {
          from: 21,
          to: 41.99,
          color: 'rgba(158,158,158,0.1)', // Grau
          label: { text: 'Di', style: { color: '#666' } }
        },
        {
          from: 42,
          to: 62.99,
          color: 'rgba(120,144,156,0.1)', // Blaugrau
          label: { text: 'Mi', style: { color: '#666' } }
        },
        {
          from: 63,
          to: 83.99,
          color: 'rgba(158,158,158,0.1)', // Grau
          label: { text: 'Do', style: { color: '#666' } }
        },
        {
          from: 84,
          to: 104.99,
          color: 'rgba(120,144,156,0.1)', // Blaugrau
          label: { text: 'Fr', style: { color: '#666' } }
        }
      ]
    },
    yAxis: [
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
      },
      { // Sekundär 3: BayKiBig Anstellungsschlüssel
        title: { text: 'BayKiBig Anstellungsschlüssel (Nenner)' },
        min: 0,
        max: chartData.maxAnstellungsschluessel,
        tickInterval: null, // automatisch skalieren
        opposite: true,
        gridLineWidth: 0
      },
      { // Sekundär 4: Fachkraftquote in Prozent
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
        color: 'rgba(124,181,236,0.5)',
        fillOpacity: 0.3,
        marker: { enabled: false }
      },
      {
        name: 'Kapazität',
        type: 'column',
        data: chartData.kapazitaet,
        yAxis: 1,
        color: '#90ed7d'
      },
      {
        name: 'BayKiBig Anstellungsschlüssel',
        type: 'line',
        data: chartData.baykibigAnstellungsschluessel?.map(item => {
          if (!item || item.totalBookingHours === 0) return 0;
          // Berechne den Nenner: totalBookingHours / totalStaffHours
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
                s += `<span style="margin-left:16px;font-size:0.9em;">Fachkräfte: ${baykibigData.fachkraftCount}, Gesamt: ${baykibigData.totalStaffCount}</span><br/>`;
                s += `<span style="margin-left:16px;font-size:0.9em;">Erforderlich: 50% oder mehr</span><br/>`;
              }
            }
          } else {
            let names = getNamesForSegment(simulationData, point.point.index, point.series.name);
            if (names.length > 0) {
              s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
              s += `<span style="margin-left:16px;font-size:0.95em;">${names.join(', ')}</span><br/>`;
            } else {
              s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
            }
          }
        });
        return s;
      }
    }
  }), [chartData, categories, simulationData, getNamesForSegment]);

  // Scenario selector for chart
  return (
    <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Scenario Selector */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" sx={{ minWidth: 120 }}>Szenario:</Typography>
        <Select
          size="small"
          value={chartSelectedScenarioId || ''}
          onChange={e => setWeeklySelectedScenarioId(e.target.value)}
          sx={{ minWidth: 280 }}
          displayEmpty
        >
          {scenarios.map(scenario => (
            <MenuItem key={scenario.id} value={scenario.id}>
              {scenario.name || `Szenario ${scenario.id}`}
            </MenuItem>
          ))}
        </Select>
      </Box>
      {/* Material UI Filterformular */}
      <Box sx={{ mb: 2, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>Stichtag:</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              type="date"
              value={stichtag}
              onChange={(e) => setStichtag(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => setStichtag(new Date().toISOString().slice(0, 10))}
            >
              Heute
            </Button>
          </Box>
          {datesOfInterest.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 300 }}>
                <InputLabel>Dates of Interest</InputLabel>
                <Select
                  value={datesOfInterest.find(item => item.date === stichtag)?.date || ""}
                  onChange={(e) => setStichtag(e.target.value)}
                  label="Dates of Interest"
                >
                  {datesOfInterest.map(item => {
                    const changesSummary = item.changes.reduce((acc, change) => {
                      const key = change.type.split(':')[0];
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {});
                    
                    const summaryText = Object.entries(changesSummary)
                      .map(([type, count]) => `${count} ${type}${count > 1 ? (type === 'Neu' ? 'e' : type === 'Verabschiedung' ? 'en' : '') : ''}`)
                      .join(', ');
                    
                    return (
                      <MenuItem key={item.date} value={item.date}>
                        <Box>
                          <Box sx={{ fontWeight: 'bold' }}>
                            {new Date(item.date).toLocaleDateString('de-DE')}
                          </Box>
                          <Box sx={{ fontSize: '0.8em', color: 'text.secondary' }}>
                            {summaryText}
                          </Box>
                        </Box>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>
          )}
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
                      checked={selectedQualifications.includes(qualification)}
                      onChange={() => {
                        const newQualifications = selectedQualifications.includes(qualification)
                          ? selectedQualifications.filter(q => q !== qualification)
                          : [...selectedQualifications, qualification];
                        setSelectedQualifications(newQualifications);
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
        <HighchartsReact highcharts={Highcharts} options={weeklyOptions} />
      </Box>
    </Box>
  );
}