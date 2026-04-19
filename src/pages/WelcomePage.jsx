import React, { useState } from 'react';
import { Title, Text, Stack, Card, Group, ThemeIcon, Container, Center, Box, Image } from '@mantine/core';
import { IconUpload, IconFolderOpen, IconPlus } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import DataImportModal from '../components/modals/DataImportModal';
import { useDispatch } from 'react-redux';
import { addScenario, setLoadDialogOpen } from '../store/simScenarioSlice';

function WelcomePage() {
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleAddEmptyScenario = () => {
    dispatch(addScenario({
      name: 'Neues Szenario',
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null
    }));
    navigate('/data');
  };

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="xl" mt="xl">
        <Stack align="center" gap="xs">
          <Box w={{ base: '100%', sm: 400 }}>
             <Image src="CapaKita_Visual.svg" alt="CapaKita Logo" />
          </Box>
          <Title order={1} size="h3" fw={700} lts="0.1em" ta="center">
            ...was wäre wenn
          </Title>
        </Stack>

        <Stack gap="md" w="100%">
          <Card 
            shadow="sm" 
            padding="lg" 
            radius="md" 
            withBorder 
            component="button" 
            onClick={() => setImportOpen(true)}
            style={{ textAlign: 'left', cursor: 'pointer', background: 'transparent' }}
          >
            <Group>
              <ThemeIcon size="xl" radius="md" variant="light" color="blue">
                <IconUpload size={24} />
              </ThemeIcon>
              <div style={{ flex: 1 }}>
                <Text fw={700}>Daten importieren</Text>
                <Text size="sm" c="dimmed">Adebis ZIP Export einspielen</Text>
              </div>
            </Group>
          </Card>

          <Card 
            shadow="sm" 
            padding="lg" 
            radius="md" 
            withBorder 
            component="button" 
            onClick={() => dispatch(setLoadDialogOpen(true))}
            style={{ textAlign: 'left', cursor: 'pointer', background: 'transparent' }}
          >
            <Group>
              <ThemeIcon size="xl" radius="md" variant="light" color="green">
                <IconFolderOpen size={24} />
              </ThemeIcon>
              <div style={{ flex: 1 }}>
                <Text fw={700}>Szenario laden</Text>
                <Text size="sm" c="dimmed">Gespeichertes Szenario aus Datei öffnen</Text>
              </div>
            </Group>
          </Card>

          <Card 
            shadow="sm" 
            padding="lg" 
            radius="md" 
            withBorder 
            component="button" 
            onClick={handleAddEmptyScenario}
            style={{ textAlign: 'left', cursor: 'pointer', background: 'transparent' }}
          >
            <Group>
              <ThemeIcon size="xl" radius="md" variant="light" color="orange">
                <IconPlus size={24} />
              </ThemeIcon>
              <div style={{ flex: 1 }}>
                <Text fw={700}>Leeres Szenario</Text>
                <Text size="sm" c="dimmed">Ohne Importdaten starten</Text>
              </div>
            </Group>
          </Card>
        </Stack>
      </Stack>

      <DataImportModal opened={importOpen} onClose={() => setImportOpen(false)} />
    </Container>
  );
}

export default WelcomePage;
