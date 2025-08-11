import React, { useState } from 'react';
import {
  Typography, Box, Button, Divider, TextField, Switch, Slider,
} from '@mui/material';
import { valueToTime } from '../../../utils/timeUtils';
import { useSelector, useDispatch } from 'react-redux';
import DayControl from './BookingDayControl';
import { useOverlayData } from '../../../hooks/useOverlayData';

// --- Tailgrids-style DateRangePicker (minimal, local, copied from SimDataGeneralTab) ---
function TailgridDateRangePicker({ value, onChange }) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (value?.start) return new Date(value.start);
    return new Date();
  });
  const [selectedStartDate, setSelectedStartDate] = useState(value?.start || null);
  const [selectedEndDate, setSelectedEndDate] = useState(value?.end || null);
  const [isOpen, setIsOpen] = useState(false);
  const datepickerRef = React.useRef(null);

  React.useEffect(() => {
    setSelectedStartDate(value?.start || null);
    setSelectedEndDate(value?.end || null);
  }, [value?.start, value?.end]);

  const handleDayClick = (dayString) => {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(dayString);
      setSelectedEndDate(null);
      onChange({ start: dayString, end: '' });
    } else {
      if (new Date(dayString) < new Date(selectedStartDate)) {
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(dayString);
        onChange({ start: dayString, end: selectedStartDate });
      } else {
        setSelectedEndDate(dayString);
        onChange({ start: selectedStartDate, end: dayString });
      }
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysArray = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      daysArray.push(<div key={`empty-${i}`}></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, month, i);
      const dayString = day.toISOString().slice(0, 10);
      let className =
        "flex h-[32px] w-[32px] items-center justify-center rounded-full hover:bg-gray-200 mb-1 cursor-pointer";
      if (selectedStartDate && dayString === selectedStartDate) {
        className += " bg-primary text-white rounded-r-none";
      }
      if (selectedEndDate && dayString === selectedEndDate) {
        className += " bg-primary text-white rounded-l-none";
      }
      if (
        selectedStartDate &&
        selectedEndDate &&
        new Date(day) > new Date(selectedStartDate) &&
        new Date(day) < new Date(selectedEndDate)
      ) {
        className += " bg-gray-300 rounded-none";
      }
      daysArray.push(
        <div
          key={i}
          className={className}
          data-date={dayString}
          onClick={() => handleDayClick(dayString)}
        >
          {i}
        </div>
      );
    }
    return daysArray;
  };

  const updateInput = () => {
    if (selectedStartDate && selectedEndDate) {
      return `${selectedStartDate} - ${selectedEndDate}`;
    } else if (selectedStartDate) {
      return selectedStartDate;
    } else {
      return "";
    }
  };

  const toggleDatepicker = () => setIsOpen((v) => !v);

  return (
    <Box sx={{ position: 'relative', mb: 1, width: '100%' }}>
      <TextField
        label=""
        value={updateInput()}
        onClick={toggleDatepicker}
        size="small"
        sx={{ width: '100%' }}
        placeholder="Zeitraum wählen"
        InputProps={{ readOnly: true }}
      />
      {isOpen && (
        <Box
          ref={datepickerRef}
          sx={{
            position: 'absolute',
            zIndex: 10,
            bgcolor: 'background.paper',
            border: '1px solid #eee',
            borderRadius: 2,
            boxShadow: 3,
            p: 2,
            mt: 1,
            minWidth: 260,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Button
              size="small"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            >{"<"}</Button>
            <Typography variant="body2">
              {currentDate.toLocaleString("default", { month: "long" })} {currentDate.getFullYear()}
            </Typography>
            <Button
              size="small"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            >{">"}</Button>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day) => (
              <Typography key={day} variant="caption" sx={{ textAlign: 'center' }}>{day}</Typography>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {renderCalendar()}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
            <Button size="small" variant="outlined">
              {selectedStartDate || "Start"}
            </Button>
            <Button size="small" variant="outlined">
              {selectedEndDate || "Ende"}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// BookingDetail component
function BookingDetail({ index, booking }) {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { baseScenario, getEffectiveDataItem, getEffectiveBookings } = useOverlayData();
  const item = getEffectiveDataItem(selectedItemId);

  // Get base booking for overlay comparison
  const baseScenarioId = baseScenario?.id;
  const baseBookingsObj = baseScenarioId ? getEffectiveBookings(selectedItemId) : {};
  const baseBooking = booking?.id ? baseBookingsObj?.[booking.id] : undefined;

  const type = item?.type;
  const parentItemId = selectedItemId;

  // Helper to update the booking in the store or overlay
  const handleUpdateBooking = (updatedBooking) => {
    if (!selectedScenarioId || !selectedItemId || !booking?.id) return;

    // If in a based scenario, use overlays
    if (baseScenarioId) {
      // Compare with base booking
      const isIdenticalToBase = baseBooking && JSON.stringify(updatedBooking) === JSON.stringify(baseBooking);
      if (isIdenticalToBase) {
        // Remove overlay if matches base
        dispatch({
          type: 'simOverlay/removeBookingOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            itemId: selectedItemId,
            bookingId: booking.id
          }
        });
      } else {
        // Set overlay if different from base
        dispatch({
          type: 'simOverlay/setBookingOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            itemId: selectedItemId,
            bookingId: booking.id,
            overlayData: updatedBooking
          }
        });
      }
    } else {
      // Regular scenario - update directly in simBooking
      dispatch({
        type: 'simBooking/updateBooking',
        payload: {
          scenarioId: selectedScenarioId,
          dataItemId: selectedItemId,
          bookingId: booking.id,
          updates: updatedBooking
        }
      });
    }
  };

  const handleDayToggle = (dayAbbr, isEnabled) => {
    // Deep clone booking and times
    const newTimes = Array.isArray(booking.times) ? booking.times.map(t => ({ ...t, segments: t.segments.map(s => ({ ...s })) })) : [];
    const dayIndex = newTimes.findIndex((t) => t.day_name === dayAbbr);

    if (isEnabled && dayIndex === -1) {
      const dayNr = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayAbbr) + 1;
      newTimes.push({
        day: dayNr,
        day_name: dayAbbr,
        segments: [{
          id: `${parentItemId}-${index}-${dayAbbr}-${Date.now()}`,
          booking_start: '08:00',
          booking_end: '16:00'
        }]
      });
    } else if (!isEnabled && dayIndex !== -1) {
      newTimes.splice(dayIndex, 1);
    }
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
  };

  const handleAddSegment = (dayAbbr) => {
    const newTimes = booking.times.map((t) =>
      t.day_name === dayAbbr
        ? {
          ...t,
          segments: [
            ...t.segments.map(s => ({ ...s })),
            {
              id: `${parentItemId}-${index}-${dayAbbr}-${Date.now()}`,
              booking_start: '13:00',
              booking_end: '16:00'
            }
          ]
        }
        : { ...t, segments: t.segments.map(s => ({ ...s })) }
    );
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
  };

  const handleTimeChange = (dayAbbr, segIdx, newValues) => {
    const newTimes = booking.times.map((t) => {
      if (t.day_name === dayAbbr) {
        const newSegments = t.segments.map((seg, i) =>
          i === segIdx
            ? {
              ...seg,
              booking_start: valueToTime(newValues[0]),
              booking_end: valueToTime(newValues[1])
            }
            : { ...seg }
        );
        return { ...t, segments: newSegments };
      }
      return { ...t, segments: t.segments.map(s => ({ ...s })) };
    });
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
  };

  const handleRemoveSegment = (dayAbbr, segIdx) => {
    const newTimes = booking.times.map((t) => {
      if (t.day_name === dayAbbr && t.segments.length > 1) {
        const newSegments = t.segments.filter((_, i) => i !== segIdx).map(s => ({ ...s }));
        return { ...t, segments: newSegments };
      }
      return { ...t, segments: t.segments.map(s => ({ ...s })) };
    });
    const updatedBooking = { ...booking, times: newTimes };
    handleUpdateBooking(updatedBooking);
  };


  // Prüft, ob ein einzelner Tag (Mo, Di, ...) im Booking geändert wurde

  const daysOfWeek = [
    { label: 'Montag', abbr: 'Mo' }, { label: 'Dienstag', abbr: 'Di' },
    { label: 'Mittwoch', abbr: 'Mi' }, { label: 'Donnerstag', abbr: 'Do' },
    { label: 'Freitag', abbr: 'Fr' }
  ];



  // Helper to ensure date is valid for date picker

  // DateRangePicker handler
  const handleDateRangeChange = (range) => {
    handleUpdateBooking({
      ...booking,
      startdate: range.start || '',
      enddate: range.end || ''
    });
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Gültigkeit</Typography>
          <TailgridDateRangePicker
            value={{ start: booking.startdate, end: booking.enddate }}
            onChange={handleDateRangeChange}
          />
        </Box>
        {daysOfWeek.map(day => {
          return (
            <Box key={day.abbr} display="flex" alignItems="center">
              <DayControl
                dayLabel={day.label}
                dayAbbr={day.abbr}
                dayData={booking.times?.find(t => t.day_name === day.abbr)}
                onToggle={handleDayToggle}
                onTimeChange={handleTimeChange}
                onAddSegment={handleAddSegment}
                onRemoveSegment={handleRemoveSegment}
                type={type}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default BookingDetail;
