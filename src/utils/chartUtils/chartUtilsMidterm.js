import { generateExpertRatioTimeDimension, generateCareRatioTimeDimension } from '../chartUtils/chartUtils';
import { sumBookingHours } from '../bookingUtils';
import { getPeriodBoundsForCategory, rangesOverlap } from '../financeUtils';
import { shouldIncludeDataItemInAnalysis } from '../dataVisibility';

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
 * Format a single ISO date string into the category label used by generateMidtermCategories
 * @param {string} timedimension
 * @param {string} dateStr - ISO date "YYYY-MM-DD"
 * @returns {string} label matching category format
 */
export function formatDateToCategory(timedimension, dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    function formatLabel(d) {
        switch (timedimension) {
            case 'week': {
                const dd = new Date(d.getTime());
                dd.setHours(0, 0, 0, 0);
                dd.setDate(dd.getDate() + 3 - ((dd.getDay() + 6) % 7));
                const week1 = new Date(dd.getFullYear(), 0, 4);
                const weekNum = 1 + Math.round(((dd.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
                return `${dd.getFullYear()}-W${weekNum}`;
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

    return formatLabel(date);
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
        scenarioId,
        timedimension
    }
) {
    const categoryBounds = (categories || [])
        .map((category) => getPeriodBoundsForCategory(timedimension, category))
        .filter(Boolean);
    const chartRange = categoryBounds.length > 0
        ? {
            start: categoryBounds[0].start,
            end: categoryBounds[categoryBounds.length - 1].end,
        }
        : { start: referenceDate, end: referenceDate };

    const bookings = bookingsByScenario[scenarioId] || {};
    const dataItems = dataByScenario[scenarioId] || {};
    const qualificationAssignments = qualificationAssignmentsByScenario[scenarioId] || {};
    const groupAssignments = groupsByScenario?.[scenarioId] || {};

    function resolveGroupId(itemId, date) {
        const assignments = groupAssignments[itemId] || {};
        const activeAssignment = Object.values(assignments).find((assignment) => {
            const startOk = !assignment.start || assignment.start <= date;
            const endOk = !assignment.end || assignment.end >= date;
            return startOk && endOk;
        });
        return activeAssignment?.groupId || null;
    }

    const filteredDemandBookings = [];
    const filteredCapacityBookings = [];

    Object.entries(dataItems).forEach(([itemId, item]) => {
        if (!item || !rangesOverlap(item.startdate || '', item.enddate || '', chartRange.start, chartRange.end)) {
            return;
        }
        if (!shouldIncludeDataItemInAnalysis(item)) {
            return;
        }

        const groupId = resolveGroupId(itemId, referenceDate) || item.groupId || null;

        let groupMatch = false;
        if (selectedGroups.length === 0) {
            groupMatch = true;
        } else if (groupId && selectedGroups.includes(groupId)) {
            groupMatch = true;
        } else if (Array.isArray(groupId) && groupId.some((groupKey) => selectedGroups.includes(groupKey))) {
            groupMatch = true;
        } else if (selectedGroups.includes('__NO_GROUP__') && (!groupId || groupId === '')) {
            groupMatch = true;
        }

        if (!groupMatch) {
            return;
        }

        const itemBookings = Object.values(bookings[itemId] || {});
        if (item.type === 'demand') {
            itemBookings.forEach((booking) => {
                if (rangesOverlap(booking.startdate || '', booking.enddate || '', chartRange.start, chartRange.end) && sumBookingHours(booking) > 0) {
                    filteredDemandBookings.push({ ...booking, itemId, groupId });
                }
            });
            return;
        }

        if (item.type === 'capacity') {
            const qualiAssignments = Object.values(qualificationAssignments[itemId] || {});
            const qualiKeys = qualiAssignments.map((assignment) => assignment.qualification);

            let qualificationMatch = false;
            if (selectedQualifications.length === 0) {
                qualificationMatch = true;
            } else if (qualiKeys.some((qualification) => selectedQualifications.includes(qualification))) {
                qualificationMatch = true;
            } else if (selectedQualifications.includes('__NO_QUALI__') && qualiKeys.length === 0) {
                qualificationMatch = true;
            }

            if (!qualificationMatch) {
                return;
            }

            itemBookings.forEach((booking) => {
                if (rangesOverlap(booking.startdate || '', booking.enddate || '', chartRange.start, chartRange.end)
                    && sumBookingHours(booking, { mode: 'pedagogical' }) > 0) {
                    filteredCapacityBookings.push({ ...booking, itemId, groupId, qualifications: qualiKeys });
                }
            });
        }
    });

    // Demand/capacity per category: sum booking hours
    function generateBookingDataSeries(referenceDate, filteredBookings, categories, mode = 'all') {
        const series = new Array(categories.length).fill(0);
        if (!categories || categories.length === 0) return [];
        categories.forEach((cat, idx) => {
            let totalHours = 0;
            const periodBounds = getPeriodBoundsForCategory(timedimension, cat);
            filteredBookings.forEach(booking => {
                const isActive = periodBounds
                    ? rangesOverlap(booking.startdate || '', booking.enddate || '', periodBounds.start, periodBounds.end)
                    : ((!booking.startdate || booking.startdate <= cat)
                        && (!booking.enddate || booking.enddate >= cat));
                if (isActive) {
                    totalHours += sumBookingHours(booking, { mode });
                }
            });
            series[idx] = totalHours;
        });
        return series.map(val => val);
    }

    const demand = generateBookingDataSeries(referenceDate, filteredDemandBookings, categories, 'all');
    const capacity_pedagogical = generateBookingDataSeries(referenceDate, filteredCapacityBookings, categories, 'pedagogical');
    const capacity_administrative = generateBookingDataSeries(referenceDate, filteredCapacityBookings, categories, 'administrative');
    const capacity = capacity_pedagogical.map((value, index) => value + (capacity_administrative[index] || 0));

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
        capacity_pedagogical: [...capacity_pedagogical],
        capacity_administrative: [...capacity_administrative],
        maxcapacity: Math.max(...capacity, 0),
        care_ratio: [...care_ratio],
        max_care_ratio: Math.max(...care_ratio, 0),
        expert_ratio: [...expert_ratio],
        maxexpert_ratio: Math.max(...expert_ratio, 0),
    };
}
