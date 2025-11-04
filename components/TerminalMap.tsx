import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Hold } from '../types';
import { formatInfraName } from '../utils/helpers';

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

    const categorizedInfra = useMemo(() => {
        const mapping = currentTerminalSettings.infrastructureModalityMapping || {};
        const categories: { vessel: string[], truck: string[], rail: string[] } = { vessel: [], truck: [], rail: [] };
        
        infrastructure.forEach(id => {
            const modality = mapping[id];
            if (modality && categories[modality]) {
                categories[modality].push(id);
            }
        });

        return categories;
    }, [infrastructure, currentTerminalSettings]);

    const getHoldForAsset = (assetId: string): Hold | undefined => {
        // An asset is considered "on hold" if there is an *active* hold for it.
        // An active hold is approved and not yet resolved (i.e., its work order is not 'Closed').
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
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {categorizedInfra.vessel.map(id => (
                            <Asset key={id} assetId={id} hold={getHoldForAsset(id)} onClick={() => onAssetClick(id)} icon="fa-ship" />
                        ))}
                    </div>
                </div>

                {/* Truck Bays */}
                <div className="p-4 border-2 border-dashed rounded-lg">
                    <h4 className="font-semibold text-lg text-text-secondary mb-3">Loading Bays (Truck)</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {categorizedInfra.truck.map(id => (
                            <Asset key={id} assetId={id} hold={getHoldForAsset(id)} onClick={() => onAssetClick(id)} icon="fa-truck" />
                        ))}
                    </div>
                </div>

                {/* Rail Sidings */}
                <div className="p-4 border-2 border-dashed rounded-lg">
                    <h4 className="font-semibold text-lg text-text-secondary mb-3">Sidings (Rail)</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {categorizedInfra.rail.map(id => (
                            <Asset key={id} assetId={id} hold={getHoldForAsset(id)} onClick={() => onAssetClick(id)} icon="fa-train" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TerminalMap;