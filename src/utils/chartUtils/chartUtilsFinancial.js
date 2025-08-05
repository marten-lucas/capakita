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
  // For now, just reuse the logic from midterm (e.g., months, quarters, etc.)
  // You can later customize this for financial-specific needs.
  // If you want to avoid a dependency, copy the logic from generateMidtermCategories here.
  // Otherwise, import and use it.
  // Example (assuming you want to keep it simple for now):
  if (!Array.isArray(events)) return [];
  // Find all unique periods based on timedimension
  const periods = new Set();
  events.forEach(event => {
    if (event.periods && Array.isArray(event.periods)) {
      event.periods.forEach(period => {
        if (period[timedimension]) periods.add(period[timedimension]);
      });
    }
  });
  return Array.from(periods).sort();
}

// Helper to check if two periods overlap (inclusive)
function periodsOverlap(startA, endA, startB, endB) {
  return !(endA < startB || endB < startA);
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
  financialDefs,
  dataItems,
  timedimension
}) {
  const expenses = [];
  const income = [];

  categories.forEach(category => {
    let expenseSum = 0;
    let incomeSum = 0;
    const { start: catStart, end: catEnd } = getCategoryPeriod(category, timedimension);

    financialEntries.forEach(financial => {
      if (!Array.isArray(financial.payments)) return;
      financial.payments.forEach(payment => {
        // Parse payment period
        const payStart = new Date(payment.valid_from);
        const payEnd = new Date(payment.valid_to);
        if (periodsOverlap(catStart, catEnd, payStart, payEnd)) {
          if (payment.type === 'income') {
            incomeSum += payment.amount || 0;
          } else if (payment.type === 'expense') {
            expenseSum += payment.amount || 0;
          }
        }
      });
    });

    expenses.push(expenseSum);
    income.push(incomeSum);
  });

  return {
    categories: [...categories],
    expenses,
    income
  };
}
