import * as React from 'react';
import dayjs from 'dayjs';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { DayCalendarSkeleton } from '@mui/x-date-pickers/DayCalendarSkeleton';
import { useScenarioEvents } from '../../hooks/useScenarioEvents';

function EventDay(props) {
  const { day, outsideCurrentMonth, eventsByDay, ...other } = props;
  const dateStr = day.format('YYYY-MM-DD');
  const events = eventsByDay[dateStr] || [];
  console.log(`Date: ${dateStr}, Events:`, events); // Debugging log
  const hasEvents = events.length > 0;

  return (
    <Tooltip
      title={
        hasEvents
          ? (
            <div>
              {events.map((ev, idx) => (
                <div key={idx}>
                  <strong>{ev.label || ev.type}</strong>
                  <span style={{ marginLeft: 8, color: '#888', fontSize: 11 }}>
                    [{ev.type}]
                  </span>
                </div>
              ))}
            </div>
          )
          : ''
      }
      arrow
      placement="top"
      disableHoverListener={!hasEvents}
    >
      <Badge
        overlap="circular"
        badgeContent={hasEvents ? events.length : undefined}
        color="primary"
      >
        <PickersDay {...other} outsideCurrentMonth={outsideCurrentMonth} day={day} />
      </Badge>
    </Tooltip>
  );
}

export default function EventCalendar({ scenarioId }) {
  const { events } = useScenarioEvents(scenarioId);

  // Group events by date string
  const eventsByDay = React.useMemo(() => {
    const map = {};
    events.forEach(ev => {
      if (!map[ev.effectiveDate]) map[ev.effectiveDate] = [];
      map[ev.effectiveDate].push(ev);
    });
    console.log('Events grouped by day:', map); // Debugging log
    return map;
  }, [events]);

  // Calendar state
  const [selectedDate, setSelectedDate] = React.useState(dayjs());
  const [loading, setLoading] = React.useState(false);

  // Simulate loading on month change
  const handleMonthChange = React.useCallback((date) => {
    setLoading(true);
    setTimeout(() => setLoading(false), 200); // quick fake loading
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DateCalendar
        value={selectedDate}
        onChange={setSelectedDate}
        loading={loading}
        onMonthChange={handleMonthChange}
        renderLoading={() => <DayCalendarSkeleton />}
        showDaysOutsideCurrentMonth
        slots={{
          day: (props) => (
            <EventDay {...props} eventsByDay={eventsByDay} />
          ),
        }}
      />
    </LocalizationProvider>
  );
}

