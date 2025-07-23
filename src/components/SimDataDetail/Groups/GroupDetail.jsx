import {
  Typography, Box, Button,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import React, { useMemo, useEffect } from 'react';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../../utils/dateUtils';
import ModMonitor from '../ModMonitor';
import useSimScenarioDataStore from '../../../store/simScenarioStore';

function GroupDetail({ group, index, onDelete, onRestore, originalGroup, onUpdateGroup, parentItemId }) {
  const { getItemBookings, updateItemBookings } = useSimScenarioDataStore((state) => ({
    getItemBookings: state.getItemBookings,
    updateItemBookings: state.updateItemBookings,
  }));

  // Get bookings and memoize segments calculation
  const bookings = getItemBookings(parentItemId);

  // --- FIX: Assign missing segment IDs in an effect, not during render ---
  useEffect(() => {
    let needsUpdate = false;
    const updatedBookings = bookings.map((booking, bookingIdx) => ({
      ...booking,
      times: booking.times?.map((timeEntry) => ({
        ...timeEntry,
        segments: timeEntry.segments?.map((segment) => {
          if (!segment.id) {
            needsUpdate = true;
            return {
              ...segment,
              id: `${parentItemId}-${bookingIdx}-${timeEntry.day_name}-${Date.now()}-${Math.random()}`
            };
          }
          return segment;
        })
      }))
    }));
    if (needsUpdate) {
      updateItemBookings(parentItemId, updatedBookings);
    }
  }, [bookings, parentItemId, updateItemBookings]);

  // Now just collect all segments for display
  const getAllBookingSegments = useMemo(() => {
    const segments = [];
    bookings.forEach((booking, bookingIdx) => {
      booking.times?.forEach((timeEntry) => {
        timeEntry.segments?.forEach((segment) => {
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
  }, [bookings]);

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
      name: allGroupsLookup[originalGroup.id] || `Gruppe ${originalGroup.id}`,
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
      const newGroupName = allGroupsLookup[newGroupId] || `Gruppe ${newGroupId}`;
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

  // Get allGroups from scenario groupdefs
  const groupDefs = useSimScenarioDataStore(state => state.getGroupDefs());
  // Build allGroups lookup { id: name }
  const allGroupsLookup = React.useMemo(() => {
    const lookup = {};
    groupDefs.forEach(g => {
      lookup[g.id] = g.name;
    });
    return lookup;
  }, [groupDefs]);

  return (
    <Box sx={{ mb: 2 }}>
      <Box alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        
        <Box alignItems="center" gap={1}>
          <ModMonitor
            itemId={parentItemId}
            field={`group-${index}`}
            value={JSON.stringify(group)}
            originalValue={originalGroup ? JSON.stringify(originalGroup) : undefined}
            onRestore={handleRestoreAll}
            title="Komplette Gruppenzuordnung auf importierte Werte zurücksetzen"
            confirmMsg="Gruppenzuordnung auf importierte Adebis-Daten zurücksetzen?"
          />
          {onDelete && (
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
      {/* Start/Enddatum section at the top */}
      <Box display="flex" gap={2} sx={{ mb: 2, alignItems: 'center' }}>
        <Typography>gültig von</Typography>
        <TextField
          label="Startdatum"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={convertDDMMYYYYtoYYYYMMDD(group.start)}
          onChange={(e) => handleDateChange('start', e.target.value)}
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
          {Object.entries(allGroupsLookup).map(([groupId, groupName]) => (
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
                          {Object.entries(allGroupsLookup).map(([groupId, groupName]) => (
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
    </Box>
  );
}

export default GroupDetail;


