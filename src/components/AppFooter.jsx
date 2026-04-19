import { Anchor, Divider, Group, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

function AppFooter() {
  return (
    <>
      <Divider my="lg" />
      <Group justify="space-between" gap="xs" pb="md">
        <Text size="sm" c="dimmed">
          CapaKita – entwickelt vom St. Johannesvereins Gramschatz e.V.
        </Text>
        <Anchor component={Link} to="/impressum-datenschutz" size="sm">
          Impressum & Datenschutz
        </Anchor>
      </Group>
    </>
  );
}

export default AppFooter;
