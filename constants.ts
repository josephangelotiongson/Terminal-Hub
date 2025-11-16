
import { Modality } from './types';

export const MOCK_CURRENT_TIME = new Date('2024-07-25T10:00:00.000Z');

export const VESSEL_COMMON_EVENTS: string[] = [
    'START PREPARATIONS / CREW ONSITE',
    'CREW ARRIVE TO WHARF',
    'VESSEL ALONGSIDE',
    'VESSEL ALLFAST',
    'GANGWAY DOWN',
    'SURVEYOR ONBOARD',
    'SURVEYOR CHECKS COMPLETED',
    'LAST HOSE DISCONNECTED',
    'CLEAN UP COMPLETION',
    'CREW COMPLETED / SITE SECURE',
];

export const VESSEL_COMMODITY_EVENTS: string[] = [
    'HOSE CONNECTED',
    'HOSE LEAK CHECK / PRESSURE CHECK',
    'START PUMPING',
    'LIQUID AT WHARF',
    'LIQUID AT TERMINAL',
    'SLOPS SAMPLE PASSED / PRODUCT INTO TANK',
    'STOP PUMPING',
    'HOSES BLOWN',
    'HOSES DISCONNECTED',
    'PIG AWAY',
    'PIG RECEIVED / COMMODITY COMPLETED',
];

export const LINE_CLEANING_EVENTS: string[] = [
    'START PIG/FLUSH',
    'LINE CHECKED',
    'LINE CLEAR FOR NEXT PRODUCT'
];

export const SOF_EVENTS_MODALITY: { [key in Modality]: string[] } = {
    vessel: VESSEL_COMMON_EVENTS,
    truck: ['Arrived', 'Ready / Approved', 'Directed to Bay', 'On Bay', 'Pumping Started', 'Pumping Stopped', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Departed'],
    rail: ['Arrived at Terminal', 'On Siding', 'Hose Connect', 'Checks OK', 'Pumping Started', 'Pumping Stopped', 'Hose Disconnect', 'Paperwork Done', 'Departed']
};

export const TRUCK_REJECTION_REASONS = [
    "Documentation Issue",
    "Safety Violation",
    "Contaminated Compartment",
    "Equipment Failure (Truck)",
    "Driver Error",
    "Underloaded",
    "Overloaded",
    "Driver Delayed",
    "Terminal Issue",
    "Equipment Re-check Required",
    "Other"
];

export const OPERATOR_RESCHEDULE_REASONS = [
    "Minor Equipment Issue (On Asset)",
    "Safety Concern (Needs Review)",
    "Process Anomaly (Needs Supervisor)",
    "Short-staffed for current task",
    "Weather condition change",
    "Vessel/Truck not ready",
    "Other (Specify in notes)"
];