import { generateExpertRatioTimeDimension, generateCareRatioTimeDimension } from '../chartUtils/chartUtils';
import { sumBookingHours } from '../bookingUtils';
import { getPeriodBoundsForCategory, rangesOverlap, resolveGroupIdAtDate, splitBookingByGroupAtDate } from '../financeUtils';
import { shouldIncludeDataItemInAnalysis } from '../dataVisibility';
import { segmentMatchesMode } from '../bookingUtils';
import { timeToMinutes } from '../timeUtils';

function normalizeDateValue(value) {
    if (value === null || value === undefined) return '';

    const text = String(value).trim();
    if (!text) return '';

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
        return text.slice(0, 10);
    }

    const europeanMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
    if (europeanMatch) {
        const day = europeanMatch[1].padStart(2, '0');
        const month = europeanMatch[2].padStart(2, '0');
        const year = europeanMatch[3];
        return `${year}-${month}-${day}`;
    }

    return text;
}

function getItemStart(item) {
    return normalizeDateValue(
        item?.startdate
        || item?.start
        || item?.validFrom
        || item?.valid_from
        || item?.rawdata?.GUELTIGAB
        || item?.rawdata?.GULTIGAB
        || item?.rawdata?.GUELTIG_AB
        || ''
    );
}

function getItemEnd(item) {
    return normalizeDateValue(
        item?.enddate
        || item?.end
        || item?.validUntil
        || item?.valid_until
        || item?.rawdata?.GUELTIGBIS
        || item?.rawdata?.GULTIGBIS
        || item?.rawdata?.GUELTIG_BIS
        || ''
    );
}

function getBookingStart(booking) {
    return normalizeDateValue(
        booking?.startdate
        || booking?.start
        || booking?.validFrom
        || booking?.valid_from
        || ''
    );
}

function getBookingEnd(booking) {
    return normalizeDateValue(
        booking?.enddate
        || booking?.end
        || booking?.validUntil
        || booking?.valid_until
        || ''
    );
}

function getSegmentShareFactor(segment) {
    const allocation = Number(segment?.allocationSharePercent);
    if (!Number.isFinite(allocation)) return 1;
    return Math.max(0, allocation) / 100;
}

function sumWeightedBookingHours(booking, options = {}) {
    if (!Array.isArray(booking?.times)) return 0;
    const mode = options.mode || 'all';
    let totalMinutes = 0;

    booking.times.forEach((day) => {
        if (!Array.isArray(day?.segments)) return;
        day.segments.forEach((segment) => {
            if (!segmentMatchesMode(segment, mode)) return;

            const startMinutes = timeToMinutes(segment?.booking_start);
            const endMinutes = timeToMinutes(segment?.booking_end);
            if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;

            totalMinutes += (endMinutes - startMinutes) * getSegmentShareFactor(segment);
        });
    });

    return totalMinutes / 60;
}

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

    function groupMatchesSelection(groupId) {
        if (selectedGroups.length === 0) return true;
        if (groupId && selectedGroups.includes(String(groupId))) return true;
        if (selectedGroups.includes('__NO_GROUP__') && !groupId) return true;
        return false;
    }

    const filteredDemandBookings = [];
    const filteredCapacityBookings = [];

    Object.entries(dataItems).forEach(([itemId, item]) => {
        const itemStart = getItemStart(item);
        const itemEnd = getItemEnd(item);

        if (!item || !rangesOverlap(itemStart, itemEnd, chartRange.start, chartRange.end)) {
            return;
        }
        if (!shouldIncludeDataItemInAnalysis(item)) {
            return;
        }

        const groupId = resolveGroupIdAtDate(
            groupAssignments[itemId] || {},
            referenceDate,
            item.groupId || null
        ) || null;

        const groupMatch = groupMatchesSelection(groupId);

        const itemBookings = Object.values(bookings[itemId] || {});
        if (item.type === 'demand') {
            if (!groupMatch) {
                return;
            }
            itemBookings.forEach((booking) => {
                if (rangesOverlap(getBookingStart(booking), getBookingEnd(booking), chartRange.start, chartRange.end) && sumBookingHours(booking) > 0) {
                    filteredDemandBookings.push({
                        ...booking,
                        itemId,
                        groupId,
                        bookingStart: getBookingStart(booking),
                        bookingEnd: getBookingEnd(booking),
                        itemStart,
                        itemEnd,
                    });
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
                if (!rangesOverlap(getBookingStart(booking), getBookingEnd(booking), chartRange.start, chartRange.end)
                    || sumWeightedBookingHours(booking, { mode: 'pedagogical' }) <= 0) {
                    return;
                }

                const splitBookings = splitBookingByGroupAtDate(
                    booking,
                    groupAssignments[itemId] || {},
                    referenceDate,
                    item.groupId || null
                );

                splitBookings.forEach((splitBooking) => {
                    if (!groupMatchesSelection(splitBooking.groupId)) return;
                    if (sumWeightedBookingHours(splitBooking, { mode: 'pedagogical' }) <= 0) return;

                    filteredCapacityBookings.push({
                        ...splitBooking,
                        itemId,
                        groupId: splitBooking.groupId,
                        qualifications: qualiKeys,
                        bookingStart: getBookingStart(splitBooking),
                        bookingEnd: getBookingEnd(splitBooking),
                        itemStart,
                        itemEnd,
                    });
                });
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
                const bookingOverlaps = periodBounds
                    ? rangesOverlap(booking.bookingStart || getBookingStart(booking), booking.bookingEnd || getBookingEnd(booking), periodBounds.start, periodBounds.end)
                    : ((!(booking.bookingStart || getBookingStart(booking)) || (booking.bookingStart || getBookingStart(booking)) <= cat) && (!(booking.bookingEnd || getBookingEnd(booking)) || (booking.bookingEnd || getBookingEnd(booking)) >= cat));

                const itemOverlaps = periodBounds
                    ? rangesOverlap(booking.itemStart || '', booking.itemEnd || '', periodBounds.start, periodBounds.end)
                    : ((!booking.itemStart || booking.itemStart <= cat) && (!booking.itemEnd || booking.itemEnd >= cat));

                if (bookingOverlaps && itemOverlaps) {
                    totalHours += sumWeightedBookingHours(booking, { mode });
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
