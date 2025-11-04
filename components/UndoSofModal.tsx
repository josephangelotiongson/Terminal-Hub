import React, { useState } from 'react';
import Modal from './Modal';

interface UndoSofModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

const UndoSofModal: React.FC<UndoSofModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [customReason, setCustomReason] = useState('');

    const handleConfirmCustom = () => {
        if (customReason.trim()) {
            onConfirm(customReason.trim());
        } else {
            alert('Please provide a reason.');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Undo SOF Step"
        >
            <div className="space-y-6">
                <p className="text-text-secondary">Please provide a reason for reverting this step. This will be logged.</p>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => onConfirm('Accidental Selection')} 
                        className="w-full text-left p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                    >
                        <p className="font-semibold text-lg">Accidental Selection</p>
                        <p className="text-sm text-text-secondary">Select this if the step was completed by mistake.</p>
                    </button>
                    
                    <div className="p-4 border rounded-lg">
                        <p className="font-semibold text-lg">Actual Reason</p>
                        <p className="text-sm text-text-secondary mb-2">Provide a specific reason for the reversal (e.g., "Surveyor requested re-check").</p>
                        <textarea
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            rows={3}
                            className="w-full"
                            placeholder="Type reason here..."
                        />
                        <button 
                            onClick={handleConfirmCustom}
                            className="btn-primary mt-3 w-full"
                        >
                            Confirm with Custom Reason
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default UndoSofModal;