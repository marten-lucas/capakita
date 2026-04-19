import React from 'react';
import { Box } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import AccordionListDetail from '../../common/AccordionListDetail';
import GroupCards from './GroupCards';
import GroupDetail from './GroupDetail';
import { addGroup } from '../../../store/simGroupSlice';

function SimDataGroupsTab() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { isBasedScenario, getEffectiveGroupAssignments } = useOverlayData();

  if (!selectedItemId) return null;

  const groupAssignmentsObj = getEffectiveGroupAssignments(selectedItemId);
  const groups = Object.values(groupAssignmentsObj || {});

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
    <Box>
      <AccordionListDetail
        items={groups}
        SummaryComponent={({ item }) => <GroupCards item={item} />}
        DetailComponent={({ item, index }) => <GroupDetail group={item} index={index} />}
        AddButtonLabel="Gruppe zuweisen"
        onAdd={handleAddGroup}
        onDelete={handleDeleteGroup}
        emptyText="Keine Gruppenzuordnungen vorhanden."
      />
    </Box>
  );
}

export default SimDataGroupsTab;
