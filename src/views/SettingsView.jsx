import React from 'react';
import { Paper, Box } from '@mantine/core';
import { useSelector } from 'react-redux';
import OrgaTabGroupDefs from '../components/orgaDetails/orgaTabGroupDefs';
import OrgaTabQualificationDefs from '../components/orgaDetails/orgaTabQualificatoinDefs';
import OrgaTabScenarioDefs from '../components/orgaDetails/orgaTabScenarioDefs';
import OrgaTabEvents from '../components/orgaDetails/orgaTabEvents';
import OrgaTabFinance from '../components/orgaDetails/orgaTabFinance';

function SettingsView() {
  const activeSubPage = useSelector((state) => state.ui.settingsSubPage || 'groups');

  const panel = React.useMemo(() => {
    switch (activeSubPage) {
      case 'scenarios':
        return <OrgaTabScenarioDefs />;
      case 'groups':
        return <OrgaTabGroupDefs />;
      case 'qualifications':
        return <OrgaTabQualificationDefs />;
      case 'events':
        return <OrgaTabEvents />;
      case 'finance':
        return <OrgaTabFinance />;
      default:
        return <OrgaTabGroupDefs />;
    }
  }, [activeSubPage]);

  return (
    <Paper shadow="sm" withBorder p={0}>
      <Box px={{ base: 4, sm: 'xs' }} py={{ base: 'sm', sm: 'md' }}>
        {panel}
      </Box>
    </Paper>
  );
}

export default SettingsView;
