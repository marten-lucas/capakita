import {
  Typography, Box, Card, CardContent, CardHeader, Button,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import React, { useMemo } from 'react';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../utils/dateUtils';
import ModMonitor from './ModMonitor';
import useSimScenarioDataStore from '../../store/simScenarioStore';

function GroupDetail({ group, index, allGroups, onDelete, canDelete, onRestore, originalGroup, onUpdateGroup, parentItemId }) {
  const { getItemBookings, updateItemBookings } = useSimScenarioDataStore((state) => ({
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
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              {group.name || 'Gruppenzuordnung'}{dateRangeText ? `: ${dateRangeText}` : ''}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <ModMonitor
                itemId={parentItemId}
                field={`group-${index}`}
                value={JSON.stringify(group)}
                originalValue={originalGroup ? JSON.stringify(originalGroup) : undefined}
                onRestore={handleRestoreAll}
                title="Komplette Gruppenzuordnung auf importierte Werte zurücksetzen"
                confirmMsg="Gruppenzuordnung auf importierte Adebis-Daten zurücksetzen?"
              />
              {onDelete && canDelete && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => onDelete(index)}
                >
                  Löschen
                </Button>
              )}
            </Box>
          </Box>
        }
      />
      
      <CardContent>
        {/* Group Selection Section */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ mr: 2 }}>Gruppe auswählen:</FormLabel>
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
            value={group.id === 'mehrere' ? 'mehrere' : (group.id ? String(group.id) : '')}
            onChange={handleGroupModeChange}
          >
            {Object.entries(allGroups).map(([groupId, groupName]) => (
              <FormControlLabel 
                key={groupId} 
                value={groupId} 
                control={<Radio />} 
                label={groupName}
              />
            ))}
            <FormControlLabel 
              value="mehrere" 
              control={<Radio />} 
              label="Mehrere Gruppen"
            />
          </RadioGroup>
        </Box>

        {/* Segment Override Section - Only shown when "mehrere" is selected */}
        {group.id === 'mehrere' && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Spezifische Gruppenzuordnung pro Buchungssegment:
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Buchung</strong></TableCell>
                    <TableCell><strong>Zeitraum</strong></TableCell>
                    <TableCell><strong>Zugeordnete Gruppe</strong></TableCell>
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
                      <TableRow key={segment.id}>
                        <TableCell>{segment.summary}</TableCell>
                        <TableCell>{segment.timeRange}</TableCell>
                        <TableCell>
                          <RadioGroup
                            row
                            name={`segment-override-${segment.id}`}
                            value={group.segmentOverrides?.[segment.id] ? String(group.segmentOverrides[segment.id]) : ''}
                            onChange={(e) => handleSegmentOverride(segment.id, e.target.value)}
                          >
                            {Object.entries(allGroups).map(([groupId, groupName]) => (
                              <FormControlLabel 
                                key={groupId}
                                value={groupId}
                                control={<Radio size="small" />}
                                label={groupName}
                                sx={{ mr: 1 }}
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

        {/* Date Range Section */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, textAlign: 'left' }}>Zeitraum der Gruppenzuordnung:</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              label="Startdatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(group.start)}
              onChange={(e) => handleDateChange('start', e.target.value)}
              sx={{ width: 150 }}
            />
            <ModMonitor
              itemId={parentItemId}
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
            />
            <ModMonitor
              itemId={parentItemId}
              field={`group-${index}-end`}
              value={group.end}
              originalValue={originalGroup ? originalGroup.end : undefined}
              onRestore={() => handleRestoreGroupDate('end')}
              title="Enddatum auf importierten Wert zurücksetzen"
              confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default GroupDetail;


