import React, { useState, useEffect, useContext } from 'react';
import Modal from './Modal';
import { Operation } from '../types';
import { AppContext } from '../context/AppContext';

interface ReworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    operation: Operation | null;
}

const REWORK_REASONS = [
    "Underloaded",
    "Overloaded",
    "Contamination Issue",
    "Equipment Re-check",
    "Other"
];

const ReworkModal: React.FC<ReworkModalProps> = ({ isOpen, onClose, operation }) => {
    const context = useContext(AppContext);
    const [reason, setReason] = useState(REWORK_REASONS[0]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setReason(REWORK_REASONS[0]);
            setNotes('');
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!operation || !context) return;
        context.reworkTruckOperation(operation.id, reason, notes);
        onClose();
    };

    if (!operation) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Log Rework for: ${operation.transportId}`}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Confirm & Reschedule</button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                    This will create a new set of tasks for this truck and require it to be rescheduled on the planning board.
                </p>
                <div>
                    <label>Reason for Rework</label>
                    <select value={reason} onChange={e => setReason(e.target.value)} className="mt-1">
                        {REWORK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label>Notes (Optional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add any additional details..." />
                </div>
            </div>
        </Modal>
    );
};

export default ReworkModal;