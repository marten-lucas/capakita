import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MantineProvider } from '@mantine/core';
import SimDataFinanceTab from './SimDataFinanceTab';
import simScenarioReducer from '../../store/simScenarioSlice';
import simDataReducer from '../../store/simDataSlice';
import simBookingReducer from '../../store/simBookingSlice';
import simGroupReducer from '../../store/simGroupSlice';
import simQualificationReducer from '../../store/simQualificationSlice';
import simOverlayReducer from '../../store/simOverlaySlice';
import simFinanceReducer from '../../store/simFinanceSlice';
import chartReducer from '../../store/chartSlice';

function createTestStore(selectedItemId) {
  return configureStore({
    reducer: {
      simScenario: simScenarioReducer,
      simData: simDataReducer,
      simBooking: simBookingReducer,
      simGroup: simGroupReducer,
      simQualification: simQualificationReducer,
      simOverlay: simOverlayReducer,
      simFinance: simFinanceReducer,
      chart: chartReducer,
    },
    preloadedState: {
      simScenario: {
        scenarios: [{ id: 'scenario-1', name: 'Szenario 1' }],
        selectedScenarioId: 'scenario-1',
        selectedItems: { 'scenario-1': selectedItemId },
        saveDialogOpen: false,
        loadDialogOpen: false,
      },
      simData: {
        dataByScenario: {
          'scenario-1': {
            'child-1': {
              id: 'child-1',
              type: 'demand',
              name: 'Max',
              validFrom: '2026-01-01',
              dateofbirth: '2024-01-15',
              groupId: 'group-1',
              absences: [],
            },
            'staff-1': {
              id: 'staff-1',
              type: 'capacity',
              name: 'Anna',
              validFrom: '2026-01-01',
              absences: [],
            },
          },
        },
      },
      simBooking: {
        bookingsByScenario: {
          'scenario-1': {
            'child-1': {
              'booking-child-1': {
                id: 'booking-child-1',
                startdate: '2026-01-01',
                enddate: '2026-12-31',
                times: [
                  { day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
                  { day_name: 'Di', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
                  { day_name: 'Mi', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
                  { day_name: 'Do', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
                  { day_name: 'Fr', segments: [{ booking_start: '08:00', booking_end: '12:00' }] },
                ],
              },
            },
            'staff-1': {
              'booking-staff-1': {
                id: 'booking-staff-1',
                startdate: '2026-01-01',
                enddate: '2026-12-31',
                times: [
                  { day_name: 'Mo', segments: [{ booking_start: '08:00', booking_end: '14:00' }, { booking_start: '14:00', booking_end: '15:00', category: 'administrative' }] },
                  { day_name: 'Di', segments: [{ booking_start: '08:00', booking_end: '14:00' }, { booking_start: '14:00', booking_end: '15:00', category: 'administrative' }] },
                  { day_name: 'Mi', segments: [{ booking_start: '08:00', booking_end: '14:00' }, { booking_start: '14:00', booking_end: '15:00', category: 'administrative' }] },
                  { day_name: 'Do', segments: [{ booking_start: '08:00', booking_end: '14:00' }, { booking_start: '14:00', booking_end: '15:00', category: 'administrative' }] },
                  { day_name: 'Fr', segments: [{ booking_start: '08:00', booking_end: '14:00' }, { booking_start: '14:00', booking_end: '15:00', category: 'administrative' }] },
                ],
              },
            },
          },
        },
      },
      simGroup: {
        groupDefsByScenario: {
          'scenario-1': [{ id: 'group-1', name: 'Krippe Sonnen', type: 'Krippe' }],
        },
        groupsByScenario: {
          'scenario-1': {
            'child-1': {
              'ga-1': {
                id: 'ga-1',
                groupId: 'group-1',
                start: '2026-01-01',
                end: '2026-12-31',
              },
            },
          },
        },
      },
      simQualification: {
        qualificationDefsByScenario: {},
        qualificationAssignmentsByScenario: {},
      },
      simOverlay: {
        overlaysByScenario: {},
      },
      simFinance: {
        financeByScenario: {
          'scenario-1': {
            settings: {
              partialAbsenceThresholdDays: 42,
              partialAbsenceEmployerSharePercent: 0,
            },
            bayKiBiGRules: [
              {
                id: 'rule-1',
                label: 'BayKiBiG 2026',
                validFrom: '2026-01-01',
                baseValue: 120,
                weightFactors: {
                  regelkind_3to6: 1.0,
                  schulkind: 1.2,
                  migration: 1.3,
                  under3: 2.0,
                  disabled: 4.5,
                },
              },
            ],
            groupFeeCatalogs: {
              'group-1': [
                {
                  id: 'fee-1',
                  validFrom: '2026-01-01',
                  minHours: 0,
                  maxHours: 25,
                  monthlyAmount: 300,
                },
              ],
            },
            itemFinances: {
              'staff-1': {
                personnelCostHistory: [
                  {
                    id: 'pc-1',
                    validFrom: '2026-01-01',
                    annualGrossSalary: 48000,
                    employerOnCostPercent: 20,
                  },
                ],
              },
            },
          },
        },
      },
      chart: {
        'scenario-1': {
          referenceDate: '2026-04-15',
        },
      },
    },
  });
}

describe('SimDataFinanceTab', () => {
  it('shows automatic child revenue preview for demand items', () => {
    const store = createTestStore('child-1');

    render(
      <MantineProvider>
        <Provider store={store}>
          <SimDataFinanceTab />
        </Provider>
      </MantineProvider>
    );

    expect(screen.getByText('Automatische Einnahmen zum Stichtag')).toBeTruthy();
    expect(screen.getByText('Durchschnittliche Wochenstunden')).toBeTruthy();
    expect(screen.getByText('20.0 h')).toBeTruthy();
    expect(screen.getByText('Elternbeitrag')).toBeTruthy();
    expect(screen.getByText('BayKiBiG-Foerderung')).toBeTruthy();
    expect(screen.getByText('Gesamteinnahmen')).toBeTruthy();
  });

  it('shows staff cost preview with working-time split for capacity items', () => {
    const store = createTestStore('staff-1');

    render(
      <MantineProvider>
        <Provider store={store}>
          <SimDataFinanceTab />
        </Provider>
      </MantineProvider>
    );

    expect(screen.getByText('Personalkosten zum Stichtag')).toBeTruthy();
    expect(screen.getByText('Wochenarbeitszeit (paedagogisch)')).toBeTruthy();
    expect(screen.getByText('30.0 h')).toBeTruthy();
    expect(screen.getByText('Wochenarbeitszeit (administrativ)')).toBeTruthy();
    expect(screen.getByText('5.0 h')).toBeTruthy();
    expect(screen.getByText('Anwesenheitsfaktor')).toBeTruthy();
    expect(screen.getByText('100 %')).toBeTruthy();
  });
});
