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

// Use a constant for empty object to avoid new reference on each render
const EMPTY_OBJECT = {};

function SimDataList() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const bookingsByScenario = useSelector(state => state.simBooking.bookingsByScenario);
  const groupsByScenario = useSelector(state => state.simGroup.groupsByScenario);
  const groupDefsByScenario = useSelector(state => state.simGroup.groupDefsByScenario);

  // Use overlay hook to get effective data
  const { getEffectiveDataItems, hasOverlay, isBasedScenario } = useOverlayData();
  const effectiveDataItems = getEffectiveDataItems();

  const data = useMemo(
    () => Object.entries(effectiveDataItems).map(([key, item]) => ({ ...item, _key: key })),
    [effectiveDataItems]
  );

  // Define colors for demand/capacity
  const DEMAND_COLOR = '#c0d9f3ff';   // blue for children
  const CAPACITY_COLOR = '#a3c7a5ff'; // green for employees

  // Helper: get scenario for current id

  // Helper: get group assignment for item (overlay-aware)
  function getCurrentGroup(itemId) {
    // Overlay-aware: overlaysByScenario?.[selectedScenarioId]?.groupassignments?.[itemId]
    // For now, just use groupsByScenario
    const groupAssignments = groupsByScenario?.[selectedScenarioId]?.[itemId];
    if (!groupAssignments) return null;
    // Find the group assignment with no end date or latest start
    // (Assume only one assignment per item for now)
    const assignments = Object.values(groupAssignments);
    if (assignments.length === 0) return null;
    // Prefer assignment with no end or latest end
    return assignments.find(a => !a.end) || assignments[0];
  }

  // Helper: get group definition by groupId
  function getGroupDef(groupId) {
    if (!groupId) return null;
    const defs = groupDefsByScenario?.[selectedScenarioId];
    if (!defs) return null;
    return defs.find(g => String(g.id) === String(groupId));
  }

  // Helper: get bookings for item
  function getBookings(itemId) {
    return bookingsByScenario?.[selectedScenarioId]?.[itemId]
      ? Object.values(bookingsByScenario[selectedScenarioId][itemId])
      : [];
  }

  // Helper: sum hours for a booking
  function sumBookingHours(booking) {
    if (!booking?.times || booking.times.length === 0) return 0;
    let total = 0;
    booking.times.forEach(day => {
      day.segments.forEach(seg => {
        if (seg.booking_start && seg.booking_end) {
          // Parse times as HH:mm
          const [sh, sm] = seg.booking_start.split(':').map(Number);
          const [eh, em] = seg.booking_end.split(':').map(Number);
          let diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff > 0) total += diff / 60;
        }
      });
    });
    return total;
  }

  // Helper: get subtitle for item (booking info)
  function getSubtitle(item) {
    const bookings = getBookings(item._key);
    if (!bookings.length) return '';
    // Use the first booking (should be only one per item)
    const booking = bookings[0];
    const hours = sumBookingHours(booking);
    // Compose date info
    const start = booking.startdate;
    const end = booking.enddate;
    if (start && end) {
      return `${hours ? `${hours} h von ${formatDate(start)} bis ${formatDate(end)}` : ''}`;
    }
    if (start) {
      return `${hours ? `${hours} h ab ${formatDate(start)}` : ''}`;
    }
    return hours ? `${hours} h` : '';
  }

  // Helper: format date as d.m.yyyy
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  }

  // Helper: get Avatar for item
  function getAvatar(item) {
    const groupAssignment = getCurrentGroup(item._key);
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
