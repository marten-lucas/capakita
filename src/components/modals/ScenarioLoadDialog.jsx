import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setLoadDialogOpen } from '../../store/simScenarioSlice';
import DataImportModal from './DataImportModal';

function ScenarioLoadDialog() {
  const dispatch = useDispatch();
  const opened = useSelector(state => state.simScenario.loadDialogOpen);

  const handleClose = () => {
    dispatch(setLoadDialogOpen(false));
  };

  return (
    <DataImportModal
      opened={opened}
      onClose={handleClose}
      title="Szenario laden"
      requirePasswordConfirmation
    />
  );
}

export default ScenarioLoadDialog;
