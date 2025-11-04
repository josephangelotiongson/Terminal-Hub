import React, { useState, useContext } from 'react';
import Modal from './Modal';
import { AppContext } from '../context/AppContext';

interface DelayModalProps {
    isOpen: boolean;
    onClose: () => void;
    opId: string;
}

const DELAY_REASONS = [
    "Gate Congestion",
    "Driver Late",
    "Documentation Issue",
    "Equipment Failure",
    "Product Unavailable",
    "Operator Unavailable",
    "Other",
];

const DelayModal: React.FC<DelayModalProps> = ({ isOpen, onClose, opId }) => {
    const context = useContext(AppContext);
    const [reason, setReason] = useState(DELAY_REASONS[0]);
    const [notes, setNotes] = useState('');

    const handleSave = () => {
        if (!reason) {
            alert("Please select a reason for the delay.");
            return;
        }
        context?.logDelay(opId, reason, notes);
        onClose();
        setNotes('');
        setReason(DELAY_REASONS[0]);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Log Delay"
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Log Delay</button>
                </>
            }
        >
            <div className="space-y-4">
                <div>
                    <label>Reason for Delay</label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1"
                    >
                        {DELAY_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label>Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Add any additional details here..."
                    />
                </div>
            </div>
        </Modal>
    );
};

export default DelayModal;
