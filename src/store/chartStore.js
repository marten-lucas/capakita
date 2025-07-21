import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';

// Hilfsfunktion für Zeitsegmente
function generateTimeSegments() {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const startHour = 7; // 7:00
  const endHour = 17; // 17:00
  const segments = [];
  for (let d = 0; d < days.length; d++) {
    for (let h = startHour; h <= endHour; h += 0.5) {
      const hour = Math.floor(h);
      const min = h % 1 === 0 ? '00' : '30';
      segments.push(`${days[d]} ${hour}:${min}`);
    }
  }
  return segments;
}

const useChartStore = create(
  persist(
    (set, get) => ({
      // Chart settings
      stichtag: new Date().toISOString().slice(0, 10),
      selectedGroups: [],
      selectedQualifications: [], // Add qualification filter
      categories: generateTimeSegments(),
      availableGroups: [], // Store available groups
      availableQualifications: [], // Store available qualifications
      
      // Midterm chart settings
      midtermTimeDimension: 'Wochen', // 'Wochen', 'Monate', 'Jahre'
      midtermSelectedGroups: [],
      midtermSelectedQualifications: [],
      
      // Scenario selection for charts
      weeklySelectedScenarioId: null,
      setWeeklySelectedScenarioId: (id) => set({ weeklySelectedScenarioId: id }),
      midtermSelectedScenarioId: null,
      setMidtermSelectedScenarioId: (id) => set({ midtermSelectedScenarioId: id }),

      // Actions
      setStichtag: (date) => set(produce((state) => {
        state.stichtag = date;
      })),
      setSelectedGroups: (groups) => set(produce((state) => {
        state.selectedGroups = groups;
      })),
      setSelectedQualifications: (qualifications) => set(produce((state) => {
        state.selectedQualifications = qualifications;
      })),
      
      // Midterm actions
      setMidtermTimeDimension: (dimension) => set(produce((state) => {
        state.midtermTimeDimension = dimension;
      })),
      setMidtermSelectedGroups: (groups) => set(produce((state) => {
        state.midtermSelectedGroups = groups;
      })),
      setMidtermSelectedQualifications: (qualifications) => set(produce((state) => {
        state.midtermSelectedQualifications = qualifications;
      })),
      
      // Update available groups and auto-sync selection
      updateAvailableGroups: (allGroupNames) => {
        const state = get();
        const groupsCopy = [...allGroupNames];
        const currentGroupsString = JSON.stringify(groupsCopy.sort());
        const availableGroupsString = JSON.stringify([...state.availableGroups].sort());
        
        if (currentGroupsString !== availableGroupsString) {
          set(produce((draft) => {
            draft.availableGroups = groupsCopy;
            // Auto-select all groups when available groups change
            draft.selectedGroups = groupsCopy;
          }));
        }
      },
      
      // Update available qualifications and auto-sync selection
      updateAvailableQualifications: (allQualifications) => {
        const state = get();
        const qualificationsCopy = [...allQualifications];
        const currentQualificationsString = JSON.stringify(qualificationsCopy.sort());
        const availableQualificationsString = JSON.stringify([...state.availableQualifications].sort());
        
        if (currentQualificationsString !== availableQualificationsString) {
          set(produce((draft) => {
            draft.availableQualifications = qualificationsCopy;
            // Auto-select all qualifications when available qualifications change
            draft.selectedQualifications = qualificationsCopy;
          }));
        }
      },
      
      // Helper to check if item is booked in segment
      isBookedInSegment: (item, dayIdx, segmentStart, segmentEnd, groupNamesFilter, isDemand, stichtag, qualificationFilter) => {
        // Stichtag als Date
        const stichtagDate = new Date(stichtag);

        // Check if item is paused on the stichtag
        const pausedState = item.parseddata?.paused;
        if (pausedState?.enabled && pausedState.start && pausedState.end) {
          const pauseStart = new Date(pausedState.start);
          const pauseEnd = new Date(pausedState.end);
          
          // If stichtag falls within pause period, item is not booked
          if (stichtagDate >= pauseStart && stichtagDate <= pauseEnd) {
            return false;
          }
        }

        // Filter by qualification (only for capacity items) - moved to correct position
        if (item.type === 'capacity' && qualificationFilter && qualificationFilter.length > 0) {
          const qualification = item.parseddata?.qualification || 'keine Qualifikation';
          if (!qualificationFilter.includes(qualification)) {
            return false;
          }
        }

        // Filter nach Gruppen (für beide: Bedarf/Kinder und Kapazität/Mitarbeiter)
        const groups = item.parseddata?.group ?? [];
        if (groups.length === 0) {
          // Keine Gruppe - nur anzeigen wenn "keine Gruppe" ausgewählt ist
          if (!groupNamesFilter.includes('0')) return false;
        } else {
          // Hat Gruppen - prüfen ob mindestens eine ausgewählte Gruppe zum Stichtag gültig ist
          const hasValidGroup = groups.some(g => {
            // Always compare as string
            const groupIdStr = String(g.id);
            if (!groupNamesFilter.includes(groupIdStr)) return false;
            const start = g.start ? new Date(g.start.split('.').reverse().join('-')) : null;
            const end = g.end ? new Date(g.end.split('.').reverse().join('-')) : null;
            if (start && stichtagDate < start) return false;
            if (end && end !== '' && stichtagDate > end) return false;
            return true;
          });
          if (!hasValidGroup) return false;
        }

        // Buchungen prüfen: Nur Buchungen, die zum Stichtag gültig sind
        const bookings = item.parseddata?.booking ?? [];
        for (const booking of bookings) {
          const bookingStart = booking.startdate ? new Date(booking.startdate.split('.').reverse().join('-')) : null;
          const bookingEnd = booking.enddate ? new Date(booking.enddate.split('.').reverse().join('-')) : null;
          
          if (bookingStart && stichtagDate < bookingStart) continue;
          if (bookingEnd && bookingEnd !== '' && stichtagDate > bookingEnd) continue;
          for (const time of booking.times ?? []) {
            if (time.day !== dayIdx + 1) continue;
            for (const seg of time.segments ?? []) {
              // Zeitvergleich
              if (
                seg.booking_start &&
                seg.booking_end &&
                seg.booking_start <= segmentEnd &&
                seg.booking_end >= segmentStart
              ) {
                return true;
              }
            }
          }
        }
        return false;
      },
      
      // Calculate chart data - simplified without caching
      calculateChartData: (simulationData) => {
        const { categories, selectedGroups, selectedQualifications, stichtag, isBookedInSegment } = get();
        const n = categories.length;
        const bedarf = [];
        const kapazitaet = [];
        const baykibigAnstellungsschluessel = [];
        
        for (let i = 0; i < n; i++) {
          const cat = categories[i];
          const [dayName, timeStr] = cat.split(' ');
          const dayIdx = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayName);
          const [hour, min] = timeStr.split(':');
          const segmentStart = `${hour.padStart(2, '0')}:${min}`;
          let endHour = parseInt(hour, 10);
          let endMin = parseInt(min, 10) + 30;
          if (endMin >= 60) {
            endHour += 1;
            endMin -= 60;
          }
          const segmentEnd = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

          // Debug log for demand filtering
          const demandItems = simulationData.filter(
            item =>
              item.type === 'demand' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, true, stichtag, selectedQualifications)
          );
          if (i === 0) {
            console.log('[ChartStore][calculateChartData] Filters:', {
              selectedGroups,
              selectedQualifications,
              stichtag
            });
          }
          bedarf.push(demandItems.length);

          const capacityItems = simulationData.filter(
            item =>
              item.type === 'capacity' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, false, stichtag, selectedQualifications)
          );
          kapazitaet.push(capacityItems.length);

          const baykibigRatio = get().calculateBayKiBigRatio(demandItems, capacityItems, 0.5);
          baykibigAnstellungsschluessel.push(baykibigRatio);
        }
        
        const maxBedarf = Math.max(...bedarf, 1);
        const maxKapazitaet = Math.ceil(maxBedarf / 5);

        // Berechne maximale Werte für BayKiBig-Achsen
        const anstellungsschluesselValues = baykibigAnstellungsschluessel.map(item => {
          if (!item || item.totalBookingHours === 0) return 0;
          return item.totalStaffHours > 0 ? item.totalBookingHours / item.totalStaffHours : 0;
        });
        
        const fachkraftquoteValues = baykibigAnstellungsschluessel.map(item => {
          return item?.fachkraftQuotePercent || 0;
        });

        const maxAnstellungsschluessel = Math.max(...anstellungsschluesselValues, 15);
        const maxFachkraftquote = Math.max(...fachkraftquoteValues, 100);

        return {
          bedarf,
          kapazitaet,
          baykibigAnstellungsschluessel,
          maxBedarf,
          maxKapazitaet,
          maxAnstellungsschluessel,
          maxFachkraftquote
        };
      },

      // BayKiBig Anstellungsschlüssel-Berechnung
      calculateBayKiBigRatio: (demandItems, capacityItems, segmentHours) => {
        const stichtag = get().stichtag;
        const stichtagDate = new Date(stichtag);
        
        // Gesamte Buchungszeitstunden der Kinder (mit Gewichtungsfaktor)
        let totalBookingHours = 0;
        let totalBookingHoursForFachkraftquote = 0; // Für Fachkraftquote ohne Behinderung
        
        demandItems.forEach(child => {
          const weightingFactor = get().calculateWeightingFactor(child, stichtagDate);
          const fachkraftWeightingFactor = get().calculateFachkraftWeightingFactor(child, stichtagDate);
          
          totalBookingHours += segmentHours * weightingFactor;
          totalBookingHoursForFachkraftquote += segmentHours * fachkraftWeightingFactor;
        });

        // Verfügbare Arbeitszeit des pädagogischen Personals
        let totalStaffHours = 0;
        let fachkraftHours = 0;
        let totalStaffCount = capacityItems.length;
        let fachkraftCount = 0;
        
        capacityItems.forEach(staff => {
          const isFachkraft = get().isFachkraft(staff);
          totalStaffHours += segmentHours;
          if (isFachkraft) {
            fachkraftHours += segmentHours;
            fachkraftCount++;
          }
        });

        // BayKiBig Anforderungen:
        // 1. Anstellungsschlüssel: 1:11 (1 Arbeitsstunde pro 11 Buchungszeitstunden)
        const requiredStaffHours = totalBookingHours / 11.0;
        
        // 2. Fachkraftquote: mindestens 50% der Arbeitszeit von Fachkräften
        // Bei Fachkraftquote werden behinderte Kinder nur einfach gezählt
        const requiredFachkraftHours = (totalBookingHoursForFachkraftquote / 11.0) * 0.5;
        
        // Prüfung ob Anforderungen erfüllt sind
        const anstellungsschluesselOk = totalStaffHours >= requiredStaffHours;
        const fachkraftquoteOk = fachkraftHours >= requiredFachkraftHours;
        
        // Rückgabe: Verhältnis von verfügbarer zu benötigter Arbeitszeit
        // Werte < 1 bedeuten Unterdeckung, > 1 Überdeckung
        const staffRatio = requiredStaffHours > 0 ? totalStaffHours / requiredStaffHours : 0;
        const fachkraftRatio = requiredFachkraftHours > 0 ? fachkraftHours / requiredFachkraftHours : 0;
        
        // Fachkraftquote als Prozentsatz der tatsächlichen Arbeitsstunden (nicht Mitarbeiteranzahl)
        const fachkraftQuotePercent = totalStaffHours > 0 ? (fachkraftHours / totalStaffHours) * 100 : 0;
        
        return {
          staffRatio,
          fachkraftRatio,
          anstellungsschluesselOk,
          fachkraftquoteOk,
          totalBookingHours,
          totalBookingHoursForFachkraftquote,
          requiredStaffHours,
          totalStaffHours,
          requiredFachkraftHours,
          fachkraftHours,
          fachkraftQuotePercent,
          totalStaffCount,
          fachkraftCount
        };
      },

      // Bestimmung ob Mitarbeiter eine Fachkraft ist
      isFachkraft: (staff) => {
        const qualification = staff.parseddata?.qualification;
        // Fachkräfte: "E" (Erzieher), "K" (Kinderpfleger)
        return qualification === 'E' || qualification === 'K';
      },

      // Berechnung des Gewichtungsfaktors für Anstellungsschlüssel
      calculateWeightingFactor: (child, stichtagDate) => {
        // Prüfe ob Schulkind anhand Gruppenzugehörigkeit
        const isSchulkind = child.parseddata?.group?.some(g => 
          g.name && g.name.toLowerCase().includes('schulkind')
        ) || false;
        
        if (isSchulkind) {
          return 1.2; // Schulkinder
        }
        
        // Prüfe Alter basierend auf Geburtsdatum
        const geburtsdatum = child.parseddata?.geburtsdatum;
        if (geburtsdatum) {
          const birthDate = new Date(geburtsdatum.split('.').reverse().join('-'));
          const age = get().calculateAge(birthDate, stichtagDate);
          
          if (age < 3) {
            return 2.0; // Kinder unter 3 Jahren
          }
        }
        
        return 1.0; // Standardgewichtung für Kinder 3+ Jahre
      },

      // Berechnung des Gewichtungsfaktors für Fachkraftquote (ohne Behinderung)
      calculateFachkraftWeightingFactor: (child, stichtagDate) => {
        // Für Fachkraftquote werden behinderte Kinder nur einfach gezählt
        // Da wir Behinderung noch nicht implementiert haben, ist dies identisch
        // mit dem normalen Gewichtungsfaktor
        const normalFactor = get().calculateWeightingFactor(child, stichtagDate);
        
        // Wenn später Behinderung implementiert wird:
        // if (child.parseddata?.disability) return 1.0; // Behinderte Kinder einfach zählen
        
        return normalFactor;
      },

      // Hilfsfunktion zur Altersberechnung
      calculateAge: (birthDate, referenceDate) => {
        const age = referenceDate.getFullYear() - birthDate.getFullYear();
        const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
        const dayDiff = referenceDate.getDate() - birthDate.getDate();
        
        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
          return age - 1;
        }
        return age;
      },

      // Get names for segment
      getNamesForSegment: (simulationData, i, seriesType) => {
        const { categories, selectedGroups, selectedQualifications, stichtag, isBookedInSegment } = get();
        const cat = categories[i];
        const [dayName, timeStr] = cat.split(' ');
        const dayIdx = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].indexOf(dayName);
        const [hour, min] = timeStr.split(':');
        const segmentStart = `${hour.padStart(2, '0')}:${min}`;
        let endHour = parseInt(hour, 10);
        let endMin = parseInt(min, 10) + 30;
        if (endMin >= 60) {
          endHour += 1;
          endMin -= 60;
        }
        const segmentEnd = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

        // Apply both filters to all series
        if (seriesType === 'Bedarf') {
          return simulationData
            .filter(item =>
              item.type === 'demand' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, true, stichtag, selectedQualifications)
            )
            .map(item => item.name);
        }
        if (seriesType === 'Kapazität') {
          return simulationData
            .filter(item =>
              item.type === 'capacity' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, false, stichtag, selectedQualifications)
            )
            .map(item => item.name);
        }
        return [];
      },
      
      // Calculate midterm chart data
      calculateMidtermChartData: (simulationData) => {
        const { midtermTimeDimension, midtermSelectedGroups, midtermSelectedQualifications } = get();
        
        // Get last date of interest to determine end date
        const lastDateOfInterest = get().getLastDateOfInterest(simulationData);

        // Generate time periods based on dimension
        const periods = get().generateMidtermPeriods(midtermTimeDimension, lastDateOfInterest);

        // Debug: show period generation logic step-by-step
        if (periods.length === 0) {
          console.warn('[MidtermChart][chartStore] No periods generated! Check dimension and date logic.');
        }

        const bedarf = [];
        const kapazitaet = [];
        const baykibigAnstellungsschluessel = [];
        
        periods.forEach((period, idx) => {
          // Debug log for demand filtering
          const demandItems = simulationData.filter(item => {
            if (item.type !== 'demand') return false;
            return get().isItemValidForPeriod(item, period, midtermSelectedGroups, midtermSelectedQualifications);
          });
          if (idx === 0) {
            console.log('[ChartStore][calculateMidtermChartData] Filters:', {
              midtermSelectedGroups,
              midtermSelectedQualifications,
              midtermTimeDimension
            });
          }
          const demandHours = demandItems.reduce((total, item) => {
            return total + get().calculateBookingHoursInPeriod(item, period);
          }, 0);

          const capacityItems = simulationData.filter(item => {
            if (item.type !== 'capacity') return false;
            return get().isItemValidForPeriod(item, period, midtermSelectedGroups, midtermSelectedQualifications);
          });
          const capacityHours = capacityItems.reduce((total, item) => {
            return total + get().calculateBookingHoursInPeriod(item, period);
          }, 0);

          bedarf.push(demandHours);
          kapazitaet.push(capacityHours);

          const baykibigRatio = get().calculateBayKiBigRatioForPeriodWithHours(demandItems, capacityItems, period);
          baykibigAnstellungsschluessel.push(baykibigRatio);
        });
        
        // Calculate max values for axes
        const maxBedarf = Math.max(...bedarf, 1);
        const maxKapazitaet = Math.max(...kapazitaet, 1);
        
        const anstellungsschluesselValues = baykibigAnstellungsschluessel.map(item => {
          if (!item || item.totalBookingHours === 0) return 0;
          return item.totalStaffHours > 0 ? item.totalBookingHours / item.totalStaffHours : 0;
        });
        
        const fachkraftquoteValues = baykibigAnstellungsschluessel.map(item => {
          return item?.fachkraftQuotePercent || 0;
        });
        
        const maxAnstellungsschluessel = Math.max(...anstellungsschluesselValues, 15);
        const maxFachkraftquote = Math.max(...fachkraftquoteValues, 100);
        
        return {
          categories: periods.map(p => p.label),
          bedarf,
          kapazitaet,
          baykibigAnstellungsschluessel,
          maxBedarf,
          maxKapazitaet,
          maxAnstellungsschluessel,
          maxFachkraftquote
        };
      },
      
      // Get last date of interest from simulation data
      getLastDateOfInterest: (simulationData) => {
        const today = new Date();
        let lastDate = today;
        
        simulationData.forEach(item => {
          // Check item dates
          if (item.parseddata?.enddate) {
            const endDate = new Date(item.parseddata.enddate.split('.').reverse().join('-'));
            if (endDate > lastDate) lastDate = endDate;
          }
          
          // Check group dates
          if (item.parseddata?.group) {
            item.parseddata.group.forEach(group => {
              if (group.end) {
                const groupEnd = new Date(group.end.split('.').reverse().join('-'));
                if (groupEnd > lastDate) lastDate = groupEnd;
              }
            });
          }
          
          // Check booking dates
          if (item.parseddata?.booking) {
            item.parseddata.booking.forEach(booking => {
              if (booking.enddate) {
                const bookingEnd = new Date(booking.enddate.split('.').reverse().join('-'));
                if (bookingEnd > lastDate) lastDate = bookingEnd;
              }
            });
          }
          
          // Check pause dates
          if (item.parseddata?.paused?.enabled && item.parseddata.paused.end) {
            const pauseEnd = new Date(item.parseddata.paused.end);
            if (pauseEnd > lastDate) lastDate = pauseEnd;
          }
        });
        
        return lastDate;
      },
      
      // Generate time periods based on dimension
      generateMidtermPeriods: (dimension, endDate) => {
        const today = new Date();
        const periods = [];
        // Normalize dimension to German label for backward compatibility
        let dim = dimension;
        if (dim === 'month') dim = 'Monate';
        if (dim === 'week') dim = 'Wochen';
        if (dim === 'year') dim = 'Jahre';
        if (dim === 'quarter') dim = 'Quartale'; // Not implemented, but for completeness

        if (dim === 'Wochen') {
          let currentDate = new Date(today);
          currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1);
          while (currentDate <= endDate) {
            const startDate = new Date(currentDate);
            const weekEnd = new Date(currentDate);
            weekEnd.setDate(currentDate.getDate() + 6);
            periods.push({
              label: `KW ${get().getWeekNumber(startDate)} ${startDate.getFullYear()}`,
              start: startDate,
              end: weekEnd
            });
            currentDate.setDate(currentDate.getDate() + 7);
          }
        } else if (dim === 'Monate') {
          let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
          while (currentDate <= endDate) {
            const startDate = new Date(currentDate);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            periods.push({
              label: startDate.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }),
              start: startDate,
              end: monthEnd
            });
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        } else if (dim === 'Jahre') {
          let currentYear = today.getFullYear();
          const endYear = endDate.getFullYear();
          while (currentYear <= endYear) {
            const startDate = new Date(currentYear, 0, 1);
            const yearEnd = new Date(currentYear, 11, 31);
            periods.push({
              label: currentYear.toString(),
              start: startDate,
              end: yearEnd
            });
            currentYear++;
          }
        } else if (dim === 'Quartale') {
          // Implement quarters
          let currentYear = today.getFullYear();
          let currentQuarter = Math.floor(today.getMonth() / 3) + 1;
          const endYear = endDate.getFullYear();
          const endQuarter = Math.floor(endDate.getMonth() / 3) + 1;
          while (currentYear < endYear || (currentYear === endYear && currentQuarter <= endQuarter)) {
            const startMonth = (currentQuarter - 1) * 3;
            const startDate = new Date(currentYear, startMonth, 1);
            const endMonth = startMonth + 2;
            const endDateQ = new Date(currentYear, endMonth + 1, 0); // last day of endMonth
            periods.push({
              label: `Q${currentQuarter} ${currentYear}`,
              start: startDate,
              end: endDateQ
            });
            currentQuarter++;
            if (currentQuarter > 4) {
              currentQuarter = 1;
              currentYear++;
            }
          }
        }
        return periods;
      },
      
      // Calculate average hours per period based on dimension
      calculatePeriodHours: (period, dimension) => {
        if (dimension === 'Wochen') {
          return 25; // 5 Tage × 5 Stunden durchschnittlich
        } else if (dimension === 'Monate') {
          return 110; // ca. 22 Arbeitstage × 5 Stunden
        } else if (dimension === 'Jahre') {
          return 1300; // ca. 260 Arbeitstage × 5 Stunden
        }
        return 25; // Fallback
      },
      
      // Calculate BayKiBig ratio for a specific period using actual booking hours
      calculateBayKiBigRatioForPeriodWithHours: (demandItems, capacityItems, period) => {
        const stichtagDate = new Date(period.start.getTime() + (period.end.getTime() - period.start.getTime()) / 2); // Middle of period
        
        // Calculate total booking hours for children (with weighting factor)
        let totalBookingHours = 0;
        let totalBookingHoursForFachkraftquote = 0;
        
        demandItems.forEach(child => {
          const bookingHours = get().calculateBookingHoursInPeriod(child, period);
          const weightingFactor = get().calculateWeightingFactor(child, stichtagDate);
          const fachkraftWeightingFactor = get().calculateFachkraftWeightingFactor(child, stichtagDate);
          
          totalBookingHours += bookingHours * weightingFactor;
          totalBookingHoursForFachkraftquote += bookingHours * fachkraftWeightingFactor;
        });
        
        // Calculate available staff hours
        let totalStaffHours = 0;
        let fachkraftHours = 0;
        let totalStaffCount = capacityItems.length;
        let fachkraftCount = 0;
        
        capacityItems.forEach(staff => {
          const staffHours = get().calculateBookingHoursInPeriod(staff, period);
          const isFachkraft = get().isFachkraft(staff);
          
          totalStaffHours += staffHours;
          if (isFachkraft) {
            fachkraftHours += staffHours;
            fachkraftCount++;
          }
        });
        
        // BayKiBig requirements
        const requiredStaffHours = totalBookingHours / 11.0;
        const requiredFachkraftHours = (totalBookingHoursForFachkraftquote / 11.0) * 0.5;
        
        const anstellungsschluesselOk = totalStaffHours >= requiredStaffHours;
        const fachkraftquoteOk = fachkraftHours >= requiredFachkraftHours;
        
        const staffRatio = requiredStaffHours > 0 ? totalStaffHours / requiredStaffHours : 0;
        const fachkraftRatio = requiredFachkraftHours > 0 ? fachkraftHours / requiredFachkraftHours : 0;
        
        // Fachkraftquote als Prozentsatz der tatsächlichen Arbeitsstunden (nicht Mitarbeiteranzahl)
        const fachkraftQuotePercent = totalStaffHours > 0 ? (fachkraftHours / totalStaffHours) * 100 : 0;
        
        return {
          staffRatio,
          fachkraftRatio,
          anstellungsschluesselOk,
          fachkraftquoteOk,
          totalBookingHours,
          totalBookingHoursForFachkraftquote,
          requiredStaffHours,
          totalStaffHours,
          requiredFachkraftHours,
          fachkraftHours,
          fachkraftQuotePercent,
          totalStaffCount,
          fachkraftCount
        };
      },

      // Calculate booking hours for an item within a specific period
      calculateBookingHoursInPeriod: (item, period) => {
        const bookings = item.parseddata?.booking ?? [];
        let totalHours = 0;
        
        bookings.forEach(booking => {
          const bookingStart = booking.startdate ? new Date(booking.startdate.split('.').reverse().join('-')) : period.start;
          const bookingEnd = booking.enddate ? new Date(booking.enddate.split('.').reverse().join('-')) : period.end;
          
          // Calculate overlap between booking period and time period
          const overlapStart = new Date(Math.max(period.start.getTime(), bookingStart.getTime()));
          const overlapEnd = new Date(Math.min(period.end.getTime(), bookingEnd.getTime()));
          
          if (overlapStart <= overlapEnd) {
            // Calculate hours for each day in the overlap period
            const currentDate = new Date(overlapStart);
            while (currentDate <= overlapEnd) {
              const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
              const weekDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 (Monday-Sunday)
              
              // Only count weekdays (Monday-Friday)
              if (weekDay >= 1 && weekDay <= 5) {
                // Find booking times for this day
                const dayTimes = booking.times?.find(time => time.day === weekDay);
                if (dayTimes && dayTimes.segments) {
                  dayTimes.segments.forEach(segment => {
                    if (segment.booking_start && segment.booking_end) {
                      const startTime = get().timeToHours(segment.booking_start);
                      const endTime = get().timeToHours(segment.booking_end);
                      totalHours += endTime - startTime;
                    }
                  });
                }
              }
              
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });
        
        return totalHours;
      },

      // Convert time string to hours (e.g., "14:30" -> 14.5)
      timeToHours: (timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours + minutes / 60;
      },

      // Get week number
      getWeekNumber: (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      },

      // Check if item is valid for period with filters
      isItemValidForPeriod: (item, period, groupFilter, qualificationFilter) => {
        // Check if item's date range overlaps with period
        const itemStart = item.parseddata?.startdate ? new Date(item.parseddata.startdate.split('.').reverse().join('-')) : null;
        const itemEnd = item.parseddata?.enddate ? new Date(item.parseddata.enddate.split('.').reverse().join('-')) : null;
        
        // Item must be active during the period
        if (itemStart && itemStart > period.end) return false;
        if (itemEnd && itemEnd < period.start) return false;
        
        // Check pause state - if paused during entire period, item is not valid
        const pausedState = item.parseddata?.paused;
        if (pausedState?.enabled && pausedState.start && pausedState.end) {
          const pauseStart = new Date(pausedState.start);
          const pauseEnd = new Date(pausedState.end);
          
          // If the pause period completely covers the time period, item is not valid
          if (pauseStart <= period.start && pauseEnd >= period.end) {
            return false;
          }
        }
        
        // Filter by groups
        const groups = item.parseddata?.group ?? [];
        if (groups.length === 0) {
          if (!groupFilter.includes('0')) return false;
        } else {
          const hasValidGroup = groups.some(g => {
            // Always compare as string
            const groupIdStr = String(g.id);
            if (!groupFilter.includes(groupIdStr)) return false;
            const groupStart = g.start ? new Date(g.start.split('.').reverse().join('-')) : null;
            const groupEnd = g.end ? new Date(g.end.split('.').reverse().join('-')) : null;
            if (groupStart && groupStart > period.end) return false;
            if (groupEnd && groupEnd < period.start) return false;
            return true;
          });
          if (!hasValidGroup) return false;
        }
        
        // Filter by qualification (only for capacity items)
        if (item.type === 'capacity' && qualificationFilter && qualificationFilter.length > 0) {
          const qualification = item.parseddata?.qualification || 'keine Qualifikation';
          if (!qualificationFilter.includes(qualification)) return false;
        }
        
        return true;
      },

      // Check if item has booking in period
      hasBookingInPeriod: (item, period) => {
        const bookings = item.parseddata?.booking ?? [];
        
        return bookings.some(booking => {
          const bookingStart = booking.startdate ? new Date(booking.startdate.split('.').reverse().join('-')) : null;
          const bookingEnd = booking.enddate ? new Date(booking.enddate.split('.').reverse().join('-')) : null;
          
          // Booking must overlap with period
          if (bookingStart && bookingStart > period.end) return false;
          if (bookingEnd && bookingEnd < period.start) return false;
          
          // Check if booking has any times defined
          return booking.times && booking.times.length > 0;
        });
      },

      // Chart visibility toggles
      chartToggles: ['weekly', 'midterm'],
      setChartToggles: (toggles) => set({ chartToggles: toggles }),

    }),
    {
      name: 'chart-storage',
      partialize: (state) => ({
        stichtag: state.stichtag,
        selectedGroups: state.selectedGroups,
        selectedQualifications: state.selectedQualifications,
        availableGroups: state.availableGroups,
        availableQualifications: state.availableQualifications,
        midtermTimeDimension: state.midtermTimeDimension,
        midtermSelectedGroups: state.midtermSelectedGroups,
        midtermSelectedQualifications: state.midtermSelectedQualifications,
        weeklySelectedScenarioId: state.weeklySelectedScenarioId,
        midtermSelectedScenarioId: state.midtermSelectedScenarioId,
        chartToggles: state.chartToggles,
      })
    }
  )
);

export default useChartStore;
