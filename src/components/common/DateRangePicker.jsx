import React, { useState } from 'react';
import { Typography, Box, Button, TextField } from '@mui/material';

function DateRangePicker({ value, onChange }) {
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

export default DateRangePicker;
