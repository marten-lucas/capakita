import React from 'react';
import { List, ListItemButton, ListItemText, Divider, Box } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedItem } from '../store/simScenarioSlice';
import { selectDataItemsByScenario } from '../store/simDataSlice';

function SimDataList() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);

  const dataSelector = React.useMemo(
    () => (state) => selectDataItemsByScenario(state, selectedScenarioId),
    [selectedScenarioId]
  );
  const data = useSelector(dataSelector);
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
              onClick={() => dispatch(setSelectedItem(item.id))}
              selected={selectedItemId === item.id}
              sx={selectedItemId === item.id ? { bgcolor: 'action.selected' } : undefined}
            >
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
