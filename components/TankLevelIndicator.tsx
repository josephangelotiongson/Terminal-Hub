import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

interface TankLevelIndicatorProps {
    tankName: string;
    transferVolume: number;
    transferDirection: 'in' | 'out';
}

const TankLevelIndicator: React.FC<TankLevelIndicatorProps> = ({ tankName, transferVolume, transferDirection }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { currentTerminalSettings } = context;
    const tankData = currentTerminalSettings.masterTanks?.[tankName];

    if (!tankData) {
        return <div className="text-sm text-red-600">Tank '{tankName}' not found in master data.</div>;
    }

    const { capacity, current } = tankData;
    const safeFillCapacity = capacity * 0.98;
    const finalVolume = transferDirection === 'in' ? current + transferVolume : current - transferVolume;
    const isOverfill = finalVolume > safeFillCapacity;
    const isNegative = finalVolume < 0;

    const toPercent = (val: number) => (capacity > 0 ? (val / capacity) * 100 : 0);

    const currentPct = toPercent(current);
    const transferPct = toPercent(transferVolume);
    const finalPct = toPercent(finalVolume);

    return (
        <div className={`p-4 border rounded-lg ${isOverfill || isNegative ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className="font-bold text-lg text-gray-800 mb-2">Tank Level: {tankName}</h4>
            
            <div className="tank-level-indicator">
                {/* Current Volume */}
                <div className="tank-level-bar tank-level-current" style={{ width: `${currentPct}%` }} />

                {/* Transfer Volume */}
                {transferDirection === 'in' ? (
                    <div className={`tank-level-bar tank-level-transfer-in ${isOverfill ? 'tank-level-overfill' : ''}`} style={{ left: `${currentPct}%`, width: `${transferPct}%` }} />
                ) : (
                    <div className="tank-level-bar tank-level-transfer-out" style={{ left: `${finalPct}%`, width: `${transferPct}%` }} />
                )}

                {/* Safe Fill Line */}
                <div className="absolute top-0 h-full border-r-2 border-dashed border-red-500" style={{ left: '98%' }} title={`Safe Fill: ${safeFillCapacity.toLocaleString()} T`}></div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-2 text-center text-sm">
                <div>
                    <p className="font-semibold text-gray-700">Current Volume</p>
                    <p className="text-gray-500">{current.toLocaleString()} T</p>
                </div>
                <div>
                    <p className="font-semibold text-gray-700">Transfer</p>
                    <p className={`font-bold ${transferDirection === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
                        {transferDirection === 'in' ? '+' : '-'}{transferVolume.toLocaleString()} T
                    </p>
                </div>
                <div>
                    <p className="font-semibold text-gray-700">Final Volume</p>
                    <p className={`font-bold ${isOverfill || isNegative ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}>
                        {finalVolume.toLocaleString()} T
                    </p>
                </div>
            </div>
            {isOverfill && <p className="text-center font-bold text-red-600 mt-2">WARNING: Plan exceeds safe fill level of {safeFillCapacity.toLocaleString()} T!</p>}
            {isNegative && <p className="text-center font-bold text-red-600 mt-2">WARNING: Plan results in a negative tank volume!</p>}
        </div>
    );
};

export default TankLevelIndicator;
