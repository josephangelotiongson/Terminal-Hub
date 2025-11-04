import React, { useState } from 'react';
import Modal from './Modal';
import { Operation } from '../types';

interface CancelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    operation: Operation;
}

const CANCELLATION_REASONS = [
    "Customer Request",
    "Asset Unavailable",
    "Planning Error",
    "Force Majeure",
    "Other"
];

const CancelModal: React.FC<CancelModalProps> = ({ isOpen, onClose, onConfirm, operation }) => {
    const [reason, setReason] = useState(CANCELLATION_REASONS[0]);
    const [customReason, setCustomReason] = useState('');

    const handleConfirm = () => {
        const finalReason = reason === "Other" ? customReason.trim() : reason;
        if (!finalReason) {
            alert("Please provide a reason for cancellation.");
            return;
        }
        onConfirm(finalReason);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Cancel Operation: ${operation.transportId}`}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Keep Plan</button>
                    <button onClick={handleConfirm} className="btn-danger">Confirm Cancellation</button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-text-secondary">Are you sure you want to cancel this operation? This action cannot be undone.</p>
                <div>
                    <label>Reason for Cancellation</label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1"
                    >
                        {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                {reason === "Other" && (
                    <div>
                        <label>Please Specify Other Reason</label>
                        <input
                            type="text"
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            className="mt-1"
                            placeholder="Specify reason..."
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CancelModal;