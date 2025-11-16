
import React, { useContext } from 'react';
import Modal from './Modal';
import { Operation } from '../types';
import { AppContext } from '../context/AppContext';
import { formatDateTime } from '../utils/helpers';
import ElapsedTimeBadge from './ElapsedTimeBadge';

interface ToRescheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    operations: Operation[];
    getReason: (op: Operation) => { reason: string; isHigh: boolean; };
}

const ToRescheduleModal: React.FC<ToRescheduleModalProps> = ({ isOpen, onClose, operations, getReason }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { openRescheduleModal } = context;

    const handleReschedule = (op: Operation) => {
        openRescheduleModal(op.id, new Date(op.eta));
        onClose();
    };
    
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Trucks to Reschedule (${operations.length})`}
            footer={<button onClick={onClose} className="btn-secondary">Close</button>}
        >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <p className="text-sm text-text-secondary">
                    These trucks require rescheduling due to planning conflicts, operator requests, or other issues.
                </p>
                {operations.length > 0 ? (
                    <div className="space-y-3">
                        {operations.map(op => {
                            const { reason, isHigh } = getReason(op);
                            const wasAtTerminal = op.modality === 'truck' && 
                                op.transferPlan?.[0]?.transfers?.[0]?.sof?.some(s => s.event === 'Arrived' && s.status === 'complete');
                            
                            return (
                                <div key={op.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-yellow-800">{op.transportId} ({op.licensePlate})</p>
                                            {isHigh && (<span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 animate-pulse">HIGH PRIORITY</span>)}
                                            {wasAtTerminal && op.requeueDetails?.time && (
                                                <ElapsedTimeBadge startTime={op.requeueDetails.time} />
                                            )}
                                        </div>
                                        <p className="text-xs text-yellow-700">
                                            Reason: {reason}
                                        </p>
                                        <p className="text-xs text-yellow-700">
                                            Product: {op.transferPlan[0]?.transfers[0]?.product}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <button onClick={() => handleReschedule(op)} className="btn-primary !text-xs !py-1.5 !px-3 w-full sm:w-auto">
                                            Reschedule
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center text-text-secondary py-8">No trucks require rescheduling.</p>
                )}
            </div>
        </Modal>
    );
};

export default ToRescheduleModal;
