
import { Operation, AppSettings, Hold } from '../types';
import { createMockOperations, createMockHolds } from './mockData';
import { createMockHistoricalOperations } from './mockHistoricalData';
import { DEFAULT_SETTINGS } from './masterData';

const loadOperations = (): Operation[] => {
    // Try to load from localStorage first
    try {
        const storedOps = localStorage.getItem('all_ops_data');
        if (storedOps) {
            return JSON.parse(storedOps);
        }
    } catch (error) {
        console.error('Failed to load operations from localStorage', error);
        // If parsing fails, proceed to generate fresh data
    }
    
    // Generate fresh data if nothing in storage or parsing failed
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
    try {
        const storedSettings = localStorage.getItem('settings_data');
        if (storedSettings) {
            return JSON.parse(storedSettings);
        }
    } catch (error) {
        console.error('Failed to load settings from localStorage', error);
    }
    // Save default if nothing is in storage
    try {
        localStorage.setItem('settings_data', JSON.stringify(DEFAULT_SETTINGS));
    } catch (error) {
        console.error('Failed to save initial settings to localStorage', error);
    }
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
    try {
        const storedHolds = localStorage.getItem(`holds_data_${terminal}`);
        if (storedHolds) {
            return JSON.parse(storedHolds);
        }
    } catch (error) {
        console.error('Failed to load holds from localStorage', error);
    }

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