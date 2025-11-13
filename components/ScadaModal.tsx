import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, HistorianDataPoint } from '../types';
import { formatInfraName } from '../utils/helpers';

const Sparkline: React.FC<{ data: HistorianDataPoint[], width: number, height: number, color: string }> = ({ data, width, height, color }) => {
    if (data.length < 2) return <div style={{ width, height }} className="flex items-center justify-center text-slate-300 text-xs">...</div>;

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.value - min) / range) * height;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                points={points}
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
};


const ScadaModal: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { scadaData, operations, switchView, getHistoryForAsset } = context;
    const [isCollapsed, setIsCollapsed] = useState(true);

    const activeInfraIds = Object.keys(scadaData).filter(id => scadaData[id].pumpStatus === 'ON');

    // Only show when pumps are running.
    if (activeInfraIds.length === 0) {
        return null;
    }
    
    // Find which operation is associated with which infra
    const infraToOpMap: Record<string, Operation> = {};
    const activeOps = operations.filter(op => op.status === 'active');
    activeOps.forEach(op => {
        op.transferPlan.forEach(tp => {
            if (activeInfraIds.includes(tp.infrastructureId)) {
                infraToOpMap[tp.infrastructureId] = op;
            }
        });
    });

    return (
        <div className="fixed bottom-4 right-4 z-[60] w-96 pointer-events-none">
            <div className="card shadow-2xl bg-background-card/95 text-text-primary border-border-primary backdrop-blur-sm pointer-events-auto transition-all duration-300">
                <div className="p-3 border-b border-border-primary flex justify-between items-center">
                    <h3 className="font-bold text-base flex items-center gap-2">
                        <i className="fas fa-wave-square text-brand-primary animate-pulse"></i>
                        Live SCADA Feed
                    </h3>
                    <button
                        onClick={() => setIsCollapsed(prev => !prev)}
                        className="text-text-tertiary hover:text-text-primary"
                        title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                        <i className={`fas ${isCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                    </button>
                </div>
                {!isCollapsed && (
                    <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
                        {activeInfraIds.sort().map(infraId => {
                            const data = scadaData[infraId];
                            const op = infraToOpMap[infraId];
                            const flowHistory = getHistoryForAsset(infraId, 'flowRate').slice(-24); // Last 6 hours
                            const tempHistory = getHistoryForAsset(infraId, 'temperature').slice(-24);
                            const pressureHistory = getHistoryForAsset(infraId, 'pressure').slice(-24);
                            return (
                                <div key={infraId} className="text-xs">
                                    <div className="flex justify-between items-center">
                                        <p className="font-bold text-brand-dark">{formatInfraName(infraId)}</p>
                                        {op && 
                                            <button 
                                                onClick={() => switchView('operation-details', op.id)}
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                {op.transportId} <i className="fas fa-external-link-alt ml-1"></i>
                                            </button>
                                        }
                                    </div>
                                    <div className="space-y-1 mt-1 p-2 bg-slate-100 rounded-md">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-text-secondary">Flow:</span> 
                                                <span className="font-mono font-bold ml-1 text-text-primary">{data.flowRate.toFixed(0)} T/hr</span>
                                            </div>
                                            <Sparkline data={flowHistory} width={80} height={20} color="#4f46e5" />
                                        </div>
                                         <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-text-secondary">Temp:</span>
                                                <span className="font-mono font-bold ml-1 text-text-primary">{data.temperature.toFixed(1)}°F</span>
                                            </div>
                                             <Sparkline data={tempHistory} width={80} height={20} color="#ef4444" />
                                        </div>
                                         <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-text-secondary">Pressure:</span>
                                                <span className="font-mono font-bold ml-1 text-text-primary">{data.pressure.toFixed(1)} kPa</span>
                                            </div>
                                            <Sparkline data={pressureHistory} width={80} height={20} color="#f97316" />
                                        </div>
                                        <div>
                                            <span className="text-text-secondary">Pump:</span> 
                                            <span className={`font-bold ml-1 ${data.pumpStatus === 'ON' ? 'text-green-600' : 'text-red-600'}`}>{data.pumpStatus}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScadaModal;