import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Hold } from '../types';
import { formatInfraName, naturalSort } from '../utils/helpers';

interface TerminalMapProps {
    infrastructure: string[];
    holds: Hold[];
    onAssetClick: (infraId: string) => void;
}

const Asset: React.FC<{ assetId: string; hold: Hold | undefined; onClick: () => void; icon: string; }> = ({ assetId, hold, onClick, icon }) => {
    const isHeld = !!hold;
    const title = hold
        ? `On Hold: ${hold.reason} ${hold.tank ? `(Lineup: ${hold.tank})` : ''}`
        : 'Status: Available';

    const baseClasses = "relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center min-h-[60px] text-center";
    const statusClasses = isHeld 
        ? "bg-red-100 border-red-400 text-red-800 hover:bg-red-200 hover:shadow-md" 
        : "bg-green-100 border-green-400 text-green-800 hover:bg-green-200 hover:shadow-md";

    return (
        <div
            title={title}
            onClick={onClick}
            className={`${baseClasses} ${statusClasses}`}
        >
            {isHeld && (
                 <i className="fas fa-wrench absolute top-1 right-1 text-red-600 text-xs" title="Maintenance/Outage"></i>
            )}
            <div className="flex flex-col items-center">
                <i className={`fas ${icon} text-lg mb-1`}></i>
                <span className="font-bold text-xs">{formatInfraName(assetId)}</span>
            </div>
        </div>
    );
};

const TerminalMap: React.FC<TerminalMapProps> = ({ infrastructure, holds, onAssetClick }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { currentTerminalSettings } = context;

    const { categorizedVesselInfra, categorizedTruckInfra, categorizedRailInfra } = useMemo(() => {
        const mapping = currentTerminalSettings.infrastructureModalityMapping || {};
        const wharfMapping = currentTerminalSettings.wharfDocklineMapping || {};
        
        // FIX: Add array check to prevent crash if infrastructure prop is not an array.
        const safeInfrastructure = infrastructure || [];
        const truckInfra = safeInfrastructure.filter(id => mapping[id] === 'truck').sort(naturalSort);
        const railInfra = safeInfrastructure.filter(id => mapping[id] === 'rail').sort(naturalSort);
        
        const vesselDocklines = safeInfrastructure.filter(id => mapping[id] === 'vessel');
        let vesselInfra: { wharf: string; docklines: string[] }[] = [];

        if (Object.keys(wharfMapping).length > 0) {
            vesselInfra = Object.entries(wharfMapping).map(([wharf, docklines]) => ({
                wharf,
                // FIX: Add Array.isArray check to prevent crash if docklines is not an array, which can happen with malformed data.
                docklines: (Array.isArray(docklines) ? docklines : []).sort(naturalSort)
            }));
            const mappedDocklines = new Set(Object.values(wharfMapping).flat());
            const unmapped = vesselDocklines.filter(id => !mappedDocklines.has(id));
            if (unmapped.length > 0) {
                vesselInfra.push({ wharf: 'Other Docks', docklines: unmapped.sort(naturalSort) });
            }
        } else {
            // Fallback for terminals without the new mapping
            if (vesselDocklines.length > 0) {
                vesselInfra.push({ wharf: 'Docks', docklines: vesselDocklines.sort(naturalSort) });
            }
        }

        return {
            categorizedVesselInfra: vesselInfra,
            categorizedTruckInfra: truckInfra,
            categorizedRailInfra: railInfra
        };
    }, [infrastructure, currentTerminalSettings]);

    const getHoldForAsset = (assetId: string): Hold | undefined => {
        return holds.find(h => 
            h.resource === assetId && 
            h.status === 'approved' &&
            h.workOrderStatus !== 'Closed'
        );
    };

    return (
        <div className="card p-4 sm:p-6 bg-slate-50">
            <div className="space-y-6">
                {/* Docks */}
                <div className="p-4 border-2 border-dashed rounded-lg">
                    <h4 className="font-semibold text-lg text-text-secondary mb-3">Docks (Vessel)</h4>
                    <div className="space-y-4">
                        {categorizedVesselInfra.map(({ wharf, docklines }) => (
                            <div key={wharf}>
                                <h5 className="font-bold text-sm text-slate-600 mb-2 pl-1">{wharf}</h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {docklines.map(id => (
                                        <Asset key={id} assetId={id} hold={getHoldForAsset(id)} onClick={() => onAssetClick(id)} icon="fa-ship" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Truck Bays */}
                <div className="p-4 border-2 border-dashed rounded-lg">
                    <h4 className="font-semibold text-lg text-text-secondary mb-3">Loading Bays (Truck)</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {categorizedTruckInfra.map(id => (
                            <Asset key={id} assetId={id} hold={getHoldForAsset(id)} onClick={() => onAssetClick(id)} icon="fa-truck" />
                        ))}
                    </div>
                </div>

                {/* Rail Sidings */}
                <div className="p-4 border-2 border-dashed rounded-lg">
                    <h4 className="font-semibold text-lg text-text-secondary mb-3">Sidings (Rail)</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {categorizedRailInfra.map(id => (
                            <Asset key={id} assetId={id} hold={getHoldForAsset(id)} onClick={() => onAssetClick(id)} icon="fa-train" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TerminalMap;