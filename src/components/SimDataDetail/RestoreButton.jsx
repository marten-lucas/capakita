import React from 'react';
import { IconButton, Tooltip, Dialog, DialogTitle, DialogActions, Button } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { useIsRestorable } from '../../hooks/useIsRestorable';
import { useDispatch } from 'react-redux';
import { restoreDataItemThunk } from '../../store/simDataSlice';

function RestoreButton({ scenarioId, itemId, onRestore }) {
  const isRestorable = useIsRestorable(scenarioId, itemId);
  const [open, setOpen] = React.useState(false);
  const dispatch = useDispatch();

  if (!isRestorable) return null;

  return (
    <>
      <Tooltip title="Auf Original zurücksetzen">
        <IconButton
          size="small"
          onClick={e => {
            e.stopPropagation();
            setOpen(true);
          }}
          sx={{ ml: 1 }}
        >
          <RestoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>
          Möchten Sie diesen Eintrag und alle zugehörigen Daten wirklich auf den Ursprungszustand zurücksetzen?
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() => {
              setOpen(false);
              dispatch(restoreDataItemThunk({ scenarioId, itemId }));
              if (onRestore) onRestore();
            }}
          >
            Wiederherstellen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default RestoreButton;
