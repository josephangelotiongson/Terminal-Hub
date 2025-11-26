
import { Operation, AppSettings, Hold } from '../types';
import { createMockOperations, createMockHolds } from './mockData';
import { createMockHistoricalOperations } from './mockHistoricalData';
import { DEFAULT_SETTINGS } from './masterData';

const OPS_KEY = 'term_hub_ops_v1';
const SETTINGS_KEY = 'term_hub_settings_v1';
const HOLDS_PREFIX = 'term_hub_holds_v1_';

const loadOperations = (): Operation[] => {
    // Try to load from local storage first
    const stored = localStorage.getItem(OPS_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        } catch (e) {
            console.error("Failed to parse stored operations", e);
        }
    }
    
    // If no valid stored data, generate fresh
    const liveOps = createMockOperations();
    const historicalOps = createMockHistoricalOperations();
    const allOps = [...historicalOps, ...liveOps];
    
    // Save the newly generated data to localStorage for session persistence
    try {
        localStorage.setItem(OPS_KEY, JSON.stringify(allOps));
    } catch (error) {
        console.error('Failed to save initial operations to localStorage', error);
    }
    
    return allOps;
};

const saveOperations = (operations: Operation[]): void => {
    try {
        localStorage.setItem(OPS_KEY, JSON.stringify(operations));
    } catch (error) {
        console.error('Failed to save operations to localStorage', error);
    }
};

const loadSettings = (): AppSettings => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error("Failed to parse stored settings", e);
        }
    }

    // Save default if nothing is in storage
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (error) {
        console.error('Failed to save initial settings to localStorage', error);
    }
    return DEFAULT_SETTINGS;
};

const saveSettings = (settings: AppSettings): void => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save settings to localStorage', error);
    }
};

const loadHolds = (terminal: string): Hold[] => {
    const key = `${HOLDS_PREFIX}${terminal}`;
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error("Failed to parse stored holds", e);
        }
    }

    const mockHolds = createMockHolds(terminal);
    // Save the initial mock data so it's available on next load
    try {
        localStorage.setItem(key, JSON.stringify(mockHolds));
    } catch (error) {
        console.error('Failed to save initial holds to localStorage', error);
    }
    return mockHolds;
};

const saveHolds = (holds: Hold[], terminal: string): void => {
    const key = `${HOLDS_PREFIX}${terminal}`;
    try {
        localStorage.setItem(key, JSON.stringify(holds));
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
