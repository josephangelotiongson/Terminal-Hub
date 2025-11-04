import React, { useState, useEffect, useContext } from 'react';
import Modal from './Modal';
import { SOFItem, Operation, User, Transfer } from '../types';
import { AppContext } from '../context/AppContext';
import DateTimePicker from './DateTimePicker';
import SignatureModal from './SignatureModal';

interface SofDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (opToSave: Operation) => void;
    sofItem: SOFItem | null;
    plan: Operation; // The full operation plan being edited
    transfer?: Transfer; // The specific transfer this SOF belongs to (optional)
}

const SofDetailsModal: React.FC<SofDetailsModalProps> = ({ isOpen, onClose, onSave, sofItem, plan, transfer }) => {
    const { users } = useContext(AppContext)!;

    const [time, setTime] = useState('');
    const [user, setUser] = useState('');
    
    // Hose Log State
    const [hoseLogEntry, setHoseLogEntry] = useState<any>(null);

    // Sample Log State
    const [samplesPassed, setSamplesPassed] = useState<'Y' | 'N' | ''>('');
    const [slop, setSlop] = useState('');
    const [surveyorSignature, setSurveyorSignature] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    
    const isHoseStep = sofItem?.event.includes('HOSE CONNECTED') && transfer;
    const isSampleStep = sofItem?.event.includes('SLOPS SAMPLE PASSED') && transfer;
    
    useEffect(() => {
        if (isOpen && sofItem) {
            setTime(sofItem.time);
            setUser(sofItem.user);

            if (isHoseStep) {
                const existingLog = plan.hoseLog?.find(h => h.product === transfer.product);
                setHoseLogEntry(existingLog || { product: transfer.product, testDate: new Date().toISOString().split('T')[0], pressureTestPassed: 'Y', newGasketUsed: 'Y', initials: '', hoseNumber: '' });
            }
            if (isSampleStep) {
                setSamplesPassed(transfer.samplesPassed || '');
                setSlop(transfer.slop || '');
                setSurveyorSignature(transfer.surveyorSignature || '');
            }
        }
    }, [isOpen, sofItem, plan, transfer, isHoseStep, isSampleStep]);

    const handleSave = () => {
        const newPlan = JSON.parse(JSON.stringify(plan));

        let targetSofArray: SOFItem[] | undefined;
        let targetTransfer: Transfer | undefined;

        if (transfer) {
            // Find the specific transfer's SOF array
            for (const line of newPlan.transferPlan) {
                const transferIndex = line.transfers.findIndex((t: Transfer) => t.id === transfer.id);
                if (transferIndex > -1) {
                    targetTransfer = line.transfers[transferIndex];
                    targetSofArray = targetTransfer.sof;
                    break;
                }
            }
        } else {
            // Use the top-level SOF array (for vessel common steps)
            targetSofArray = newPlan.sof;
        }

        const sofIndex = (targetSofArray || []).findIndex((s: SOFItem) => s.event === sofItem?.event && s.loop === sofItem?.loop);
        
        if (targetSofArray && sofIndex > -1) {
            // Update the SOF item itself
            targetSofArray[sofIndex].time = time;
            targetSofArray[sofIndex].user = user;

            // Update associated data if applicable
            if (isHoseStep) {
                const hoseLogIndex = (newPlan.hoseLog || []).findIndex((h: any) => h.product === transfer.product);
                if (hoseLogIndex > -1) {
                    newPlan.hoseLog[hoseLogIndex] = hoseLogEntry;
                } else {
                    if (!newPlan.hoseLog) newPlan.hoseLog = [];
                    newPlan.hoseLog.push(hoseLogEntry);
                }
            }
            if (isSampleStep && targetTransfer) {
                targetTransfer.samplesPassed = samplesPassed;
                targetTransfer.slop = slop;
                targetTransfer.surveyorSignature = surveyorSignature;
            }

            onSave(newPlan);
            onClose();
        } else {
            console.error("Could not find SOF item to update.");
            onClose();
        }
    };
    
    if (!sofItem) return null;

    return (
        <>
            {transfer && <SignatureModal isOpen={isSigning} onClose={() => setIsSigning(false)} onSave={setSurveyorSignature} initialSignature={surveyorSignature} />}
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Edit SOF Step: ${sofItem.event}`}
                footer={<>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save Changes</button>
                </>}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label>Completion Time</label>
                            <DateTimePicker value={time} onChange={setTime} />
                        </div>
                        <div>
                            <label>Completed By</label>
                            <select value={user} onChange={e => setUser(e.target.value)} className="w-full">
                                {users.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {isHoseStep && hoseLogEntry && (
                        <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                            <h4 className="font-semibold text-base">Hose Log Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label>Hose Number</label><input type="text" value={hoseLogEntry.hoseNumber} onChange={e => setHoseLogEntry({...hoseLogEntry, hoseNumber: e.target.value})} /></div>
                                <div><label>Test Date</label><input type="date" value={hoseLogEntry.testDate} onChange={e => setHoseLogEntry({...hoseLogEntry, testDate: e.target.value})} /></div>
                                <div><label>Pressure Test Passed?</label><select value={hoseLogEntry.pressureTestPassed} onChange={e => setHoseLogEntry({...hoseLogEntry, pressureTestPassed: e.target.value})} className="w-full"><option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option></select></div>
                                <div><label>New Gasket Used?</label><select value={hoseLogEntry.newGasketUsed} onChange={e => setHoseLogEntry({...hoseLogEntry, newGasketUsed: e.target.value})} className="w-full"><option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option></select></div>
                            </div>
                        </div>
                    )}

                    {isSampleStep && (
                         <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                            <h4 className="font-semibold text-base">Sample & Surveyor Details</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label>Samples Passed?</label>
                                    <select value={samplesPassed} onChange={e => setSamplesPassed(e.target.value as any)} className="w-full">
                                        <option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option>
                                    </select>
                                </div>
                                <div>
                                    <label>Slop Quantity (MT)</label>
                                    <input type="number" value={slop} onChange={e => setSlop(e.target.value)} placeholder="0"/>
                                </div>
                            </div>
                             <div>
                                <label>Surveyor Signature</label>
                                <div onClick={() => setIsSigning(true)} className="w-full h-32 flex items-center justify-center cursor-pointer hover:bg-slate-100 p-1 rounded-md border border-slate-300 bg-white">
                                    {surveyorSignature ? <img src={surveyorSignature} alt="signature" className="h-28 w-auto" /> : <span className="text-blue-600 font-semibold">TAP TO SIGN</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
};

export default SofDetailsModal;