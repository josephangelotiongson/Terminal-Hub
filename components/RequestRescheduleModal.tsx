
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { OPERATOR_RESCHEDULE_REASONS } from '../constants';

interface RequestRescheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    opId: string;
    onSave: (opId: string, reason: string, notes: string) => void;
}

const RequestRescheduleModal: React.FC<RequestRescheduleModalProps> = ({ isOpen, onClose, opId, onSave }) => {
    const [reason, setReason] = useState(OPERATOR_RESCHEDULE_REASONS[0]);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setReason(OPERATOR_RESCHEDULE_REASONS[0]);
            setNotes('');
        }
    }, [isOpen]);

    const handleSave = () => {
        const finalReason = reason === 'Other (Specify in notes)' ? notes.trim() || 'Other' : reason;
        if (!finalReason) {
            alert("Please provide a reason for the reschedule request.");
            return;
        }
        onSave(opId, finalReason, notes);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Request Reschedule"
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Submit Request</button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">Select a reason for the reschedule request. This will be sent to the Operations Lead or Dispatcher for review.</p>
                <div>
                    <label>Reason for Request</label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1"
                    >
                        {OPERATOR_RESCHEDULE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label>Notes (Required if 'Other')</label>
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

export default RequestRescheduleModal;
