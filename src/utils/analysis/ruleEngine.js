function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pct(part, total) {
  if (!total) return 0;
  return (toNumber(part) / toNumber(total)) * 100;
}

function classifySeverity(value, mediumThreshold, highThreshold) {
  if (value >= highThreshold) return 'high';
  if (value >= mediumThreshold) return 'medium';
  return 'low';
}

function formatPercent(value) {
  return `${Math.round(toNumber(value) * 10) / 10}%`;
}

function createAlert({ id, stepId, severity, title, statement, measure }) {
  return { id, stepId, severity, title, statement, measure };
}

function rankSeverity(severity) {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
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
    dataQuality: {
      totalRecords,
      missingBooking,
      missingGroup,
      missingBirthDate,
      missingName,
      missingBookingShare: pct(missingBooking, totalRecords),
      missingGroupShare: pct(missingGroup, totalRecords),
      missingBirthDateShare: pct(missingBirthDate, totalRecords),
      missingNameShare: pct(missingName, totalRecords),
    },
    latest: {
      childrenCount: toNumber(latest?.childrenCount),
      bookingHours: toNumber(latest?.bookingHours),
      careHours: toNumber(latest?.careHours),
    },
    historicalDelta: {
      childrenPct: toNumber(historicalDelta?.childrenPct),
      bookingPct: toNumber(historicalDelta?.bookingPct),
      carePct: toNumber(historicalDelta?.carePct),
    },
    utilization: {
      overloadSharePct: toNumber(utilization?.overloadSharePct),
      maxOverloadHours: toNumber(utilization?.maxOverloadHours),
      meanOverloadHours: toNumber(utilization?.meanOverloadHours),
    },
    transitions: {
      count: toNumber(transitions?.count),
      averageAgeMonths: toNumber(transitions?.averageAgeMonths),
      averageDeltaHours: toNumber(transitions?.averageDeltaHours),
      corridorRemainPct: toNumber(transitions?.corridorRemainPct),
    },
    ageDistribution: {
      krippePct: toNumber(ageDistribution?.krippePct),
      regelPct: toNumber(ageDistribution?.regelPct),
      schulePct: toNumber(ageDistribution?.schulePct),
    },
    finance: {
      income: toNumber(finance?.income),
      expenses: toNumber(finance?.expenses),
      net: toNumber(finance?.net),
      careRatio: toNumber(finance?.careRatio),
      expertRatio: toNumber(finance?.expertRatio),
    },
  };
}

