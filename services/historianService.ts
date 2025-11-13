
/**
 * NOTE TO MAINTAINER & AI:
 * This service simulates a SCADA/historian database for all master data assets.
 * Its primary purpose is to generate realistic, persistent time-series data
 * each time the application loads for the first time for a given terminal.
 * This ensures that charts and historical views are populated with believable data
 * that reflects simulated terminal activity based on the mock operations data.
 *
 * THIS IS A CORE REQUIREMENT and this simulation should not be removed or disabled
 * without replacing it with a real backend integration.
 */
import { Operation, TerminalSettings, HistorianData, HistorianDataPoint } from '../types';
import { MOCK_CURRENT_TIME } from '../constants';

// A simple seeded pseudo-random number generator
const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

/**
 * Generates a realistic historical dataset for all assets in a terminal.
 * It simulates asset states (tank levels, flow rates) over time based on when
 * mock operations were active.
 */
const generateRealisticData = (
    terminalSettings: TerminalSettings,
    allOperations: Operation[]
): HistorianData => {
    const historian: HistorianData = {};
    const allAssetIds = new Set([
        ...Object.keys(terminalSettings.masterTanks || {}),
        ...Object.keys(terminalSettings.infrastructureModalityMapping || {})
    ]);

    // Initialize current state and history arrays for all assets
    const assetStates: { [assetId: string]: { [measurement: string]: number } } = {};
    allAssetIds.forEach(assetId => {
        historian[assetId] = {};
        assetStates[assetId] = {};
        const tank = terminalSettings.masterTanks?.[assetId];
        if (tank) {
            assetStates[assetId] = {
                level: tank.current,
                temperature: tank.measurements?.temperature || 75,
                pressure: tank.measurements?.pressure || 2,
            };
            Object.keys(assetStates[assetId]).forEach(m => historian[assetId][m] = []);
        } else {
            assetStates[assetId] = { flowRate: 0, pressure: 0, temperature: 0 };
            Object.keys(assetStates[assetId]).forEach(m => historian[assetId][m] = []);
        }
    });

    const now = MOCK_CURRENT_TIME;
    const historyDurationDays = 14; // Reduced from 30
    const intervalMinutes = 30; // Increased from 15
    const totalIntervals = historyDurationDays * 24 * (60 / intervalMinutes);

    // Iterate backwards in time to build the history
    for (let i = 0; i < totalIntervals; i++) {
        const timestamp = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
        const timestampMs = timestamp.getTime();
        
        // Generate a seed for this timestamp to ensure deterministic noise
        const timeSeed = i * 123.45;

        const activeAssetsAtThisInterval = new Set<string>();

        // Find operations active during this specific time interval
        const activeOps = allOperations.filter(op => {
            const eta = new Date(op.eta).getTime();
            const completed = op.completedTime ? new Date(op.completedTime).getTime() : op.cancellationDetails ? new Date(op.cancellationDetails.time).getTime() : Infinity;
            return timestampMs >= eta && timestampMs <= completed;
        });
        
        // Determine asset activity based on operations
        activeOps.forEach(op => {
            op.transferPlan.forEach(line => {
                if (line.infrastructureId) {
                    activeAssetsAtThisInterval.add(line.infrastructureId);
                    const state = assetStates[line.infrastructureId];
                    if (state && 'flowRate' in state) {
                        const baseFlow = op.modality === 'vessel' ? 1200 : op.modality === 'truck' ? 150 : 300;
                        // Deterministic noise
                        const noise = (seededRandom(timeSeed + line.infrastructureId.charCodeAt(0)) - 0.5) * 50;
                        state.flowRate = baseFlow + noise;
                        state.pressure = (baseFlow / 200) + (seededRandom(timeSeed + 1) - 0.5) * 0.5;
                        state.temperature = 45 + (seededRandom(timeSeed + 2) - 0.5) * 5;
                    }
                }
                line.transfers.forEach(t => {
                    const tankId = t.direction.includes(' to Tank') ? t.to : t.from;
                    if (tankId && assetStates[tankId]) {
                        activeAssetsAtThisInterval.add(tankId);
                        const state = assetStates[tankId];
                        const baseFlow = op.modality === 'vessel' ? 1200 : op.modality === 'truck' ? 150 : 300;
                        const volumeChange = (baseFlow * (intervalMinutes / 60)); // Tonnes per interval
                        
                        // We are moving backwards in time, so we reverse the operation
                        if (t.direction.includes(' to Tank')) state.level -= volumeChange;
                        else state.level += volumeChange;
                        
                        state.temperature += (seededRandom(timeSeed + tankId.charCodeAt(0)) - 0.6) * 0.5; // Temp fluctuates more when active
                    }
                });
            });
        });

        // Add a data point for every asset at this timestamp
        allAssetIds.forEach(assetId => {
            const state = assetStates[assetId];
            const assetSeed = timeSeed + assetId.charCodeAt(0);
            
            if (!activeAssetsAtThisInterval.has(assetId)) {
                // If inactive, simulate noise or reversion to idle state
                if ('flowRate' in state) { state.flowRate = 0; state.pressure = 0; state.temperature = 20; }
                if ('level' in state) {
                    state.level += (seededRandom(assetSeed) - 0.5) * 2; // Small level drift
                    state.temperature += (seededRandom(assetSeed + 1) - 0.5) * 0.05; // Temp drifts slowly
                    state.pressure = Math.max(0, state.pressure + (seededRandom(assetSeed + 2) - 0.5) * 0.02); // Pressure drifts slowly
                }
            }
            
            // Record the state for this timestamp by unshifting (we're going backwards)
            Object.keys(state).forEach(measurement => {
                historian[assetId][measurement].unshift({
                    timestamp: timestamp.toISOString(),
                    value: state[measurement]
                });
            });
        });
    }

    return historian;
};


export const historianService = {
    loadHistorianData: (terminal: string, terminalSettings: TerminalSettings, allOperations: Operation[]): HistorianData => {
        const storageKey = `historian_data_v3_${terminal}`;
        
        // DEMO MODE: Force clear local storage
        localStorage.removeItem(storageKey);
        
        // If not found, generate, save, and return
        console.log(`Generating new historian data for terminal ${terminal}...`);
        const newData = generateRealisticData(terminalSettings, allOperations);
        try {
            localStorage.setItem(storageKey, JSON.stringify(newData));
        } catch (e) {
            console.error("Failed to save historian data to localStorage.", e);
        }
        return newData;
    },
};
