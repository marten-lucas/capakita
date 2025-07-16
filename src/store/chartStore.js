import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { produce } from 'immer';

// Hilfsfunktion für Zeitsegmente
function generateTimeSegments() {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const startHour = 7;
  const endHour = 16.5; // 16:30
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
      categories: generateTimeSegments(),
      availableGroups: [], // Store available groups
      
      // Actions
      setStichtag: (date) => set(produce((state) => {
        state.stichtag = date;
      })),
      setSelectedGroups: (groups) => set(produce((state) => {
        state.selectedGroups = groups;
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
      
      // Helper to check if item is booked in segment
      isBookedInSegment: (item, dayIdx, segmentStart, segmentEnd, groupNamesFilter, isDemand, stichtag) => {
        // Stichtag als Date
        const stichtagDate = new Date(stichtag);

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
      
      // Calculate chart data
      calculateChartData: (simulationData) => {
        const { categories, selectedGroups, stichtag, isBookedInSegment } = get();
        const n = categories.length;
        const bedarf = [];
        const kapazitaet = [];
        
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
          const demandCount = simulationData.filter(
            item =>
              item.type === 'demand' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, true, stichtag)
          ).length;
          bedarf.push(demandCount);

          // Kapazität: Mitarbeiter mit Buchung im Segment und Gruppe ausgewählt und zum Stichtag gültig
          const capacityCount = simulationData.filter(
            item =>
              item.type === 'capacity' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, false, stichtag)
          ).length;
          kapazitaet.push(capacityCount);
        }
        const betreuungsschluessel = Array(n).fill(4);
        const maxBedarf = Math.max(...bedarf, 1);
        const maxKapazitaet = Math.ceil(maxBedarf / 5);

        return {
          bedarf,
          kapazitaet,
          betreuungsschluessel,
          maxBedarf,
          maxKapazitaet
        };
      },
      
      // Get names for segment
      getNamesForSegment: (simulationData, i, seriesType) => {
        const { categories, selectedGroups, stichtag, isBookedInSegment } = get();
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
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, true, stichtag)
            )
            .map(item => item.name);
        }
        if (seriesType === 'Kapazität') {
          return simulationData
            .filter(item =>
              item.type === 'capacity' &&
              isBookedInSegment(item, dayIdx, segmentStart, segmentEnd, selectedGroups, false, stichtag)
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
        availableGroups: state.availableGroups
      })
    }
  )
);

export default useChartStore;

