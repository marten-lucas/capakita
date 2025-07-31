import React, { useMemo } from 'react';
import { List, ListItemButton, ListItemText, Divider, Box, Chip, Avatar, Tooltip } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { deleteDataItemThunk } from '../../store/simDataSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import PersonIcon from '@mui/icons-material/Person';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import RestoreButton from './RestoreButton';
import { getDateRangeString } from '../../utils/dateUtils';
import { sumBookingHours } from '../../utils/bookingUtils';
import { getEffectiveGroupAssignments as getEffectiveGroupAssignmentsUtil, getScenarioChain } from '../../utils/overlayUtils';

// Use a constant for empty object to avoid new reference on each render
const EMPTY_OBJECT = {};

function SimDataList() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const groupsByScenario = useSelector(state => state.simGroup.groupsByScenario);

  const scenarioChain = useMemo(
    () => getScenarioChain(scenarios, selectedScenarioId),
    [scenarios, selectedScenarioId]
  );

  // Use overlay hook to get effective data
  const { getEffectiveDataItems, hasOverlay, isBasedScenario, getEffectiveGroupDefs, getEffectiveBookings } = useOverlayData();
  const effectiveDataItems = getEffectiveDataItems();
  const groupDefs = getEffectiveGroupDefs();

  const data = useMemo(
    () => Object.entries(effectiveDataItems).map(([key, item]) => ({ ...item, _key: key })),
    [effectiveDataItems]
  );

  // Define colors for demand/capacity
  const DEMAND_COLOR = '#c0d9f3ff';   // blue for children
  const CAPACITY_COLOR = '#a3c7a5ff'; // green for employees

  // Helper: get group definition by groupId
  function getGroupDef(groupId) {
    if (!groupId) return null;
    return groupDefs.find(g => String(g.id) === String(groupId));
  }

  // Helper: get bookings for item
  function getBookings(itemId) {
    const bookingsObj = getEffectiveBookings(itemId);
    return bookingsObj ? Object.values(bookingsObj) : [];
  }

  // Helper: get subtitle for item (booking info)
  function getSubtitle(item) {
    const bookings = getBookings(item._key);
    if (!bookings.length) return '';
    // Use the first booking (should be only one per item)
    const booking = bookings[0];
    const hours = sumBookingHours(booking);
    return getDateRangeString(booking.startdate, booking.enddate, hours);
  }

  // Helper: get Avatar for item
  function getAvatar(item) {
    const groupAssignments = getEffectiveGroupAssignmentsUtil(
      scenarioChain,
      overlaysByScenario,
      groupsByScenario,
      item._key
    );
    const assignments = groupAssignments ? Object.values(groupAssignments) : [];
    const groupAssignment = assignments.length === 0 ? null : assignments.find(a => !a.end) || assignments[0];
    const groupDef = groupAssignment ? getGroupDef(groupAssignment.groupId) : null;
    const color = item.type === 'demand' ? DEMAND_COLOR : CAPACITY_COLOR;
    let icon = null;
    if (groupDef && groupDef.icon) {
      icon = groupDef.icon;
    } else if (item.type === 'capacity') {
      icon = <PersonIcon fontSize="small" />;
    } else if (item.type === 'demand') {
      icon = <ChildCareIcon fontSize="small" />;
    }
    return (
      <Avatar sx={{ bgcolor: color, color: '#222', width: 32, height: 32, fontSize: 22 }}>
        {typeof icon === 'string' ? icon : icon}
      </Avatar>
    );
  }

  // Helper: get source chip
  function getSourceChip(item) {
    if (item.source && item.source.toLowerCase().includes('adebis')) {
      return <Chip label="Importiert" size="small" color="info" sx={{ fontSize: '0.7rem', height: 20 }} />;
    }
    return <Chip label="Manuell" size="small" color="default" sx={{ fontSize: '0.7rem', height: 20 }} />;
  }

  // Handler: restore item to base or imported state
  const handleRestore = (itemId, isBasedScenario, scenarios, data) => {

    if (isBasedScenario) {
      // Remove overlays for this item in this scenario
      dispatch({ type: 'simOverlay/removeDataItemOverlay', payload: { scenarioId: selectedScenarioId, itemId } });
      dispatch({ type: 'simOverlay/removeBookingOverlay', payload: { scenarioId: selectedScenarioId, itemId } });
      dispatch({ type: 'simOverlay/removeGroupAssignmentOverlay', payload: { scenarioId: selectedScenarioId, itemId } });
      dispatch({ type: 'simOverlay/removeQualificationDefOverlay', payload: { scenarioId: selectedScenarioId } });
    } else {
      // For base scenario: restore imported data if possible
      // Find imported data for this item
      const state = window.store?.getState?.() || {};
      const allScenarios = state.simScenario?.scenarios || [];
      const importedScenarios = allScenarios.filter(s => s.imported);
      let importedItem = null;
      for (const s of importedScenarios) {
        importedItem = Object.values(state.simData?.dataByScenario?.[s.id] || {}).find(
          i =>
            i.adebisId &&
            data.find(d => d._key === itemId)?.adebisId &&
            i.adebisId.id === data.find(d => d._key === itemId)?.adebisId.id &&
            i.adebisId.source === data.find(d => d._key === itemId)?.adebisId.source
        );
        if (importedItem) break;
      }
      if (importedItem) {
        dispatch({
          type: 'simData/updateDataItem',
          payload: {
            scenarioId: selectedScenarioId,
            itemId,
            updates: {
              ...importedItem,
              id: itemId // keep current id
            }
          }
        });
        // TODO: Also restore bookings, group assignments, qualification assignments if needed
      }
    }
  };

  if (!data || data.length === 0) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ p: 3, color: 'text.secondary', textAlign: 'center', width: '100%' }}>
          Importieren Sie Adebis-Daten oder fügen Sie Datensätze manuell hinzu
        </Box>
      </Box>
    );
  }
  
  return (
    <List
      sx={{
        width: 340,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        height: '100vh',
        maxHeight: '100vh',
        overflowY: 'auto'
      }}
    >
      {data.map((item) => {
        const itemHasOverlay = isBasedScenario && hasOverlay(item._key);
        const subtitle = getSubtitle(item);

        return (
          <div key={item._key}>
            <ListItemButton
              onClick={() => dispatch(setSelectedItem(item._key))}
              selected={selectedItemId === item._key}
              sx={selectedItemId === item._key ? { bgcolor: 'action.selected' } : undefined}
              alignItems="flex-start"
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, width: '100%' }}>
                <Tooltip title={item.type === 'demand' ? 'Kind' : 'Mitarbeiter'}>
                  {getAvatar(item)}
                </Tooltip>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Row 1: Name */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  </Box>
                  {/* Row 2: Subtitle */}
                  <Box sx={{ fontSize: '0.85em', color: 'text.secondary', mt: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subtitle}
                  </Box>
                  {/* Row 3: Chips */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.2 }}>
                    {itemHasOverlay && (
                      <Chip 
                        label="Geändert" 
                        size="small" 
                        color="warning" 
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 20 }}
                      />
                    )}
                    {getSourceChip(item)}
                  </Box>
                </Box>
                <RestoreButton
                  scenarioId={selectedScenarioId}
                  itemId={item._key}
                  onRestore={() => handleRestore(item._key, isBasedScenario, scenarios, data)}
                />
                <IconButton
                  edge="end"
                  aria-label="delete"
                  size="small"
                  onClick={e => {
                    e.stopPropagation();
                    dispatch(deleteDataItemThunk({ scenarioId: selectedScenarioId, itemId: item._key }));
                  }}
                  sx={{ ml: 1 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </ListItemButton>
            <Divider />
          </div>
        );
      })}
    </List>
  );
}

export default SimDataList;
