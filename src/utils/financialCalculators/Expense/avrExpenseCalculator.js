import { 
  getSalaryForGroupAndStage, 
  normalizeDateString, 
  getAllSalaryGroups, 
  getAllSalaryStages, 
  getAllBonusTypes,
  getBonusDefinition,
  calcAvrChildBonus,
  calcAvrInstructorBonus,
  calcAvrYearlyBonus
<<<<<<< HEAD
<<<<<<< HEAD
} from './avrUtils';
=======
} from './avr-calculator';
>>>>>>> df9580b (restructured folrder)
=======
} from './avr-calculator';
>>>>>>> df9580b622e2313ef0fed77965c12629ee4f9637
import { useState } from 'react';

export function useAvrExpenseCalculator({ financial, onChange, item }) {
  // State for bonus menu (must be called unconditionally)
  const [bonusMenuAnchor, setBonusMenuAnchor] = useState(null);
  const bonusMenuOpen = Boolean(bonusMenuAnchor);

  // Get Eintrittsdatum from parseddata.startdate, fallback to empty string
  const eintrittsdatum = item?.parseddata?.startdate
    ? item.parseddata.startdate.split('.').reverse().join('-')
    : '';

  // Hilfsfunktion: Hole Wochenstunden und fulltimeHours
  const getWochenstunden = () => {
    // Try to get from worktime field (handle German decimal format)
    let worktime = item?.parseddata?.worktime || item?.parseddata?.wochenstunden || financial.wochenstunden;
    if (worktime && typeof worktime === 'string') {
      // Replace German decimal comma with dot
      worktime = worktime.replace(',', '.');
    }
    let wochenstunden = Number(worktime) || 0;
    
    // Note: worktime should now be automatically calculated from bookings
    // This fallback calculation is kept for safety but should rarely be needed
    if (wochenstunden === 0 && item?.parseddata?.booking) {
      let totalMinutesPerWeek = 0;
      item.parseddata.booking.forEach(booking => {
        if (booking.times) {
          booking.times.forEach(dayTime => {
            if (dayTime.segments) {
              dayTime.segments.forEach(segment => {
                if (segment.booking_start && segment.booking_end) {
                  const [sh, sm] = segment.booking_start.split(':').map(Number);
                  const [eh, em] = segment.booking_end.split(':').map(Number);
                  const minutes = (eh * 60 + em) - (sh * 60 + sm);
                  if (minutes > 0) totalMinutesPerWeek += minutes;
                }
              });
            }
          });
        }
      });
      wochenstunden = totalMinutesPerWeek / 60;
    }
    
    return wochenstunden;
  };
  
  const wochenstunden = getWochenstunden();
  // Use today's date as reference for AVR calculator, normalized
  // Hole fulltimeHours aus AVR-Daten

  if (financial.type === 'expense-avr') {
    // Use today's date as reference for AVR calculator, normalized
    const todayStr = normalizeDateString(new Date().toISOString().slice(0, 10));

    // Gruppe options from reference data
    const groupOptions = getAllSalaryGroups(todayStr); // [{group_id, group_name}]

    // Find selected group name by group_id
    const selectedGroup = groupOptions.find(g => g.group_id === financial.group);
    const selectedGroupName = selectedGroup ? selectedGroup.group_name : '';

    // Stufe options from reference data
    const stageOptions = financial.group
      ? getAllSalaryStages(todayStr, financial.group).map(a => ({
          value: a.stage,
          label: `Stufe ${a.stage}`
        }))
      : [];

    // Determine salary using AVR calculator
    let avrSalary = null;
    if (financial.group && financial.stage) {
      avrSalary = getSalaryForGroupAndStage(
        todayStr,
        selectedGroupName,
        financial.stage // pass stage id directly
      );
    }

    // Zuschläge-Handler

    // Get bonus types for the reference date
    const bonusTypes = getAllBonusTypes(todayStr);

    // Bonus-Beträge berechnen und Zusatzinfos holen
    const bonusRows = bonusTypes.map(bonus => {
      const def = getBonusDefinition(todayStr, bonus.value);
      let amount = '';
      let payout = '';
      let payoutDate = null;
      let startInput = null;
      let endInput = null;
      let continueOnAbsence = !!def?.continue_on_absence;

      // Start/Ende bestimmen
      let bonusStart = '';
      let bonusEnd = '';
      if (def?.startdate === 'input') {
        bonusStart = financial[`${bonus.value}_start`] || '';
        startInput = true;
      } else if (def?.startdate === 'simulationdata') {
        bonusStart = item?.parseddata?.startdate || '';
      }
      if (def?.enddate === 'input') {
        bonusEnd = financial[`${bonus.value}_end`] || '';
        endInput = true;
      } else if (def?.enddate === 'simulationdata') {
        bonusEnd = item?.parseddata?.enddate || '';
      }

      // Betrag berechnen
      if (bonus.value === 'avr-childbonus') {
        amount = calcAvrChildBonus(todayStr, financial.kinderanzahl || 0, wochenstunden);
        payout = 'Monatlich';
      } else if (bonus.value === 'avr-instructor') {
        amount = calcAvrInstructorBonus(todayStr, wochenstunden, bonusStart, bonusEnd);
        payout = 'Monatlich';
      } else if (bonus.value === 'avr-yearly') {
        const yearly = calcAvrYearlyBonus(
          todayStr,
          selectedGroupName,
          financial.stage,
          wochenstunden,
          bonusStart,
          bonusEnd
        );
        amount = yearly.amount;
        payout = 'Jährlich';
        payoutDate = yearly.payoutDate;
      }

      return {
        ...bonus,
        amount,
        payout,
        payoutDate,
        startInput,
        endInput,
        bonusStart,
        bonusEnd,
        continueOnAbsence,
        def
      };
    });

    // Handler für Start/Ende Input
    const handleBonusDateChange = (bonusKey, field, value) => {
      onChange({
        ...financial,
        [`${bonusKey}_${field}`]: value
      });
    };

    // Handler to "hide" a bonus type for this financial entry
    const handleBonusDelete = (bonusType) => {
      const disabledBonuses = Array.isArray(financial.disabledBonuses)
        ? [...financial.disabledBonuses, bonusType]
        : [bonusType];
      onChange({
        ...financial,
        disabledBonuses
      });
    };

    // Handler to add a bonus type by removing it from disabled list
    const handleBonusAdd = (bonusType) => {
      const disabledBonuses = Array.isArray(financial.disabledBonuses)
        ? financial.disabledBonuses.filter(type => type !== bonusType)
        : [];
      onChange({
        ...financial,
        disabledBonuses
      });
      setBonusMenuAnchor(null);
    };

    // Filter out disabled bonuses
    const filteredBonusRows = Array.isArray(financial.disabledBonuses)
      ? bonusRows.filter(row => !financial.disabledBonuses.includes(row.value))
      : bonusRows;

    // Calculate available bonus types (those that are currently disabled)
    const availableBonusTypes = Array.isArray(financial.disabledBonuses)
      ? bonusTypes.filter(bonus => financial.disabledBonuses.includes(bonus.value))
      : [];

    // Calculate total yearly amount including all bonuses
    let totalYearlyAmount = 0;
    if (avrSalary) {
      totalYearlyAmount += avrSalary * 12;
    }
    filteredBonusRows.forEach(row => {
      if (row.payout === 'Monatlich' && row.amount) {
        totalYearlyAmount += Number(row.amount) * 12;
      } else if (row.payout === 'Jährlich' && row.amount) {
        totalYearlyAmount += Number(row.amount);
      }
    });

    return {
      groupOptions,
      stageOptions,
      avrSalary,
      bonusRows,
      eintrittsdatum,
      wochenstunden,
      handleBonusDateChange,
      handleBonusDelete,
      handleBonusAdd,
      availableBonusTypes, // <-- now defined
      filteredBonusRows,
      bonusMenuAnchor,
      setBonusMenuAnchor,
      bonusMenuOpen,
      totalYearlyAmount,
    };
  }

  return {};
}