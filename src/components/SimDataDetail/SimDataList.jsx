import React, { useState } from 'react';
import { Box, Typography, Stack, Card, CardActionArea, CardContent } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useNavigate } from 'react-router-dom';
import DataImportModal from '../components/modals/DataImportModal';
import ScenarioLoadDialog from '../components/modals/ScenarioLoadDialog.jsx';
import { useScenarioImport } from '../hooks/useScenarioImport';
import { useSelector, useDispatch } from 'react-redux';
import { addScenario, setSelectedScenarioId } from '../store/simScenarioSlice';

function WelcomePage() {
  const [importOpen, setImportOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const { importScenario } = useScenarioImport();

  // Selector für die Daten, memoized

  // Handler für DataImportModal
  const handleImport = async ({ file, isAnonymized }) => {
    await importScenario({ file, isAnonymized });
    setImportOpen(false);
    navigate('/data');
  };

  // Nach Abschluss immer zu /data navigieren
  const handleLoadDone = () => {
    setLoadOpen(false);
    navigate('/data');
  };

  // Neues leeres Szenario direkt anlegen und auswählen
  const handleAddEmptyScenario = () => {
    const newScenario = {
      name: 'Neues Szenario',
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null
    };
    dispatch(addScenario(newScenario));
    // Setze das neue Szenario als ausgewählt
    const lastScenario = scenarios[scenarios.length - 1];
    if (lastScenario) {
      dispatch(setSelectedScenarioId(lastScenario.id));
    }
    navigate('/data');
  };

  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        py: 6,
      }}
    >
      {/* App Logo */}
      <Box sx={{ width: '100%', maxWidth: 480, mb: 2 }}>
        <img
          src="CapaKita_Visual.svg"
          alt="CapaKita Logo"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            margin: '0 auto',
          }}
        />
      </Box>
      {/* Claim */}
      <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, textAlign: 'center', letterSpacing: '.1em' }}>
        ...was wäre wenn
      </Typography>
      {/* Wertversprechen */}
      <Typography variant="h6" sx={{ maxWidth: "80%", textAlign: 'center', color: 'text.secondary', mb: 0 }}>
        CapaKita hilft Ihnen, Personalkapazitäten und Betreuungsbedarf in Ihrer Kita einfach und flexibel zu simulieren. Importieren Sie Ihre Daten, spielen Sie verschiedene Szenarien durch und treffen Sie fundierte Entscheidungen für die Zukunft.
      </Typography>
      {/* Cards statt Buttons */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mt: 2, width: '100%', justifyContent: 'center' }}>
        <Card
          sx={{
            minWidth: 220,
            bgcolor: '#e3f2fd',
            boxShadow: 3,
            borderRadius: 3,
            textAlign: 'center'
          }}
        >
          <CardActionArea onClick={() => setImportOpen(true)}>
            <CardContent>
              <FileUploadIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Adebis-Daten importieren
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card
          sx={{
            minWidth: 220,
            bgcolor: '#e8f5e9',
            boxShadow: 3,
            borderRadius: 3,
            textAlign: 'center'
          }}
        >
          <CardActionArea onClick={() => setLoadOpen(true)}>
            <CardContent>
              <FolderOpenIcon sx={{ fontSize: 56, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                CapaKita-Datei laden,
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card
          sx={{
            minWidth: 220,
            bgcolor: '#e8f5e9',
            boxShadow: 3,
            borderRadius: 3,
            textAlign: 'center'
          }}
        >
          <CardActionArea onClick={handleAddEmptyScenario}>
            <CardContent>
              <AddCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Leeres Szenario anlegen,
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Stack>
      {/* Dialoge */}
      <DataImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
      <ScenarioLoadDialog open={loadOpen} onClose={() => setLoadOpen(false)} onLoaded={handleLoadDone} />
    </Box>
  );
}

export default WelcomePage;