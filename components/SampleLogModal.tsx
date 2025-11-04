import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import SignatureModal from './SignatureModal';
import { Transfer } from '../types';

interface SampleLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (logData: Partial<Transfer>) => void;
    transfer: Transfer;
}

const SampleLogModal: React.FC<SampleLogModalProps> = ({ isOpen, onClose, onSave, transfer }) => {
    const [samplesPassed, setSamplesPassed] = useState<'Y' | 'N' | ''>('');
    const [slop, setSlop] = useState('');
    const [surveyorSignature, setSurveyorSignature] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            setSamplesPassed(transfer.samplesPassed || 'Y'); // Default to Yes for "less clicks"
            setSlop(transfer.slop || '');
            setSurveyorSignature(transfer.surveyorSignature || '');
        }
    }, [isOpen, transfer]);

    const handleSave = () => {
        onSave({
            samplesPassed,
            slop,
            surveyorSignature
        });
        onClose();
    };

    return (
        <>
            <SignatureModal isOpen={isSigning} onClose={() => setIsSigning(false)} onSave={setSurveyorSignature} initialSignature={surveyorSignature} />
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Sample & Surveyor Log for ${transfer.product}`}
                footer={<>
                    <button onClick={onClose} className="btn-secondary">Skip</button>
                    <button onClick={handleSave} className="btn-primary">Save Log</button>
                </>}
            >
                <div className="space-y-4">
                     <p className="text-sm text-text-secondary">Please confirm sample status and capture the surveyor's signature.</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label>Samples Passed?</label>
                            <select value={samplesPassed} onChange={e => setSamplesPassed(e.target.value as any)}>
                                <option value="">Select...</option>
                                <option value="Y">Yes</option>
                                <option value="N">No</option>
                            </select>
                        </div>
                        <div>
                            <label>Slop Quantity (MT)</label>
                            <input type="number" value={slop} onChange={e => setSlop(e.target.value)} placeholder="0"/>
                        </div>
                    </div>
                    <div>
                        <label>Surveyor Signature</label>
                        <div onClick={() => setIsSigning(true)} className="w-full h-32 flex items-center justify-center cursor-pointer hover:bg-slate-100 p-1 rounded-md border border-slate-300">
                            {surveyorSignature ? <img src={surveyorSignature} alt="signature" className="h-28 w-auto" /> : <span className="text-blue-600 font-semibold">TAP TO SIGN</span>}
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default SampleLogModal;