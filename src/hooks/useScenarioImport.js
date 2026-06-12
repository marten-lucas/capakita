import { useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import CryptoJS from 'crypto-js';
import { createId } from '../utils/idUtils';
import { addScenario, setSelectedItems, updateScenario } from '../store/simScenarioSlice';
import { refreshAllEvents } from '../store/eventSlice';
import { extractAdebisData } from '../utils/adebis-reader';
import { isRecordActiveOnDate } from '../utils/financeUtils';
import {
  adebis2simData,
  adebis2bookings,
  adebis2GroupDefs,
  adebis2QualiDefs,
  adebis2GroupAssignments
} from '../utils/adebis-parser';

function cloneObject(value, fallback) {
  return value ? JSON.parse(JSON.stringify(value)) : fallback;
}

function toExternalKey(item) {
  const source = item?.adebisId?.source || item?.type || 'unknown';
  const id = item?.adebisId?.id || item?.rawdata?.KINDNR || item?.rawdata?.IDNR || item?.id;
  return `${source}:${String(id)}`;
}

function normalizeDataItemForCompare(item) {
  if (!item) return null;
  const {
    id: _id,
    originalData: _originalData,
    ...rest
  } = item;
  return rest;
}

function getExtension(fileName = '') {
  const lower = String(fileName).toLowerCase();
  if (lower.endsWith('.capakita.json')) return '.capakita.json';
  const dotIndex = lower.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return lower.slice(dotIndex);
}

function isCapakitaLikeFile(fileName = '') {
  const ext = getExtension(fileName);
  return ext === '.capakita' || ext === '.enc' || ext === '.txt' || ext === '.capakita.json' || ext === '.json';
}

function toAssignmentList(assignmentsByItem = {}, itemId) {
  const entry = assignmentsByItem?.[String(itemId)];
  if (!entry || typeof entry !== 'object') return [];
  return Object.values(entry);
}

function buildPreparedImport({
  rawdata,
  importMeta,
  isAnonymized,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { simDataList } = adebis2simData(rawdata.kidsRaw, rawdata.employeesRaw, rawdata.belegungRaw);
  const { bookings, bookingReference } = adebis2bookings(rawdata.belegungRaw, rawdata.employeesRaw);
  const groupDefs = adebis2GroupDefs(rawdata.groupsRaw);
  const activeEmployeeRawdata = simDataList
    .filter((item) => item.type === 'capacity')
    .filter((item) => isRecordActiveOnDate(item, today))
    .map((item) => item.rawdata || {});
  const qualiDefs = adebis2QualiDefs(activeEmployeeRawdata);
  const { groupAssignments } = adebis2GroupAssignments(rawdata.grukiRaw);

  const itemsByExternalKey = new Map();
  const recordOptions = [];

  simDataList.forEach((item) => {
    const externalKey = toExternalKey(item);
    itemsByExternalKey.set(externalKey, item);
    recordOptions.push({
      value: externalKey,
      label: `${item.type === 'demand' ? 'Kind' : 'Mitarbeiter'}: ${item.name}`,
      type: item.type,
      adebisSource: item?.adebisId?.source || '',
      adebisId: item?.adebisId?.id || '',
    });
  });

  const bookingsByExternalKey = new Map();
  bookingReference.forEach((ref) => {
    const booking = bookings.find((entry) => String(entry.id) === String(ref.bookingKey));
    if (!booking) return;
    const externalKey = `${ref.adebisId?.source || 'unknown'}:${String(ref.adebisId?.id || '')}`;
    const prev = bookingsByExternalKey.get(externalKey) || [];
    prev.push(booking);
    bookingsByExternalKey.set(externalKey, prev);
  });

  const groupAssignmentsByExternalKey = new Map();
  const qualificationAssignmentsByExternalKey = new Map();
  groupAssignments.forEach((assignment) => {
    const kindNr = assignment?.rawdata?.KINDNR;
    if (!kindNr) return;
    const externalKey = `kind:${String(kindNr)}`;
    const prev = groupAssignmentsByExternalKey.get(externalKey) || [];
    prev.push(assignment);
    groupAssignmentsByExternalKey.set(externalKey, prev);
  });

  simDataList.forEach((item) => {
    const externalKey = toExternalKey(item);
    if (item.type !== 'capacity') {
      qualificationAssignmentsByExternalKey.set(externalKey, []);
      return;
    }

    const qualification = item?.rawdata?.QUALIFIK || '';
    if (!qualification) {
      qualificationAssignmentsByExternalKey.set(externalKey, []);
      return;
    }

    qualificationAssignmentsByExternalKey.set(externalKey, [
      {
        qualification,
      },
    ]);
  });

  return {
    importMeta,
    isAnonymized,
    simDataList,
    groupDefs,
    qualiDefs,
    recordOptions,
    itemsByExternalKey,
    bookingsByExternalKey,
    groupAssignmentsByExternalKey,
    qualificationAssignmentsByExternalKey,
  };
}

function buildPreparedImportFromCapakitaData({
  payload,
  fileName,
}) {
  const scenarioId = payload?.selectedScenarioId
    || Object.keys(payload?.dataByScenario || {})[0]
    || payload?.scenarios?.[0]?.id
    || null;

  if (!scenarioId) {
    throw new Error('Die Capakita-Datei enthält kein gültiges Szenario.');
  }

  const itemsById = payload?.dataByScenario?.[scenarioId] || {};
  const bookingsByItem = payload?.bookingsByScenario?.[scenarioId] || {};
  const groupsByItem = payload?.groupsByScenario?.[scenarioId] || {};
  const qualificationAssignmentsByItem = payload?.qualificationAssignmentsByScenario?.[scenarioId] || {};
  const itemFinancesByItem = payload?.financeByScenario?.[scenarioId]?.itemFinances || {};
  const scenarioFinance = cloneObject(payload?.financeByScenario?.[scenarioId], null);

  const simDataList = Object.values(itemsById || {});
  const groupDefs = payload?.groupDefsByScenario?.[scenarioId] || [];
  const qualiDefs = payload?.qualificationDefsByScenario?.[scenarioId] || [];

  const itemsByExternalKey = new Map();
  const bookingsByExternalKey = new Map();
  const groupAssignmentsByExternalKey = new Map();
  const qualificationAssignmentsByExternalKey = new Map();
  const itemFinancesByExternalKey = new Map();
  const recordOptions = [];

  Object.entries(itemsById || {}).forEach(([itemId, item]) => {
    const externalKey = toExternalKey(item);
    itemsByExternalKey.set(externalKey, item);
    recordOptions.push({
      value: externalKey,
      label: `${item.type === 'demand' ? 'Kind' : 'Mitarbeiter'}: ${item.name || itemId}`,
      type: item.type,
      adebisSource: item?.adebisId?.source || '',
      adebisId: item?.adebisId?.id || '',
    });

    bookingsByExternalKey.set(externalKey, Object.values(bookingsByItem[String(itemId)] || {}));
    groupAssignmentsByExternalKey.set(externalKey, Object.values(groupsByItem[String(itemId)] || {}));
    qualificationAssignmentsByExternalKey.set(externalKey, toAssignmentList(qualificationAssignmentsByItem, itemId));

    const itemFinance = itemFinancesByItem[String(itemId)];
    if (itemFinance && typeof itemFinance === 'object') {
      itemFinancesByExternalKey.set(externalKey, cloneObject(itemFinance, {}));
    }
  });

  return {
    importMeta: {
      mode: 'capakita',
      generatedAt: new Date().toISOString(),
      warnings: [],
      conflicts: [],
      sourceFile: fileName,
    },
    isAnonymized: false,
    simDataList,
    groupDefs,
    qualiDefs,
    recordOptions,
    itemsByExternalKey,
    bookingsByExternalKey,
    groupAssignmentsByExternalKey,
    qualificationAssignmentsByExternalKey,
    itemFinancesByExternalKey,
    scenarioFinance,
  };
}

async function parseCapakitaPayload(file, password) {
  const fileName = file?.name || '';
  const ext = getExtension(fileName);
  const text = await file.text();

  if (ext === '.json' || ext === '.capakita.json') {
    return JSON.parse(text);
  }

  if (!password) {
    throw new Error('Für .capakita-Dateien ist ein Passwort erforderlich.');
  }

  const bytes = CryptoJS.AES.decrypt(text, password);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new Error('Falsches Passwort oder beschädigte Capakita-Datei.');
  }

  return JSON.parse(decrypted);
}

function filterByScope(preparedImport, importOptions) {
  const scope = importOptions?.recordScope || 'all';
  const selected = new Set(importOptions?.selectedRecordKeys || []);

  return preparedImport.recordOptions.filter((record) => {
    if (scope === 'children') return record.type === 'demand';
    if (scope === 'employees') return record.type === 'capacity';
    if (scope === 'selected') return selected.has(record.value);
    return true;
  });
}

function getConflictInfo(existingItem, incomingItem) {
  const existingComparable = normalizeDataItemForCompare(existingItem);
  const incomingComparable = normalizeDataItemForCompare(incomingItem);
  const isIdentical = JSON.stringify(existingComparable) === JSON.stringify(incomingComparable);
  return { isIdentical };
}

export function useScenarioImport() {
  const dispatch = useDispatch();
  const store = useStore();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const scenarios = useSelector((state) => state.simScenario.scenarios);
  const dataByScenario = useSelector((state) => state.simData.dataByScenario);
  const bookingsByScenario = useSelector((state) => state.simBooking.bookingsByScenario);
  const groupsByScenario = useSelector((state) => state.simGroup.groupsByScenario);
  const groupDefsByScenario = useSelector((state) => state.simGroup.groupDefsByScenario);
  const qualificationDefsByScenario = useSelector((state) => state.simQualification.qualificationDefsByScenario);
  const qualificationAssignmentsByScenario = useSelector((state) => state.simQualification.qualificationAssignmentsByScenario);
  const financeByScenario = useSelector((state) => state.simFinance.financeByScenario);

  const getImportPreview = useCallback((preparedImport, importOptions = {}) => {
    const selectedScenario = scenarios.find((scenario) => String(scenario.id) === String(selectedScenarioId));
    if (!selectedScenarioId) {
      return {
        supported: true,
        reason: 'Es wird ein neues Szenario angelegt.',
        counts: { considered: filterByScope(preparedImport, importOptions).length, newRecords: filterByScope(preparedImport, importOptions).length, identical: 0, conflicts: 0 },
        conflicts: [],
        filteredRecords: filterByScope(preparedImport, importOptions),
      };
    }

    if (selectedScenario?.baseScenarioId) {
      return {
        supported: false,
        reason: 'Import in abgeleitete Szenarien ist nicht unterstützt. Bitte ein Basisszenario wählen.',
        counts: { considered: 0, newRecords: 0, identical: 0, conflicts: 0 },
        conflicts: [],
        filteredRecords: [],
      };
    }

    const filteredRecords = filterByScope(preparedImport, importOptions);
    const existingItems = Object.values(dataByScenario[selectedScenarioId] || {});
    const existingByExternalKey = new Map(existingItems.map((item) => [toExternalKey(item), item]));

    const conflicts = [];
    let newRecords = 0;
    let identical = 0;

    filteredRecords.forEach((record) => {
      const incoming = preparedImport.itemsByExternalKey.get(record.value);
      const existing = existingByExternalKey.get(record.value);
      if (!incoming || !existing) {
        newRecords += 1;
        return;
      }

      const { isIdentical } = getConflictInfo(existing, incoming);
      if (isIdentical) {
        identical += 1;
      } else {
        conflicts.push({
          key: record.value,
          label: record.label,
          type: record.type,
        });
      }
    });

    return {
      supported: true,
      counts: {
        considered: filteredRecords.length,
        newRecords,
        identical,
        conflicts: conflicts.length,
      },
      conflicts,
      filteredRecords,
    };
  }, [dataByScenario, scenarios, selectedScenarioId]);

  const prepareImport = useCallback(async ({ file, isAnonymized, importMode = 'historical', password = '' }) => {
    const fileName = file?.name || '';
    if (isCapakitaLikeFile(fileName)) {
      const payload = await parseCapakitaPayload(file, password);
      return buildPreparedImportFromCapakitaData({ payload, fileName });
    }

    const { rawdata, importMeta } = await extractAdebisData(file, isAnonymized, { mode: importMode });
    return buildPreparedImport({ rawdata, importMeta, isAnonymized });
  }, []);

  const applyImport = useCallback(async ({ preparedImport, importOptions = {} }) => {
    let targetScenarioId = selectedScenarioId;
    if (!targetScenarioId) {
      targetScenarioId = createId('scenario');
      dispatch(addScenario({
        id: targetScenarioId,
        name: 'Importiertes Szenario',
        baseScenarioId: null,
        imported: false,
        importedAnonymized: false,
      }));
    }

    const selectedScenario = scenarios.find((scenario) => String(scenario.id) === String(targetScenarioId));
    if (selectedScenario?.baseScenarioId) {
      throw new Error('Import in abgeleitete Szenarien ist nicht unterstützt.');
    }

    const mergeMode = importOptions.mergeMode || 'append';
    const conflictPolicy = importOptions.conflictPolicy || 'skip';
    const filteredRecords = filterByScope(preparedImport, importOptions);

    const nextDataByScenario = cloneObject(dataByScenario, {});
    const nextBookingsByScenario = cloneObject(bookingsByScenario, {});
    const nextGroupsByScenario = cloneObject(groupsByScenario, {});
    const nextGroupDefsByScenario = cloneObject(groupDefsByScenario, {});
    const nextQualificationDefsByScenario = cloneObject(qualificationDefsByScenario, {});
    const nextQualificationAssignmentsByScenario = cloneObject(qualificationAssignmentsByScenario, {});
    const nextFinanceByScenario = cloneObject(financeByScenario, {});

    const existingData = nextDataByScenario[targetScenarioId] || {};
    const existingBookings = nextBookingsByScenario[targetScenarioId] || {};
    const existingGroups = nextGroupsByScenario[targetScenarioId] || {};
    const existingQualAssignments = nextQualificationAssignmentsByScenario[targetScenarioId] || {};

    let nextData = mergeMode === 'replace' ? {} : cloneObject(existingData, {});
    let nextBookings = mergeMode === 'replace' ? {} : cloneObject(existingBookings, {});
    let nextGroups = mergeMode === 'replace' ? {} : cloneObject(existingGroups, {});
    let nextQualAssignments = mergeMode === 'replace' ? {} : cloneObject(existingQualAssignments, {});

    const nextItemFinances = cloneObject(nextFinanceByScenario[targetScenarioId]?.itemFinances, {});

    const existingByExternalKey = new Map(
      Object.entries(existingData).map(([itemId, item]) => [toExternalKey(item), { itemId, item }])
    );

    const createdOrUpdatedIds = [];

    filteredRecords.forEach((record) => {
      const externalKey = record.value;
      const incomingItem = preparedImport.itemsByExternalKey.get(externalKey);
      if (!incomingItem) return;

      const existing = existingByExternalKey.get(externalKey);
      const isConflict = existing && !getConflictInfo(existing.item, incomingItem).isIdentical;

      let targetItemId = null;

      if (!existing) {
        targetItemId = createId('simdata');
      } else if (!isConflict) {
        if (mergeMode === 'append') {
          targetItemId = existing.itemId;
        } else {
          targetItemId = createId('simdata');
        }
      } else {
        if (mergeMode === 'append' && conflictPolicy === 'skip') {
          return;
        }
        if (mergeMode === 'append' && conflictPolicy === 'duplicate') {
          targetItemId = createId('simdata');
        } else {
          targetItemId = existing.itemId;
        }
      }

      nextData[targetItemId] = { ...incomingItem, id: targetItemId };
      createdOrUpdatedIds.push(targetItemId);

      const incomingBookings = preparedImport.bookingsByExternalKey.get(externalKey) || [];
      nextBookings[targetItemId] = {};
      incomingBookings.forEach((booking) => {
        const bookingId = createId('booking');
        nextBookings[targetItemId][bookingId] = { ...booking, id: bookingId };
      });

      const incomingGroups = preparedImport.groupAssignmentsByExternalKey.get(externalKey) || [];
      nextGroups[targetItemId] = {};
      incomingGroups.forEach((assignment) => {
        const assignmentId = createId('group');
        nextGroups[targetItemId][assignmentId] = {
          ...assignment,
          id: assignmentId,
          kindId: targetItemId,
        };
      });

      if (incomingItem.type === 'capacity') {
        const incomingAssignments = preparedImport.qualificationAssignmentsByExternalKey?.get(externalKey) || [];
        if (incomingAssignments.length > 0) {
          const normalizedAssignments = {};
          incomingAssignments.forEach((assignment) => {
            const qualification = assignment?.qualification || '';
            if (!qualification) return;
            const assignmentId = `${qualification}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            normalizedAssignments[assignmentId] = {
              id: assignmentId,
              dataItemId: targetItemId,
              qualification,
            };
          });
          if (Object.keys(normalizedAssignments).length > 0) {
            nextQualAssignments[targetItemId] = normalizedAssignments;
          } else {
            delete nextQualAssignments[targetItemId];
          }
        } else {
          const qualification = incomingItem?.rawdata?.QUALIFIK || '';
          if (qualification) {
            const assignmentId = `${qualification}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            nextQualAssignments[targetItemId] = {
              [assignmentId]: {
                id: assignmentId,
                dataItemId: targetItemId,
                qualification,
              },
            };
          } else {
            delete nextQualAssignments[targetItemId];
          }
        }
      } else {
        delete nextQualAssignments[targetItemId];
      }

      const incomingItemFinance = preparedImport.itemFinancesByExternalKey?.get(externalKey);
      if (incomingItemFinance && typeof incomingItemFinance === 'object') {
        nextItemFinances[targetItemId] = cloneObject(incomingItemFinance, {});
      } else {
        delete nextItemFinances[targetItemId];
      }
    });

    nextDataByScenario[targetScenarioId] = nextData;
    nextBookingsByScenario[targetScenarioId] = nextBookings;
    nextGroupsByScenario[targetScenarioId] = nextGroups;
    nextQualificationAssignmentsByScenario[targetScenarioId] = nextQualAssignments;

    const hasChildrenInImport = filteredRecords.some((record) => record.type === 'demand');
    const hasEmployeesInImport = filteredRecords.some((record) => record.type === 'capacity');

    if (mergeMode === 'replace' || hasChildrenInImport) {
      if (mergeMode === 'replace') {
        nextGroupDefsByScenario[targetScenarioId] = cloneObject(preparedImport.groupDefs, []);
      } else {
        const mergedGroupDefs = cloneObject(nextGroupDefsByScenario[targetScenarioId], []);
        const existingById = new Map(mergedGroupDefs.map((def) => [String(def.id), def]));
        preparedImport.groupDefs.forEach((def) => {
          const id = String(def.id);
          if (!existingById.has(id)) {
            mergedGroupDefs.push(def);
          } else if (conflictPolicy === 'overwrite') {
            const idx = mergedGroupDefs.findIndex((entry) => String(entry.id) === id);
            if (idx >= 0) mergedGroupDefs[idx] = def;
          }
        });
        nextGroupDefsByScenario[targetScenarioId] = mergedGroupDefs;
      }
    }

    if (mergeMode === 'replace' || hasEmployeesInImport) {
      if (mergeMode === 'replace') {
        nextQualificationDefsByScenario[targetScenarioId] = cloneObject(preparedImport.qualiDefs, []);
      } else {
        const mergedQualiDefs = cloneObject(nextQualificationDefsByScenario[targetScenarioId], []);
        const existingByKey = new Map(mergedQualiDefs.map((def) => [String(def.key), def]));
        preparedImport.qualiDefs.forEach((def) => {
          const key = String(def.key);
          if (!existingByKey.has(key)) {
            mergedQualiDefs.push(def);
          } else if (conflictPolicy === 'overwrite') {
            const idx = mergedQualiDefs.findIndex((entry) => String(entry.key) === key);
            if (idx >= 0) mergedQualiDefs[idx] = def;
          }
        });
        nextQualificationDefsByScenario[targetScenarioId] = mergedQualiDefs;
      }
    }

    const defaultScenarioFinance = {
      settings: { partialAbsenceThresholdDays: 42, partialAbsenceEmployerSharePercent: 0 },
      bayKiBiGRules: [],
      groupFeeCatalogs: {},
    };

    const existingScenarioFinance = {
      ...defaultScenarioFinance,
      ...(nextFinanceByScenario[targetScenarioId] || {}),
    };

    const incomingScenarioFinance = preparedImport?.scenarioFinance && typeof preparedImport.scenarioFinance === 'object'
      ? cloneObject(preparedImport.scenarioFinance, {})
      : null;

    const hasExistingScenarioFinanceData = Boolean(
      (existingScenarioFinance?.bayKiBiGRules || []).length > 0
      || Object.keys(existingScenarioFinance?.groupFeeCatalogs || {}).length > 0
    );

    let mergedScenarioFinance = existingScenarioFinance;
    if (incomingScenarioFinance) {
      const shouldTakeIncomingFinance = mergeMode === 'replace'
        || conflictPolicy === 'overwrite'
        || !hasExistingScenarioFinanceData;

      if (shouldTakeIncomingFinance) {
        mergedScenarioFinance = {
          ...defaultScenarioFinance,
          ...incomingScenarioFinance,
        };
      }
    }

    nextFinanceByScenario[targetScenarioId] = {
      ...mergedScenarioFinance,
      itemFinances: nextItemFinances,
    };

    dispatch({ type: 'simOverlay/deleteAllOverlaysForScenario', payload: { scenarioId: targetScenarioId } });
    dispatch({ type: 'simData/loadDataByScenario', payload: nextDataByScenario });
    dispatch({ type: 'simBooking/loadBookingsByScenario', payload: nextBookingsByScenario });
    dispatch({ type: 'simGroup/loadGroupsByScenario', payload: nextGroupsByScenario });
    dispatch({ type: 'simGroup/loadGroupDefsByScenario', payload: nextGroupDefsByScenario });
    dispatch({ type: 'simQualification/loadQualificationAssignmentsByScenario', payload: nextQualificationAssignmentsByScenario });
    dispatch({ type: 'simQualification/loadQualificationDefsByScenario', payload: nextQualificationDefsByScenario });
    dispatch({ type: 'simFinance/loadFinanceByScenario', payload: nextFinanceByScenario });

    dispatch(updateScenario({
      scenarioId: targetScenarioId,
      updates: {
        imported: true,
        importedAnonymized: !!preparedImport.isAnonymized,
        importMode: preparedImport.importMeta?.mode || 'snapshot',
        importWarningsCount: Array.isArray(preparedImport.importMeta?.warnings) ? preparedImport.importMeta.warnings.length : 0,
      },
    }));

    dispatch(setSelectedItems(createdOrUpdatedIds.length > 0 ? [createdOrUpdatedIds[0]] : []));

    const currentState = store.getState();
    dispatch(refreshAllEvents({
      simScenario: {
        ...currentState.simScenario,
        selectedScenarioId: targetScenarioId,
      },
      simData: { dataByScenario: nextDataByScenario },
      simBooking: { bookingsByScenario: nextBookingsByScenario },
      simGroup: {
        groupsByScenario: nextGroupsByScenario,
        groupDefsByScenario: nextGroupDefsByScenario,
      },
    }));

    return {
      importedCount: createdOrUpdatedIds.length,
    };
  }, [
    bookingsByScenario,
    dataByScenario,
    dispatch,
    financeByScenario,
    groupDefsByScenario,
    groupsByScenario,
    qualificationAssignmentsByScenario,
    qualificationDefsByScenario,
    scenarios,
    store,
    selectedScenarioId,
  ]);

  return {
    prepareImport,
    getImportPreview,
    applyImport,
  };
}