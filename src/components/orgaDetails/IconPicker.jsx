import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import EmojiPicker from 'emoji-picker-react';

function IconPicker({ value, onChange, disabled = false }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEmojiClick = (emojiObject) => {
    onChange(emojiObject.emoji);
    setDialogOpen(false);
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5em',
            backgroundColor: 'background.paper'
          }}
        >
          {value || '👥'}
        </Box>
        <IconButton
          size="small"
          onClick={() => setDialogOpen(true)}
          disabled={disabled}
          title="Icon ändern"
        >
          <EditIcon />
        </IconButton>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Icon auswählen</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              autoFocusSearch={false}
              searchDisabled={false}
              skinTonesDisabled={true}
              width={400}
              height={400}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Abbrechen</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default IconPicker;