import React from 'react';
import { DatePickerInput } from '@mantine/dates';
import { useSelector, useDispatch } from 'react-redux';
import {
  setReferenceDate,
  updateWeeklyChartData,
  updateHistogramChartData,
} from '../../store/chartSlice';

function EventPicker({ scenarioId }) {
  const dispatch = useDispatch();
  const referenceDate = useSelector((state) => state.chart[scenarioId]?.referenceDate || null);

  return (
    <DatePickerInput
      label="Stichtag"
      placeholder="Datum wählen"
      value={referenceDate ? new Date(referenceDate) : null}
      clearable={false}
      onChange={(date) => {
        const nextDate = date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        dispatch(setReferenceDate({ scenarioId, date: nextDate }));
        dispatch(updateWeeklyChartData(scenarioId));
        dispatch(updateHistogramChartData(scenarioId));
      }}
    />
  );
}

export default EventPicker;
