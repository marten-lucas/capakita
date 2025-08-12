import React, { useState } from 'react';
import { Box, Typography, Stack, Card, CardActionArea, CardContent, useTheme } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useNavigate } from 'react-router-dom';
import DataImportModal from '../components/modals/DataImportModal';
import ScenarioLoadDialog from '../components/modals/ScenarioLoadDialog';
import { useScenarioImport } from '../hooks/useScenarioImport';
import { useDispatch } from 'react-redux';
import { addScenario, setLoadDialogOpen } from '../store/simScenarioSlice';

function WelcomePage() {
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const { importScenario } = useScenarioImport();
  const theme = useTheme();

  const handleImport = async ({ file, isAnonymized }) => {
    await importScenario({ file, isAnonymized });
    setImportOpen(false);
    navigate('/data');
  };

  const handleLoadDone = () => {
    navigate('/data');
  };

  const handleAddEmptyScenario = () => {
    const newScenario = {
      name: 'Neues Szenario',
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null
    };
    dispatch(addScenario(newScenario));
    navigate('/data');
  };

  return (
    <Box
      sx={{
        minHeight: '80vh',
        height: { xs: 'calc(100vh - 56px)', md: 'calc(100vh - 64px)' }, // Adjust for navbar
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 0,
        px: 2,
        pb: { xs: 4, md: 6 }, // Add space at the bottom
      }}
    >
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '2 1 0%' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          width: '100%',
          maxWidth: 800,
          mt: { xs: 4, md: 0 },
        }}
      >
        {/* App Logo */}
        <Box
          sx={{
            width: { xs: '70vw', sm: 340, md: 480 },
            maxWidth: 480,
            mb: 2,
          }}
        >
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
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            mb: 1,
            textAlign: 'center',
            letterSpacing: '.1em',
            fontSize: { xs: 'clamp(1.5rem, 6vw, 2.5rem)', md: '2.5rem' },
          }}
        >
          ...was wäre wenn
        </Typography>
        {/* Wertversprechen */}
        <Typography
          variant="h6"
          sx={{
            maxWidth: { xs: "100%", md: "80%" },
            textAlign: 'center',
            color: 'text.secondary',
            mb: 0,
            fontSize: { xs: 'clamp(1rem, 3vw, 1.25rem)', md: '1.25rem' },
          }}
        >
          CapaKita hilft Ihnen als Träger oder Leitung eines Kindergartens in Bayern, Personalkapazitäten und Betreuungsbedarf in Ihrer Kita einfach und flexibel zu simulieren. Importieren Sie Ihre Daten, spielen Sie verschiedene Szenarien durch und treffen Sie fundierte Entscheidungen für die Zukunft.
        </Typography>
      </Box>
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '1 1 0%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          mt: { xs: 4, md: 6 },
          mb: { xs: 2, md: 3 }, // Move buttons upwards
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{
            width: '100%',
            maxWidth: 800,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Card
            sx={{
              minWidth: { xs: 260, sm: 300 },
              width: { xs: '90vw', sm: 300 },
              maxWidth: 400,
              bgcolor: theme.palette.primary.light,
              boxShadow: 3,
              borderRadius: 3,
              textAlign: 'center'
            }}
          >
            <CardActionArea onClick={() => setImportOpen(true)}>
              <CardContent>
                <FileUploadIcon sx={{ fontSize: 56, color: "#fff", mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.primary.contrastText }}>
                  Adebis-Daten importieren
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
          <Card
            sx={{
              minWidth: { xs: 260, sm: 300 },
              width: { xs: '90vw', sm: 300 },
              maxWidth: 400,
              bgcolor: theme.palette.secondary.light,
              boxShadow: 3,
              borderRadius: 3,
              textAlign: 'center'
            }}
          >
            <CardActionArea onClick={() => dispatch(setLoadDialogOpen(true))}>
              <CardContent>
                <FolderOpenIcon sx={{ fontSize: 56, color: "#fff", mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.secondary.contrastText }}>
                  CapaKita-Datei laden
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
          <Card
            sx={{
              minWidth: { xs: 260, sm: 300 },
              width: { xs: '90vw', sm: 300 },
              maxWidth: 400,
              bgcolor: theme.palette.success.light,
              boxShadow: 3,
              borderRadius: 3,
              textAlign: 'center'
            }}
          >
            <CardActionArea onClick={handleAddEmptyScenario}>
              <CardContent>
                <AddCircleOutlineIcon sx={{ fontSize: 56, color: "#fff", mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.success.contrastText }}>
                  Leeres Szenario anlegen
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Stack>
      </Box>
      {/* Dialoge */}
      <DataImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
      <ScenarioLoadDialog onLoaded={handleLoadDone} />
    </Box>
  );
}

export default WelcomePage;


