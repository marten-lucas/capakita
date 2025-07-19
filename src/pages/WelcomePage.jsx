import React, { useState } from 'react';
import { Box, Typography, Stack, Card, CardActionArea, CardContent } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useNavigate } from 'react-router-dom';
import DataImportModal from '../components/modals/DataImportModal';
import LoadDataDialog from '../components/modals/LoadDataDialog';
import AddScenarioDialog from '../components/modals/AddScenarioDialog';
import { extractAdebisZipAndData } from '../utils/adebis-import.js';
import useSimScenarioStore from '../store/simScenarioStore';
import useAppSettingsStore from '../store/appSettingsStore';

function WelcomePage() {
  const [importOpen, setImportOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [addScenarioOpen, setAddScenarioOpen] = useState(false);
  const navigate = useNavigate();

  const addScenario = useSimScenarioStore(state => state.addScenario);
  const setSelectedScenarioId = useSimScenarioStore(state => state.setSelectedScenarioId);
  const importGroupsFromAdebis = useAppSettingsStore(state => state.importGroupsFromAdebis);
  const importQualificationsFromEmployees = useAppSettingsStore(state => state.importQualificationsFromEmployees);

  // Handler für DataImportModal
  const handleImport = async ({ file, isAnonymized }) => {
    const { processedData  } = await extractAdebisZipAndData(
      file,
      isAnonymized,
      importGroupsFromAdebis,
      importQualificationsFromEmployees
    );

    // Szenario anlegen wie in SimDatenPage
    const scenarioName = isAnonymized ? 'Importiertes Szenario (anonymisiert)' : 'Importiertes Szenario';
    const newScenario = {
      name: scenarioName,
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null,
      simulationData: processedData
    };
    addScenario(newScenario);
    // Setze das neue Szenario als ausgewählt
    const scenarios = useSimScenarioStore.getState().scenarios;
    const lastScenario = scenarios[scenarios.length - 1];
    if (lastScenario) {
      setSelectedScenarioId(lastScenario.id);
    }
    setImportOpen(false);
    navigate('/data');
  };

  // Nach Abschluss immer zu /data navigieren
  const handleLoadDone = () => {
    setLoadOpen(false);
    navigate('/data');
  };
  const handleAddScenarioDone = () => {
    setAddScenarioOpen(false);
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
          src="/CapaKita_Visual.svg"
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
      <Typography variant="h6" sx={{ maxWidth: 540, textAlign: 'center', color: 'text.secondary', mb: 3 }}>
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
            bgcolor: '#f3e5f5',
            boxShadow: 3,
            borderRadius: 3,
            textAlign: 'center'
          }}
        >
          <CardActionArea onClick={() => setLoadOpen(true)}>
            <CardContent>
              <FolderOpenIcon sx={{ fontSize: 56, color: 'secondary.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                CapaKita-Datei laden
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
          <CardActionArea onClick={() => setAddScenarioOpen(true)}>
            <CardContent>
              <AddCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Leeres Szenario anlegen
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Stack>
      {/* Dialoge */}
      <DataImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
      <LoadDataDialog open={loadOpen} onClose={() => setLoadOpen(false)} onLoaded={handleLoadDone} />
      <AddScenarioDialog open={addScenarioOpen} onClose={() => setAddScenarioOpen(false)} onAdded={handleAddScenarioDone} />
    </Box>
  );
}

export default WelcomePage;
 