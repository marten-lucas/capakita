import { collectRelevantDatesFromObjects } from "../financialUtils";
import { buildPeriodsFromDates } from "../../dateUtils";
import { getCurrentBayKiBiGConfig, calcBayKiBiGFoerderung } from "../../BayKiBiG-calculator";
import { getAverageWeeklyBookingTimes } from "../../bookingUtils";
import { getGroupAssignements } from "../../groupsUtils";



/**
 * updatePayments für income-baykibig
 * @param {Object} financial
 * @param {Object} dataItem - das Kind
 * @param {Array} bookings - Buchungen für das Kind
 * @param {Array} groupDefs - Gruppen-Definitionen (optional)
 * @param {Object|Array} groupAssignments - Gruppen-Zuordnungen für das Kind (optional)
 * @returns {Array} payments
 */
export function updatePayments(financial, dataItem, bookings, groupDefs = [], groupAssignments = {}) {
    const config = getCurrentBayKiBiGConfig();

    console.log('BayKiBiGIncomeCalculator: updatePayments called', { financial, dataItem, bookings, groupDefs, groupAssignments });

    const dates = collectRelevantDatesFromObjects([
        [dataItem],
        bookings,
        [financial],
        groupAssignments
    ]);
    // Optional: config-Änderungen als Periodenwechsel (hier ignoriert, da statisch)

    // 2. Perioden bilden
    let periods = buildPeriodsFromDates(dates);

    
    const payments = periods.map(period => {
        const { valid_from, valid_to } = period;

        // Durchschnittliche tägliche Buchungszeit (Mo-Fr) für die Periode
        const dailyHours = getAverageWeeklyBookingTimes(bookings, valid_from, valid_to);
        const groupAssignments = getGroupAssignements(dataItem, valid_from);
        // Förderung berechnen
        const { staatlich, kommunal } = calcBayKiBiGFoerderung({
            child: dataItem,
            groupAssignments,
            hours: dailyHours,
            config,
            periodStart: valid_from
        });

        return {
            valid_from,
            valid_to,
            amount: Math.round((staatlich + kommunal) * 100) / 100,
            frequency: "monthly",
            currency: 'EUR',
            type: 'income'
        };
    });

    return payments;
}
