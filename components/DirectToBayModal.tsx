import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Operation } from '../types';
import { formatInfraName } from '../utils/helpers';

interface DirectToBayModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    operation: Operation;
    isRevert: boolean;
}

const DirectToBayModal: React.FC<DirectToBayModalProps> = ({ isOpen, onClose, onConfirm, operation, isRevert }) => {
    const [smsStatus, setSmsStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

    useEffect(() => {
        if (isOpen) {
            setSmsStatus('idle');
        }
    }, [isOpen]);

    const handleSend = () => {
        setSmsStatus('sending');
        setTimeout(() => {
            setSmsStatus('sent');
            setTimeout(() => {
                onConfirm();
                onClose();
            }, 1000); // Wait a moment to show the "Sent" status
        }, 1500); // Simulate network delay
    };

    const bayName = operation.transferPlan?.[0]?.infrastructureId ? formatInfraName(operation.transferPlan[0].infrastructureId) : 'the assigned bay';
    const message = isRevert
        ? `Hello ${operation.driverName || 'Driver'}, please DISREGARD previous instruction. Hold your position. An operator will provide an update shortly.`
        : `Hello ${operation.driverName || 'Driver'}, you are cleared to proceed to ${bayName}.`;

    const title = isRevert ? 'Revert Call to Bay' : 'Direct Truck to Bay';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary" disabled={smsStatus !== 'idle'}>Cancel</button>
                    <button onClick={handleSend} className="btn-primary" disabled={smsStatus !== 'idle'}>
                        {smsStatus === 'idle' && <><i className="fas fa-sms mr-2"></i>Send SMS</>}
                        {smsStatus === 'sending' && <><i className="fas fa-spinner fa-spin mr-2"></i>Sending...</>}
                        {smsStatus === 'sent' && <><i className="fas fa-check-circle mr-2"></i>Sent</>}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">This will simulate sending an SMS to the registered driver to proceed or hold.</p>
                <div className="p-4 bg-slate-100 rounded-lg">
                    <p><strong className="font-semibold text-text-secondary">Driver:</strong> {operation.driverName || 'N/A'}</p>
                    <p><strong className="font-semibold text-text-secondary">Phone:</strong> {operation.driverPhone || 'Not Registered'}</p>
                </div>
                
                {/* Simulated Phone UI */}
                <div className="w-full max-w-sm mx-auto bg-white rounded-xl shadow-lg p-2 border">
                    <div className="flex justify-end p-2">
                        <div className="bg-blue-500 text-white text-sm rounded-xl py-2 px-3 max-w-[80%]">
                            <p>{message}</p>
                        </div>
                    </div>
                     {smsStatus !== 'idle' && (
                         <div className="flex justify-end p-2 text-xs text-gray-400">
                             {smsStatus === 'sending' ? <span>Sending...</span> : <span>Delivered <i className="fas fa-check-double"></i></span>}
                         </div>
                     )}
                </div>
            </div>
        </Modal>
    );
};

export default DirectToBayModal;