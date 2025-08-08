import { getPaymentSum4Period } from "../financialCalculators/financialUtils";

// Generate a tooltip for the financial chart
export function generateFinancialChartTooltip(points, x) {
  let s = `<b>${x}</b><br/>`;
  points.forEach(point => {
    s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y} €<br/>`;
  });
  return s;
}

// Generate categories for the financial chart (similar to midterm)
export function generateFinancialCategories(timedimension, events) {
  // Use the same logic as generateMidtermCategories
  // Find the earliest and latest event date
  if (!Array.isArray(events) || events.length === 0) return [];
  const dates = events
    .map(ev => ev.effectiveDate)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return [];
  // Start with today instead of first event date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDate = today;
  const lastDate = new Date(dates[dates.length - 1]);

  // Helper: format label for each timedimension
  function formatLabel(date) {
    switch (timedimension) {
      case 'week': {
        const d = new Date(date.getTime());
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
        const week1 = new Date(d.getFullYear(), 0, 4);
        const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
        return `${d.getFullYear()}-W${weekNum}`;
      }
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'quarter': {
        const q = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${q}`;
      }
      case 'year':
        return `${date.getFullYear()}`;
      default:
        return date.toISOString().slice(0, 10);
    }
  }

  // Helper: step date forward by timedimension
  function stepDate(date) {
    const d = new Date(date.getTime());
    switch (timedimension) {
      case 'week':
        d.setDate(d.getDate() + 7);
        break;
      case 'month':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'quarter':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'year':
        d.setFullYear(d.getFullYear() + 1);
        break;
      default:
        d.setDate(d.getDate() + 1);
    }
    return d;
  }

  // Generate categories from firstDate to lastDate
  const categories = [];
  let current = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
  let lastLabel = formatLabel(lastDate);
  while (formatLabel(current) <= lastLabel) {
    categories.push(formatLabel(current));
    current = stepDate(current);
  }
  return categories;
}



// Helper to get period start/end for a category label
function getCategoryPeriod(category, timedimension) {
  // For simplicity, assume category is an ISO date string for 'month', 'week', etc.
  // You may want to improve this for quarters/years.
  let start, end;
  if (timedimension === 'month') {
    start = new Date(category + '-01');
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // last day of month
  } else if (timedimension === 'year') {
    start = new Date(category + '-01-01');
    end = new Date(category + '-12-31');
  } else if (timedimension === 'quarter') {
    // Assume category is "YYYY-Qn"
    const [year, q] = category.split('-Q');
    const quarter = Number(q);
    start = new Date(Number(year), (quarter - 1) * 3, 1);
    end = new Date(Number(year), quarter * 3, 0); // last day of quarter
  } else if (timedimension === 'week') {
    // Assume category is ISO week string: "2024-W01"
    const [year, week] = category.split('-W').map(Number);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    start = new Date(simple);
    end = new Date(simple);
    end.setDate(end.getDate() + 6);
  } else {
    // fallback: treat as month
    start = new Date(category + '-01');
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
  }
  return { start, end };
}

// Calculate chart data for the financial chart (prototype)
export function calculateChartDataFinancial({
  categories,
  financialEntries,
  timedimension
}) {
  const expenses = [];
  const income = [];

  categories.forEach(category => {
    
    const { start: catStart, end: catEnd } = getCategoryPeriod(category, timedimension);

    // Use getPaymentSum4Period with all financialEntries at once for each type
    const { sum: expenseTotal } = getPaymentSum4Period(
      catStart.toISOString().slice(0, 10),
      catEnd.toISOString().slice(0, 10),
      financialEntries,
      { types: ['expense'] }
    );
    const { sum: incomeTotal } = getPaymentSum4Period(
      catStart.toISOString().slice(0, 10),
      catEnd.toISOString().slice(0, 10),
      financialEntries,
      { types: ['income'] }
    );

    expenses.push(expenseTotal);
    income.push(incomeTotal);
  });
  console.log("[calculateChartDataFinancial] categories:", categories, "expenses:", expenses, "income:", income);
  return {
    categories: [...categories],
    expenses,
    income
  };
}
