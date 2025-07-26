import React from 'react';
import { Box } from '@mui/material';
import EmojiPicker from 'emoji-picker-react';

function IconPicker({ onChange }) {
  const handleEmojiClick = (emojiObject) => {
    onChange(emojiObject.emoji);
  };

  return (
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
  );
}

export default IconPicker;