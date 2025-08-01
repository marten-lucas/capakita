import * as React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de'; // Import German locale
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { DayCalendarSkeleton } from '@mui/x-date-pickers/DayCalendarSkeleton';
import { useScenarioEvents } from '../../hooks/useScenarioEvents';
import { formatEventTooltip } from '../../utils/eventUtils.jsx'; // Updated import

function EventDay(props) {
  const { day, outsideCurrentMonth, eventsByDay, ...other } = props;
  const dateStr = day.format('YYYY-MM-DD');
  const events = eventsByDay[dateStr] || [];
  const hasEvents = events.length > 0;

  return (
    <Tooltip
      title={formatEventTooltip(events)} // Use central function for tooltip
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

export default function EventCalendar({ scenarioId, selectedDate, onDateChange }) {
  const { events } = useScenarioEvents(scenarioId);

  // Group events by date string
  const eventsByDay = React.useMemo(() => {
    const map = {};
    events.forEach(ev => {
      if (!map[ev.effectiveDate]) map[ev.effectiveDate] = [];
      map[ev.effectiveDate].push(ev);
    });
    return map;
  }, [events]);

  const [loading, setLoading] = React.useState(false);

  // Simulate loading on month change
  const handleMonthChange = React.useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 200); // quick fake loading
  }, []);

  // Handle date selection
  const handleDateChange = (date) => {
    const formattedDate = date.format('YYYY-MM-DD');
    onDateChange(formattedDate);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} locale="de">
      <DateCalendar
        value={dayjs(selectedDate || new Date())}
        onChange={handleDateChange}
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
