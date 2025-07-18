import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React, { useState, useMemo } from 'react';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../utils/dateUtils';
import ModMonitor from './ModMonitor';
import useSimulationDataStore from '../../store/simulationDataStore';

function GroupAccordion({ group, index, allGroups, defaultExpanded, onDelete, canDelete, onRestore, originalGroup, onUpdateGroup, parentItemId }) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  
  const { getItemBookings, updateItemBookings } = useSimulationDataStore((state) => ({
    getItemBookings: state.getItemBookings,
    updateItemBookings: state.updateItemBookings,
  }));

  // Get bookings and memoize segments calculation
  const bookings = getItemBookings(parentItemId);
  
  const getAllBookingSegments = useMemo(() => {
    const segments = [];
    
    bookings.forEach((booking, bookingIdx) => {
      booking.times?.forEach((timeEntry) => {
        timeEntry.segments?.forEach((segment) => {
          // Ensure segment has ID and update bookings if needed
          if (!segment.id) {
            const newId = `${parentItemId}-${bookingIdx}-${timeEntry.day_name}-${Date.now()}-${Math.random()}`;
            
            // Update the booking with the new segment ID
            const updatedBookings = bookings.map((b, idx) => {
              if (idx === bookingIdx) {
                return {
                  ...b,
                  times: b.times?.map((t) => {
                    if (t.day_name === timeEntry.day_name) {
                      return {
                        ...t,
                        segments: t.segments?.map((s) => 
                          s === segment ? { ...s, id: newId } : s
                        )
                      };
                    }
                    return t;
                  })
                };
              }
              return b;
            });
            
            // Update the bookings in the store
            updateItemBookings(parentItemId, updatedBookings);
            
            // Use the new ID for this segment
            segment = { ...segment, id: newId };
          }
          
          segments.push({
            id: segment.id,
            bookingId: bookingIdx + 1,
            day: timeEntry.day_name,
            timeRange: `${segment.booking_start} - ${segment.booking_end}`,
            summary: `Buchung ${bookingIdx + 1} (${timeEntry.day_name}): ${segment.booking_start} - ${segment.booking_end}`
          });
        });
      });
    });
    
    return segments;
  }, [bookings, parentItemId, updateItemBookings]);

  const handleDateChange = (field, value) => {
    const updatedGroup = { ...group, [field]: convertYYYYMMDDtoDDMMYYYY(value) };
    onUpdateGroup(updatedGroup);
  };

  // Restore für Feld
  const handleRestoreGroupDate = (field) => {
    if (!originalGroup) return;
    const updatedGroup = { ...group, [field]: originalGroup[field] || '' };
    onUpdateGroup(updatedGroup);
  };

  // Restore für Gruppen-ID
  const handleRestoreGroupId = () => {
    if (!originalGroup) return;
    const updatedGroup = {
      ...group,
      id: originalGroup.id,
      name: allGroups[originalGroup.id] || `Gruppe ${originalGroup.id}`,
    };
    onUpdateGroup(updatedGroup);
  };

  // Restore für alles
  const handleRestoreAll = () => {
    if (window.confirm('Gruppenzuordnung auf importierte Adebis-Daten zurücksetzen?')) {
      onRestore && onRestore(index);
    }
  };

  const handleGroupModeChange = (event) => {
    const mode = event.target.value;
    if (mode === 'mehrere') {
      const updatedGroup = { 
        ...group, 
        id: 'mehrere', 
        name: 'Mehrere Gruppen',
        segmentOverrides: group.segmentOverrides || {}
      };
      onUpdateGroup(updatedGroup);
    } else {
      const newGroupId = parseInt(mode, 10);
      const newGroupName = allGroups[newGroupId] || `Gruppe ${newGroupId}`;
      const updatedGroup = { 
        ...group, 
        id: newGroupId, 
        name: newGroupName,
        segmentOverrides: undefined
      };
      onUpdateGroup(updatedGroup);
    }
  };

  const handleSegmentOverride = (segmentId, groupId) => {
    const updatedGroup = {
      ...group,
      segmentOverrides: {
        ...group.segmentOverrides,
        [segmentId]: groupId ? parseInt(groupId, 10) : undefined
      }
    };
    onUpdateGroup(updatedGroup);
  };

  const { start, end } = group;
  let dateRangeText = '';
  if (start && end) {
    dateRangeText = `von ${start} bis ${end}`;
  } else if (start) {
    dateRangeText = `ab ${start}`;
  } else if (end) {
    dateRangeText = `bis ${end}`;
  }

  return (
    <Accordion onChange={() => setExpanded(e => !e)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {group.name || 'Gruppenzuordnung'}{dateRangeText ? `: ${dateRangeText}` : ''}
          </Typography>
          {expanded && (
            <ModMonitor
              itemId={parentItemId}
              field={`group-${index}`}
              value={JSON.stringify(group)}
              originalValue={originalGroup ? JSON.stringify(originalGroup) : undefined}
              onRestore={handleRestoreAll}
              title="Komplette Gruppenzuordnung auf importierte Werte zurücksetzen"
              confirmMsg="Gruppenzuordnung auf importierte Adebis-Daten zurücksetzen?"
              iconProps={{ sx: { ml: 1 } }}
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {/* Move delete button inside AccordionDetails to avoid nested buttons */}
        {onDelete && canDelete && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              size="small"
              color="error"
              onClick={(e) => { e.stopPropagation(); onDelete(index); }}
            >
              Löschen
            </Button>
          </Box>
        )}
        <Box display="flex" flexDirection="column" gap={3}>
          <FormControl component="fieldset">
            <Box display="flex" alignItems="center">
              <FormLabel component="legend" sx={{ mr: 1 }}>Gruppe</FormLabel>
              <ModMonitor
                itemId={parentItemId}
                field={`group-${index}-id`}
                value={group.id}
                originalValue={originalGroup ? originalGroup.id : undefined}
                onRestore={handleRestoreGroupId}
                title="Gruppenzuordnung auf importierten Wert zurücksetzen"
                confirmMsg="Gruppenzuordnung auf importierten Wert zurücksetzen?"
              />
            </Box>
            <RadioGroup
              row
              aria-label="gruppe"
              name={`gruppe-radio-buttons-group-${index}`}
              value={group.id === 'mehrere' ? 'mehrere' : (group.id ? String(group.id) : '')}
              onChange={handleGroupModeChange}
            >
              {Object.entries(allGroups).map(([groupId, groupName]) => (
                <FormControlLabel key={groupId} value={groupId} control={<Radio />} label={groupName} />
              ))}
              <FormControlLabel value="mehrere" control={<Radio />} label="Mehrere" />
            </RadioGroup>
          </FormControl>

          {group.id === 'mehrere' && (
            <Box onClick={(e) => e.stopPropagation()}>
              <Typography variant="h6" sx={{ mb: 2 }}>Gruppenzuordnung pro Buchungssegment</Typography>
              <TableContainer component={Paper} variant="outlined" onClick={(e) => e.stopPropagation()}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Buchung</TableCell>
                      <TableCell>Zeitraum</TableCell>
                      <TableCell>Gruppe</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getAllBookingSegments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          <Typography variant="body2" color="text.secondary">
                            Keine Buchungssegmente vorhanden
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      getAllBookingSegments.map((segment) => (
                        <TableRow key={segment.id} onClick={(e) => e.stopPropagation()}>
                          <TableCell onClick={(e) => e.stopPropagation()}>{segment.summary}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>{segment.timeRange}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <RadioGroup
                              row
                              name={`segment-group-${segment.id}`}
                              value={group.segmentOverrides?.[segment.id] ? String(group.segmentOverrides[segment.id]) : ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSegmentOverride(segment.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {Object.entries(allGroups).map(([groupId, groupName]) => (
                                <FormControlLabel 
                                  key={groupId} 
                                  value={groupId} 
                                  control={<Radio size="small" onClick={(e) => e.stopPropagation()} />} 
                                  label={groupName}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ))}
                            </RadioGroup>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          <Box display="flex" gap={2} alignItems="center">
            <TextField
              label="Startdatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(group.start)}
              onChange={(e) => handleDateChange('start', e.target.value)}
              sx={{ width: 150 }}
              inputProps={{ readOnly: false }}
            />
            <ModMonitor
              itemId={parentItemId} // Use parentItemId
              field={`group-${index}-start`}
              value={group.start}
              originalValue={originalGroup ? originalGroup.start : undefined}
              onRestore={() => handleRestoreGroupDate('start')}
              title="Startdatum auf importierten Wert zurücksetzen"
              confirmMsg="Startdatum auf importierten Wert zurücksetzen?"
            />
            <Typography>bis</Typography>
            <TextField
              label="Enddatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(group.end)}
              onChange={(e) => handleDateChange('end', e.target.value)}
              sx={{ width: 150 }}
              inputProps={{ readOnly: false }}
            />
            <ModMonitor
              itemId={parentItemId} // Use parentItemId
              field={`group-${index}-end`}
              value={group.end}
              originalValue={originalGroup ? originalGroup.end : undefined}
              onRestore={() => handleRestoreGroupDate('end')}
              title="Enddatum auf importierten Wert zurücksetzen"
              confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
            />
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default GroupAccordion;


