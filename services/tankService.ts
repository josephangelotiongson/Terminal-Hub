
import { TERMINAL_MASTER_DATA } from './masterData';
import { TerminalSettings } from '../types';

type TanksState = TerminalSettings['masterTanks'];

export const tankService = {
    loadTanks: (terminal: string): TanksState => {
        // DEMO MODE: Force clear local storage
        localStorage.removeItem(`tanks_data_${terminal}`);

        // Fallback to master data
        const masterTanks = TERMINAL_MASTER_DATA[terminal]?.masterTanks || {};
        localStorage.setItem(`tanks_data_${terminal}`, JSON.stringify(masterTanks));
        return masterTanks;
    },

    saveTanks: (terminal: string, tanks: TanksState): void => {
        try {
            localStorage.setItem(`tanks_data_${terminal}`, JSON.stringify(tanks));
        } catch (error) {
            console.error('Failed to save tanks to localStorage', error);
        }
    }
};
