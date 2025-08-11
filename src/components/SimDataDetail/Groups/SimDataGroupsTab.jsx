import React from 'react';
import { Typography, Box } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import AccordionListDetail from '../../common/AccordionListDetail';
import GroupCards from './GroupCards';
import GroupDetail from './GroupDetail';
import AddIcon from '@mui/icons-material/Add';
import { addGroup } from '../../../store/simGroupSlice';

function SimDataGroupsTab() {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { isBasedScenario, getEffectiveGroupAssignments } = useOverlayData();

  if (!selectedItemId) return null;

  // Get overlay-aware group assignments for this item
  const groupAssignmentsObj = getEffectiveGroupAssignments(selectedItemId);
  const groups = Object.values(groupAssignmentsObj || {});

  // Add group handler
  const handleAddGroup = () => {
    if (!selectedItemId || !selectedScenarioId) return;
    const newGroupId = Date.now().toString();
    const newGroup = {
      id: newGroupId,
      kindId: selectedItemId,
      groupId: '',
      start: '',
      end: '',
    };
    if (isBasedScenario) {
      dispatch({
        type: 'simOverlay/setGroupAssignmentOverlay',
        payload: {
          scenarioId: selectedScenarioId,
          itemId: selectedItemId,
          groupId: newGroupId,
          overlayData: newGroup
        }
      });
    } else {
      dispatch(addGroup({
        scenarioId: selectedScenarioId,
        dataItemId: selectedItemId,
        group: newGroup
      }));
    }
  };

  // Delete group handler
  const handleDeleteGroup = (idx, group) => {
    if (!group) return;
    dispatch({
      type: 'simGroup/deleteGroup',
      payload: {
        scenarioId: selectedScenarioId,
        dataItemId: selectedItemId,
        groupId: group.id
      }
    });
  };

  return (
    <Box
      flex={1}
      display="flex"
      flexDirection="column"
      gap={2}
      sx={{ overflowY: 'auto', height: '100%', minHeight: 0 }}
    >
      <AccordionListDetail
        items={groups}
        SummaryComponent={GroupCards}
        DetailComponent={({ item, index }) => <GroupDetail group={item} index={index} />}
        AddButtonLabel="Gruppe zuweisen"
        onAdd={handleAddGroup}
        onDelete={handleDeleteGroup}
        AddButtonProps={{ startIcon: <AddIcon /> }}
        emptyText="Keine Gruppenzuordnungen vorhanden."
      />
    </Box>
  );
}

export default SimDataGroupsTab;


