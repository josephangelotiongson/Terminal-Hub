
import { Operation, AppSettings, Hold } from '../types';
import { createMockOperations, createMockHolds } from './mockData';
import { createMockHistoricalOperations } from './mockHistoricalData';
import { DEFAULT_SETTINGS } from './masterData';

const loadOperations = (): Operation[] => {
    // DEMO MODE: Force clear local storage to ensure fresh data on reload
    localStorage.removeItem('all_ops_data');

    // Generate fresh data
    const liveOps = createMockOperations();
    const historicalOps = createMockHistoricalOperations();
    const allOps = [...historicalOps, ...liveOps];
    
    // Save the newly generated data to localStorage for session persistence
    try {
        localStorage.setItem('all_ops_data', JSON.stringify(allOps));
    } catch (error) {
        console.error('Failed to save initial operations to localStorage', error);
    }
    
    return allOps;
};

const saveOperations = (operations: Operation[]): void => {
    try {
        localStorage.setItem('all_ops_data', JSON.stringify(operations));
    } catch (error) {
        console.error('Failed to save operations to localStorage', error);
    }
};

const loadSettings = (): AppSettings => {
    // DEMO MODE: Force clear local storage
    localStorage.removeItem('settings_data');
    return DEFAULT_SETTINGS;
};

const saveSettings = (settings: AppSettings): void => {
    try {
        localStorage.setItem('settings_data', JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save settings to localStorage', error);
    }
};

const loadHolds = (terminal: string): Hold[] => {
    // DEMO MODE: Force clear local storage
    localStorage.removeItem(`holds_data_${terminal}`);

    const mockHolds = createMockHolds(terminal);
    // Save the initial mock data so it's available on next load
    try {
        localStorage.setItem(`holds_data_${terminal}`, JSON.stringify(mockHolds));
    } catch (error) {
        console.error('Failed to save initial holds to localStorage', error);
    }
    return mockHolds;
};

const saveHolds = (holds: Hold[], terminal: string): void => {
    try {
        localStorage.setItem(`holds_data_${terminal}`, JSON.stringify(holds));
    } catch (error) {
        console.error('Failed to save holds to localStorage', error);
    }
};


export const dataService = {
    loadOperations,
    saveOperations,
    loadSettings,
    saveSettings,
    loadHolds,
    saveHolds
};
