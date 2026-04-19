import React from 'react';
import { Accordion, Button, Stack, Text, Group, ActionIcon, Center } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

function AccordionListDetail({
  items = [],
  SummaryComponent,
  DetailComponent,
  AddButtonLabel = 'Hinzufügen',
  onAdd,
  onDelete,
  emptyText = 'Keine Einträge vorhanden.'
}) {
  const renderSummary = (item, index) => React.createElement(SummaryComponent, { item, index });
  const renderDetail = (item, index) => React.createElement(DetailComponent, { item, index });

  return (
    <Stack gap="md">
      {items.length === 0 ? (
        <Center mih={100} style={{ border: '1px dashed #ccc', borderRadius: '8px' }}>
          <Text c="dimmed">{emptyText}</Text>
        </Center>
      ) : (
        <Accordion variant="separated" defaultValue={String(items[0]?.id || '0')}>
          {items.map((item, index) => (
            <Accordion.Item key={item.id || index} value={item.id || index.toString()}>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Accordion.Control>
                  {renderSummary(item, index)}
                </Accordion.Control>
                <ActionIcon 
                  color="red" 
                  variant="subtle" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(index, item);
                  }}
                  mr="md"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              <Accordion.Panel>
                {renderDetail(item, index)}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}

      {onAdd && (
        <Button 
          variant="light" 
          leftSection={<IconPlus size={16} />} 
          onClick={onAdd}
          fullWidth
        >
          {AddButtonLabel}
        </Button>
      )}
    </Stack>
  );
}

export default AccordionListDetail;
