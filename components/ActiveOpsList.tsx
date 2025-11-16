
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality, ScadaData } from '../types';
import { calculateOperationValue, formatCurrency, formatInfraName, naturalSort, getOperationBorderColorClass, createDocklineToWharfMap, calculateOperationProgress, getActiveTransfers, canDispatchTrucks, canClearBay } from '../utils/helpers';
import CallOffTruckModal from './CallOffTruckModal';

// This helper determines if an active operation is physically at its designated asset.
const isAtAsset = (op: Operation): boolean => {
    if (op.status !== 'active') {
        return false;
    }

    if (op.modality === 'truck') {
        // A truck is considered physically occupying the bay asset if it is directed there, on the bay, or loading.
        // Post-loading activities like weighing and paperwork mean the bay can be cleared for the next op.
        const atAssetStatuses = ['Directed to Bay', 'On Bay', 'Loading'];
        return atAssetStatuses.includes(op.truckStatus || '');
    }
    if (op.modality === 'vessel') {
        // For vessels, being "alongside" means they are at the asset (dock).
        return (op.sof || []).some(s => s.event === 'VESSEL ALONGSIDE' && s.status === 'complete');
    }
    if (op.modality === 'rail') {
        // For rail, being "on siding" means they are at the asset.
        // The SOF is on the transfer level for rail.
        return (op.transferPlan || []).some(tp => 
            (tp.transfers || []).some(t => 
                (t.sof || []).some(s => {
                    const baseEvent = s.event.replace(/^(Rework #\d+: )/, '');
                    return baseEvent === 'On Siding' && s.status === 'complete';
                })
            )
        );
    }
    return false;
};

const ProgressIcon: React.FC<{ modality: Modality; percentage: number }> = ({ modality, percentage }) => {
    const getIconClass = (modality: Modality) => {
        switch (modality) {
            case 'vessel': return 'fa-ship';
            case 'truck': return 'fa-truck';
            case 'rail': return 'fa-train';
            default: return 'fa-question-circle';
        }
    };

    const fillColor = '#3b82f6'; // blue-500, a brighter blue
    const emptyColor = '#e2e8f0'; // slate-200

    const style = {
        backgroundImage: `linear-gradient(to top, ${fillColor} 50%, ${emptyColor} 50%)`,
        backgroundSize: '100% 200%',
        backgroundPosition: `0% ${percentage}%`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        transition: 'background-position 1.5s ease-out',
    };

    return (
        <div className="w-20 h-20 flex items-center justify-center flex-shrink-0" title={`${percentage.toFixed(0)}% Full`}>
            <i className={`fas ${getIconClass(modality)} text-6xl`} style={style}></i>
        </div>
    );
};


// A small card to show details of an active operation on an asset.
const OperationCard: React.FC<{ operation: Operation, scadaData: ScadaData, infraId: string }> = ({ operation, scadaData, infraId }) => {
    const { switchView, settings, currentUser, revertCallOff } = useContext(AppContext)!;
    const isCommercials = currentUser.role === 'Commercials';
    const canRevert = canDispatchTrucks(currentUser);
    const borderColorClass = getOperationBorderColorClass(operation);

    const isVessel = operation.modality === 'vessel';

    // Get display transfer for card details (still infra-specific for context)
    const displayTransfer = useMemo(() => 
        operation.transferPlan.find(line => line.infrastructureId === infraId)?.transfers[0],
        [operation, infraId]
    );
    
    // This value is for the whole op, which is ok for a high-level financial summary
    const { totalValue } = isCommercials ? calculateOperationValue(operation, settings) : { totalValue: 0 };
    
    // Calculate progress: aggregated for vessels, infra-specific for others.
    const { percentage: percentageDone, completed, total } = useMemo(() => {
        return calculateOperationProgress(operation, isVessel ? undefined : infraId);
    }, [operation, infraId, isVessel]);

    // Determine direction: aggregated for vessels, infra-specific for others.
    const direction = useMemo(() => {
        if (isVessel) {
            // For vessels, check all transfers. If any are inbound to the terminal, the vessel is unloading.
            const hasInboundTransfer = operation.transferPlan.some(line => 
                line.transfers.some(t => t.direction.includes(' to Tank'))
            );
            return hasInboundTransfer ? 'in' : 'out';
        } else {
            // For trucks/rail, use the specific transfer on this infra.
            return displayTransfer?.direction.includes(' to Tank') ? 'in' : 'out';
        }
    }, [operation, isVessel, displayTransfer]);

    // The visual fill percentage: if unloading ('in'), show 100 - %done. If loading ('out'), show %done.
    const visualPercentage = direction === 'in' ? 100 - percentageDone : percentageDone;
    
    const infraScada = scadaData[infraId];
    const isPumpingOnInfra = infraScada?.pumpStatus === 'ON';

    return (
        <div 
            onClick={() => switchView('operation-details', operation.id)}
            className={`card p-4 sm:p-5 h-full flex items-center cursor-pointer hover:shadow-lg border-l-4 ${borderColorClass}`}
        >
            <ProgressIcon modality={operation.modality} percentage={visualPercentage} />
            <div className="flex-grow min-w-0 ml-4 sm:ml-5">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-grow min-w-0">
                        {operation.modality === 'truck' ? (
                            <>
                                <h4 className="font-mono font-black text-3xl tracking-wider text-brand-dark truncate leading-none" title={operation.licensePlate}>{operation.licensePlate}</h4>
                                <p className="font-bold text-base text-text-secondary truncate">{operation.transportId}</p>
                            </>
                        ) : (
                            <h4 className="font-bold text-xl text-brand-dark truncate">{operation.transportId}</h4>
                        )}
                    </div>
                    {isCommercials && (
                        <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex-shrink-0">
                            {formatCurrency(totalValue)}
                        </span>
                    )}
                </div>
                {isPumpingOnInfra && (
                    <div className="text-sm font-bold text-green-600 flex items-center animate-pulse flex-shrink-0 mt-1" title="Live Flow Rate">
                        <i className="fas fa-exchange-alt mr-1"></i>
                        <span>{infraScada.flowRate.toFixed(0)} T/hr</span>
                    </div>
                )}
                <div className="mt-2 grid grid-cols-[auto,1fr] gap-x-2 gap-y-1.5 text-sm">
                    {operation.modality === 'truck' && operation.driverName && (
                        <>
                            <div className="text-text-secondary font-semibold">Driver:</div>
                            <div className="text-text-primary truncate">{operation.driverName}</div>
                        </>
                    )}
                    <div className="text-text-secondary font-semibold">Customer:</div>
                    <div className="text-text-primary truncate">{displayTransfer?.customer}</div>

                    <div className="text-text-secondary font-semibold">Product:</div>
                    <div className="text-text-primary truncate">{displayTransfer?.product}</div>

                    <div className="text-text-secondary font-semibold">Lineup:</div>
                    <div className="text-text-primary truncate">{displayTransfer?.from} &rarr; {displayTransfer?.to}</div>

                    <div className="text-text-secondary font-semibold">Volume:</div>
                    <div className="text-text-primary truncate">{`${completed.toFixed(0)} / ${total.toLocaleString()} T`}</div>
                </div>
                 {operation.modality === 'truck' && operation.truckStatus === 'Directed to Bay' && (
                    <div className="mt-2 text-right">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                revertCallOff(operation.id);
                            }}
                            className="btn-secondary !text-sm !py-1 !px-3 !bg-yellow-100 !border-yellow-300 !text-yellow-800 hover:!bg-yellow-200 disabled:!bg-slate-100 disabled:!text-slate-400 disabled:!border-slate-300 disabled:cursor-not-allowed"
                            disabled={!canRevert}
                            title={!canRevert ? "Permission Denied" : "Revert Call"}
                        >
                            <i className="fas fa-undo mr-1"></i>Revert Call
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// A placeholder card for when an asset is available.
const AvailableCard: React.FC<{ onClick: () => void; disabled: boolean }> = ({ onClick, disabled }) => (
    <div 
        className={`border-2 border-dashed  rounded-lg h-full flex items-center justify-center min-h-[120px] transition-colors ${
            disabled 
                ? 'border-slate-200 bg-slate-50 cursor-not-allowed' 
                : 'border-slate-300 cursor-pointer hover:bg-slate-100'
        }`}
        onClick={!disabled ? onClick : undefined}
        title={disabled ? 'Permission Denied' : 'Click to assign a waiting truck'}
    >
        <p className={`font-semibold ${disabled ? 'text-slate-300' : 'text-slate-400'}`}>Available</p>
    </div>
);

const CompletedCard: React.FC<{ op: Operation; onClear: () => void; canClear: boolean }> = ({ op, onClear, canClear }) => {
    return (
        <div className="card p-4 sm:p-5 h-full flex flex-col justify-between border-l-4 border-slate-500 bg-slate-50">
            <div>
                <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-500">Bay Clear Required</h4>
                    <span className="text-xs font-semibold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">COMPLETED</span>
                </div>
                <div className="mt-2 text-sm text-text-secondary">
                    <p>Last truck:</p>
                    <p className="font-bold text-lg text-text-primary">{op.licensePlate}</p>
                    <p className="text-xs">Completed at: {op.completedTime ? new Date(op.completedTime).toLocaleTimeString() : 'N/A'}</p>
                </div>
            </div>
            <button
                onClick={onClear}
                disabled={!canClear}
                className="btn-secondary w-full mt-4 !bg-white hover:!bg-slate-100 disabled:opacity-50"
                title={canClear ? "Mark bay as clear and available" : "Permission Denied"}
            >
                <i className="fas fa-check-circle mr-2"></i>
                Clear Bay for Next Truck
            </button>
        </div>
    );
};

const ActiveOpsList: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <p>Loading...</p>;

    const { operations, selectedTerminal, workspaceFilter, workspaceSearchTerm, currentTerminalSettings, visibleInfrastructure, currentUser, scadaData, revertCallOff, lastCompletedOpByInfra, clearBayForNextOp, getOperationById } = context;
    
    const [isCallOffModalOpen, setIsCallOffModalOpen] = useState(false);
    const [selectedBay, setSelectedBay] = useState<string | null>(null);

    const canDispatch = canDispatchTrucks(currentUser);
    const canClear = canClearBay(currentUser);

    const handleAvailableClick = (infraId: string) => {
        setSelectedBay(infraId);
        setIsCallOffModalOpen(true);
    };

    const { vesselAssets, truckAssets, railAssets } = useMemo(() => {
        const infraMap = currentTerminalSettings.infrastructureModalityMapping || {};

        const opsAtAssets = operations.filter(op => 
            op.terminal === selectedTerminal &&
            isAtAsset(op)
        );

        const assetToOpMap = new Map<string, Operation>();
        opsAtAssets.forEach(op => {
            (op.transferPlan || []).forEach(tp => {
                if (tp.infrastructureId) {
                    assetToOpMap.set(tp.infrastructureId, op);
                }
            });
        });

        const visibleVesselInfra = visibleInfrastructure.filter(id => infraMap[id] === 'vessel');
        const visibleTruckInfra = visibleInfrastructure.filter(id => infraMap[id] === 'truck');
        const visibleRailInfra = visibleInfrastructure.filter(id => infraMap[id] === 'rail');
        
        const wharfMapping = createDocklineToWharfMap(currentTerminalSettings);
        const vesselAssetsByWharf: { [wharfName: string]: { infraId: string, operation: Operation | null }[] } = {};

        if (workspaceFilter === 'all' || workspaceFilter === 'vessel') {
            visibleVesselInfra.forEach(docklineId => {
                const wharfName = wharfMapping[docklineId] || 'Other Docks';
                if (!vesselAssetsByWharf[wharfName]) {
                    vesselAssetsByWharf[wharfName] = [];
                }
                vesselAssetsByWharf[wharfName].push({
                    infraId: docklineId,
                    operation: assetToOpMap.get(docklineId) || null
                });
            });
        }

        const truckAssets: { infraId: string, operation: Operation | null }[] = [];
        if (workspaceFilter === 'all' || workspaceFilter === 'truck') {
            visibleTruckInfra.forEach(infraId => {
                truckAssets.push({ infraId, operation: assetToOpMap.get(infraId) || null });
            });
        }
        
        const railAssets: { infraId: string, operation: Operation | null }[] = [];
        if (workspaceFilter === 'all' || workspaceFilter === 'rail') {
            visibleRailInfra.forEach(infraId => {
                railAssets.push({ infraId, operation: assetToOpMap.get(infraId) || null });
            });
        }

        const searchAndFilter = (assets: { infraId: string, operation: Operation | null }[]) => {
            if (!workspaceSearchTerm) return assets;
            const term = workspaceSearchTerm.toLowerCase();
            if (term === 'available') return assets.filter(a => !a.operation);
            
            return assets.filter(({ operation }) => {
                if (operation) {
                    const firstTransfer = operation.transferPlan[0]?.transfers[0];
                    return (
                        operation.transportId.toLowerCase().includes(term) ||
                        (firstTransfer?.customer || '').toLowerCase().includes(term) ||
                        (firstTransfer?.product || '').toLowerCase().includes(term)
                    );
                }
                return false;
            });
        };
        
        const searchedVesselAssets = Object.entries(vesselAssetsByWharf).reduce((acc, [wharfName, assets]) => {
            const filteredAssets = searchAndFilter(assets);
            if (filteredAssets.length > 0) {
                (acc as any)[wharfName] = filteredAssets;
            }
            return acc;
        }, {} as typeof vesselAssetsByWharf);

        return {
            vesselAssets: searchedVesselAssets,
            truckAssets: searchAndFilter(truckAssets),
            railAssets: searchAndFilter(railAssets),
        };

    }, [operations, selectedTerminal, workspaceFilter, workspaceSearchTerm, currentTerminalSettings, visibleInfrastructure]);


    return (
        <>
            <CallOffTruckModal 
                isOpen={isCallOffModalOpen}
                onClose={() => setIsCallOffModalOpen(false)}
                bayInfraId={selectedBay}
            />
            <div>
                <div className="sticky top-0 z-10 bg-background-body p-4 sm:p-6 border-b border-border-primary">
                    {/* The search and filter components are in the Header */}
                </div>
                <div className="p-3 sm:p-6">
                    <div className="space-y-8">
                        {Object.keys(vesselAssets).length > 0 && (
                            <div>
                                <h3 className="text-2xl font-bold text-brand-dark mb-4">Wharfs</h3>
                                <div className="space-y-6">
                                    {/* FIX: Refactored to use Object.keys().map() for improved type safety with dictionary objects, preventing the '.map does not exist on type unknown' error. */}
                                    {Object.keys(vesselAssets).sort().map(wharfName => {
                                        const assets = vesselAssets[wharfName];
                                        return (
                                            <div key={wharfName}>
                                                <h4 className="font-semibold text-text-secondary mb-2 pl-1">{wharfName}</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                                    {assets.map(({ infraId, operation }) => (
                                                        <div key={infraId}>
                                                            <div className="flex justify-between items-baseline mb-1">
                                                                <h5 className="font-semibold text-xs text-text-secondary">{formatInfraName(infraId)}</h5>
                                                            </div>
                                                            {operation ? <OperationCard operation={operation} scadaData={scadaData} infraId={infraId} /> : <AvailableCard onClick={() => {}} disabled={true} />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {truckAssets.length > 0 && (
                             <div>
                                <h3 className="text-2xl font-bold text-brand-dark mb-4">Truck Bays</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                    {truckAssets.map(({ infraId, operation }) => {
                                        const lastCompletedOpId = lastCompletedOpByInfra[infraId];
                                        const lastCompletedOp = lastCompletedOpId ? getOperationById(lastCompletedOpId) : null;
                                        return (
                                             <div key={infraId}>
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <h4 className="font-semibold text-text-secondary">{formatInfraName(infraId)}</h4>
                                                </div>
                                                {operation ? (
                                                    <OperationCard operation={operation} scadaData={scadaData} infraId={infraId} />
                                                ) : lastCompletedOp ? (
                                                    <CompletedCard op={lastCompletedOp} onClear={() => clearBayForNextOp(infraId)} canClear={canClear} />
                                                ) : (
                                                    <AvailableCard onClick={() => handleAvailableClick(infraId)} disabled={!canDispatch} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {railAssets.length > 0 && (
                             <div>
                                <h3 className="text-2xl font-bold text-brand-dark mb-4">Rail Sidings</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                    {railAssets.map(({ infraId, operation }) => (
                                         <div key={infraId}>
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h4 className="font-semibold text-text-secondary">{formatInfraName(infraId)}</h4>
                                            </div>
                                            {operation ? <OperationCard operation={operation} scadaData={scadaData} infraId={infraId} /> : <AvailableCard onClick={() => {}} disabled={true} />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {Object.keys(vesselAssets).length === 0 && truckAssets.length === 0 && railAssets.length === 0 && (
                            <div className="card text-center py-12 text-text-secondary">
                                <p>No active operations or available assets match the current filter.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ActiveOpsList;
