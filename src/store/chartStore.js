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
          if (!groupNamesFilter.includes('keine Gruppe')) return false;
        } else {
          // Hat Gruppen - prüfen ob mindestens eine ausgewählte Gruppe zum Stichtag gültig ist
          const hasValidGroup = groups.some(g => {
            if (!groupNamesFilter.includes(g.name)) return false;
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

          // Bedarf: Kinder mit Buchung im Segment und Gruppe ausgewählt und zum Stichtag gültig
          const demandItems = simulationData.filter(
            item =>
              item.type === 'demand' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, true, stichtag, selectedQualifications)
          );
          bedarf.push(demandItems.length);

          // Kapazität: Mitarbeiter mit Buchung im Segment und Gruppe ausgewählt und zum Stichtag gültig
          const capacityItems = simulationData.filter(
            item =>
              item.type === 'capacity' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, false, stichtag, selectedQualifications)
          );
          kapazitaet.push(capacityItems.length);

          // BayKiBig Anstellungsschlüssel berechnen
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
        
        // Fachkraftquote als Prozentsatz der tatsächlichen Mitarbeiter
        const fachkraftQuotePercent = totalStaffCount > 0 ? (fachkraftCount / totalStaffCount) * 100 : 0;
        
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
      }
    }),
    {
      name: 'chart-storage',
      partialize: (state) => ({
        stichtag: state.stichtag,
        selectedGroups: state.selectedGroups,
        selectedQualifications: state.selectedQualifications,
        availableGroups: state.availableGroups,
        availableQualifications: state.availableQualifications
      })
    }
  )
);

export default useChartStore;

