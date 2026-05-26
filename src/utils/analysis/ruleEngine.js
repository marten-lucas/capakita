import { Engine } from 'json-rules-engine';
import Ajv from 'ajv';
import Handlebars from 'handlebars';

const ajv = new Ajv({ allErrors: true });

const RULE_SCHEMA = {
  type: 'object',
  required: ['id', 'stepId', 'severity', 'priority', 'conditions', 'event'],
  properties: {
    id: { type: 'string', minLength: 1 },
    stepId: { type: 'string', minLength: 1 },
    severity: { enum: ['high', 'medium', 'low'] },
    priority: { type: 'integer', minimum: 1 },
    conditions: {
      type: 'object',
      required: ['all'],
      properties: {
        all: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['fact', 'operator', 'value'],
            properties: {
              fact: { type: 'string', minLength: 1 },
              operator: { type: 'string', minLength: 1 },
              value: {},
            },
          },
        },
      },
    },
    event: {
      type: 'object',
      required: ['type', 'params'],
      properties: {
        type: { type: 'string', minLength: 1 },
        params: {
          type: 'object',
          required: ['title', 'statementTemplate', 'measureId'],
          properties: {
            title: { type: 'string', minLength: 1 },
            statementTemplate: { type: 'string', minLength: 1 },
            measureId: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  },
};

const MEASURE_SCHEMA = {
  type: 'object',
  required: ['id', 'label'],
  properties: {
    id: { type: 'string', minLength: 1 },
    label: { type: 'string', minLength: 1 },
  },
};

const MEASURES = [
  { id: 'M-Data-Booking-Queue', label: 'Fehlende Buchungen bearbeiten und Erfassungs-Queue ausfuehren.' },
  { id: 'M-Data-Group-Queue', label: 'Gruppenzuordnung fuer offene Faelle nachpflegen.' },
  { id: 'M-Data-Birthdate-Queue', label: 'Geburtsdaten erfassen, damit Altersauswertungen belastbar sind.' },
  { id: 'M-Data-Name-Queue', label: 'Stammdaten vervollstaendigen und Namensluecken schliessen.' },
  { id: 'M-Capacity-Peak', label: 'Dienstplaene und Kapazitaetsblenden in Peak-Zeiten pruefen.' },
  { id: 'M-Capacity-Expand', label: 'Kapazitaetsanpassung fuer dauerhafte Ueberlast einplanen.' },
  { id: 'M-Transitions-Corridor', label: 'Uebergangsregeln und Wechselzeitpunkte fachlich pruefen.' },
  { id: 'M-Transitions-Flow', label: 'Wechselrichtungen mit hohem Volumen gezielt organisatorisch begleiten.' },
  { id: 'M-Age-Distribution', label: 'Aufnahme- und Platzsteuerung auf Altersstruktur abstimmen.' },
  { id: 'M-Finance-Net', label: 'Einnahmen-/Ausgabenstruktur und Personalaufwand abstimmen.' },
  { id: 'M-Ratio-Care', label: 'Betreuungsschluessel gegen Zielwerte und Personalplanung abgleichen.' },
  { id: 'M-Ratio-Expert', label: 'Fachkraftquote durch Qualifikationsplanung stabilisieren.' },
  { id: 'M-Observe', label: 'Entwicklung weiter beobachten, aktuell kein akuter Eingriff noetig.' },
];

const RULES = [
  {
    id: 'R-DQ-Booking-High',
    stepId: 'quality',
    severity: 'high',
    priority: 100,
    conditions: { all: [{ fact: 'missingBookingShare', operator: 'greaterThanInclusive', value: 10 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Datenqualitaet: Fehlende Buchungen',
        statementTemplate: '{{missingBookingShareFmt}} der Datensaetze haben keine Buchung.',
        measureId: 'M-Data-Booking-Queue',
      },
    },
  },
  {
    id: 'R-DQ-Booking-Medium',
    stepId: 'quality',
    severity: 'medium',
    priority: 90,
    conditions: { all: [{ fact: 'missingBookingShare', operator: 'greaterThanInclusive', value: 5 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Datenqualitaet: Buchungsluecken',
        statementTemplate: '{{missingBookingShareFmt}} der Datensaetze haben keine Buchung.',
        measureId: 'M-Data-Booking-Queue',
      },
    },
  },
  {
    id: 'R-DQ-Group-High',
    stepId: 'quality',
    severity: 'high',
    priority: 88,
    conditions: { all: [{ fact: 'missingGroupShare', operator: 'greaterThanInclusive', value: 8 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Datenqualitaet: Fehlende Gruppenzuordnung',
        statementTemplate: '{{missingGroupShareFmt}} der Datensaetze haben keine aktive Gruppe.',
        measureId: 'M-Data-Group-Queue',
      },
    },
  },
  {
    id: 'R-DQ-Birth-Medium',
    stepId: 'quality',
    severity: 'medium',
    priority: 84,
    conditions: { all: [{ fact: 'missingBirthDateShare', operator: 'greaterThanInclusive', value: 2 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Datenqualitaet: Fehlende Geburtsdaten',
        statementTemplate: '{{missingBirthDateShareFmt}} der Kinder ohne Geburtsdatum.',
        measureId: 'M-Data-Birthdate-Queue',
      },
    },
  },
  {
    id: 'R-DQ-Name-Medium',
    stepId: 'quality',
    severity: 'medium',
    priority: 80,
    conditions: { all: [{ fact: 'missingNameShare', operator: 'greaterThanInclusive', value: 0.5 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Datenqualitaet: Fehlende Namen',
        statementTemplate: '{{missingNameShareFmt}} der Datensaetze ohne Name.',
        measureId: 'M-Data-Name-Queue',
      },
    },
  },
  {
    id: 'R-UTIL-Overload-High',
    stepId: 'utilization',
    severity: 'high',
    priority: 70,
    conditions: { all: [{ fact: 'overloadSharePct', operator: 'greaterThanInclusive', value: 20 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Auslastung: Hohe Ueberlast',
        statementTemplate: '{{overloadShareFmt}} der Zeitfenster liegen ueber Kapazitaet.',
        measureId: 'M-Capacity-Peak',
      },
    },
  },
  {
    id: 'R-UTIL-MeanOverload-High',
    stepId: 'utilization',
    severity: 'high',
    priority: 69,
    conditions: { all: [{ fact: 'meanOverloadHours', operator: 'greaterThanInclusive', value: 3 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Auslastung: Dauerhafte Ueberlast',
        statementTemplate: 'Mittlere Ueberlast liegt bei {{meanOverloadHoursFmt}} h.',
        measureId: 'M-Capacity-Expand',
      },
    },
  },
  {
    id: 'R-TRANS-Corridor-High',
    stepId: 'transitions',
    severity: 'high',
    priority: 68,
    conditions: { all: [{ fact: 'corridorRemainPct', operator: 'lessThan', value: 70 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Uebergaenge: Niedriger Korridor-Verbleib',
        statementTemplate: 'Nur {{corridorRemainFmt}} verbleiben im Regelkorridor.',
        measureId: 'M-Transitions-Corridor',
      },
    },
  },
  {
    id: 'R-TRANS-Delta-High',
    stepId: 'transitions',
    severity: 'medium',
    priority: 64,
    conditions: { all: [{ fact: 'averageDeltaHoursAbs', operator: 'greaterThanInclusive', value: 2 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Uebergaenge: Starkes Buchungsdelta',
        statementTemplate: 'Ø Delta Buchungszeit liegt bei {{averageDeltaHoursFmt}} h.',
        measureId: 'M-Transitions-Flow',
      },
    },
  },
  {
    id: 'R-AGE-Krippe-Low',
    stepId: 'age',
    severity: 'medium',
    priority: 58,
    conditions: { all: [{ fact: 'krippePct', operator: 'lessThan', value: 15 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Alter: Krippenanteil auffaellig',
        statementTemplate: 'Krippenanteil liegt bei {{krippePctFmt}}.',
        measureId: 'M-Age-Distribution',
      },
    },
  },
  {
    id: 'R-AGE-Schule-High',
    stepId: 'age',
    severity: 'medium',
    priority: 57,
    conditions: { all: [{ fact: 'schulePct', operator: 'greaterThan', value: 30 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Alter: Schulanteil auffaellig',
        statementTemplate: 'Schulanteil liegt bei {{schulePctFmt}}.',
        measureId: 'M-Age-Distribution',
      },
    },
  },
  {
    id: 'R-FIN-Net-High',
    stepId: 'kpis',
    severity: 'high',
    priority: 54,
    conditions: { all: [{ fact: 'net', operator: 'lessThan', value: 0 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Finanzen: Kritischer Saldo',
        statementTemplate: 'Saldo liegt bei {{netFmt}} EUR.',
        measureId: 'M-Finance-Net',
      },
    },
  },
  {
    id: 'R-RATIO-Expert-Low',
    stepId: 'kpis',
    severity: 'medium',
    priority: 50,
    conditions: { all: [{ fact: 'expertRatio', operator: 'lessThan', value: 60 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Fachkraftquote unter Zielband',
        statementTemplate: 'Fachkraftquote liegt bei {{expertRatioFmt}}%.',
        measureId: 'M-Ratio-Expert',
      },
    },
  },
  {
    id: 'R-RATIO-Care-High',
    stepId: 'kpis',
    severity: 'medium',
    priority: 49,
    conditions: { all: [{ fact: 'careRatio', operator: 'greaterThan', value: 8 }] },
    event: {
      type: 'analysis-alert',
      params: {
        title: 'Betreuungsschluessel kritisch',
        statementTemplate: 'Betreuungsschluessel liegt bei {{careRatioFmt}}.',
        measureId: 'M-Ratio-Care',
      },
    },
  },
];

const validateRule = ajv.compile(RULE_SCHEMA);
const validateMeasure = ajv.compile(MEASURE_SCHEMA);

function assertConfiguration() {
  RULES.forEach((rule) => {
    if (!validateRule(rule)) {
      throw new Error(`Invalid rule config for ${rule?.id || 'unknown'}: ${ajv.errorsText(validateRule.errors)}`);
    }
  });

  MEASURES.forEach((measure) => {
    if (!validateMeasure(measure)) {
      throw new Error(`Invalid measure config for ${measure?.id || 'unknown'}: ${ajv.errorsText(validateMeasure.errors)}`);
    }
  });
}

assertConfiguration();

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pct(part, total) {
  if (!total) return 0;
  return (toNumber(part) / toNumber(total)) * 100;
}

function formatPercent(value) {
  return `${Math.round(toNumber(value) * 10) / 10}%`;
}

function severityRank(severity) {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function createEngine() {
  const engine = new Engine([], { allowUndefinedFacts: true });
  RULES.forEach((rule) => {
    engine.addRule({
      ...rule,
      event: {
        ...rule.event,
        type: rule.id,
      },
    });
  });
  return engine;
}

function mapMeasureIdToLabel() {
  return Object.fromEntries(MEASURES.map((measure) => [measure.id, measure.label]));
}

function enrichTemplateFacts(metrics) {
  return {
    ...metrics,
    missingBookingShareFmt: formatPercent(metrics.missingBookingShare),
    missingGroupShareFmt: formatPercent(metrics.missingGroupShare),
    missingBirthDateShareFmt: formatPercent(metrics.missingBirthDateShare),
    missingNameShareFmt: formatPercent(metrics.missingNameShare),
    overloadShareFmt: formatPercent(metrics.overloadSharePct),
    corridorRemainFmt: formatPercent(metrics.corridorRemainPct),
    krippePctFmt: formatPercent(metrics.krippePct),
    regelPctFmt: formatPercent(metrics.regelPct),
    schulePctFmt: formatPercent(metrics.schulePct),
    careRatioFmt: Math.round(metrics.careRatio * 10) / 10,
    expertRatioFmt: Math.round(metrics.expertRatio * 10) / 10,
    meanOverloadHoursFmt: Math.round(metrics.meanOverloadHours * 10) / 10,
    averageDeltaHoursFmt: Math.round(metrics.averageDeltaHours * 10) / 10,
    netFmt: Math.round(metrics.net),
  };
}

export function buildAnalysisMetrics({
  dataQuality,
  latest,
  historicalDelta,
  utilization,
  transitions,
  ageDistribution,
  finance,
}) {
  const totalRecords = toNumber(dataQuality?.total);
  const missingBooking = toNumber(dataQuality?.missingBooking);
  const missingGroup = toNumber(dataQuality?.missingGroup);
  const missingBirthDate = toNumber(dataQuality?.missingBirthDate);
  const missingName = toNumber(dataQuality?.missingName);

  return {
    totalRecords,
    missingBooking,
    missingGroup,
    missingBirthDate,
    missingName,
    missingBookingShare: pct(missingBooking, totalRecords),
    missingGroupShare: pct(missingGroup, totalRecords),
    missingBirthDateShare: pct(missingBirthDate, totalRecords),
    missingNameShare: pct(missingName, totalRecords),

    childrenCount: toNumber(latest?.childrenCount),
    bookingHours: toNumber(latest?.bookingHours),
    careHours: toNumber(latest?.careHours),

    childrenPct: toNumber(historicalDelta?.childrenPct),
    bookingPct: toNumber(historicalDelta?.bookingPct),
    carePct: toNumber(historicalDelta?.carePct),

    overloadSharePct: toNumber(utilization?.overloadSharePct),
    maxOverloadHours: toNumber(utilization?.maxOverloadHours),
    meanOverloadHours: toNumber(utilization?.meanOverloadHours),

    transitionCount: toNumber(transitions?.count),
    transitionCountDeltaPct: toNumber(transitions?.countDeltaPct),
    averageAgeMonths: toNumber(transitions?.averageAgeMonths),
    medianAgeMonths: toNumber(transitions?.medianAgeMonths),
    averageDeltaHours: toNumber(transitions?.averageDeltaHours),
    averageDeltaHoursAbs: Math.abs(toNumber(transitions?.averageDeltaHours)),
    corridorRemainPct: toNumber(transitions?.corridorRemainPct),
    topRouteSharePct: toNumber(transitions?.topRouteSharePct),

    krippePct: toNumber(ageDistribution?.krippePct),
    regelPct: toNumber(ageDistribution?.regelPct),
    schulePct: toNumber(ageDistribution?.schulePct),

    income: toNumber(finance?.income),
    expenses: toNumber(finance?.expenses),
    net: toNumber(finance?.net),
    incomePct: toNumber(finance?.incomePct),
    expensesPct: toNumber(finance?.expensesPct),
    netPct: toNumber(finance?.netPct),
    careRatio: toNumber(finance?.careRatio),
    expertRatio: toNumber(finance?.expertRatio),
  };
}

export async function computeAnalysisInsights(metricsInput) {
  const metrics = buildAnalysisMetrics(metricsInput || {});
  const templateFacts = enrichTemplateFacts(metrics);
  const measureById = mapMeasureIdToLabel();

  const engine = createEngine();
  const results = await engine.run(metrics);

  const alerts = (results?.events || []).map((event) => {
    const sourceRule = RULES.find((rule) => rule.id === event.type);
    const template = Handlebars.compile(event.params.statementTemplate);

    return {
      id: sourceRule?.id || event.type,
      stepId: sourceRule?.stepId || 'summary',
      severity: sourceRule?.severity || 'low',
      priority: sourceRule?.priority || 1,
      title: event.params.title,
      statement: template(templateFacts),
      measureId: event.params.measureId,
      measure: measureById[event.params.measureId] || measureById['M-Observe'],
    };
  });

  alerts.sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) return severityDelta;
    const priorityDelta = Number(right.priority || 0) - Number(left.priority || 0);
    if (priorityDelta !== 0) return priorityDelta;
    return String(left.id).localeCompare(String(right.id));
  });

  const uniqueByGroup = [];
  const seenStepSeverities = new Set();
  alerts.forEach((alert) => {
    const bucket = `${alert.stepId}:${alert.title}`;
    if (seenStepSeverities.has(bucket)) return;
    seenStepSeverities.add(bucket);
    uniqueByGroup.push(alert);
  });

  const topAlerts = uniqueByGroup.slice(0, 3);

  const stepStatements = {
    quality: topAlerts.find((entry) => entry.stepId === 'quality')?.statement
      || `Datenbasis: ${metrics.totalRecords} aktive Datensaetze, fehlende Buchungen ${formatPercent(metrics.missingBookingShare)}.`,
    stock: `Bestand aktuell: ${metrics.childrenCount} Kinder, ${Math.round(metrics.bookingHours)} Buchungsstunden, ${Math.round(metrics.careHours)} Betreuungsstunden.`,
    utilization: topAlerts.find((entry) => entry.stepId === 'utilization')?.statement
      || `Ueberlastanteil ${formatPercent(metrics.overloadSharePct)}, mittlere Ueberlast ${Math.round(metrics.meanOverloadHours * 10) / 10} h.`,
    transitions: topAlerts.find((entry) => entry.stepId === 'transitions')?.statement
      || `Uebergaenge: ${metrics.transitionCount}, Ø Alter ${Math.round(metrics.averageAgeMonths * 10) / 10} Monate, Korridor ${formatPercent(metrics.corridorRemainPct)}.`,
    age: topAlerts.find((entry) => entry.stepId === 'age')?.statement
      || `Altersanteile: Krippe ${formatPercent(metrics.krippePct)}, Regelgruppe ${formatPercent(metrics.regelPct)}, Schule ${formatPercent(metrics.schulePct)}.`,
    kpis: topAlerts.find((entry) => entry.stepId === 'kpis')?.statement
      || `Saldo ${Math.round(metrics.net)} EUR, Betreuungsschluessel ${Math.round(metrics.careRatio * 10) / 10}, Fachkraftquote ${Math.round(metrics.expertRatio * 10) / 10}%.`,
    summary: topAlerts.length > 0
      ? `Priorisierte Handlungsfelder: ${topAlerts.map((entry) => entry.title).join(', ')}.`
      : 'Keine kritischen Alerts im aktuellen Analysefenster.',
  };

  return {
    metrics,
    alerts: uniqueByGroup,
    topAlerts,
    stepStatements,
    measures: topAlerts.map((entry) => entry.measure),
  };
}
