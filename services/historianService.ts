
import { Operation, TerminalSettings, HistorianData } from '../types';

export const historianService = {
    loadHistorianData: (terminal: string, terminalSettings: TerminalSettings, allOperations: Operation[]): HistorianData => {
        const storageKey = `historian_data_v3_${terminal}`;
        
        // Data generation disabled per user request to reduce localStorage usage.
        localStorage.removeItem(storageKey);
        
        // Return empty data structure to prevent historical charts from loading data.
        return {};
    },
};