import React, { useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import useSimulationDataStore from '../../store/simulationDataStore';
// Material UI imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

// Hilfsfunktion für Zeitsegmente
function generateTimeSegments() {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const startHour = 7;
  const endHour = 16.5; // 16:30
  const segments = [];
  for (let d = 0; d < days.length; d++) {
    for (let h = startHour; h <= endHour; h += 0.5) {
      const hour = Math.floor(h);
      const min = h % 1 === 0 ? '00' : '30';
      segments.push(`${days[d]} ${hour}:${min}`);
    }
  }
  return segments;
}

const categories = generateTimeSegments();

export default function WeeklyChart() {
  // Filter State
  const [stichtag, setStichtag] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  // SimulationData aus Store holen
  const simulationData = useSimulationDataStore(state => state.simulationData);

  // Gruppen aus Store holen (immer aktuell)
  const groupsLookup = useSimulationDataStore(state => state.groupsLookup);

  // Wenn groupsLookup ein Objekt wie { "1": "Fuchsgruppe", ... } ist:
  const groupKeys = Object.keys(groupsLookup);
  const groupNames = groupKeys.map(key => groupsLookup[key]);

  // Zusätzliche Gruppe "keine Gruppe" falls vorhanden
  const hasNoGroup = React.useMemo(() => (
    simulationData.some(item =>
      (item.type === 'demand' || item.type === 'capacity') &&
      (!item.parseddata?.group || item.parseddata.group.length === 0)
    )
  ), [simulationData]);

  const allGroupNames = React.useMemo(() => (
    hasNoGroup ? [...groupNames, 'keine Gruppe'] : groupNames
  ), [groupNames, hasNoGroup]);

  // Initialauswahl: alle Gruppen
  const [selectedGroups, setSelectedGroups] = useState([]);

  // Wenn sich die Gruppen im Store ändern, passe die Auswahl an
  React.useEffect(() => {
    // Only update if the groups have actually changed
    const currentGroupsString = JSON.stringify(allGroupNames.sort());
    const selectedGroupsString = JSON.stringify(selectedGroups.sort());
    
    if (currentGroupsString !== selectedGroupsString) {
      setSelectedGroups(allGroupNames);
    }
  }, [allGroupNames.join(',')]); // Use join to create a stable string dependency

  // Hilfsfunktion: prüft ob ein Kind/Mitarbeiter im Segment gebucht ist und zum Stichtag gültig ist
  function isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, groupNamesFilter, isDemand, stichtag) {
    // Stichtag als Date
    const stichtagDate = new Date(stichtag);

    // Filter nach Gruppen (für beide: Bedarf/Kinder und Kapazität/Mitarbeiter)
    const groups = item.parseddata?.group ?? [];
    if (groups.length === 0) {
      // Keine Gruppe - nur anzeigen wenn "keine Gruppe" ausgewählt ist
      if (!groupNamesFilter.includes('keine Gruppe')) return false;
    } else {
      // Hat Gruppen - prüfen ob mindestens eine ausgewählte Gruppe zum Stichtag gültig ist
      const hasValidGroup = groups.some(g => {
        if (!groupNamesFilter.includes(g.name)) return false;
        const start = g.start ? new Date(g.start.split('.').reverse().join('-')) : null;
        const end = g.end ? new Date(g.end.split('.').reverse().join('-')) : null;
        if (start && stichtagDate < start) return false;
        if (end && end !== '' && stichtagDate > end) return false;
        return true;
      });
      if (!hasValidGroup) return false;
    }

    // Buchungen prüfen: Nur Buchungen, die zum Stichtag gültig sind
    const bookings = item.parseddata?.booking ?? [];
    for (const booking of bookings) {
      const bookingStart = booking.startdate ? new Date(booking.startdate.split('.').reverse().join('-')) : null;
      const bookingEnd = booking.enddate ? new Date(booking.enddate.split('.').reverse().join('-')) : null;
      
      if (bookingStart && stichtagDate < bookingStart) continue;
      if (bookingEnd && bookingEnd !== '' && stichtagDate > bookingEnd) continue;
      for (const time of booking.times ?? []) {
        if (time.day !== dayIdx + 1) continue;
        for (const seg of time.segments ?? []) {
          // Zeitvergleich
          if (
            seg.booking_start &&
            seg.booking_end &&
            seg.booking_start <= segmentEnd &&
            seg.booking_end >= segmentStart
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Diagrammdaten berechnen, abhängig von stichtag und selectedGroups
  const [chartData, setChartData] = useState({
    bedarf: [],
    kapazitaet: [],
    betreuungsschluessel: [],
    maxBedarf: 1,
    maxKapazitaet: 1
  });

  React.useEffect(() => {
    const n = categories.length;
    const bedarf = [];
    const kapazitaet = [];
    for (let i = 0; i < n; i++) {
      const cat = categories[i];
      const [dayName, timeStr] = cat.split(' ');
      const dayIdx = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayName);
      const [hour, min] = timeStr.split(':');
      const segmentStart = `${hour.padStart(2, '0')}:${min}`;
      let endHour = parseInt(hour, 10);
      let endMin = parseInt(min, 10) + 30;
      if (endMin >= 60) {
        endHour += 1;
        endMin -= 60;
      }
      const segmentEnd = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

      // Bedarf: Kinder mit Buchung im Segment und Gruppe ausgewählt und zum Stichtag gültig
      const demandCount = simulationData.filter(
        item =>
          item.type === 'demand' &&
          isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, true, stichtag)
      ).length;
      bedarf.push(demandCount);

      // Kapazität: Mitarbeiter mit Buchung im Segment und Gruppe ausgewählt und zum Stichtag gültig
      const capacityCount = simulationData.filter(
        item =>
          item.type === 'capacity' &&
          isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, false, stichtag)
      ).length;
      kapazitaet.push(capacityCount);
    }
    const betreuungsschluessel = Array(n).fill(4);
    const maxBedarf = Math.max(...bedarf, 1);
    const maxKapazitaet = Math.ceil(maxBedarf / 5);

    setChartData({
      bedarf,
      kapazitaet,
      betreuungsschluessel,
      maxBedarf,
      maxKapazitaet
    });
  }, [simulationData, selectedGroups, stichtag]);

  // Hilfsfunktion: Namen für Segment und Serie (Bedarf/Kapazität) holen
  function getNamesForSegment(i, seriesType) {
    const cat = categories[i];
    const [dayName, timeStr] = cat.split(' ');
    const dayIdx = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayName);
    const [hour, min] = timeStr.split(':');
    const segmentStart = `${hour.padStart(2, '0')}:${min}`;
    let endHour = parseInt(hour, 10);
    let endMin = parseInt(min, 10) + 30;
    if (endMin >= 60) {
      endHour += 1;
      endMin -= 60;
    }
    const segmentEnd = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    if (seriesType === 'Bedarf') {
      return simulationData
        .filter(item =>
          item.type === 'demand' &&
          isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, true, stichtag)
        )
        .map(item => item.name);
    }
    if (seriesType === 'Kapazität') {
      return simulationData
        .filter(item =>
          item.type === 'capacity' &&
          isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, false, stichtag)
        )
        .map(item => item.name);
    }
    return [];
  }

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
          let names = getNamesForSegment(point.point.index, point.series.name);
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

  // Handler für Gruppen-Checkboxen

  // Handler für Stichtag
  const handleStichtagChange = (e) => {
    setStichtag(e.target.value);
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
            onChange={handleStichtagChange}
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
                    onChange={() => setSelectedGroups(prev =>
                      prev.includes(groupName)
                        ? prev.filter(g => g !== groupName)
                        : [...prev, groupName]
                    )}
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