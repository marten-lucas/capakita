import React, { useState, useEffect } from 'react';
import { Group, Box, Paper, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

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
  const isMobile = useMediaQuery('(max-width: 62em)');
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
    <Group
      align="stretch"
      gap="md"
      wrap={isMobile ? 'wrap' : 'nowrap'}
      style={{
        minHeight: 0,
        height: isMobile ? 'auto' : 'calc(100dvh - 170px)',
      }}
    >
      {/* Sidebar / List */}
      <Paper
        withBorder
        shadow="xs"
        w={isMobile ? '100%' : 320}
        h={isMobile ? 'auto' : '100%'}
        display="flex"
        style={{ flexDirection: 'column', minHeight: 0 }}
      >
        <Box p="xs" style={{ overflowY: isMobile ? 'visible' : 'auto', minHeight: 0, flex: isMobile ? undefined : 1 }}>
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
        </Box>
      </Paper>

      {/* Main Content / Detail */}
      <Paper
        withBorder
        shadow="xs"
        style={{
          flex: 1,
          minWidth: isMobile ? '100%' : 0,
          height: isMobile ? 'auto' : '100%',
          minHeight: isMobile ? 360 : 0,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {selectedItem ? (
          <Box display="flex" style={{ flexDirection: 'column', height: isMobile ? 'auto' : '100%', minHeight: 0 }}>
            <Group justify="space-between" p="md" wrap="wrap" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <Title order={4}>
                {typeof detailTitle === 'function' ? detailTitle(selectedItem) : detailTitle}
              </Title>
              {actions && actions(selectedItem)}
            </Group>

            <Box p="md" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {typeof detailContent === 'function' ? detailContent(selectedItem) : detailContent}
            </Box>
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
