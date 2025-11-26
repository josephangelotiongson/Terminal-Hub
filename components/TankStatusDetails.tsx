
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import TankDetailsModal from './TankDetailsModal';
import { Operation, HistorianDataPoint, Transfer, Modality } from '../types';
import { MOCK_CURRENT_TIME } from '../constants';
import { formatDateTime, getOperationDurationHours } from '../utils/helpers';

// --- SVG Chart Component for Historical Data ---
const HistoryChart: React.FC<{
    data: HistorianDataPoint[];
    measurement: string;
    unit: string;
    capacity?: number;
}> = ({ data, measurement, unit, capacity }) => {
    
    const { yMin, yMax, yAxisLabels, xAxisLabels, pathData } = useMemo(() => {
        if (!data || data.length < 2) {
            return { yMin: 0, yMax: 100, xMin: 0, xMax: 1, yAxisLabels: [], xAxisLabels: [], pathData: '' };
        }

        let yMin: number, yMax: number;

        if (measurement === 'level' && capacity && capacity > 0) {
            yMin = 0;
            yMax = capacity;
        } else {
            const values = data.map(d => d.value);
            const dataYMin = Math.min(...values);
            const dataYMax = Math.max(...values);
            const yRange = dataYMax - dataYMin;
            const yPadding = yRange * 0.1 || 10;
            yMin = Math.max(0, dataYMin - yPadding);
            yMax = dataYMax + yPadding;
        }
        
        const timestamps = data.map(d => new Date(d.timestamp).getTime());
        const xMin = Math.min(...timestamps);
        const xMax = Math.max(...timestamps);

        const yLabels = [];
        for(let i = 0; i <= 4; i++) {
            yLabels.push(yMin + (yMax - yMin) * (i / 4));
        }
        yLabels.reverse(); // For top-to-bottom rendering

        const xLabels = [];
        for(let i = 0; i <= 4; i++) {
            xLabels.push(new Date(xMin + (xMax - xMin) * (i / 4)));
        }

        const points = data.map(d => {
            const x = ((new Date(d.timestamp).getTime() - xMin) / (xMax - xMin)) * 100;
            const y = 100 - ((d.value - yMin) / (yMax - yMin)) * 100;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');

        return { yMin, yMax, xMin, xMax, yAxisLabels: yLabels, xAxisLabels: xLabels, pathData: points };
    }, [data, measurement, capacity]);

    return (
        <div className="h-64 flex text-xs text-text-tertiary">
            <div className="flex flex-col justify-between pr-2 text-right">
                {yAxisLabels.map((label, i) => (
                    <span key={i}>
                        {i === 0 
                            ? `${label.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unit}` 
                            : label.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                ))}
            </div>
            <div className="flex-grow flex flex-col">
                <div className="flex-grow relative">
                    <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                        {yAxisLabels.map((_, i) => (
                             <line key={i} x1="0" y1={`${(i / (yAxisLabels.length - 1)) * 100}%`} x2="100%" y2={`${(i / (yAxisLabels.length - 1)) * 100}%`} stroke="#e2e8f0" strokeWidth="1" />
                        ))}
                        <polyline fill="none" stroke="#4f46e5" strokeWidth="2" points={pathData} vectorEffect="non-scaling-stroke" />
                    </svg>
                </div>
                <div className="flex justify-between pt-2 border-t">
                     {xAxisLabels.map((label, i) => {
                         let labelText = '';
                         if (i === 0) {
                             labelText = '14d ago';
                         } else if (i === xAxisLabels.length - 1) {
                             labelText = 'Today';
                         } else {
                             labelText = label.toLocaleDateString([], { month: 'short', day: 'numeric' });
                         }
                         return <span key={i} className="text-center">{labelText}</span>
                     })}
                </div>
            </div>
        </div>
    );
};

// --- Inventory Projection Chart ---
const InventoryProjectionChart: React.FC<{
    data: { timestamp: Date; value: number }[];
    capacity: number;
}> = ({ data, capacity }) => {
    const { yAxisLabels, xAxisLabels, pathData, dangerZones } = useMemo(() => {
        if (!data || data.length === 0) {
            return { yAxisLabels: [], xAxisLabels: [], pathData: '', dangerZones: [] };
        }

        // Y Axis: 0 to Capacity (with 10% buffer on top)
        const yMin = 0;
        const yMax = capacity * 1.1; 

        // X Axis: Min time to Max time
        const timestamps = data.map(d => d.timestamp.getTime());
        const xMin = Math.min(...timestamps);
        const xMax = Math.max(...timestamps);
        const xRange = xMax - xMin || 1; // Avoid div by zero

        // Generate Labels
        const yLabels = [capacity * 1.1, capacity, capacity * 0.5, 0];
        const xLabels = [
            new Date(xMin),
            new Date(xMin + xRange * 0.33),
            new Date(xMin + xRange * 0.66),
            new Date(xMax)
        ];

        // Map Points
        const points = data.map(d => {
            const x = ((d.timestamp.getTime() - xMin) / xRange) * 100;
            // Scale value relative to yMax
            const y = 100 - (d.value / yMax) * 100; 
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');

        return { yAxisLabels: yLabels, xAxisLabels: xLabels, pathData: points, dangerZones: [] };
    }, [data, capacity]);

    const safeFillY = 100 - ((capacity * 0.98) / (capacity * 1.1)) * 100;
    const capacityY = 100 - (capacity / (capacity * 1.1)) * 100;
    const zeroY = 100 - 0; // Bottom of valid range

    return (
        <div className="h-64 flex text-xs text-text-tertiary">
            <div className="flex flex-col justify-between pr-2 text-right w-16 flex-shrink-0">
                {yAxisLabels.map((label, i) => (
                    <span key={i} className={i === 1 ? 'text-red-500 font-bold' : ''}>
                        {label.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                ))}
            </div>
            <div className="flex-grow flex flex-col">
                <div className="flex-grow relative border-l border-slate-200">
                    <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                        {/* Background Grid */}
                        <line x1="0" y1="0%" x2="100%" y2="0%" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="0" y1="100%" x2="100%" y2="100%" stroke="#e2e8f0" strokeWidth="1" />
                        
                        {/* Safe Fill Line (98%) */}
                        <line x1="0" y1={`${safeFillY}%`} x2="100%" y2={`${safeFillY}%`} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,4" />
                        {/* Capacity Line (100%) */}
                        <line x1="0" y1={`${capacityY}%`} x2="100%" y2={`${capacityY}%`} stroke="#ef4444" strokeWidth="2" strokeDasharray="2,2" />
                        {/* Zero Line */}
                        <line x1="0" y1={`${zeroY}%`} x2="100%" y2={`${zeroY}%`} stroke="#64748b" strokeWidth="2" />

                        {/* Data Line */}
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={pathData} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                        
                        {/* Area under curve (Optional aesthetic) */}
                        <polygon points={`${0},${zeroY} ${pathData} ${100},${zeroY}`} fill="url(#blueGradient)" opacity="0.2" />
                        
                        <defs>
                            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#ffffff" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <div className="flex justify-between pt-2 border-t">
                     {xAxisLabels.map((label, i) => (
                         <span key={i} className="text-center">{label.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                     ))}
                </div>
            </div>
        </div>
    );
};

const getIcon = (modality: Modality): string => {
    switch (modality) {
        case 'vessel': return 'fa-ship';
        case 'truck': return 'fa-truck';
        case 'rail': return 'fa-train';
        default: return 'fa-question-circle';
    }
};

// --- Main Component ---
const TankStatusDetails: React.FC = () => {
    const context = useContext(AppContext);
    
    // Safe defaults for hooks to run unconditionally
    const activeTankId = context?.activeTankId || null;
    const tanks = context?.tanks || {};
    const operations = context?.operations || [];
    const simulatedTime = context?.simulatedTime || MOCK_CURRENT_TIME;
    const getHistoryForAsset = context?.getHistoryForAsset || (() => []);

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'projection' | 'forecast' | 'history'>('projection');
    const [historyMeasurement, setHistoryMeasurement] = useState<'level' | 'temperature' | 'pressure'>('level');
    
    const tankData = useMemo(() => {
        if (!activeTankId) return null;
        return tanks?.[activeTankId] || null;
    }, [activeTankId, tanks]);

    // --- 1. Today's Projection (Detailed, short-term) ---
    const { projectedMovements, endOfDayVolume } = useMemo(() => {
        if (!activeTankId || !tankData) return { projectedMovements: [], endOfDayVolume: 0 };
        
        const today = simulatedTime;
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();

        const todaysOps = operations
            .filter(op => {
                const opTime = new Date(op.eta).getTime();
                return (op.status === 'planned' || op.status === 'active') && opTime >= startOfDay && opTime < endOfDay;
            })
            .flatMap(op => 
                op.transferPlan.flatMap(line => 
                    line.transfers.map(t => ({ op, transfer: t }))
                )
            )
            .filter(({ transfer }) => transfer.from === activeTankId || transfer.to === activeTankId)
            .sort((a, b) => new Date(a.op.eta).getTime() - new Date(b.op.eta).getTime());
            
        let runningVolume = tankData.current;
        const movements = todaysOps.map(({ op, transfer }) => {
            const isIncoming = transfer.to === activeTankId;
            const volumeChange = isIncoming ? transfer.tonnes : -transfer.tonnes;
            runningVolume += volumeChange;
            return {
                op,
                transfer,
                volumeChange,
                projectedVolumeAfter: runningVolume
            };
        });

        return { projectedMovements: movements, endOfDayVolume: runningVolume };

    }, [activeTankId, tankData, operations, simulatedTime]);

    // --- 2. Inventory Forecast (Long-term, all scheduled) ---
    const { inventoryForecast, forecastDataPoints } = useMemo(() => {
        if (!activeTankId || !tankData) return { inventoryForecast: [], forecastDataPoints: [] };

        // Get all future planned or active operations
        const allRelevantOps = operations
            .filter(op => (op.status === 'planned' || op.status === 'active') && op.transferPlan)
            .flatMap(op => 
                op.transferPlan.flatMap(line => 
                    line.transfers
                        .filter(t => t.from === activeTankId || t.to === activeTankId)
                        .map(t => ({ op, transfer: t }))
                )
            )
            .sort((a, b) => new Date(a.op.eta).getTime() - new Date(b.op.eta).getTime());

        let runningVolume = tankData.current;
        
        // Start point for chart
        const points: { timestamp: Date; value: number }[] = [];
        points.push({ timestamp: simulatedTime, value: runningVolume });
        
        const forecast = allRelevantOps.map(({ op, transfer }) => {
            const isIncoming = transfer.to === activeTankId;
            
            const opStart = new Date(op.eta);
            const duration = getOperationDurationHours(op);
            const opEnd = new Date(opStart.getTime() + duration * 3600 * 1000);

            let graphChange = isIncoming ? transfer.tonnes : -transfer.tonnes;
            let tableChange = graphChange; // Table shows total planned change

            // For active operations, we need to calculate remaining volume to project
            if (op.status === 'active') {
                const transferred = transfer.transferredTonnes || 0;
                const remaining = transfer.tonnes - transferred;
                graphChange = isIncoming ? remaining : -remaining;
            }

            // --- Logic for Graph Points ---
            // Only plot future changes
            if (opEnd > simulatedTime) {
                const plotStart = opStart > simulatedTime ? opStart : simulatedTime;
                const preVolume = runningVolume;
                runningVolume += graphChange;
                
                // Point before change starts (flat line from previous state)
                points.push({ timestamp: plotStart, value: preVolume });
                // Point after change ends (sloped line for transfer duration)
                points.push({ timestamp: opEnd, value: runningVolume });
            } else {
                // If op is "planned" but in the past (overdue), assume it happens NOW
                if (op.status === 'planned') {
                     const preVolume = runningVolume;
                     runningVolume += graphChange;
                     points.push({ timestamp: simulatedTime, value: preVolume });
                     const shiftedEnd = new Date(simulatedTime.getTime() + duration * 3600 * 1000);
                     points.push({ timestamp: shiftedEnd, value: runningVolume });
                }
                // If active and "finished" in past according to duration but not status?
                // We ignore it for the graph beyond ensuring runningVolume is up to date if needed.
                // But runningVolume starts at tankData.current (Live), so past events shouldn't double count.
            }

            return {
                id: op.id + transfer.id,
                date: op.eta,
                transportId: op.transportId,
                modality: op.modality,
                product: transfer.product,
                customer: transfer.customer,
                direction: isIncoming ? 'In' : 'Out',
                change: tableChange, 
                balance: runningVolume,
                isViolation: runningVolume < 0 || runningVolume > tankData.capacity
            };
        });

        // Sort points by timestamp to ensure correct drawing order
        points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return { inventoryForecast: forecast, forecastDataPoints: points };
    }, [activeTankId, tankData, operations, simulatedTime]);


    const historyData = useMemo(() => {
        if (!activeTankId) return [];
        return getHistoryForAsset(activeTankId, historyMeasurement);
    }, [activeTankId, historyMeasurement, getHistoryForAsset]);

    if (!context) return null;
    const { goBack, switchView } = context;

    if (!tankData) {
        return <div className="card p-8 text-center m-6">Tank not found. Please go back to the listing.</div>;
    }

    const measurementUnitMap = {
        level: 'T',
        temperature: '°F',
        pressure: 'inWC',
    };
    const unit = measurementUnitMap[historyMeasurement];
    const measurementName = historyMeasurement.charAt(0).toUpperCase() + historyMeasurement.slice(1);

    const fillPercentage = tankData.capacity > 0 ? Math.min(1, tankData.current / tankData.capacity) : 0;
    const isOverfilled = tankData.current > tankData.capacity;

    return (
        <>
            <TankDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} tankId={activeTankId} />
            <div className="p-4 sm:p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="btn-icon"><i className="fas fa-arrow-left text-xl"></i></button>
                        <h2 className="text-3xl font-bold text-brand-dark">Tank {activeTankId} Status</h2>
                    </div>
                    <div>
                         <button onClick={() => setIsDetailsModalOpen(true)} className="btn-secondary mr-2">Tank Details</button>
                        <button className="btn-icon"><i className="fas fa-cog text-xl"></i></button>
                    </div>
                </div>
                
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 card p-6 flex flex-col items-center">
                         <div className="relative w-32 h-32">
                            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                <ellipse cx="50" cy="90" rx="48" ry="8" fill="#2563eb" />
                                <path d={`M 2 ${90 - 80 * fillPercentage} V 90 A 48 8 0 0 0 98 90 V ${90 - 80 * fillPercentage} Z`} fill="#60a5fa" />
                                <ellipse cx="50" cy={90 - 80 * fillPercentage} rx="48" ry="8" fill="#3b82f6" opacity="0.9" />
                                <ellipse cx="50" cy="10" rx="48" ry="8" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
                                <path d="M 2 10 V 90 A 48 8 0 0 0 98 90 V 10" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
                            </svg>
                        </div>
                         <div className="grid grid-cols-2 gap-4 w-full mt-4 text-center">
                            <div><p className="text-sm font-semibold text-text-secondary">Current Volume</p><p className="text-2xl font-bold text-brand-dark">{tankData.current.toLocaleString(undefined, { maximumFractionDigits: 1})} T</p></div>
                            <div><p className="text-sm font-semibold text-text-secondary">Capacity</p><p className="text-2xl font-bold text-text-primary">{tankData.capacity.toLocaleString()} T</p></div>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-2 card p-6">
                         <div className="border-b mb-4">
                            <nav className="-mb-px flex space-x-4">
                                <button onClick={() => setActiveTab('projection')} className={`tab ${activeTab === 'projection' ? 'active' : ''}`}>Today's Transfers</button>
                                <button onClick={() => setActiveTab('forecast')} className={`tab ${activeTab === 'forecast' ? 'active' : ''}`}>Inventory Forecast</button>
                                <button onClick={() => setActiveTab('history')} className={`tab ${activeTab === 'history' ? 'active' : ''}`}>Historical Data</button>
                            </nav>
                        </div>
                        
                        {activeTab === 'projection' && (
                            <div className="space-y-1">
                                <div className="p-2 rounded-lg bg-slate-800 text-white flex justify-between items-center my-2 shadow-lg">
                                    <span className="font-bold text-sm">Current Volume</span>
                                    <span className="font-bold text-base">{tankData.current.toLocaleString(undefined, { maximumFractionDigits: 1 })} T</span>
                                </div>

                                {projectedMovements.length > 0 ? projectedMovements.map(({ op, transfer, volumeChange, projectedVolumeAfter }, index) => {
                                    const time = new Date(op.eta);

                                    return (
                                        <div key={op.id + transfer.id} className="relative pl-6">
                                            <div className="absolute top-4 left-2.5 w-0.5 h-full bg-slate-200"></div>
                                            <div className="absolute top-4 left-0 h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center">
                                                <i className={`fas fa-arrow-${volumeChange > 0 ? 'up text-green-600' : 'down text-orange-600'}`}></i>
                                            </div>
                                            <div className="p-3 border rounded-lg ml-4 bg-white hover:bg-slate-50 cursor-pointer" onClick={() => switchView('operation-details', op.id)}>
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-semibold text-sm truncate flex items-center gap-2">
                                                            <i className={`fas ${getIcon(op.modality)} text-text-secondary w-4 text-center`}></i>
                                                            <span>{op.transportId}</span>
                                                        </p>
                                                        <p className="text-xs text-text-secondary truncate">{transfer.product}</p>
                                                    </div>
                                                    <div className="text-right">
                                                         <p className={`font-semibold text-sm ${volumeChange > 0 ? 'text-green-600' : 'text-orange-600'}`}>{volumeChange > 0 ? '+' : ''}{transfer.tonnes.toLocaleString()} T</p>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-baseline mt-1">
                                                    <span className="font-mono text-xs w-12">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <div className="text-right font-mono text-xs w-24 text-text-secondary">
                                                        &rarr; {projectedVolumeAfter.toLocaleString(undefined, { maximumFractionDigits: 1 })} T
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }) : <p className="text-center text-slate-500 py-8">No transfers scheduled for today.</p>}
                                <div className="p-2 rounded-lg bg-slate-800 text-white flex justify-between items-center mt-2">
                                    <span className="font-semibold text-sm">End of Day Projected</span>
                                    <span className="font-bold text-base">{endOfDayVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} T</span>
                                </div>
                            </div>
                        )}

                        {activeTab === 'forecast' && (
                            <div className="flex flex-col h-full">
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-lg text-brand-dark">Projected Inventory Levels</h4>
                                        <div className="flex items-center gap-4 text-xs font-semibold">
                                            <span className="flex items-center"><span className="w-3 h-0.5 bg-red-500 mr-1"></span>Capacity</span>
                                            <span className="flex items-center"><span className="w-3 h-0.5 bg-yellow-500 mr-1 border-b border-dashed"></span>Safe Fill</span>
                                        </div>
                                    </div>
                                    <div className="bg-white p-2 border rounded-lg shadow-sm">
                                        <InventoryProjectionChart data={forecastDataPoints} capacity={tankData.capacity} />
                                    </div>
                                </div>

                                <div className="overflow-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
                                            <tr>
                                                <th className="p-2 border-b">Date</th>
                                                <th className="p-2 border-b">Operation</th>
                                                <th className="p-2 border-b text-center">Dir</th>
                                                <th className="p-2 border-b text-right">Change</th>
                                                <th className="p-2 border-b text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventoryForecast.map((row, idx) => (
                                                <tr key={row.id} className={`border-b hover:bg-slate-50 ${row.isViolation ? 'bg-red-50' : ''}`}>
                                                    <td className="p-2 whitespace-nowrap text-xs text-slate-600">
                                                        {formatDateTime(row.date)}
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="font-semibold text-slate-800">{row.transportId}</div>
                                                        <div className="text-xs text-slate-500">{row.customer}</div>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${row.direction === 'In' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                            {row.direction}
                                                        </span>
                                                    </td>
                                                    <td className={`p-2 text-right font-mono ${row.change > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {row.change > 0 ? '+' : ''}{row.change.toLocaleString()}
                                                    </td>
                                                    <td className="p-2 text-right font-mono font-bold text-slate-700">
                                                        {row.balance.toLocaleString()}
                                                        {row.isViolation && <i className="fas fa-exclamation-triangle text-red-600 ml-2" title="Projected Violation (Overfill or Negative)"></i>}
                                                    </td>
                                                </tr>
                                            ))}
                                            {inventoryForecast.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">No future operations scheduled for this tank.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'history' && (
                             <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h4 className="font-bold text-lg text-brand-dark">Historical Trend: {measurementName}</h4>
                                        <p className="text-sm text-text-secondary -mt-1">Last 14 Days</p>
                                    </div>
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded-md">
                                        <button onClick={() => setHistoryMeasurement('level')} className={`px-2 py-0.5 text-xs font-semibold rounded ${historyMeasurement === 'level' ? 'bg-white shadow-sm' : ''}`}>Level</button>
                                        <button onClick={() => setHistoryMeasurement('temperature')} className={`px-2 py-0.5 text-xs font-semibold rounded ${historyMeasurement === 'temperature' ? 'bg-white shadow-sm' : ''}`}>Temp</button>
                                        <button onClick={() => setHistoryMeasurement('pressure')} className={`px-2 py-0.5 text-xs font-semibold rounded ${historyMeasurement === 'pressure' ? 'bg-white shadow-sm' : ''}`}>Pressure</button>
                                    </div>
                                </div>
                                <HistoryChart 
                                    data={historyData} 
                                    measurement={historyMeasurement} 
                                    unit={unit} 
                                    capacity={historyMeasurement === 'level' ? tankData.capacity : undefined}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default TankStatusDetails;
