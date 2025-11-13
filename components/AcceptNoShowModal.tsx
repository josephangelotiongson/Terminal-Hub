

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Operation } from '../types';

interface AcceptNoShowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    operation: Operation;
}

const LATE_REASONS = [
    "Driver Delayed (Traffic)",
    "Mechanical Issue (Truck)",
    "Documentation Issue (Resolved)",
    "Terminal Hold/Delay",
    "Dispatcher Error",
    "Other"
];

const AcceptNoShowModal: React.FC<AcceptNoShowModalProps> = ({ isOpen, onClose, onConfirm, operation }) => {
    const [selectedReason, setSelectedReason] = useState(LATE_REASONS[0]);
    const [customReason, setCustomReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedReason(LATE_REASONS[0]);
            setCustomReason('');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
        if (!finalReason) {
            alert("Please provide a reason for accepting this late truck.");
            return;
        }
        onConfirm(finalReason);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Accept Late Truck: ${operation.transportId}`}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleConfirm} className="btn-primary">Confirm Acceptance</button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-text-secondary">
                    You are accepting the arrival of a truck marked as '{operation.currentStatus}'. Please provide a reason for the log.
                </p>
                <div>
                    <label htmlFor="accept-reason-select">Reason</label>
                    <select
                        id="accept-reason-select"
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="mt-1"
                        autoFocus
                    >
                        {LATE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                {selectedReason === 'Other' && (
                    <div>
                        <label htmlFor="accept-reason-custom">Please Specify</label>
                        <textarea
                            id="accept-reason-custom"
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            rows={2}
                            placeholder="Enter custom reason..."
                            className="mt-1"
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default AcceptNoShowModal;