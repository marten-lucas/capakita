import {
  Typography, Box, Button,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import React, { useMemo, useEffect } from 'react';
import { convertDDMMYYYYtoYYYYMMDD } from '../../../utils/dateUtils';
import ModMonitor from '../ModMonitor';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { getBookings } from '../../../store/simBookingSlice';
import { deleteGroup } from '../../../store/simGroupSlice';
import { useOverlayData } from '../../../hooks/useOverlayData';

const EMPTY_GROUP_DEFS = [];

function GroupDetail({ index, group }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { baseScenario, isBasedScenario } = useOverlayData();
  const baseScenarioId = baseScenario?.id;

  // Overlay-aware selector for base group assignments
  const baseGroups = useSelector(state => {
    if (!baseScenarioId || !selectedItemId || !group?.id) return undefined;
    const baseGroupsObj = state.simGroup.groupsByScenario[baseScenarioId]?.[selectedItemId];
    return baseGroupsObj ? Object.values(baseGroupsObj) : undefined;
  });

  // Use bookings from simBookingSlice - check both current and base scenario
  const bookings = useSelector(state => {
    const currentBookings = getBookings(state, selectedScenarioId, selectedItemId);
    if (currentBookings && currentBookings.length > 0) return currentBookings;
    
    // If no bookings in current scenario and it's a based scenario, try base scenario
    if (isBasedScenario && baseScenario) {
      return getBookings(state, baseScenario.id, selectedItemId);
    }
    
    return currentBookings;
  });

  // Get original group from item.originalParsedData (from import)
  const originalGroup = undefined;
  const parentItemId = selectedItemId;

  // Assign missing segment IDs in an effect, not during render
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
      // Only update if something changed
      dispatch({
        type: 'simData/updateItemBookings',
        payload: {
          scenarioId: selectedScenarioId,
          itemId: parentItemId,
          bookings: updatedBookings
        }
      });
    }
  }, [bookings, parentItemId, dispatch, selectedScenarioId]);

  // Collect all segments for display
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

  // Handler to update group in store
  const handleUpdateGroup = (updatedGroup) => {
    if (!group) return;

    if (isBasedScenario) {
      // Compare with base group assignments
      const baseGroup = baseGroups?.find(g => g.id === group.id);
      const isIdenticalToBase = baseGroup && JSON.stringify(updatedGroup) === JSON.stringify(baseGroup);
      if (isIdenticalToBase) {
        // Remove overlay if matches base
        dispatch({
          type: 'simOverlay/removeGroupAssignmentOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            itemId: selectedItemId,
            groupId: group.id
          }
        });
      } else {
        // Set overlay if different from base
        dispatch({
          type: 'simOverlay/setGroupAssignmentOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            itemId: selectedItemId,
            groupId: group.id,
            overlayData: updatedGroup
          }
        });
      }
    } else {
      // Regular scenario - update directly in simGroup
      dispatch({
        type: 'simGroup/updateGroup',
        payload: {
          scenarioId: selectedScenarioId,
          dataItemId: selectedItemId,
          groupId: group.id,
          updates: updatedGroup
        }
      });
    }
  };

  // Handler to delete group in store
  const handleDeleteGroup = () => {
    if (!group) return;
    dispatch(deleteGroup({
      scenarioId: selectedScenarioId,
      dataItemId: selectedItemId,
      groupId: group.id
    }));
  };

  const handleDateChange = (field, value) => {
    // value from date picker is always YYYY-MM-DD, store as such
    const updatedGroup = { ...group, [field]: value };
    handleUpdateGroup(updatedGroup);
  };

  // Restore für Feld
  const handleRestoreGroupDate = (field) => {
    if (!originalGroup) return;
    const updatedGroup = { ...group, [field]: originalGroup[field] || '' };
    handleUpdateGroup(updatedGroup);
  };

  // Restore für Gruppen-ID
  const groupDefsSelector = React.useMemo(() =>
    createSelector(
      [
        state => state.simGroup.groupDefsByScenario,
        () => selectedScenarioId,
        () => baseScenario?.id
      ],
      (groupDefsByScenario, scenarioId, baseScenarioId) => {
        const currentDefs = groupDefsByScenario[scenarioId] || [];
        const baseDefs = baseScenarioId ? (groupDefsByScenario[baseScenarioId] || []) : [];
        
        // Merge base and current
        const merged = [...baseDefs];
        currentDefs.forEach(currentDef => {
          const existingIndex = merged.findIndex(def => def.id === currentDef.id);
          if (existingIndex >= 0) {
            merged[existingIndex] = currentDef;
          } else {
            merged.push(currentDef);
          }
        });
        
        return merged;
      }
    ),
    [selectedScenarioId, baseScenario?.id]
  );
  const groupDefs = useSelector(groupDefsSelector);
  const allGroupsLookup = React.useMemo(() => {
    const lookup = {};
    groupDefs.forEach(g => {
      lookup[g.id] = g.name;
    });
    return lookup;
  }, [groupDefs]);

  const handleRestoreGroupId = () => {
    if (!originalGroup) return;
    const updatedGroup = {
      ...group,
      id: originalGroup.id,
      name: allGroupsLookup[originalGroup.id] || `Gruppe ${originalGroup.id}`,
    };
    handleUpdateGroup(updatedGroup);
  };

  // Restore für alles
  const handleRestoreAll = () => {
    if (!originalGroup) return;
    // Replace group with original
    handleUpdateGroup({ ...originalGroup });
  };

  const handleGroupModeChange = (event) => {
    const mode = event.target.value;
    if (mode === 'multiple') {
      const updatedGroup = {
        ...group,
        groupId: 'multiple',
        name: 'Mehrere Gruppen',
        segmentOverrides: group.segmentOverrides || {}
      };
      handleUpdateGroup(updatedGroup);
    } else {
      const newGroupId = String(mode);
      const newGroupName = allGroupsLookup[newGroupId] || `Gruppe ${newGroupId}`;
      const updatedGroup = {
        ...group,
        groupId: newGroupId,
        name: newGroupName,
        segmentOverrides: undefined
      };
      handleUpdateGroup(updatedGroup);
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
    handleUpdateGroup(updatedGroup);
  };

  // Helper to ensure date is valid for date picker
  const getDatePickerValue = (dateStr) => {
    if (!dateStr) return '';
    // Accept YYYY-MM-DD only
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Accept DD.MM.YYYY and convert
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return convertDDMMYYYYtoYYYYMMDD(dateStr);
    return '';
  };

  if (!group) return null;

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
          <Button
            size="small"
            color="error"
            onClick={handleDeleteGroup}
          >
            Löschen
          </Button>
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
          value={getDatePickerValue(group.start)}
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
          value={getDatePickerValue(group.end)}
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
          value={group.groupId === 'multiple' ? 'multiple' : (group.groupId ? String(group.groupId) : '')}
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
          {groupDefs.length > 1 && (
            <FormControlLabel
              value="multiple"
              control={<Radio />}
              label="Mehrere Gruppen"
            />
          )}
        </RadioGroup>
      </Box>
      {/* Segment Override Section - Only shown when "multiple" is selected */}
      {group.groupId === 'multiple' && (
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
