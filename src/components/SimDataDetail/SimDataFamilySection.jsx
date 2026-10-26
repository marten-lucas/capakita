import React from 'react';
import { Badge, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { useDispatch } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { findFamilyMembers } from '../../utils/adebisFamily';

const SOURCE_LABELS = {
  erzber: 'erzber (Erziehungsberechtigte)',
  haushalt: 'Haushalt (Adresse)',
};

/**
 * Familien-/Geschwisterbereich im Daten-Detail.
 *
 * Reverse-Engineering-Basis (adebisKITA 7.5): Familie = Stern über der Link-Tabelle
 * erzber (adrnr ↔ kindnr); Geschwister teilen mindestens eine Erziehungsberechtigten-
 * Adresse. Ohne erzber.xml im Export gruppiert Capakita per Haushalt (NAME + Adresse
 * aus kind.xml). Klick auf ein Geschwister springt direkt zu dessen Datensatz.
 */
function SimDataFamilySection({ item }) {
  const dispatch = useDispatch();
  const { getEffectiveDataItems, getEffectiveGroupDefs } = useOverlayData();

  if (!item || item.type !== 'demand') return null;

  const dataItems = getEffectiveDataItems();
  const groupDefs = getEffectiveGroupDefs();
  const siblings = findFamilyMembers(dataItems, item.id);

  const groupNameById = new Map(groupDefs.map((groupDef) => [String(groupDef.id), groupDef.name]));

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="center" mb={siblings.length > 0 ? 'xs' : 0}>
        <Text fw={600}>Familie &amp; Geschwister</Text>
        {item.familyLabel ? (
          <Badge variant="light" color="indigo">{item.familyLabel}</Badge>
        ) : null}
      </Group>

      {siblings.length === 0 ? (
        <Text size="sm" c="dimmed">
          {item.familyId
            ? 'Familie erkannt, aber keine weiteren Kinder in dieser Capakita-Datei.'
            : 'Keine Geschwister erkannt. Für die Familienverknüpfung erzber.xml/adressen.xml in den adebis-Export aufnehmen oder Adressfelder (NAME, STRASSE, PLZ) in kind.xml füllen.'}
        </Text>
      ) : (
        <Stack gap="xs">
          {item.familySource && SOURCE_LABELS[item.familySource] ? (
            <Text size="xs" c="dimmed">
              Quelle: {SOURCE_LABELS[item.familySource]}
            </Text>
          ) : null}
          {siblings.map((sibling) => (
            <UnstyledButton
              key={sibling.id}
              onClick={() => dispatch(setSelectedItem(sibling.id))}
              data-testid={`sibling-jump-${sibling.id}`}
              p="xs"
              radius="md"
              style={(theme) => ({
                display: 'block',
                border: `1px solid ${theme.colors.gray[3]}`,
                backgroundColor: theme.colors.gray[0],
              })}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} truncate>
                    {sibling.name || `Kind ${sibling?.rawdata?.KINDNR || ''}`}
                  </Text>
                  {sibling.dateofbirth ? (
                    <Text size="xs" c="dimmed">
                      geb. {String(sibling.dateofbirth).slice(0, 10)}
                    </Text>
                  ) : null}
                  {sibling.groupId && groupNameById.get(String(sibling.groupId)) ? (
                    <Badge variant="light" size="sm">
                      {groupNameById.get(String(sibling.groupId))}
                    </Badge>
                  ) : null}
                </Group>
                <IconChevronRight size={16} aria-label="Zu Geschwister springen" />
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export default SimDataFamilySection;
