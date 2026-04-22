import React, { useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Popover,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconSearch } from '@tabler/icons-react';
import GroupIcon from '../common/GroupIcon';
import {
  formatGroupIconLabel,
  GROUP_ICON_CATEGORIES,
  GROUP_ICON_LOOKUP,
  normalizeGroupIcon,
} from '../../utils/groupIcons';

function GroupIconPicker({ value, onChange, defaultValue = GROUP_ICON_CATEGORIES[0]?.icons[0] }) {
  const [opened, { open, close, toggle }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState(GROUP_ICON_CATEGORIES[0]?.value || 'animals');
  const [search, setSearch] = useState('');

  const normalizedValue = normalizeGroupIcon(value || defaultValue);

  const iconsByCategory = useMemo(() => {
    const query = search.trim().toLowerCase();

    return Object.fromEntries(
      GROUP_ICON_CATEGORIES.map((category) => [
        category.value,
        category.icons.filter((entry) => {
          const iconName = entry.icon || entry;
          const label = entry.label || GROUP_ICON_LOOKUP[iconName]?.label || formatGroupIconLabel(iconName);
          if (!query) return true;
          return (
            label.toLowerCase().includes(query) ||
            iconName.toLowerCase().includes(query)
          );
        }),
      ])
    );
  }, [search]);

  const handleSelect = (iconName) => {
    onChange?.(iconName);
    close();
  };

  const triggerLabel = `Gruppenicon auswählen: ${formatGroupIconLabel(normalizedValue)}`;

  return (
    <Popover opened={opened} onChange={(nextOpened) => (nextOpened ? open() : close())} withinPortal position="bottom-start" shadow="md" width={560} offset={8}>
      <Popover.Target>
        <Button
          variant="light"
          leftSection={<GroupIcon icon={normalizedValue} size={18} />}
          rightSection={<IconChevronDown size={14} />}
          onClick={toggle}
          aria-label="Gruppenicon auswählen"
          title={triggerLabel}
          data-testid="group-icon-picker-trigger"
        >
          Icon auswählen
        </Button>
      </Popover.Target>

      <Popover.Dropdown data-testid="group-icon-picker-popover">
        <Stack gap="sm">
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Icons suchen"
            leftSection={<IconSearch size={14} />}
          />

          <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
            <Tabs.List>
              {GROUP_ICON_CATEGORIES.map((category) => (
                <Tabs.Tab key={category.value} value={category.value}>
                  {category.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {GROUP_ICON_CATEGORIES.map((category) => {
              const icons = iconsByCategory[category.value] || [];

              return (
                <Tabs.Panel key={category.value} value={category.value} pt="sm">
                  <ScrollArea h={320} type="auto">
                    {icons.length === 0 ? (
                      <Text c="dimmed" size="sm">
                        Keine Icons in dieser Kategorie.
                      </Text>
                    ) : (
                      <SimpleGrid cols={6} spacing="xs">
                        {icons.map((entry) => {
                          const iconName = entry.icon || entry;
                          const iconLabel = entry.label || GROUP_ICON_LOOKUP[iconName]?.label || formatGroupIconLabel(iconName);
                          const selected = normalizedValue === normalizeGroupIcon(iconName);

                          return (
                            <Tooltip key={iconName} label={iconLabel} withArrow>
                              <ActionIcon
                                variant={selected ? 'filled' : 'light'}
                                color={selected ? 'blue' : 'gray'}
                                size="xl"
                                onClick={() => handleSelect(iconName)}
                                aria-label={iconLabel}
                                data-selected={selected ? 'true' : 'false'}
                              >
                                <Box component="span" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <GroupIcon icon={iconName} size={22} />
                                </Box>
                              </ActionIcon>
                            </Tooltip>
                          );
                        })}
                      </SimpleGrid>
                    )}
                  </ScrollArea>
                </Tabs.Panel>
              );
            })}
          </Tabs>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export default GroupIconPicker;