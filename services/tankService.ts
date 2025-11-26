
import { TERMINAL_MASTER_DATA } from './masterData';
import { TerminalSettings } from '../types';

type TanksState = TerminalSettings['masterTanks'];

const TANKS_PREFIX = 'term_hub_tanks_v1_';

export const tankService = {
    loadTanks: (terminal: string): TanksState => {
        const storageKey = `${TANKS_PREFIX}${terminal}`;
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse stored tanks", e);
            }
        }

        // Fallback to master data
        const masterTanks = TERMINAL_MASTER_DATA[terminal]?.masterTanks || {};
        localStorage.setItem(storageKey, JSON.stringify(masterTanks));
        return masterTanks;
    },

    saveTanks: (terminal: string, tanks: TanksState): void => {
        const storageKey = `${TANKS_PREFIX}${terminal}`;
        try {
            localStorage.setItem(storageKey, JSON.stringify(tanks));
        } catch (error) {
            console.error('Failed to save tanks to localStorage', error);
        }
    }
};
