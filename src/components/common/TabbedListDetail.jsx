import React, { useState, useEffect } from 'react';
import { Group, Box, Paper, Stack, Text, Title, ActionIcon, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand } from '@tabler/icons-react';

/**
 * Generisches List-Detail-Layout.
 *
 * @param {string} [listPosition='left'] - 'left' | 'right' (Desktop: Liste rechts vom Detail)
 * @param {ReactNode} [listHeader] - Kopf des Listen-Panels (Filter/Aktionen), über der Liste
 * @param {boolean} [collapsible=false] - Panel eingeklappt als schmale Leiste mit Aufklapper (nur Desktop)
 */
function TabbedListDetail({
  data = [],
  selectedId: controlledSelectedId,
  onSelect,
  renderItem, // function(item) -> ReactNode
  detailTitle, // string or function(item)
  detailContent, // ReactNode or function(item)
  actions, // function(item) -> ReactNode
  emptyText = 'Keine Einträge vorhanden.',
  listPosition = 'left',
  listHeader = null,
  toolbarContent = null,
  collapsible = false,
}) {
  const isMobile = useMediaQuery('(max-width: 62em)');
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState(data[0]?.id || null);
  const [collapsed, setCollapsed] = useState(false);
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
  const isCollapsed = collapsible && !isMobile && collapsed;

  const listPanel = (
    <Paper
      withBorder
      shadow="xs"
      data-testid="list-detail-list-panel"
      w={isMobile ? '100%' : 340}
      h={isMobile ? 'auto' : '100%'}
      display="flex"
      style={{
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        width: isMobile ? '100%' : 340,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {(listHeader || collapsible) ? (
        <Box
          p="xs"
          style={{
            borderBottom: '1px solid var(--mantine-color-gray-3)',
            ...(isMobile ? {} : {
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: 'var(--mantine-color-body)',
            }),
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Box style={{ flex: 1, minWidth: 0 }}>{listHeader}</Box>
            {collapsible && !isMobile ? (
              <Tooltip label={collapsed ? 'Datenliste einblenden' : 'Datenliste ausblenden'}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={collapsed ? 'Datenliste einblenden' : 'Datenliste ausblenden'}
                  onClick={() => setCollapsed((value) => !value)}
                >
                  {collapsed ? <IconLayoutSidebarRightExpand size={16} /> : <IconLayoutSidebarRightCollapse size={16} />}
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
        </Box>
      ) : null}

      <Box p="xs" style={{ overflowY: isMobile ? 'visible' : 'auto', minHeight: 0, flex: isMobile ? undefined : 1 }}>
        {data.length === 0 ? (
          <Text c="dimmed" fs="italic" ta="center" mt="xl">{emptyText}</Text>
        ) : (
          <Stack gap={4}>
            {data.map((item) => (
              <Paper
                key={item.id}
                data-testid={`data-list-item-${item.id}`}
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
  );

  const toolbarPanel = toolbarContent ? (
    <Paper
      withBorder
      shadow="xs"
      data-testid="list-detail-toolbar-panel"
      style={{
        flex: isMobile ? 'none' : '0 0 240px',
        minWidth: 0,
        width: isMobile ? '100%' : 240,
        maxWidth: '100%',
        height: isMobile ? 'auto' : '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <Box p="sm">{toolbarContent}</Box>
    </Paper>
  ) : null;

  const detailPanel = (
    <Paper
      withBorder
      shadow="xs"
      data-testid="list-detail-detail-panel"
      style={{
        flex: isMobile ? 'none' : 1,
        minWidth: 0,
        width: isMobile ? '100%' : undefined,
        maxWidth: '100%',
        height: isMobile ? 'auto' : '100%',
        minHeight: isMobile ? 360 : 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
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

          <Box p="md" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {typeof detailContent === 'function' ? detailContent(selectedItem) : detailContent}
          </Box>
        </Box>
      ) : (
        <Box h="100%" display="flex" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text c="dimmed">Wählen Sie einen Eintrag aus der Liste aus.</Text>
        </Box>
      )}
    </Paper>
  );

  return (
    <Group
      align="stretch"
      gap="md"
      wrap={isMobile ? 'wrap' : 'nowrap'}
      style={{
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        height: isMobile ? 'auto' : 'calc(100dvh - 170px)',
        flexDirection: isMobile ? 'column' : (listPosition === 'right' ? 'row-reverse' : 'row'),
      }}
    >
      {isCollapsed ? (
        <Paper
          withBorder
          shadow="xs"
          data-testid="list-detail-list-collapsed"
          h={isMobile ? 'auto' : '100%'}
          p={4}
          style={{ width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <Tooltip label="Datenliste einblenden" position="left">
            <ActionIcon
              variant="subtle"
              aria-label="Datenliste einblenden"
              onClick={() => setCollapsed(false)}
            >
              <IconLayoutSidebarRightExpand size={18} />
            </ActionIcon>
          </Tooltip>
          <Text
            size="xs"
            c="dimmed"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', userSelect: 'none' }}
          >
            Datenliste
          </Text>
        </Paper>
      ) : listPanel}

      {detailPanel}
      {toolbarPanel}
    </Group>
  );
}

export default TabbedListDetail;
