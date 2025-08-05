import { generateExpertRatioTimeDimension, generateCareRatioTimeDimension, filterBookings } from '../chartUtils/chartUtils';
import { sumBookingHours } from '../bookingUtils';

/**
 * Generate categories for midterm chart from today until the latest event date.
 * @param {string} timedimension - 'week' | 'month' | 'quarter' | 'year'
 * @param {Array} events - Array of event objects with effectiveDate
 * @returns {Array} categories - Array of time labels
 */
export function generateMidtermCategories(timedimension, events) {
    // Find the latest event date
    const today = new Date();
    let latestDate = today;
    if (Array.isArray(events) && events.length > 0) {
        const maxDateStr = events.reduce((max, ev) => {
            if (ev.effectiveDate && ev.effectiveDate > max) return ev.effectiveDate;
            return max;
        }, today.toISOString().slice(0, 10));
        latestDate = new Date(maxDateStr);
    }

    // Helper: format label for each timedimension
    function formatLabel(date) {
        switch (timedimension) {
            case 'week': {
                // ISO week number
                const d = new Date(date.getTime());
                d.setHours(0, 0, 0, 0);
                // Thursday in current week decides the year
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

    // Generate categories from today to latestDate
    const categories = [];
    let current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let lastLabel = formatLabel(latestDate);
    while (formatLabel(current) <= lastLabel) {
        categories.push(formatLabel(current));
        current = stepDate(current);
    }
    return categories;
}



/**
 * Calculate midterm chart data for given scenario and filters.
 * Uses categories generated externally (e.g. from generateMidtermCategories).
 */
export function calculateChartDataMidterm(
    categories,
    referenceDate,
    selectedGroups,
    selectedQualifications,
    {
        bookingsByScenario,
        dataByScenario,
        groupDefs,
        qualificationDefs,
        groupsByScenario,
        qualificationAssignmentsByScenario,
        overlaysByScenario,
        scenarioId,
        timedimension
    }
) {
    // No scenario chain logic here, only use the passed-in data
    const { demand: filteredDemandBookings, capacity: filteredCapacityBookings } = filterBookings({
        bookingsByScenario,
        dataByScenario,
        qualificationAssignmentsByScenario,
        overlaysByScenario,
        scenarioId,
        referenceDate,
        selectedGroups,
        selectedQualifications,
        groupsByScenario
    });

    // Demand/capacity per category: sum booking hours
    function generateBookingDataSeries(referenceDate, filteredBookings, categories) {
        const series = new Array(categories.length).fill(0);
        if (!categories || categories.length === 0) return [];
        categories.forEach((cat, idx) => {
            let totalHours = 0;
            filteredBookings.forEach(booking => {
                // For midterm, booking must be active at the category date
                const isActive = (!booking.startdate || booking.startdate <= cat)
                    && (!booking.enddate || booking.enddate >= cat);
                if (isActive) {
                    totalHours += sumBookingHours(booking);
                }
            });
            series[idx] = totalHours;
        });
        return series.map(val => val);
    }

    const demand = generateBookingDataSeries(referenceDate, filteredDemandBookings, categories);
    const capacity = generateBookingDataSeries(referenceDate, filteredCapacityBookings, categories);

    // careRatio and expertRatio per timedimension
    const care_ratio = generateCareRatioTimeDimension(
        categories,
        timedimension,
        filteredDemandBookings,
        filteredCapacityBookings,
        dataByScenario[scenarioId],
        groupDefs || []
    );
    const expert_ratio = generateExpertRatioTimeDimension(
        categories,
        timedimension,
        filteredCapacityBookings,
        qualificationDefs || []
    );

    return {
        categories: [...categories],
        demand: [...demand],
        maxdemand: Math.max(...demand, 0),
        capacity: [...capacity],
        maxcapacity: Math.max(...capacity, 0),
        care_ratio: [...care_ratio],
        max_care_ratio: Math.max(...care_ratio, 0),
        expert_ratio: [...expert_ratio],
        maxexpert_ratio: Math.max(...expert_ratio, 0),
    };
}
