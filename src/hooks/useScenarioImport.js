import { useCallback } from 'react';
import useSimScenarioStore from '../store/simScenarioStore';
import useSimDataStore from '../store/simDataStore';
import useSimBookingStore from '../store/simBookingStore';
import useSimGroupStore from '../store/simGroupStore';
import { extractAdebisZipAndData } from '../utils/adebis-import';
import { convertDDMMYYYYtoYYYYMMDD } from '../utils/dateUtils';

// Utility: Map rawdata to simData attributes
function mapRawDataToSimData(item) {
  const { type, rawdata, parseddata, name, id } = item;
  let simData = {
    id: String(id),
    type,
    source: rawdata?.source || "adebis import",
    name: name || "",
    remark: "",
    startdate: "",
    enddate: "",
    dateofbirth: "",
    vacation: "",
    absences: [],
    rawdata: {},
    overlays: {},
  };

  if (type === 'demand' && rawdata?.data?.KIND) {
    const kind = rawdata.data.KIND;
    simData.rawdata = { KIND: kind };
    simData.startdate = convertDDMMYYYYtoYYYYMMDD(parseddata?.startdate || kind.AUFNDAT);
    simData.enddate = convertDDMMYYYYtoYYYYMMDD(parseddata?.enddate || kind.AUSTRDAT);
    simData.name = name || kind.FNAME || "";
    simData.dateofbirth = convertDDMMYYYYtoYYYYMMDD(parseddata?.geburtsdatum || kind.GEBDATUM);
    simData.vacation = "";
  } else if (type === 'capacity' && rawdata?.data?.ANSTELLUNG) {
    const anst = rawdata.data.ANSTELLUNG;
    // Only keep required fields for rawdata
    simData.rawdata = {
      ANSTELLUNG: {
        IDNR: anst.IDNR,
        BEGINNDAT: anst.BEGINNDAT,
        ENDDAT: anst.ENDDAT,
        URLAUB: anst.URLAUB,
        VERTRAGART: anst.VERTRAGART
      }
    };
    simData.startdate = convertDDMMYYYYtoYYYYMMDD(parseddata?.startdate || anst.BEGINNDAT);
    simData.enddate = convertDDMMYYYYtoYYYYMMDD(parseddata?.enddate || anst.ENDDAT);
    simData.name = name || `Mitarbeiter ${anst.IDNR}` || "";
    simData.dateofbirth = ""; // Not available for employees
    simData.vacation = parseddata?.vacation || (anst.URLAUB !== undefined ? String(anst.URLAUB) : "");
  } else {
    simData.rawdata = {};
  }

  if (Array.isArray(item.absences)) simData.absences = item.absences;

  simData.originalData = JSON.parse(JSON.stringify({
    name: simData.name,
    startdate: simData.startdate,
    enddate: simData.enddate,
    vacation: simData.vacation,
    absences: simData.absences,
    dateofbirth: simData.dateofbirth
  }));

  return simData;
}

export function useScenarioImport() {
  const addScenario = useSimScenarioStore(state => state.addScenario);
  const setSelectedScenarioId = useSimScenarioStore(state => state.setSelectedScenarioId);
  const importDataItems = useSimDataStore(state => state.importDataItems);
  const importBookings = useSimBookingStore(state => state.importBookings);
  const addGroupDef = useSimGroupStore(state => state.addGroupDef);

  const importScenario = useCallback(
    async ({ file, isAnonymized }) => {
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

      const qualidefs = uniqueQualifications.map(key => ({
        key,
        name: key
      }));

      const ratesWithAmounts = rates.map(rate => {
        const amountObj = rateAmounts.find(a => a.id === rate.id);
        if (!amountObj) return null;
        return { ...rate, ...amountObj };
      }).filter(rate => !!rate);

      const organisation = { groupdefs, qualidefs, rates: ratesWithAmounts };

      // --- Normalize and map imported items ---
      const normalizedItems = processedData.map(mapRawDataToSimData);

      // --- Extract bookings from processedData ---
      const bookingsImportItems = processedData.map(item => ({
        id: String(item.id),
        booking: Array.isArray(item.parseddata?.booking) ? item.parseddata.booking : []
      }));

      const scenarioName = isAnonymized ? 'Importiertes Szenario (anonymisiert)' : 'Importiertes Szenario';
      const newScenario = {
        name: scenarioName,
        remark: '',
        confidence: 50,
        likelihood: 50,
        baseScenarioId: null,
        imported: true,
        importedAnonymized: !!isAnonymized,
        organisation
      };
      addScenario(newScenario);

      // Select the new scenario and import normalized data items
      const scenarios = useSimScenarioStore.getState().scenarios;
      const lastScenario = scenarios[scenarios.length - 1];
      if (lastScenario) {
        setSelectedScenarioId(lastScenario.id);
        importDataItems(lastScenario.id, normalizedItems);
        importBookings(lastScenario.id, bookingsImportItems);
        // Import groupdefs into group store
        groupdefs.forEach(def => addGroupDef(lastScenario.id, def));
      }
    },
    [addScenario, setSelectedScenarioId, importDataItems, importBookings, addGroupDef]
  );

  // Return as object for destructuring
  return { importScenario };
};