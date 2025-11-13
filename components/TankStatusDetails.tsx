import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import TankDetailsModal from './TankDetailsModal';
import { Operation, HistorianDataPoint, Transfer, Modality } from '../types';
import { MOCK_CURRENT_TIME } from '../constants';

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
    if (!context) return null;

    const { activeTankId, goBack, tanks, operations, switchView, getHistoryForAsset, simulatedTime } = context;

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'projection' | 'history'>('projection');
    const [historyMeasurement, setHistoryMeasurement] = useState<'level' | 'temperature' | 'pressure'>('level');
    
    const tankData = useMemo(() => {
        if (!activeTankId) return null;
        return tanks?.[activeTankId] || null;
    }, [activeTankId, tanks]);

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

    const historyData = useMemo(() => {
        if (!activeTankId) return [];
        return getHistoryForAsset(activeTankId, historyMeasurement);
    }, [activeTankId, historyMeasurement, getHistoryForAsset]);

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
    const liquidHeight = 80 * fillPercentage;
    const liquidY = 90 - liquidHeight;
    const isOverfilled = tankData.current > tankData.capacity;

    const liquidSideColor = isOverfilled ? "#ef4444" : "#60a5fa";
    const liquidTopColor = isOverfilled ? "#dc2626" : "#3b82f6";
    const liquidBottomColor = isOverfilled ? "#b91c1c" : "#2563eb";

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
                                <button onClick={() => setActiveTab('history')} className={`tab ${activeTab === 'history' ? 'active' : ''}`}>Historical Data</button>
                            </nav>
                        </div>
                        
                        {activeTab === 'projection' && (
                            <div className="space-y-1">
                                <div className="p-2 rounded-lg bg-slate-800 text-white flex justify-between items-center my-2 shadow-lg">
                                    <span className="font-bold text-sm">Current Volume</span>
                                    <span className="font-bold text-base">{tankData.current.toLocaleString(undefined, { maximumFractionDigits: 1 })} T</span>
                                </div>

                                {projectedMovements.map(({ op, transfer, volumeChange, projectedVolumeAfter }, index) => {
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
                                })}
                                <div className="p-2 rounded-lg bg-slate-800 text-white flex justify-between items-center mt-2">
                                    <span className="font-semibold text-sm">End of Day Projected</span>
                                    <span className="font-bold text-base">{endOfDayVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} T</span>
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