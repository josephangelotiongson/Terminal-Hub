import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';

// New visual component for the tank with fill level
const TankVisualizer: React.FC<{ current: number; capacity: number }> = ({ current, capacity }) => {
    const fillPercentage = capacity > 0 ? Math.min(1, current / capacity) : 0;
    const liquidHeight = 75 * fillPercentage; // Cylindrical part height is 75 (from y=15 to y=90)
    const liquidY = 90 - liquidHeight;
    const isOverfilled = current > capacity;

    const liquidSideColor = isOverfilled ? "#ef4444" : "#60a5fa";
    const liquidTopColor = isOverfilled ? "#dc2626" : "#3b82f6";
    const liquidBottomColor = isOverfilled ? "#b91c1c" : "#2563eb"; // A darker shade for the bottom

    return (
        <div className="w-24 h-auto flex-shrink-0 relative">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="tankSideGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#e2e8f0" />
                        <stop offset="50%" stopColor="#f8fafc" />
                        <stop offset="100%" stopColor="#e2e8f0" />
                    </linearGradient>
                </defs>

                {/* Liquid */}
                {fillPercentage > 0 && (
                    <g>
                        <ellipse cx="50" cy="90" rx="45" ry="10" fill={liquidBottomColor} />
                        <path d={`M 5 ${liquidY} V 90 A 45 10 0 0 0 95 90 V ${liquidY} Z`} fill={liquidSideColor} />
                        <ellipse cx="50" cy={liquidY} rx="45" ry="10" fill={liquidTopColor} opacity="0.9">
                            <animate attributeName="ry" values="10;9.5;10" dur="3s" repeatCount="indefinite" />
                        </ellipse>
                    </g>
                )}

                {/* Tank Structure (drawn over the liquid) */}
                <ellipse cx="50" cy="15" rx="45" ry="10" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                <path d="M 5 15 V 90 A 45 10 0 0 0 95 90 V 15" fill="transparent" stroke="#cbd5e1" strokeWidth="1" />
                <ellipse cx="50" cy="90" rx="45" ry="10" fill="transparent" stroke="#cbd5e1" strokeWidth="1" />
                
                {/* Horizontal guide lines */}
                {[...Array(8)].map((_, i) => (
                    <path key={i} d={`M 5 ${25 + i * 8} A 45 10 0 0 1 95 ${25 + i * 8}`} fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeOpacity="0.3" />
                ))}
                <path d="M 5 15 A 45 10 0 0 1 95 15" fill="none" stroke="#cbd5e1" strokeWidth="1" />
            </svg>
             <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                {`${(fillPercentage * 100).toFixed(0)}%`}
            </div>
        </div>
    );
};


const TankStatus: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { tanks, switchView } = context;

    const sortedTanks = useMemo(() => {
        return Object.entries(tanks || {}).sort(([nameA], [nameB]) => nameA.localeCompare(nameB, undefined, { numeric: true }));
    }, [tanks]);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-brand-dark">Tank Status</h2>
                <button className="btn-icon"><i className="fas fa-cog text-xl"></i></button>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex items-start gap-3">
                <i className="fas fa-exclamation-triangle text-yellow-500 mt-1"></i>
                <p className="text-sm text-yellow-800">
                    <span className="font-bold">Disclaimer:</span> Data in this web app is for informational purposes only. Please consult with relevant experts before making any operational decisions.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {sortedTanks.map(([tankName, tankData]) => {
                    const lastUpdatedDate = tankData.lastUpdated ? new Date(tankData.lastUpdated) : null;
                    const daysAgo = lastUpdatedDate ? Math.floor((new Date().getTime() - lastUpdatedDate.getTime()) / (1000 * 3600 * 24)) : null;
                    let lastUpdatedText = 'Unknown';
                    if (daysAgo !== null) {
                        if (daysAgo === 0) lastUpdatedText = 'today';
                        else if (daysAgo === 1) lastUpdatedText = 'yesterday';
                        else if (daysAgo < 365) lastUpdatedText = `${daysAgo} days ago`;
                        else lastUpdatedText = `over a year ago`;
                    }
                    
                    return (
                        <div key={tankName} onClick={() => switchView('tank-status-details', null, null, null, undefined, tankName)} className="card p-4 flex gap-4 cursor-pointer hover:shadow-lg hover:border-brand-primary transition-all">
                            <TankVisualizer current={tankData.current} capacity={tankData.capacity} />
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg text-brand-dark">{`Tank ${tankName}`}</h3>
                                        <p className="text-sm text-text-secondary">{tankData.customer || 'Unassigned'}</p>
                                    </div>
                                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800">Idle</span>
                                </div>
                                <p className="text-sm font-medium text-text-primary truncate mt-1">{tankData.product || 'Empty'}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-3 border-t pt-2">
                                    <div title="Temperature"><i className="fas fa-thermometer-half w-5 text-red-500"></i> {tankData.measurements?.temperature.toFixed(2) || 'N/A'} °F</div>
                                    <div title="Tank Level"><i className="fas fa-ruler-vertical w-5 text-blue-500"></i> {tankData.measurements?.level.toFixed(2) || 'N/A'} FT</div>
                                    <div title="Water Cut"><i className="fas fa-tint w-5 text-cyan-500"></i> {tankData.measurements?.waterCut.toFixed(2) || 'N/A'} in</div>
                                    <div title="Vapor Space Pressure"><i className="fas fa-compress-arrows-alt w-5 text-purple-500"></i> {tankData.measurements?.pressure.toFixed(2) || 'N/A'} inWC</div>
                                </div>
                                <p className="text-xs text-text-tertiary mt-2 text-right">Data Status: Last updated {lastUpdatedText}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
             {sortedTanks.length === 0 && (
                <div className="card text-center py-12 text-text-secondary">
                    <p>No tanks found in the master data for this terminal.</p>
                </div>
            )}
        </div>
    );
};

export default TankStatus;