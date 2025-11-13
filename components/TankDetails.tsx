import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import TankDetailsModal from './TankDetailsModal';
import { Operation } from '../types';

// --- Main Component ---
const TankStatusDetails: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { activeTankId, goBack, tanks, operations, switchView } = context;

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    
    const tankData = useMemo(() => {
        if (!activeTankId) return null;
        return tanks?.[activeTankId] || null;
    }, [activeTankId, tanks]);

    const { projectedMovements, endOfDayVolume } = useMemo(() => {
        if (!activeTankId || !tankData) return { projectedMovements: [], endOfDayVolume: 0 };
        
        const today = new Date();
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

    }, [activeTankId, tankData, operations]);

    if (!tankData) {
        return <div className="card p-8 text-center m-6">Tank not found. Please go back to the listing.</div>;
    }

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
                
                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 card p-6 flex flex-col items-center">
                         <div className="relative w-48 h-48">
                            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                {/* Liquid */}
                                {fillPercentage > 0 && (
                                    <g>
                                        <ellipse cx="50" cy="90" rx="48" ry="8" fill={liquidBottomColor} />
                                        <path d={`M 2 ${liquidY} V 90 A 48 8 0 0 0 98 90 V ${liquidY} Z`} fill={liquidSideColor} />
                                        <ellipse cx="50" cy={liquidY} rx="48" ry="8" fill={liquidTopColor} opacity="0.9">
                                            <animate attributeName="ry" values="8;7.5;8" dur="3s" repeatCount="indefinite" />
                                        </ellipse>
                                    </g>
                                )}
                                {/* Tank Structure */}
                                <ellipse cx="50" cy="10" rx="48" ry="8" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.5" />
                                <path d="M 2 10 V 90 A 48 8 0 0 0 98 90 V 10" fill="transparent" stroke="#94a3b8" strokeWidth="0.5" />
                                <ellipse cx="50" cy="90" rx="48" ry="8" fill="transparent" stroke="#94a3b8" strokeWidth="0.5" />
                            </svg>
                        </div>
                         <div className="grid grid-cols-2 gap-4 w-full mt-4 text-center">
                            <div>
                                <p className="text-sm font-semibold text-text-secondary">Current Volume</p>
                                <p className="text-2xl font-bold text-brand-dark">{tankData.current.toLocaleString(undefined, { maximumFractionDigits: 1})} T</p>
                            </div>
                             <div>
                                <p className="text-sm font-semibold text-text-secondary">Capacity</p>
                                <p className="text-2xl font-bold text-text-primary">{tankData.capacity.toLocaleString()} T</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="lg:col-span-3 card p-6 space-y-4">
                        <h3 className="font-bold text-xl text-brand-dark">Today's Projected Volume</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            <div className="p-3 rounded-lg bg-slate-100 flex justify-between items-center">
                                <span className="font-semibold text-text-secondary">Current Volume</span>
                                <span className="font-bold text-lg text-text-primary">{tankData.current.toLocaleString(undefined, { maximumFractionDigits: 1 })} T</span>
                            </div>

                            {projectedMovements.map(({ op, transfer, volumeChange, projectedVolumeAfter }, index) => (
                                <div key={op.id + transfer.id} className="relative pl-6">
                                    <div className="absolute top-4 left-2.5 w-0.5 h-full bg-slate-200"></div>
                                    <div className="absolute top-4 left-0 h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center">
                                        <i className={`fas fa-arrow-${volumeChange > 0 ? 'up text-green-600' : 'down text-orange-600'}`}></i>
                                    </div>
                                    <div className="p-3 border rounded-lg ml-4 bg-white">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{op.transportId} <span className="text-xs font-normal text-text-tertiary">({op.modality})</span></p>
                                                <p className="text-xs text-text-secondary">ETA: {new Date(op.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <div className="text-right">
                                                 <p className={`font-bold text-lg ${volumeChange > 0 ? 'text-green-600' : 'text-orange-600'}`}>{volumeChange > 0 ? '+' : ''}{transfer.tonnes.toLocaleString()} T</p>
                                                 <p className="text-xs text-text-secondary">({transfer.product})</p>
                                            </div>
                                        </div>
                                         {op.status === 'active' && (
                                            <div className="text-right mt-2">
                                                <button onClick={() => switchView('operation-details', op.id)} className="btn-primary !py-1 !px-3 !text-xs">View Active Op</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 ml-4 flex justify-between items-center">
                                        <span className="font-semibold text-text-secondary text-xs">Projected Volume:</span>
                                        <span className="font-bold text-base text-text-primary">{projectedVolumeAfter.toLocaleString(undefined, { maximumFractionDigits: 1 })} T</span>
                                    </div>
                                </div>
                            ))}
                             <div className="p-3 rounded-lg bg-slate-800 text-white flex justify-between items-center">
                                <span className="font-semibold">End of Day Projected Volume</span>
                                <span className="font-bold text-lg">{endOfDayVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} T</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TankStatusDetails;