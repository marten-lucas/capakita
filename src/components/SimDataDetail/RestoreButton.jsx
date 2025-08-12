import React from 'react';
import { Tooltip, Dialog, DialogTitle, DialogActions, Button } from '@mui/material';
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
      <Tooltip title="Auf Original zurücksetzen" placement="right">
        <div
          role="button"
          tabIndex={0}
          onClick={e => {
            e.stopPropagation();
            setOpen(true);
          }}
          onKeyPress={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              setOpen(true);
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
            width: 32,
            height: 32,
            borderRadius: '50%',
            cursor: 'pointer',
            transition: 'background 0.2s',
            background: 'none',
            outline: 'none',
          }}
          aria-label="Auf Original zurücksetzen"
        >
          <RestoreIcon fontSize="small" />
        </div>
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
