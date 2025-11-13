import React from 'react';
import Modal from './Modal';

interface RequeuePriorityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (priority: 'high' | 'normal') => void;
}

const RequeuePriorityModal: React.FC<RequeuePriorityModalProps> = ({ isOpen, onClose, onSelect }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Re-queue Priority">
        <div className="space-y-4">
            <p className="text-text-secondary">Select a priority for this re-queued order. High priority orders will be highlighted for planners.</p>
            <button onClick={() => onSelect('high')} className="w-full text-left p-4 border rounded-lg bg-red-50 hover:bg-red-100 transition">
                <p className="font-semibold text-lg text-red-700"><i className="fas fa-exclamation-triangle mr-2"></i>High Priority</p>
                <p className="text-sm text-red-600">This order needs immediate attention for rescheduling.</p>
            </button>
            <button onClick={() => onSelect('normal')} className="w-full text-left p-4 border rounded-lg bg-slate-50 hover:bg-slate-100 transition">
                <p className="font-semibold text-lg text-text-primary">Normal Priority</p>
                <p className="text-sm text-text-secondary">This order will be added to the standard rescheduling queue.</p>
            </button>
        </div>
    </Modal>
);

export default RequeuePriorityModal;
