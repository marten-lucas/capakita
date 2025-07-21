import { useCallback } from 'react';
import useSimScenarioStore from '../store/simScenarioStore';
import { extractAdebisZipAndData } from '../utils/adebis-import';

export function useScenarioImport() {
  const addScenario = useSimScenarioStore(state => state.addScenario);
  const setSelectedScenarioId = useSimScenarioStore(state => state.setSelectedScenarioId);
  const setGroupDefs = useSimScenarioStore(state => state.setGroupDefs);
  const setQualiDefs = useSimScenarioStore(state => state.setQualiDefs);

  const importScenario = useCallback(async ({ file, isAnonymized }) => {
    // Remove manual zip loading and file listing here
    // Instead, add logging inside extractAdebisZipAndData

    const {
      processedData,
      newGroupsLookup,
      uniqueQualifications,
      rates,
      rateAmounts
    } = await extractAdebisZipAndData(
      file,
      isAnonymized,
      null,
      null
    );

    // Debug logs for file presence and parsed data
    console.log('ImportScenario: rates:', rates);
    console.log('ImportScenario: rateAmounts:', rateAmounts);

    // Ensure groupdefs IDs are strings
    const groupdefs = Object.entries(newGroupsLookup).map(([id, name]) => ({
      id: String(id),
      name,
      icon: (() => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('schul')) return '🏫';
        if (lowerName.includes('fuchs')) return '🦊';
        if (lowerName.includes('bär') || lowerName.includes('baer')) return '🐻';
        if (lowerName.includes('hase') || lowerName.includes('kaninchen')) return '🐰';
        if (lowerName.includes('frosch')) return '🐸';
        if (lowerName.includes('schmetterling')) return '🦋';
        if (lowerName.includes('marienkäfer') || lowerName.includes('käfer')) return '🐞';
        if (lowerName.includes('biene')) return '🐝';
        if (lowerName.includes('schule') || lowerName.includes('schulkind')) return '🎒';
        if (lowerName.includes('stern')) return '⭐';
        if (lowerName.includes('sonne')) return '☀️';
        if (lowerName.includes('mond')) return '🌙';
        if (lowerName.includes('regenbogen')) return '🌈';
        if (lowerName.includes('blume')) return '🌸';
        if (lowerName.includes('baum')) return '🌳';
        return '👥';
      })()
    }));

    // Ensure group IDs in simulationData are strings
    const processedDataWithStringGroupIds = processedData.map(item => {
      if (item.parseddata?.group && Array.isArray(item.parseddata.group)) {
        item.parseddata.group = item.parseddata.group.map(g => ({
          ...g,
          id: g.id !== undefined ? String(g.id) : g.id
        }));
      }
      return item;
    });

    const qualidefs = uniqueQualifications.map(key => ({
      key,
      name: key
    }));

    // Compose rates with amounts (flatten: merge first valid amount into rate)
    const ratesWithAmounts = rates.map(rate => {
      const amountObj = rateAmounts.find(a => a.id === rate.id);
      if (!amountObj) return null;
      return { ...rate, ...amountObj };
    }).filter(rate => !!rate);

    const organisation = { groupdefs, qualidefs, rates: ratesWithAmounts };

    const scenarioName = isAnonymized ? 'Importiertes Szenario (anonymisiert)' : 'Importiertes Szenario';
    const newScenario = {
      name: scenarioName,
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null,
      simulationData: processedDataWithStringGroupIds,
      imported: true,
      importedAnonymized: !!isAnonymized,
      organisation
    };
    addScenario(newScenario);

    // Select the new scenario and set groupdefs/qualidefs
    const scenarios = useSimScenarioStore.getState().scenarios;
    const lastScenario = scenarios[scenarios.length - 1];
    if (lastScenario) {
      setSelectedScenarioId(lastScenario.id);
      setGroupDefs(groupdefs);
      setQualiDefs(qualidefs);
    }
  }, [addScenario, setSelectedScenarioId, setGroupDefs, setQualiDefs]);

  return { importScenario };
}