export function computeAnalysisInsights(metricsInput) {
  const metrics = buildAnalysisMetrics(metricsInput || {});
  const alerts = [];

  const bookingShare = metrics.dataQuality.missingBookingShare;
  const bookingSeverity = classifySeverity(bookingShare, 5, 10);
  if (bookingSeverity !== 'low') {
    alerts.push(createAlert({
      id: 'dq-missing-booking',
      stepId: 'quality',
      severity: bookingSeverity,
      title: 'Datenqualitaet: Fehlende Buchungen',
      statement: `${formatPercent(bookingShare)} der Datensaetze haben keine Buchung.`,
      measure: 'Fehlende Buchungen bearbeiten und Erfassungs-Queue ausfuehren.',
    }));
  }

  const missingGroupShare = metrics.dataQuality.missingGroupShare;
  const groupSeverity = classifySeverity(missingGroupShare, 3, 8);
  if (groupSeverity !== 'low') {
    alerts.push(createAlert({
      id: 'dq-missing-group',
      stepId: 'quality',
      severity: groupSeverity,
      title: 'Datenqualitaet: Fehlende Gruppenzuordnung',
      statement: `${formatPercent(missingGroupShare)} der Datensaetze haben keine aktive Gruppe.`,
      measure: 'Gruppenzuordnung fuer offene Faelle nachpflegen.',
    }));
  }

  const overloadShare = metrics.utilization.overloadSharePct;
  const overloadSeverity = classifySeverity(overloadShare, 10, 20);
  if (overloadSeverity !== 'low') {
    alerts.push(createAlert({
      id: 'util-overload-share',
      stepId: 'utilization',
      severity: overloadSeverity,
      title: 'Auslastung: Ueberlastete Zeitfenster',
      statement: `${formatPercent(overloadShare)} der Zeitfenster liegen ueber Kapazitaet.`,
      measure: 'Dienstplaene und Kapazitaetsblenden in Peak-Zeiten pruefen.',
    }));
  }

  const corridorRemain = metrics.transitions.corridorRemainPct;
  const corridorSeverity = corridorRemain < 70 ? 'high' : corridorRemain < 80 ? 'medium' : 'low';
  if (corridorSeverity !== 'low') {
    alerts.push(createAlert({
      id: 'trans-corridor-remain',
      stepId: 'transitions',
      severity: corridorSeverity,
      title: 'Uebergaenge: Niedriger Verbleib im Regelkorridor',
      statement: `Nur ${formatPercent(corridorRemain)} verbleiben im Regelkorridor.`,
      measure: 'Uebergangsregeln und Wechselzeitpunkte fachlich pruefen.',
    }));
  }

  const net = metrics.finance.net;
  const netSeverity = net < 0 ? 'high' : net < 500 ? 'medium' : 'low';
  if (netSeverity !== 'low') {
    alerts.push(createAlert({
      id: 'fin-net',
      stepId: 'kpis',
      severity: netSeverity,
      title: 'Finanzen: Kritischer Saldo',
      statement: `Aktueller Saldo liegt bei ${Math.round(net)} EUR.`,
      measure: 'Einnahmen-/Ausgabenstruktur und Personalaufwand abstimmen.',
    }));
  }

  const sortedAlerts = [...alerts].sort((left, right) => {
    const severityDelta = rankSeverity(right.severity) - rankSeverity(left.severity);
    if (severityDelta !== 0) return severityDelta;
    return left.id.localeCompare(right.id);
  });

  const topAlerts = sortedAlerts.slice(0, 3);

  const stepStatements = {
    quality: topAlerts.find((entry) => entry.stepId === 'quality')?.statement
      || `Datenbasis: ${metrics.dataQuality.totalRecords} aktive Datensaetze, fehlende Buchungen ${formatPercent(bookingShare)}.`,
    stock: `Bestand aktuell: ${metrics.latest.childrenCount} Kinder, ${metrics.latest.bookingHours} Buchungsstunden, ${metrics.latest.careHours} Betreuungsstunden.`,
    utilization: topAlerts.find((entry) => entry.stepId === 'utilization')?.statement
      || `Ueberlastanteil liegt bei ${formatPercent(overloadShare)}; mittlere Ueberlast ${Math.round(metrics.utilization.meanOverloadHours * 10) / 10} h.`,
    transitions: topAlerts.find((entry) => entry.stepId === 'transitions')?.statement
      || `Uebergaenge: ${metrics.transitions.count} Faelle, Ø Alter ${Math.round(metrics.transitions.averageAgeMonths * 10) / 10} Monate.`,
    age: `Altersanteile: Krippe ${formatPercent(metrics.ageDistribution.krippePct)}, Regelgruppe ${formatPercent(metrics.ageDistribution.regelPct)}, Schule ${formatPercent(metrics.ageDistribution.schulePct)}.`,
    kpis: topAlerts.find((entry) => entry.stepId === 'kpis')?.statement
      || `Saldo ${Math.round(metrics.finance.net)} EUR, Betreuungsschluessel ${Math.round(metrics.finance.careRatio * 10) / 10}, Fachkraftquote ${Math.round(metrics.finance.expertRatio * 10) / 10}%.`,
    summary: topAlerts.length > 0
      ? `Priorisierte Handlungsfelder: ${topAlerts.map((entry) => entry.title).join(', ')}.`
      : 'Keine kritischen Alerts im aktuellen Analysefenster.',
  };

  return {
    metrics,
    alerts: sortedAlerts,
    topAlerts,
    stepStatements,
    measures: topAlerts.map((entry) => entry.measure),
  };
}
