import { List, ListItem, ListItemButton, ListItemText, Divider, Box, ListItemAvatar, Avatar, Chip } from '@mui/material';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// Farbpalette für Gruppen (z.B. 10 Farben)
const GROUP_COLORS = [
  '#1976d2', // blau
  '#388e3c', // grün
  '#fbc02d', // gelb
  '#d32f2f', // rot
  '#7b1fa2', // violett
  '#0288d1', // türkis
  '#c2185b', // pink
  '#ffa000', // orange
  '#455a64', // grau
  '#388e8e', // petrol
];

// Hilfsfunktion: Bestimme Farbe für Gruppe anhand ID oder Name
function getGroupColor(group) {
  if (!group) return '#bdbdbd';
  // Nutze id, sonst name, sonst fallback
  const key = group.id ?? group.name ?? '';
  let idx = 0;
  if (typeof key === 'number') idx = key % GROUP_COLORS.length;
  else if (typeof key === 'string') {
    // Hashcode aus String
    idx = Math.abs([...key].reduce((acc, c) => acc + c.charCodeAt(0), 0)) % GROUP_COLORS.length;
  }
  return GROUP_COLORS[idx];
}

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
        let groupName = '';
        if (item.type === 'demand' && item.parseddata?.group && item.parseddata.group.length > 0) {
          group = item.parseddata.group[0];
          groupName = group?.name || 'Gruppe unbekannt';
        }
        const groupColor = item.type === 'demand' ? getGroupColor(group) : '#bdbdbd';
        let secondaryText = '';
        if (item.type === 'demand') {
          secondaryText = `${hours} h in ${groupName}`;
        } else {
          secondaryText = `${hours} h`;
        }
        // Hinweis: segmentsPerDay enthält jetzt für Mitarbeiter mehrere Zeitsegmente pro Tag
        // Diese Struktur kann an die Slider-Komponente weitergegeben werden!
        return (
          <div key={item.id}>
            
            <ListItemButton
              onClick={() => onRowClick(item)}
              selected={selectedItem && selectedItem.id === item.id}
              sx={selectedItem && selectedItem.id === item.id ? { bgcolor: 'action.selected' } : undefined}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: groupColor }}>
                  {item.type === 'demand' ? <SentimentVerySatisfiedIcon /> : <AccountCircleIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{item.name}</span>
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#888' }}>{secondaryText}</span>
                    <Chip
                      label={item.rawdata?.source || 'unbekannt'}
                      size="small"
                      color={item.rawdata?.source === 'adebis export' ? 'primary' : 'default'}
                      sx={{ ml: 1 }}
                    />
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
