import React from 'react';
import { Paper, Box, ActionIcon, Menu } from '@mantine/core';
import { IconPlus, IconLayersIntersect, IconUsers, IconCertificate, IconCalendarEvent, IconTools } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import OrgaTabGroupDefs from '../components/orgaDetails/orgaTabGroupDefs';
import OrgaTabQualificationDefs from '../components/orgaDetails/orgaTabQualificatoinDefs';
import OrgaTabScenarioDefs from '../components/orgaDetails/orgaTabScenarioDefs';
import OrgaTabEvents from '../components/orgaDetails/orgaTabEvents';
import OrgaTabFinance from '../components/orgaDetails/orgaTabFinance';
import { addScenario, updateScenario } from '../store/simScenarioSlice';
import { addGroupDef } from '../store/simGroupSlice';
import { addQualificationDef } from '../store/simQualificationSlice';
import { addBayKiBiGRule, addGroupFeeEntry, updateScenarioFinanceSettings } from '../store/simFinanceSlice';
import { DEFAULT_GROUP_ICON } from '../utils/groupIcons';

function SettingsView() {
  const dispatch = useDispatch();
  const activeSubPage = useSelector((state) => state.ui.settingsSubPage || 'groups');
  const normalizedSubPage = activeSubPage === 'finance' ? 'finance-funding' : activeSubPage;
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const groupDefs = useSelector((state) => state.simGroup.groupDefsByScenario[selectedScenarioId] || []);

  const panel = React.useMemo(() => {
    switch (normalizedSubPage) {
      case 'scenarios':
        return <OrgaTabScenarioDefs />;
      case 'groups':
        return <OrgaTabGroupDefs />;
      case 'qualifications':
        return <OrgaTabQualificationDefs />;
      case 'events':
        return <OrgaTabEvents />;
      case 'finance-funding':
        return <OrgaTabFinance section="funding" />;
      case 'finance-absence':
        return <OrgaTabFinance section="absence" />;
      case 'finance-fees':
        return <OrgaTabFinance section="fees" />;
      default:
        return <OrgaTabGroupDefs />;
    }
  }, [normalizedSubPage]);

  const fabEntries = React.useMemo(() => {
    if (!selectedScenarioId) return [];

    if (normalizedSubPage === 'scenarios') {
      return [
        {
          key: 'scenario',
          label: 'Szenario',
          icon: IconLayersIntersect,
          onClick: () => dispatch(addScenario({ name: 'Neues Szenario', baseScenarioId: null, makeNameUnique: true })),
        },
      ];
    }

    if (normalizedSubPage === 'groups') {
      return [
        {
          key: 'group',
          label: 'Gruppe',
          icon: IconUsers,
          onClick: () => dispatch(addGroupDef({
            scenarioId: selectedScenarioId,
            groupDef: {
              id: Date.now().toString(),
              name: 'Neue Gruppe',
              icon: DEFAULT_GROUP_ICON,
              type: 'Regelgruppe',
              fillUp: false,
              maxFacilityCount: '',
              maxSchoolGrade: '',
            },
          })),
        },
      ];
    }

    if (normalizedSubPage === 'qualifications') {
      return [
        {
          key: 'qualification',
          label: 'Qualifikation',
          icon: IconCertificate,
          onClick: () => dispatch(addQualificationDef({
            scenarioId: selectedScenarioId,
            qualiDef: { key: `Q${Date.now()}`, initial: 'Q', name: 'Neue Qualifikation', IsExpert: true },
          })),
        },
      ];
    }

    if (normalizedSubPage === 'events') {
      return [
        {
          key: 'events-defaults',
          label: 'Auto-Event Defaults',
          icon: IconCalendarEvent,
          onClick: () => dispatch(updateScenario({
            scenarioId: selectedScenarioId,
            updates: {
              autoEventSettings: {
                kita: { ageYears: 3, bookingDeltaHours: 0 },
                school: { ageYears: 6, bookingDeltaHours: 0 },
                statisticsBinding: null,
              },
            },
          })),
        },
      ];
    }

    if (normalizedSubPage === 'finance-funding') {
      return [
        {
          key: 'finance-rule',
          label: 'Förderregel',
          icon: IconTools,
          onClick: () => dispatch(addBayKiBiGRule({
            scenarioId: selectedScenarioId,
            rule: { label: 'BayKiBiG', validFrom: '', validUntil: '', baseValue: '' },
          })),
        },
      ];
    }

    if (normalizedSubPage === 'finance-absence') {
      return [
        {
          key: 'finance-absence-default',
          label: 'Abwesenheit Defaults',
          icon: IconTools,
          onClick: () => dispatch(updateScenarioFinanceSettings({
            scenarioId: selectedScenarioId,
            updates: { partialAbsenceThresholdDays: 42, partialAbsenceEmployerSharePercent: 0 },
          })),
        },
      ];
    }

    if (normalizedSubPage === 'finance-fees') {
      return (groupDefs || []).slice(0, 8).map((group) => ({
        key: `fee-${group.id}`,
        label: `Beitragsstaffel: ${group.name || group.id}`,
        icon: IconTools,
        onClick: () => dispatch(addGroupFeeEntry({
          scenarioId: selectedScenarioId,
          groupId: group.id,
          entry: { validFrom: '', validUntil: '', maxHours: '', monthlyAmount: '' },
        })),
      }));
    }

    return [];
  }, [normalizedSubPage, selectedScenarioId, groupDefs, dispatch]);

  return (
    <Paper shadow="sm" withBorder p={0} style={{ position: 'relative' }}>
      <Box px={{ base: 4, sm: 'xs' }} py={{ base: 'sm', sm: 'md' }}>
        {panel}
      </Box>

      {fabEntries.length > 0 && (
        <Menu position="left-start" offset={10} shadow="md">
          <Menu.Target>
            <ActionIcon
              size="xl"
              radius="xl"
              variant="filled"
              aria-label="Hinzufügen"
              style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}
            >
              <IconPlus size={24} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Hinzufügen</Menu.Label>
            {fabEntries.map((entry) => (
              <Menu.Item
                key={entry.key}
                leftSection={<entry.icon size={16} />}
                onClick={entry.onClick}
              >
                {entry.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Paper>
  );
}

export default SettingsView;
