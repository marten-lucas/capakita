import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
  Link,
  Modal
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * DataImportModal Component
 * This component encapsulates the entire data processing UI, displayed within a Material-UI Modal.
 * It receives all necessary state and handler functions as props from its parent.
 */
function DataImportModal({
  open,
  onClose,
  isAnonymized,
  setIsAnonymized,
  xmlFiles,
  zipFileName,
  error,
  processing,
  downloadUrl,
  processingMessage,
  handleFileChange,
  handleUploadClick,
  handleProcessAndDownload,
  fileInputRef // Passed directly to the input element
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="data-processing-modal-title"
      aria-describedby="data-processing-modal-description"
    >
      <Container maxWidth="md"
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%', // Responsive width
          maxHeight: '90vh', // Max height to prevent overflow
          overflowY: 'auto', // Enable scrolling if content is too long
          bgcolor: 'background.paper',
          border: '2px solid #000',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
          outline: 'none', // Remove outline on focus
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }} id="data-processing-modal-title">
          Daten hochladen und verarbeiten
        </Typography>

        <Box
          sx={{
            border: '1px dashed grey',
            p: 3,
            borderRadius: 2,
            textAlign: 'center',
            mb: 4,
            bgcolor: 'background.paper',
            boxShadow: 3,
          }}
        >
          <input
            type="file"
            ref={fileInputRef} // Using the ref passed from parent
            onChange={handleFileChange}
            accept=".zip"
            style={{ display: 'none' }}
          />
          <Button
            variant="contained"
            onClick={handleUploadClick}
            startIcon={<UploadFileIcon />}
            disabled={processing}
            sx={{ mr: 2 }}
          >
            ZIP-Datei auswählen
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                checked={isAnonymized}
                onChange={(e) => setIsAnonymized(e.target.checked)}
                disabled={processing || xmlFiles.length === 0}
              />
            }
            label="Daten anonymisieren"
            sx={{ ml: 2 }}
          />

          {processing && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 3 }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {processingMessage || 'Lade oder verarbeite Dateien...'}
              </Typography>
            </Box>
          )}
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
          {processingMessage && !error && !processing && (
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                  {processingMessage}
              </Typography>
          )}
        </Box>

        {xmlFiles.length > 0 && (
          <Box sx={{ mt: 4, p: 3, borderRadius: 2, boxShadow: 3, bgcolor: 'background.paper' }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Enthaltene XML-Dateien in: <Typography component="span" variant="h6" color="primary">{zipFileName}</Typography>
            </Typography>
            <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #eee', borderRadius: 1, mb: 2 }}>
              {xmlFiles.map((fileName) => (
                <ListItem key={fileName} divider>
                  <ListItemIcon>
                    <DescriptionIcon color="action" />
                  </ListItemIcon>
                  <ListItemText primary={fileName} />
                </ListItem>
              ))}
            </List>
            <Button
              variant="contained"
              color="primary"
              onClick={handleProcessAndDownload}
              startIcon={<DownloadIcon />}
              disabled={processing || xmlFiles.length === 0}
              sx={{ mt: 2, py: 1.5, px: 3 }}
            >
              Verarbeiten und ZIP herunterladen
            </Button>
            {downloadUrl && (
              <Box sx={{ mt: 3, p: 2, border: '1px dashed #ccc', borderRadius: 1, bgcolor: 'action.hover' }}>
                <Typography variant="body1" gutterBottom>
                  Fertig! Hier ist Ihre verarbeitete Datei:
                </Typography>
                <Link href={downloadUrl} download={`processed_${zipFileName}`} variant="button" underline="none">
                  <Button variant="outlined" startIcon={<DownloadIcon />} color="success" sx={{ mt: 1, py: 1, px: 2 }}>
                    {`processed_${zipFileName}`}
                  </Button>
                </Link>
              </Box>
            )}
          </Box>
        )}
      </Container>
    </Modal>
  );
}

export default DataImportModal;
