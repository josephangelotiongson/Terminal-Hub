import React, { useContext, useMemo } from 'react';
import Modal from './Modal';
import { AppContext } from '../context/AppContext';
import { Operation } from '../types';
import { formatDateTime, formatInfraName } from '../utils/helpers';
import ElapsedTimeBadge from './ElapsedTimeBadge';

interface CallOffTruckModalProps {
    isOpen: boolean;
    onClose: () => void;
    bayInfraId: string | null;
}

// A reusable card for displaying truck information within the modal.
const TruckCard: React.FC<{
    truckData: any;
    onSelect: (opId: string) => void;
    cardType: 'planned' | 'high-priority' | 'other' | 'incompatible';
}> = ({ truckData, onSelect, cardType }) => {
    const { op, isSelectable, isWaiting, isHighPriority, requiredTank, isCompatible } = truckData;
    
    const cardStyles = {
        planned: 'border-blue-500 bg-blue-50',
        'high-priority': 'border-red-500 bg-red-50',
        other: 'border-green-500 bg-green-50',
        incompatible: 'border-slate-400 bg-slate-100 opacity-70',
    };

    const waitingSince = useMemo(() => {
        if (isWaiting) {
            const transfer = op.transferPlan?.[0]?.transfers?.[0];
            // Find the latest 'Ready / Approved' SOF event
            const readySof = (transfer?.sof || [])
                .filter((s: any) => s.event.includes('Ready / Approved') && s.status === 'complete')
                .sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
            return readySof?.time || op.eta; // Fallback to ETA if SOF not found
        }
        if (isHighPriority) {
            return op.requeueDetails?.time || op.eta; // Fallback to ETA
        }
        return null; // Not in a waiting state
    }, [op, isWaiting, isHighPriority]);


    const renderButton = () => {
        if (isSelectable) {
            return <button onClick={() => onSelect(op.id)} className="btn-primary">Direct to Bay</button>;
        }
        const reason = !isCompatible ? `Incompatible (needs ${requiredTank})` : !isWaiting ? 'Not at Terminal' : 'Cannot Select';
        return <button className="btn-secondary" disabled title={reason}>{reason}</button>;
    };

    return (
        <div 
            key={op.id} 
            className={`p-3 border-l-4 ${cardStyles[cardType]} rounded-r-lg flex justify-between items-center`}
            title={!isCompatible ? `Incompatible: This truck requires tank ${requiredTank}, which is not connected to this bay.` : ''}
        >
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold">{op.transportId} ({op.licensePlate})</p>
                    {isHighPriority && (
                        <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                            HIGH PRIORITY
                        </span>
                    )}
                    {(isWaiting || isHighPriority) && waitingSince && <ElapsedTimeBadge startTime={waitingSince} />}
                </div>
                <p className="text-sm text-text-secondary">{op.transferPlan[0].transfers[0].product}</p>
                <p className="text-xs text-text-tertiary">ETA: {formatDateTime(op.eta)}</p>
            </div>
            {renderButton()}
        </div>
    );
};


