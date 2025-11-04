import { Operation, AppSettings, Hold } from '../types';
import { MOCK_OPERATIONS, DEFAULT_SETTINGS } from './mockData';

const loadOperations = (): Operation[] => {
    try {
        const stored = localStorage.getItem('operations_data');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load operations from localStorage', error);
    }
    // Fallback to the centralized mock data
    return MOCK_OPERATIONS;
};

const saveOperations = (operations: Operation[]): void => {
    try {
        localStorage.setItem('operations_data', JSON.stringify(operations));
    } catch (error) {
        console.error('Failed to save operations to localStorage', error);
    }
};

const loadSettings = (): AppSettings => {
    try {
        const stored = localStorage.getItem('settings_data');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Simple merge to ensure new settings from code are available if not in localStorage
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch (error) {
        console.error('Failed to load settings from localStorage', error);
    }
    // Fallback to the centralized default settings
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
        const stored = localStorage.getItem(`holds_data_${terminal}`);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load holds from localStorage', error);
    }
    // Initialize with holds from mock data for the selected terminal
    const initialHolds = MOCK_OPERATIONS.filter(op => op.terminal === terminal && op.modality === 'vessel' && op.currentStatus === 'On Hold').map(op => ({
        id: `hold-${op.id}`,
        resource: op.transferPlan[0].infrastructureId,
        terminal: op.terminal,
        startTime: op.eta,
        endTime: new Date(new Date(op.eta).getTime() + 4 * 3600 * 1000).toISOString(),
        reason: 'Maintenance',
        user: 'Auto-Gen',
        status: 'approved'
    } as Hold));
    
    return initialHolds; 
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