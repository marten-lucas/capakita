import React from 'react';
import { useSelector } from 'react-redux';
import StatisticsLegacyView from './StatisticsLegacyView';
import StatisticsStoryDeckView from './StatisticsStoryDeckView';

function StatisticsView() {
  const analysisStoryDeckEnabled = useSelector((state) => state.ui.analysisStoryDeckEnabled);

  if (analysisStoryDeckEnabled) {
    return <StatisticsStoryDeckView />;
  }

  return <StatisticsLegacyView />;
}

export default StatisticsView;
