import React, { useState, useEffect } from 'react';
import { Group, Box, Paper, ScrollArea, Stack, ActionIcon, Text, Title, Badge } from '@mantine/core';

function TabbedListDetail({
  data = [],
  selectedId: controlledSelectedId,
  onSelect,
  renderItem, // function(item) -> ReactNode
  detailTitle, // string or function(item)
  detailContent, // ReactNode or function(item)
  actions, // function(item) -> ReactNode
  emptyText = 'Keine Einträge vorhanden.'
}) {
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState(data[0]?.id || null);
  const selectedId = controlledSelectedId ?? uncontrolledSelectedId;

  useEffect(() => {
    if (data.length > 0 && !data.some(item => item.id === selectedId)) {
        const nextId = data[0].id;
        if (controlledSelectedId === undefined) {
           setUncontrolledSelectedId(nextId);
        } else {
           onSelect?.(nextId);
        }
    }
  }, [data, selectedId, controlledSelectedId, onSelect]);

  const handleSelect = (id) => {
    if (controlledSelectedId === undefined) {
      setUncontrolledSelectedId(id);
    }
    onSelect?.(id);
  };

  const selectedItem = data.find(item => item.id === selectedId);

  return (
    <Group align="flex-start" gap="md" h="calc(100vh - 120px)" wrap="nowrap">
      {/* Sidebar / List */}
      <Paper withBorder shadow="xs" w={320} h="100%" display="flex" style={{ flexDirection: 'column' }}>
        <ScrollArea style={{ flex: 1 }} p="xs">
          {data.length === 0 ? (
            <Text c="dimmed" fs="italic" ta="center" mt="xl">{emptyText}</Text>
          ) : (
            <Stack gap={4}>
              {data.map((item) => (
                <Paper
                  key={item.id}
                  p="xs"
                  radius="sm"
                  onClick={() => handleSelect(item.id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedId === item.id ? 'var(--mantine-color-blue-light)' : 'transparent',
                  }}
                >
                  {renderItem ? renderItem(item) : <Text size="sm">{item.name}</Text>}
                </Paper>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Paper>

      {/* Main Content / Detail */}
      <Paper withBorder shadow="xs" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {selectedItem ? (
          <Box display="flex" style={{ flexDirection: 'column', height: '100%' }}>
            <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <Title order={4}>
                {typeof detailTitle === 'function' ? detailTitle(selectedItem) : detailTitle}
              </Title>
              {actions && actions(selectedItem)}
            </Group>
            
            <ScrollArea style={{ flex: 1 }} p="md">
              {typeof detailContent === 'function' ? detailContent(selectedItem) : detailContent}
            </ScrollArea>
          </Box>
        ) : (
          <Box h="100%" display="flex" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text c="dimmed">Wählen Sie einen Eintrag aus der Liste aus.</Text>
          </Box>
        )}
      </Paper>
    </Group>
  );
}

export default TabbedListDetail;
