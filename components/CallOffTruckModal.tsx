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
    const { op, isSelectable, isWaiting, isHighPriority, requiredTank, isCompatible, isRescheduleOrNoShow } = truckData;
    
    const cardStyles = {
        planned: 'border-blue-500 bg-blue-50',
        'high-priority': 'border-red-500 bg-red-50',
        other: 'border-green-500 bg-green-50',
        incompatible: 'border-slate-400 bg-slate-100 opacity-70',
    };

    const statusSince = useMemo(() => {
        if (isWaiting) {
            const transfer = op.transferPlan?.[0]?.transfers?.[0];
            const readySof = (transfer?.sof || [])
                .filter((s: any) => s.event.includes('Ready / Approved') && s.status === 'complete')
                .sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
            return readySof?.time || op.eta;
        }
        if (isRescheduleOrNoShow) {
            return op.requeueDetails?.time || op.eta;
        }
        return null;
    }, [op, isWaiting, isRescheduleOrNoShow]);


    const renderButton = () => {
        if (isSelectable) {
            return <button onClick={() => onSelect(op.id)} className="btn-primary">Direct to Bay</button>;
        }
        const reason = !isCompatible ? `Incompatible (needs ${requiredTank})` : 'Cannot Select';
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
                    {statusSince && <ElapsedTimeBadge startTime={statusSince} />}
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
    
    // Safe defaults
    const operations = context?.operations || [];
    const currentTerminalSettings = context?.currentTerminalSettings || { infrastructureTankMapping: {} };
    const directTruckToBay = context?.directTruckToBay || (() => {});

    const { plannedForBay, availableToCall, incompatibleOthers } = useMemo(() => {
        if (!bayInfraId) return { plannedForBay: [], availableToCall: [], incompatibleOthers: [] };

        const relevantTrucks = operations.filter(op => 
            op.modality === 'truck' && 
            (op.status === 'planned' || op.truckStatus === 'Waiting')
        );

        const bayConnectedTanks = new Set(currentTerminalSettings.infrastructureTankMapping?.[bayInfraId] || []);

        const trucksWithValidation = relevantTrucks.map(op => {
            const transfer = op.transferPlan?.[0]?.transfers?.[0];
            const requiredTank = transfer?.from;

            const isPlannedForThisBay = op.transferPlan?.[0]?.infrastructureId === bayInfraId;
            const isRescheduleOrNoShow = ['Reschedule Required', 'No Show'].includes(op.currentStatus);
            const isHighPriority = op.requeueDetails?.priority === 'high' && isRescheduleOrNoShow;
            const isWaiting = op.truckStatus === 'Waiting';
            
            const isCompatible = requiredTank ? bayConnectedTanks.has(requiredTank) : false;
            
            const isSelectable = isCompatible && (isWaiting || isRescheduleOrNoShow);

            return { op, isCompatible, isHighPriority, isPlannedForThisBay, isWaiting, isSelectable, requiredTank, isRescheduleOrNoShow };
        });

        const planned = trucksWithValidation.filter(t => t.isPlannedForThisBay);
        const available = trucksWithValidation.filter(t => !t.isPlannedForThisBay && t.isCompatible && (t.isWaiting || t.isRescheduleOrNoShow));
        const incompatible = trucksWithValidation.filter(t => !t.isPlannedForThisBay && !t.isCompatible && (t.isWaiting || t.isRescheduleOrNoShow));

        const sortFn = (a: any, b: any) => {
            if (a.isHighPriority && !b.isHighPriority) return -1;
            if (!a.isHighPriority && b.isHighPriority) return 1;
            return new Date(a.op.eta).getTime() - new Date(b.op.eta).getTime();
        };

        planned.sort(sortFn);
        available.sort(sortFn);
        incompatible.sort(sortFn);

        return { 
            plannedForBay: planned,
            availableToCall: available,
            incompatibleOthers: incompatible
        };
    }, [operations, bayInfraId, currentTerminalSettings]);

    if (!context) return null;

    const handleSelect = (opId: string) => {
        if (bayInfraId) {
            directTruckToBay(opId, bayInfraId);
        }
        onClose();
    };
    
    const noTrucksAvailable = [plannedForBay, availableToCall, incompatibleOthers].every(arr => arr.length === 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Select Truck for ${formatInfraName(bayInfraId || '')}`}
            footer={<button onClick={onClose} className="btn-secondary">Cancel</button>}
        >
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {noTrucksAvailable && (
                    <p className="text-center text-text-secondary">No trucks are currently planned, waiting, or marked for reschedule.</p>
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

                {availableToCall.length > 0 && (
                     <div>
                        <h4 className="font-semibold text-text-primary text-base mb-2">Available for Immediate Call-in</h4>
                        <div className="space-y-2">
                            {availableToCall.map(truckData => (
                                <TruckCard key={truckData.op.id} truckData={truckData} onSelect={handleSelect} cardType={truckData.isHighPriority ? 'high-priority' : 'other'} />
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