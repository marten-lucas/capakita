import { useState } from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
};

function DatenImportModal({ open, onClose, onImport }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnonymized, setIsAnonymized] = useState(true);

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleCheckboxChange = (event) => {
    setIsAnonymized(event.target.checked);
  };

  const handleInternalClose = () => {
    setSelectedFile(null);
    setIsAnonymized(false);
    onClose();
  };

  const handleImportClick = () => {
    if (selectedFile) {
      onImport({ file: selectedFile, isAnonymized });
      handleInternalClose();
    }
  };

return (
    <Modal open={open} onClose={handleInternalClose} aria-labelledby="import-modal-title">
        <Box sx={modalStyle}>
            <Typography id="import-modal-title" variant="h6" component="h2">
                Daten importieren
            </Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
                <Button variant="contained" component="label" startIcon={<FileUploadIcon />}>
                    ZIP-Datei auswählen
                    <input type="file" hidden accept=".zip,application/zip" onChange={handleFileChange} />
                </Button>
                {selectedFile && <Typography variant="body2">Ausgewählte Datei: {selectedFile.name}</Typography>}
                <FormControlLabel control={<Checkbox checked={isAnonymized} onChange={handleCheckboxChange}  />} label="anonymisiert" />
                <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
                    <Button onClick={handleInternalClose}>Abbrechen</Button>
                    <Button variant="contained" onClick={handleImportClick} disabled={!selectedFile}>
                        Importieren
                    </Button>
                </Stack>
            </Stack>
        </Box>
    </Modal>
);
}

export default DatenImportModal;