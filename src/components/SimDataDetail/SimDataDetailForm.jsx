import {
  Typography, Box, Button
} from '@mui/material';
import SimDataTabs from './SimDataTabs';
import SimDataGeneralTab from "./SimDataGeneralTab";
import { useSelector, useDispatch } from 'react-redux';
import { deleteDataItem } from '../../store/simDataSlice';

function SimDataDetailForm() {
  // Get scenarioId and selected item id from Redux store
  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[scenarioId]);
  // Get item from data store using scenarioId and selectedItemId
  const item = useSelector(state => state.simData.dataByScenario[scenarioId]?.[selectedItemId]);
  const dispatch = useDispatch();

  // Guard: Wenn item nicht gesetzt, Hinweis anzeigen und return
  if (!item) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">
          Wählen Sie einen Eintrag aus, um Details anzuzeigen.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      bgcolor="background.paper"
      boxShadow={3}
      borderRadius={2}
      p={3}
      height="90%"
      display="flex"
      flexDirection="column"
      overflow="auto"
    >
      <SimDataTabs />
      {/* Show delete button if manual entry */}
      {item?.rawdata?.source === 'manual entry' && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => dispatch(deleteDataItem({ scenarioId, itemId: item.id }))}
          >
            Eintrag löschen
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default SimDataDetailForm;

