import React, { useMemo } from 'react';
import { Box, Chip, Avatar, Tooltip } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { deleteDataItemThunk } from '../../store/simDataSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import RestoreButton from './RestoreButton';
import { getDateRangeString } from '../../utils/dateUtils';
import { sumBookingHours } from '../../utils/bookingUtils';
import { getEffectiveGroupAssignments, getScenarioChain } from '../../utils/overlayUtils';
import TabbedListDetail from '../common/TabbedListDetail';
import SimDataTabs from './SimDataTabs';

// Use a constant for empty object to avoid new reference on each render
const EMPTY_OBJECT = {};

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
    isBasedScenario,
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
        id: key,     // required by TabbedListDetail
        _key: key,   // keep for lookups
      })),
    [effectiveDataItems]
  );

  // Helpers
  function getGroupDef(groupId) {
    if (!groupId) return null;
    return groupDefs.find(g => String(g.id) === String(groupId));
  }

  function getBookings(itemId) {
    const bookingsObj = getEffectiveBookings(itemId);
    return bookingsObj ? Object.values(bookingsObj) : [];
  }

  function getSubtitle(item) {
    const bookings = getBookings(item._key);
    if (!bookings.length) return '';
    const booking = bookings[0];
    const hours = sumBookingHours(booking);
    return getDateRangeString(booking.startdate, booking.enddate, hours);
  }

  function getAvatar(item) {
    const groupAssignments = getEffectiveGroupAssignments(
      scenarioChain,
      overlaysByScenario,
      groupsByScenario,
      item._key
    );
    const assignments = groupAssignments ? Object.values(groupAssignments) : [];
    const groupAssignment = assignments.length === 0 ? null : assignments.find(a => !a.end) || assignments[0];
    const groupDef = groupAssignment ? getGroupDef(groupAssignment.groupId) : null;
    const DEMAND_COLOR = '#ced7d9ff';
    const CAPACITY_COLOR = '#d9ddd9dd';
    const color = item.type === 'demand' ? DEMAND_COLOR : CAPACITY_COLOR;
    let icon = null;
    if (groupDef && groupDef.icon) {
      icon = groupDef.icon;
    } else if (item.type === 'capacity') {
      icon = <PersonIcon fontSize="small" />;
    } else if (item.type === 'demand') {
      icon = <ChildCareIcon fontSize="small" />;
    }
    return (
      <Avatar sx={{ bgcolor: color, color: '#222', width: 32, height: 32, fontSize: 22 }}>
        {typeof icon === 'string' ? icon : icon}
      </Avatar>
    );
  }

  function getSourceChip(item) {
    if (item.source && item.source.toLowerCase().includes('adebis')) {
      return <Chip label="Importiert" size="small" color="info" sx={{ fontSize: '0.7rem', height: 20 }} />;
    }
    return <Chip label="Manuell" size="small" color="default" sx={{ fontSize: '0.7rem', height: 20 }} />;
  }

  function getQualificationChips(item) {
    if (item.type !== 'capacity') return null;
    const qualificationAssignments = getEffectiveQualificationAssignments(item._key);
    if (!qualificationAssignments || qualificationAssignments.length === 0) return null;

    return qualificationAssignments.map((assignment, index) => {
      const qualificationDef = qualificationDefs.find(def => def.key === assignment.qualification);
      const displayName = qualificationDef?.initial || qualificationDef?.name || assignment.qualification;
      const isExpert = qualificationDef?.IsExpert !== false;

      return (
        <Chip
          key={`${assignment.qualification}-${index}`}
          label={displayName}
          size="small"
          color={isExpert ? 'primary' : 'secondary'}
          variant="outlined"
          sx={{ fontSize: '0.6rem', height: 18, mr: 0.5 }}
        />
      );
    });
  }

  const handleRestore = (itemId, isBasedScenario, scenarios, data) => {
    if (isBasedScenario) {
      dispatch({ type: 'simOverlay/removeDataItemOverlay', payload: { scenarioId: selectedScenarioId, itemId } });
      dispatch({ type: 'simOverlay/removeBookingOverlay', payload: { scenarioId: selectedScenarioId, itemId } });
      dispatch({ type: 'simOverlay/removeGroupAssignmentOverlay', payload: { scenarioId: selectedScenarioId, itemId } });
      dispatch({ type: 'simOverlay/removeQualificationDefOverlay', payload: { scenarioId: selectedScenarioId } });
    } else {
      const state = window.store?.getState?.() || {};
      const allScenarios = state.simScenario?.scenarios || [];
      const importedScenarios = allScenarios.filter(s => s.imported);
      let importedItem = null;
      for (const s of importedScenarios) {
        importedItem = Object.values(state.simData?.dataByScenario?.[s.id] || {}).find(
          i =>
            i.adebisId &&
            data.find(d => d._key === itemId)?.adebisId &&
            i.adebisId.id === data.find(d => d._key === itemId)?.adebisId.id &&
            i.adebisId.source === data.find(d => d._key === itemId)?.adebisId.source
        );
        if (importedItem) break;
      }
      if (importedItem) {
        dispatch({
          type: 'simData/updateDataItem',
          payload: {
            scenarioId: selectedScenarioId,
            itemId,
            updates: {
              ...importedItem,
              id: itemId
            }
          }
        });
      }
    }
  };

  // Item renderers for TabbedListDetail
  const ItemTitle = item => item.name || '';
  const ItemSubTitle = item => getSubtitle(item);
  const ItemChips = item => (
    <>
      {isBasedScenario && hasOverlay(item._key) && (
        <Chip
          label="Geändert"
          size="small"
          color="warning"
          variant="outlined"
          sx={{ fontSize: '0.6rem', height: 20 }}
        />
      )}
      {getSourceChip(item)}
      {getQualificationChips(item)}
    </>
  );
  const ItemAvatar = item => (
    <Tooltip title={item.type === 'demand' ? 'Kind' : 'Mitarbeiter'}>
      {getAvatar(item)}
    </Tooltip>
  );
  const ItemHoverIcons = item => [
    {
      icon: (
        <RestoreButton
          scenarioId={selectedScenarioId}
          itemId={item._key}
          onRestore={() => handleRestore(item._key, isBasedScenario, scenarios, data)}
        />
      ),
      title: 'Zurücksetzen',
      onClick: () => handleRestore(item._key, isBasedScenario, scenarios, data)
    },
    {
      icon: <DeleteIcon fontSize="small" />,
      title: 'Löschen',
      onClick: () => dispatch(deleteDataItemThunk({ scenarioId: selectedScenarioId, itemId: item._key }))
    }
  ];
  const ItemAddButton = null; // No add button

  return (
    <TabbedListDetail
      items={data}
      ItemTitle={ItemTitle}
      ItemSubTitle={ItemSubTitle}
      ItemChips={ItemChips}
      ItemAvatar={ItemAvatar}
      ItemHoverIcons={ItemHoverIcons}
      ItemAddButton={ItemAddButton}
      Detail={SimDataTabs}
      emptyText="Importieren Sie Adebis-Daten oder fügen Sie Datensätze manuell hinzu"
      getLevel={() => 0}
      // Controlled selection: store and read from Redux
      selectedId={selectedItemId || data[0]?.id}
      onSelect={(id) => dispatch(setSelectedItem(id))}
    />
  );
}

export default SimDataList;
 