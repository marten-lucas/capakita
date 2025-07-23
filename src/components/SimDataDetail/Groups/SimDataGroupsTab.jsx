import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ModMonitor from '../ModMonitor';
import GroupCards from './GroupCards';

function SimDataGroupsTab({
  item,
  groups,
  lastAddedGroupIdx,
  importedGroupCount,
  handleAddGroup,
  handleDeleteGroup,
  handleRestoreGroup,
}) {
  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Gruppen:
          <ModMonitor
            itemId={item.id}
            field="groups"
            value={JSON.stringify(groups)}
            originalValue={JSON.stringify(item.originalParsedData?.group || [])}
            onRestore={() => handleRestoreGroup()}
            title="Alle Gruppen auf importierte Werte zurücksetzen"
            confirmMsg="Alle Gruppen auf importierten Wert zurücksetzen?"
          />
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddGroup}
        >
          Gruppe hinzufügen
        </Button>
      </Box>
      <GroupCards
        itemId={item.id}
        groups={groups}
        lastAddedIndex={lastAddedGroupIdx}
        onDelete={handleDeleteGroup}
        importedCount={importedGroupCount}
        originalGroups={item?.originalParsedData?.group}
        onRestoreGroup={handleRestoreGroup}
        isManualEntry={item?.rawdata?.source === 'manual entry'}
      />
    </Box>
  );
}

export default SimDataGroupsTab;
