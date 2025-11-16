
import React, { useContext } from 'react';
import Modal from './Modal';
import { Operation } from '../types';
import { AppContext } from '../context/AppContext';
import { formatDateTime } from '../utils/helpers';
import ElapsedTimeBadge from './ElapsedTimeBadge';

interface NoShowModalProps {
    isOpen: boolean;
    onClose: () => void;
    operations: Operation[];
}

const NoShowModal: React.FC<NoShowModalProps> = ({ isOpen, onClose, operations }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { openAcceptNoShowModal, openRescheduleModal } = context;

    const handleProcessArrival = (opId: string) => {
        openAcceptNoShowModal(opId);
        onClose(); // Close this modal after action
    };

    const handleReschedule = (op: Operation) => {
        openRescheduleModal(op.id, new Date(op.eta));
        onClose();
    };
    
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`No Show Trucks (${operations.length})`}
            footer={<button onClick={onClose} className="btn-secondary">Close</button>}
        >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <p className="text-sm text-text-secondary">
                    These trucks did not arrive within 30 minutes of their scheduled ETA and have been automatically flagged.
                </p>
                {operations.length > 0 ? (
                    <div className="space-y-3">
                        {operations.map(op => (
                            <div key={op.id} className="p-3 bg-red-50 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-red-800">{op.transportId} ({op.licensePlate})</p>
                                        <ElapsedTimeBadge startTime={op.requeueDetails?.time || op.eta} />
                                    </div>
                                    <p className="text-xs text-red-700">
                                        Scheduled ETA: {formatDateTime(op.eta)}
                                    </p>
                                    <p className="text-xs text-red-700">
                                        Product: {op.transferPlan[0]?.transfers[0]?.product}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 items-stretch">
                                    <button onClick={() => handleProcessArrival(op.id)} className="btn-secondary !text-xs !py-1.5 !px-3">
                                        Process Arrival
                                    </button>
                                    <button onClick={() => handleReschedule(op)} className="btn-primary !text-xs !py-1.5 !px-3">
                                        Reschedule
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-text-secondary py-8">No trucks have been flagged as No Show.</p>
                )}
            </div>
        </Modal>
    );
};

export default NoShowModal;
