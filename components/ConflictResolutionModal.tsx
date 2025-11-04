import React, { useContext } from 'react';
import Modal from './Modal';
import { AppContext } from '../context/AppContext';
import { Operation } from '../types';
import { formatInfraName } from '../utils/helpers';

const ConflictResolutionModal: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { conflictData, closeConflictModal, resolveAndRescheduleConflicts } = context;

    if (!conflictData.isOpen || !conflictData.conflictingOps || conflictData.conflictingOps.length === 0) {
        return null;
    }

    const { conflictingOps, hold } = conflictData;

    return (
        <Modal
            isOpen={true}
            onClose={closeConflictModal}
            title="Scheduling Conflict Detected"
            footer={
                <>
                    <button onClick={closeConflictModal} className="btn-secondary">Cancel</button>
                    <button onClick={resolveAndRescheduleConflicts} className="btn-primary">Reschedule Conflicting Orders</button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-text-secondary">
                    The requested hold for <strong className="text-text-primary">{hold?.reason}</strong> on <strong className="text-text-primary">{hold?.resource ? formatInfraName(hold.resource) : ''}</strong> overlaps with the following scheduled truck orders.
                </p>
                <div className="max-h-60 overflow-y-auto border p-2 rounded-md space-y-2 bg-slate-50">
                    {conflictingOps.map((op: Operation) => (
                        <div key={op.id} className="p-2 bg-white border rounded-md">
                            <p className="font-bold text-sm">{op.transportId} ({op.licensePlate})</p>
                            <p className="text-xs text-text-secondary">Scheduled for: {new Date(op.eta).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
                <p className="text-text-secondary">
                    Do you want to move these orders to the "To Reschedule" list?
                </p>
            </div>
        </Modal>
    );
};

export default ConflictResolutionModal;
