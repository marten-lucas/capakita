import { List, ListItem, ListItemButton, ListItemText, Divider, Box, ListItemAvatar, Avatar, Chip } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import useSimDataStore from '../store/simDataStore';
import useSimScenarioStore from '../store/simScenarioStore';

function SimDataList() {
  // Get selected scenario id from scenario store
  const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);
  // Get selected item id for the current scenario from scenario store
  const selectedItemId = useSimScenarioStore(state => state.selectedItems?.[selectedScenarioId]);
  // Setter for selected item
  const setSelectedItem = useSimScenarioStore(state => state.setSelectedItem);

  // Get all items of the selected scenario from the data store
  const data = useSimDataStore(state => state.getDataItems(selectedScenarioId));
  // Define colors for demand/capacity
  const DEMAND_COLOR = '#c0d9f3ff';   // blue for children
  const CAPACITY_COLOR = '#a3c7a5ff'; // green for employees

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
        return (
          <div key={item.id}>
            <ListItemButton
              onClick={() => setSelectedItem(item.id)} // This already saves the selected item id to the scenario store
              selected={selectedItemId === item.id}
              sx={selectedItemId === item.id ? { bgcolor: 'action.selected' } : undefined}
            >
              {/* <ListItemAvatar>
                <Avatar sx={{ bgcolor: avatarColor }}>
                  {item.type === 'demand'
                    ? groupIcon
                    : <AccountCircleIcon />}
                </Avatar>
              </ListItemAvatar> */}
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{item.name}</span>
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
