import { Anchor, Divider, Group, Text } from '@mantine/core';
import { useDispatch } from 'react-redux';
import { setActivePage } from '../store/uiSlice';

function AppFooter() {
  const dispatch = useDispatch();

  return (
    <>
      <Divider my="lg" />
      <Group justify="space-between" gap="xs" pb="md">
        <Text size="sm" c="dimmed">
          CapaKita – entwickelt vom St. Johannesvereins Gramschatz e.V.
        </Text>
        <Anchor component="button" onClick={() => dispatch(setActivePage('legal'))} size="sm">
          Impressum & Datenschutz
        </Anchor>
      </Group>
    </>
  );
}

export default AppFooter;
