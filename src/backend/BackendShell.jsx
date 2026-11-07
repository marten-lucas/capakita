import { useEffect, useState } from 'react';
import { Alert, Anchor, Box, Button, Center, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { logoutFromSharedWorkspace, retrySharedStorageSave, subscribeSharedStorageStatus } from './sharedStorage';

const AUTH_ERRORS = {
  configuration: 'Die Anmeldung ist nicht konfiguriert. Bitte prüfe die Authentik-/Coolify-Einstellungen.',
  not_allowed: 'Dein Authentik-Konto ist nicht für diesen CapaKita-Workspace freigeschaltet.',
  login_failed: 'Die Anmeldung über Authentik ist fehlgeschlagen. Bitte versuche es erneut.',
};

function LoginScreen({ error, onRetry }) {
  const authError = new URLSearchParams(window.location.search).get('auth_error');
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" radius="md" p="xl" w="min(100%, 440px)">
        <Stack>
          <Title order={2}>CapaKita</Title>
          <Text c="dimmed">Melde dich über Authentik an, um den gemeinsamen Workspace zu öffnen.</Text>
          {(error || AUTH_ERRORS[authError]) && <Alert color="red">{error || AUTH_ERRORS[authError]}</Alert>}
          <Button component="a" href="/api/auth/login">Mit Authentik anmelden</Button>
          {error && <Button variant="subtle" onClick={onRetry}>Erneut versuchen</Button>}
        </Stack>
      </Paper>
    </Center>
  );
}

function WorkspaceStatus({ session }) {
  const [status, setStatus] = useState({ kind: 'idle', message: 'Gemeinsamer Workspace' });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => subscribeSharedStorageStatus(setStatus), []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutFromSharedWorkspace();
    } catch (error) {
      setStatus({ kind: 'error', message: error.message });
      setLoggingOut(false);
    }
  };

  return (
    <Paper radius={0} px="md" py={6} withBorder={false} bg="var(--mantine-color-gray-0)">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="xs" wrap="nowrap" miw={0}>
          <Text size="sm" fw={600} truncate>{session.user?.name || session.user?.email || 'Angemeldet'}</Text>
          <Text size="xs" c="dimmed" visibleFrom="sm">{session.role === 'admin' ? 'Admin' : session.role === 'viewer' ? 'Nur Lesen' : 'Editor'}</Text>
          <Text
            size="xs"
            c={status.kind === 'error' || status.kind === 'conflict' ? 'red' : status.kind === 'saving' || status.kind === 'pending' ? 'blue' : 'dimmed'}
            truncate
          >
            {status.message}
          </Text>
          {status.kind === 'error' && <Button size="compact-xs" variant="light" onClick={retrySharedStorageSave}>Erneut speichern</Button>}
          {status.kind === 'auth_expired' && <Button size="compact-xs" variant="light" onClick={() => window.location.reload()}>Neu anmelden</Button>}
        </Group>
        <Button size="compact-sm" variant="subtle" loading={loggingOut} onClick={handleLogout}>Abmelden</Button>
      </Group>
      {status.kind === 'conflict' && (
        <Alert color="red" mt="xs" title="Speicherkonflikt">
          Bitte lade die Seite neu, um den aktuellen gemeinsamen Stand zu laden. Nicht gespeicherte lokale Änderungen können dabei verloren gehen.
          <Anchor component="button" type="button" ml="xs" onClick={() => window.location.reload()}>Jetzt neu laden</Anchor>
        </Alert>
      )}
    </Paper>
  );
}

export default function BackendShell({ status, error, session, onRetry, children }) {
  if (status === 'loading') {
    return <Center mih="100vh"><Stack align="center"><Loader /><Text c="dimmed">Workspace wird geladen …</Text></Stack></Center>;
  }
  if (status === 'unauthenticated') return <LoginScreen error={error} onRetry={onRetry} />;
  if (status === 'error') return <LoginScreen error={error || 'Der gemeinsame Workspace ist nicht erreichbar.'} onRetry={onRetry} />;

  return <Box><WorkspaceStatus session={session} />{children}</Box>;
}
