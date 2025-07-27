import React, { useMemo } from 'react';
import { List, ListItemButton, ListItemText, Divider, Box } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { deleteDataItemThunk } from '../../store/simDataSlice';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';

// Use a constant for empty object to avoid new reference on each render
const EMPTY_OBJECT = {};

function SimDataList() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);

  // Fix: always return same reference for empty object
  const dataByScenario = useSelector(
    state => state.simData.dataByScenario[selectedScenarioId] || EMPTY_OBJECT
  );

  const data = useMemo(
    () => Object.entries(dataByScenario).map(([key, item]) => ({ ...item, _key: key })),
    [dataByScenario]
  );

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
          <div key={item._key}>
            <ListItemButton
              onClick={() => dispatch(setSelectedItem(item._key))}
              selected={selectedItemId === item._key}
              sx={selectedItemId === item._key ? { bgcolor: 'action.selected' } : undefined}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{item.name}</span>
                  </Box>
                }
                secondaryTypographyProps={{ component: 'div' }}
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
            </ListItemButton>
            <Divider />
          </div>
        );
      })}
    </List>
  );
}

export default SimDataList;
