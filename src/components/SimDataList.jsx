import { List, ListItem, ListItemButton, ListItemText, Divider, Box, ListItemAvatar, Avatar, Chip } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import useModMonitorStore from '../store/modMonitorStore';
import useAppSettingsStore from '../store/appSettingsStore';




function consolidateBookingTimes(booking) {
  if (!booking || booking.length === 0) return { text: 'Keine Buchungszeiten', hours: 0, segmentsPerDay: {} };
  const dayOrder = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  let totalMinutes = 0;
  const segmentsPerDay = {};

  booking.forEach(b => {
    if (b.times && b.times.length > 0) {
      b.times.forEach(dayTime => {
        if (dayOrder.includes(dayTime.day_name)) {
          // --- NEU: Unterstütze auch String-Format wie aus "ZEITEN" ---
          let segs = [];
          if (Array.isArray(dayTime.segments)) {
            segs = dayTime.segments;
          } else if (typeof dayTime.segments === 'string') {
            // z.B. "08:30|13:30|16:00|17:00"
            const parts = dayTime.segments.split('|').filter(Boolean);
            for (let i = 0; i < parts.length - 1; i += 2) {
              if (parts[i] && parts[i + 1]) {
                segs.push({ booking_start: parts[i], booking_end: parts[i + 1] });
              }
            }
          }
          // Fallback: falls segments leer, prüfe alt: dayTime.start/end
          if (!segs.length && dayTime.booking_start && dayTime.booking_end) {
            segs = [{ booking_start: dayTime.booking_start, booking_end: dayTime.booking_end }];
          }
          if (!segmentsPerDay[dayTime.day_name]) segmentsPerDay[dayTime.day_name] = [];
          segs.forEach(seg => {
            if (seg.booking_start && seg.booking_end) {
              const [sh, sm] = seg.booking_start.split(':').map(Number);
              const [eh, em] = seg.booking_end.split(':').map(Number);
              const mins = (eh * 60 + em) - (sh * 60 + sm);
              if (mins > 0) totalMinutes += mins;
              segmentsPerDay[dayTime.day_name].push({
                start: seg.booking_start,
                end: seg.booking_end
              });
            }
          });
        }
      });
    }
  });
  return {
    hours: (totalMinutes / 60).toFixed(1),
    segmentsPerDay // z.B. { Mo: [{start, end}, ...], Di: [...] }
  };
}

function SimDataList({ data, onRowClick, selectedItem }) {
  // Selector: serialisiere alle Modifikationen, damit React neu rendert bei jeder Änderung
  const modificationsStore = useModMonitorStore(state => state.modifications);
  
  // Get groups from AppSettingsStore for icons
  const getGroupById = useAppSettingsStore(state => state.getGroupById);

  // Define colors for demand/capacity
  const DEMAND_COLOR = '#c0d9f3ff';   // blue for children
  const CAPACITY_COLOR = '#a3c7a5ff'; // green for employees

  function getModificationStatus(item) {
    const mods = item.modifications || [];
    if (mods.length === 0) return 'unchanged';
    const storeMods = modificationsStore[item.id] || {};
    let active = 0;
    let inactive = 0;
    mods.forEach(mod => {
      if (storeMods[mod.field]) active++;
      else inactive++;
    });
    if (active > 0 && inactive > 0) return 'inactive modification';
    if (active > 0) return 'modified';
    return 'unchanged';
  }

  function getModificationChipProps(status) {
    switch (status) {
      case 'modified':
        return { label: 'Geändert', color: 'warning', variant: 'filled' };
      case 'inactive modification':
        return { label: 'Inaktive Modifikation', color: 'default', variant: 'outlined' };
      default:
        return { label: 'Unverändert', color: 'success', variant: 'outlined' };
    }
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
        width: 320,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        height: '100vh',
        maxHeight: '100vh',
        overflowY: 'auto'
      }}
    >
      {data.map((item) => {
        // Passe consolidateBookingTimes-Aufruf an, übergebe type
        const { hours } = consolidateBookingTimes(item.parseddata?.booking, item.type);
        // Für demand: erste Gruppe bestimmen
        let group = null;
        let groupIcon = '👥'; // Default icon
        let groupName = '';
        if (item.type === 'demand' && item.parseddata?.group && item.parseddata.group.length > 0) {
          group = item.parseddata.group[0];
          groupName = group?.name || 'Gruppe unbekannt';
          // Get icon from settings store
          const settingsGroup = getGroupById(group?.id);
          if (settingsGroup && settingsGroup.icon) {
            groupIcon = settingsGroup.icon;
          }
        } else if (item.type === 'demand') {
          // No group set for child
          groupIcon = '🙂';
          groupName = 'keine Gruppe';
        }
        // Use color by type only
        const avatarColor = item.type === 'demand' ? DEMAND_COLOR : CAPACITY_COLOR;
        let secondaryText = '';
        if (item.type === 'demand') {
          secondaryText = `${hours} h in ${groupName}`;
        } else {
          secondaryText = `${hours} h`;
        }
        // Hinweis: segmentsPerDay enthält jetzt für Mitarbeiter mehrere Zeitsegmente pro Tag
        // Diese Struktur kann an die Slider-Komponente weitergegeben werden!
        const modificationStatus = getModificationStatus(item);
        const modChipProps = getModificationChipProps(modificationStatus);

        // Check if item is manually added
        const isManualEntry = item?.rawdata?.source === 'manual entry';

        return (
          <div key={item.id}>
            <ListItemButton
              onClick={() => onRowClick(item)}
              selected={selectedItem && selectedItem.id === item.id}
              sx={selectedItem && selectedItem.id === item.id ? { bgcolor: 'action.selected' } : undefined}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: avatarColor }}>
                  {item.type === 'demand'
                    ? groupIcon
                    : <AccountCircleIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{item.name}</span>
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                    <span style={{ color: '#888' }}>{secondaryText}</span>
                    <Chip
                      label={item.rawdata?.source || 'unbekannt'}
                      size="small"
                      color={item.rawdata?.source === 'adebis export' ? 'primary' : 'default'}
                      variant={item.rawdata?.source === 'manual entry' ? 'outlined' : 'filled'}
                      sx={{ mt: 0.5 }}
                    />
                    {!isManualEntry && (
                      <Chip {...modChipProps} size="small" sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItemButton>
            <Divider />
          </div>
        );
      })}
    </List>
  );
}

export default SimDataList;
