import { Anchor, Button, Card, Container, Group, List, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

function LegalPage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>Impressum & Datenschutz</Title>
            <Text c="dimmed" mt={4}>
              Rechtliche Angaben zu CapaKita
            </Text>
          </div>

          <Button
            component={Link}
            to="/"
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
          >
            Zurück
          </Button>
        </Group>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm">
            <Title order={2}>Impressum</Title>
            <Text fw={600}>St. Johannesverein Gramschatz e. V.</Text>
            <Text>Träger des Ahorn-Kindergarten Gramschatz</Text>
            <Text>Schulzengasse 12<br />97222 Gramschatz</Text>
            <Text>Telefon: 09363 / 1512</Text>
            <Text>
              E-Mail:{' '}
              <Anchor href="mailto:info@kiga-gramschatz.de">info@kiga-gramschatz.de</Anchor>
            </Text>
            <Text>
              Der St. Johannesverein Gramschatz e. V. ist ein gemeinnütziger Verein und wird
              durch zwei Vorstandsmitglieder vertreten, darunter immer der 1. oder 2. Vorstand.
            </Text>
            <Text>
              Inhaltlich verantwortlich für CapaKita und diesen Internetauftritt ist der
              St. Johannesverein Gramschatz e. V., Anschrift wie oben.
            </Text>
            <Text>
              CapaKita wurde vom Vorstand des St. Johannesvereins als digitale Anwendung zur
              kapazitätsbezogenen Szenario- und Planungsunterstützung entwickelt.
            </Text>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm">
            <Title order={2}>Datenschutz</Title>
            <Text>
              Der Schutz personenbezogener Daten ist uns wichtig. CapaKita ist als reine
              Client-Anwendung konzipiert. Die fachlichen Daten, die Sie in der Anwendung
              eingeben, importieren oder bearbeiten, werden ausschließlich lokal im Browser auf
              Ihrem Endgerät verarbeitet.
            </Text>
            <Text>
              Eine inhaltliche Übermittlung an den Anbieter sowie eine serverseitige Speicherung
              oder Auswertung dieser Anwendungsdaten durch CapaKita finden nicht statt.
            </Text>
            <Text>
              Eine dauerhafte Speicherung erfolgt nur, wenn Sie dies selbst veranlassen, etwa
              durch den Export einer verschlüsselten Szenariodatei auf Ihr eigenes Endgerät.
            </Text>
            <Text>
              Beim bloßen Aufruf der Website können durch den Hosting-Provider technisch
              erforderliche Verbindungsdaten verarbeitet werden, insbesondere IP-Adresse,
              Zeitpunkt des Zugriffs sowie Informationen zum verwendeten Browser und
              Betriebssystem. Diese Verarbeitung dient ausschließlich der sicheren Bereitstellung
              der Website.
            </Text>
            <Text>
              CapaKita verwendet keine Benutzerkonten, keine serverseitigen Formulareingaben und
              keine Analyse- oder Trackingdienste zur Auswertung Ihres Nutzungsverhaltens.
            </Text>
            <Text>
              Soweit kirchliches Datenschutzrecht anwendbar ist, richten sich Ihre Rechte
              insbesondere nach dem Gesetz über den kirchlichen Datenschutz (KDG). Für Anfragen
              zum Datenschutz können Sie die oben genannten Kontaktdaten verwenden.
            </Text>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm">
            <Title order={3}>Hinweise</Title>
            <List spacing="xs">
              <List.Item>Es werden keine Anwendungsdaten an den Verein übertragen.</List.Item>
              <List.Item>Importierte Dateien werden ausschließlich lokal im Browser verarbeitet.</List.Item>
              <List.Item>Exportierte Sicherungen werden von Ihnen selbst auf Ihrem Gerät gespeichert.</List.Item>
            </List>
            <Text size="sm" c="dimmed">
              Stand: April 2026
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

export default LegalPage;
