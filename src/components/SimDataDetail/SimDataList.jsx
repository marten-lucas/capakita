import React, { useMemo } from 'react';
import { Group, Avatar, Badge, Text, ActionIcon, Stack, Tooltip } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { deleteDataItemThunk } from '../../store/simDataSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { IconTrash, IconUser, IconBabyCarriage, IconChevronRight } from '@tabler/icons-react';
import { getDateRangeString } from '../../utils/dateUtils';
import { sumBookingHours } from '../../utils/bookingUtils';
import { getEffectiveGroupAssignments, getScenarioChain } from '../../utils/overlayUtils';
import TabbedListDetail from '../common/TabbedListDetail';
import SimDataTabs from './SimDataTabs';
import GroupIcon from '../common/GroupIcon';

function SimDataList() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const groupsByScenario = useSelector(state => state.simGroup.groupsByScenario);

  const scenarioChain = useMemo(
    () => getScenarioChain(scenarios, selectedScenarioId),
    [scenarios, selectedScenarioId]
  );

  const {
    getEffectiveDataItems,
    hasOverlay,
    getEffectiveGroupDefs,
    getEffectiveBookings,
    getEffectiveQualificationDefs,
    getEffectiveQualificationAssignments
  } = useOverlayData();

  const effectiveDataItems = getEffectiveDataItems();
  const groupDefs = getEffectiveGroupDefs();
  const qualificationDefs = getEffectiveQualificationDefs();

  const data = useMemo(
    () =>
      Object.entries(effectiveDataItems).map(([key, item]) => ({
        ...item,
        id: key,
        _key: key,
      })),
    [effectiveDataItems]
  );

  const getGroupDef = (groupId) => groupId ? groupDefs.find(g => String(g.id) === String(groupId)) : null;

  const renderItem = (item) => {
    const bookings = Object.values(getEffectiveBookings(item._key));
    const subtitle = bookings.length > 0 ? getDateRangeString(bookings[0].startdate, bookings[0].enddate, sumBookingHours(bookings[0])) : '';
    
    const groupAssignments = getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, item._key);
    const assignments = groupAssignments ? Object.values(groupAssignments) : [];
    const groupAssignment = assignments.find(a => !a.end) || assignments[0];
    const groupDef = groupAssignment ? getGroupDef(groupAssignment.groupId) : null;

    const isExpert = item.type === 'capacity' && getEffectiveQualificationAssignments(item._key).some(a => {
        const def = qualificationDefs.find(d => d.key === a.qualification);
        return def?.IsExpert !== false;
    });

    return (
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group wrap="nowrap">
          <Avatar color={item.type === 'demand' ? 'cyan' : 'green'} radius="xl">
            {groupDef?.icon ? (
              <GroupIcon icon={groupDef.icon} size={16} />
            ) : item.type === 'demand' ? (
              <IconBabyCarriage size={20} />
            ) : (
              <IconUser size={20} />
            )}
          </Avatar>
          <div>
            <Group gap={5}>
                <Text size="sm" fw={500}>{item.name}</Text>
                {hasOverlay(item._key) && <Badge size="xs" color="orange" variant="light">Neu</Badge>}
            </Group>
            <Text size="xs" c="dimmed">{subtitle}</Text>
          </div>
        </Group>
        
        <Group gap={4}>
            {item.type === 'capacity' && getEffectiveQualificationAssignments(item._key).map(a => (
                <Badge key={a.id} size="xs" variant="outline" color={isExpert ? 'blue' : 'gray'}>
                    {qualificationDefs.find(d => d.key === a.qualification)?.initial || a.qualification}
                </Badge>
            ))}
            <IconChevronRight size={14} color="gray" />
        </Group>
      </Group>
    );
  };

  return (
    <TabbedListDetail
      data={data}
      selectedId={selectedItemId}
      onSelect={(id) => dispatch(setSelectedItem(id))}
      renderItem={renderItem}
      detailTitle={(item) => item?.name || 'Details'}
      detailContent={() => <SimDataTabs />}
      actions={(item) => (
        <Group gap="xs">
          <Tooltip label="Löschen">
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => dispatch(deleteDataItemThunk({ scenarioId: selectedScenarioId, itemId: item._key }))}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
    />
  );
}

export default SimDataList;