const CallOffTruckModal: React.FC<CallOffTruckModalProps> = ({ isOpen, onClose, bayInfraId }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { operations, currentTerminalSettings, directTruckToBay } = context;

    const { plannedForBay, highPriority, otherWaiting, incompatibleOthers } = useMemo(() => {
        if (!bayInfraId) return { plannedForBay: [], highPriority: [], otherWaiting: [], incompatibleOthers: [] };

        const relevantTrucks = operations.filter(op => 
            op.modality === 'truck' && 
            (op.status === 'planned' || op.truckStatus === 'Waiting')
        );

        const bayConnectedTanks = new Set(currentTerminalSettings.infrastructureTankMapping?.[bayInfraId] || []);

        const trucksWithValidation = relevantTrucks.map(op => {
            const transfer = op.transferPlan?.[0]?.transfers?.[0];
            const requiredTank = transfer?.from;

            const isPlannedForThisBay = op.transferPlan?.[0]?.infrastructureId === bayInfraId;
            const isHighPriority = op.requeueDetails?.priority === 'high' && op.currentStatus === 'Reschedule Required';
            const isWaiting = op.truckStatus === 'Waiting';
            
            const isCompatible = requiredTank ? bayConnectedTanks.has(requiredTank) : false;
            
            const isSelectable = isCompatible && (isWaiting || isHighPriority);

            return { op, isCompatible, isHighPriority, isPlannedForThisBay, isWaiting, isSelectable, requiredTank };
        });

        const planned = trucksWithValidation.filter(t => t.isPlannedForThisBay);
        const highPrio = trucksWithValidation.filter(t => !t.isPlannedForThisBay && t.isHighPriority && t.isCompatible);
        const waiting = trucksWithValidation.filter(t => !t.isPlannedForThisBay && !t.isHighPriority && t.isWaiting && t.isCompatible);
        const incompatible = trucksWithValidation.filter(t => !t.isPlannedForThisBay && !t.isCompatible && (t.isWaiting || t.isHighPriority));

        const sortFn = (a: any, b: any) => {
            if (a.isHighPriority && !b.isHighPriority) return -1;
            if (!a.isHighPriority && b.isHighPriority) return 1;
            return new Date(a.op.eta).getTime() - new Date(b.op.eta).getTime();
        };

        planned.sort(sortFn);
        highPrio.sort(sortFn);
        waiting.sort(sortFn);

        return { 
            plannedForBay: planned,
            highPriority: highPrio,
            otherWaiting: waiting,
            incompatibleOthers: incompatible
        };
    }, [operations, bayInfraId, currentTerminalSettings]);


    const handleSelect = (opId: string) => {
        if (bayInfraId) {
            directTruckToBay(opId, bayInfraId);
        }
        onClose();
    };
    
    const noTrucksAvailable = [plannedForBay, highPriority, otherWaiting, incompatibleOthers].every(arr => arr.length === 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Select Truck for ${formatInfraName(bayInfraId || '')}`}
            footer={<button onClick={onClose} className="btn-secondary">Cancel</button>}
        >
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {noTrucksAvailable && (
                    <p className="text-center text-text-secondary">No trucks are currently planned, waiting, or marked for high-priority reschedule.</p>
                )}

                {plannedForBay.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-text-primary text-base mb-2">Originally Planned for this Bay</h4>
                        <div className="space-y-2">
                            {plannedForBay.map(truckData => (
                                <TruckCard key={truckData.op.id} truckData={truckData} onSelect={handleSelect} cardType="planned" />
                            ))}
                        </div>
                    </div>
                )}

                {highPriority.length > 0 && (
                     <div>
                        <h4 className="font-semibold text-red-600 text-base mb-2">High Priority to be Rescheduled</h4>
                        <div className="space-y-2">
                            {highPriority.map(truckData => (
                                <TruckCard key={truckData.op.id} truckData={truckData} onSelect={handleSelect} cardType="high-priority" />
                            ))}
                        </div>
                    </div>
                )}

                {otherWaiting.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-text-secondary text-base mb-2">Other Waiting Trucks</h4>
                        <div className="space-y-2">
                            {otherWaiting.map(truckData => (
                                <TruckCard key={truckData.op.id} truckData={truckData} onSelect={handleSelect} cardType="other" />
                            ))}
                        </div>
                    </div>
                )}

                {incompatibleOthers.length > 0 && (
                    <div className="pt-4 border-t mt-4">
                        <h4 className="font-semibold text-text-secondary text-sm mb-2">Incompatible Waiting Trucks</h4>
                         <div className="space-y-2">
                            {incompatibleOthers.map(truckData => (
                                <TruckCard key={truckData.op.id} truckData={truckData} onSelect={handleSelect} cardType="incompatible" />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CallOffTruckModal;