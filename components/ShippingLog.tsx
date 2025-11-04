import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Transfer } from '../types';
import { combineToIso, isoToDateInput, isoToTimeInput } from '../utils/helpers';
import SignatureModal from './SignatureModal';

interface ShippingLogProps {
    plan: Operation;
    setPlan: React.Dispatch<React.SetStateAction<Operation | null>>;
}

const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2);
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${String(hours).padStart(2, '0')}:${minutes}`;
});

const SignatureDisplay: React.FC<{ signature: string; onClick: () => void }> = ({ signature, onClick }) => {
    const isSigned = signature && signature.startsWith('data:image');
    return (
        <div onClick={onClick} className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-slate-100 p-1 min-h-[30px] rounded-md border border-transparent hover:border-slate-300">
            {isSigned ? <img src={signature} alt="signature" className="h-6 w-auto" /> : <span className="text-blue-600 text-xs font-semibold">SIGN</span>}
        </div>
    );
};


const ShippingLog: React.FC<ShippingLogProps> = ({ plan, setPlan }) => {
    const [signingTarget, setSigningTarget] = useState<{ type: 'product' | 'hose' | 'observation' | 'new_hose' | 'new_observation', id: string | number } | null>(null);

    // State for new entries
    const [newHandover, setNewHandover] = useState({ by: '', to: '' });
    const [newHose, setNewHose] = useState({ hoseNumber: '', product: '', testDate: '', pressureTestPassed: '' as 'Y' | 'N' | '', newGasketUsed: '' as 'Y' | 'N' | '', initials: '' });
    const [newObservation, setNewObservation] = useState({ timestamp_date: '', timestamp_time: '', pressure: '', observation: '', initials: '' });

    const handleUpdate = (updateFn: (draft: Operation) => void) => {
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newPlan = JSON.parse(JSON.stringify(prevPlan));
            updateFn(newPlan);
            return newPlan;
        });
    };
    
    const handleTransferLogChange = (transferId: string, field: keyof Transfer, value: any) => {
        handleUpdate(draft => {
            for (const line of draft.transferPlan) {
                const transfer = line.transfers.find(t => t.id === transferId);
                if (transfer) {
                    (transfer as any)[field] = value;
                    break;
                }
            }
        });
    };

    const handleAddHandover = () => {
        if (newHandover.by && newHandover.to) {
            handleUpdate(draft => {
                if (!draft.handOvers) draft.handOvers = [];
                draft.handOvers.push(newHandover);
            });
            setNewHandover({ by: '', to: '' });
        }
    };

    const handleAddHose = () => {
        if (newHose.hoseNumber && newHose.initials) {
            handleUpdate(draft => {
                if (!draft.hoseLog) draft.hoseLog = [];
                draft.hoseLog.push(newHose);
            });
            setNewHose({ hoseNumber: '', product: '', testDate: '', pressureTestPassed: '', newGasketUsed: '', initials: '' });
        } else {
            alert("Please provide a hose number and initial the entry.");
        }
    };
    
    const handleAddObservation = () => {
        if (newObservation.observation && newObservation.initials) {
            const timestamp = combineToIso(newObservation.timestamp_date, newObservation.timestamp_time) || new Date().toISOString();
            handleUpdate(draft => {
                if (!draft.observationLog) draft.observationLog = [];
                draft.observationLog.push({
                    timestamp,
                    pressure: newObservation.pressure,
                    observation: newObservation.observation,
                    initials: newObservation.initials
                });
            });
            setNewObservation({ timestamp_date: '', timestamp_time: '', pressure: '', observation: '', initials: '' });
        } else {
             alert("Please provide an observation and initial the entry.");
        }
    };
    
    const handleSaveSignature = (dataUrl: string) => {
        if (!signingTarget) return;
        const { type, id } = signingTarget;

        switch (type) {
            case 'product':
                handleTransferLogChange(id as string, 'surveyorSignature', dataUrl);
                break;
            case 'hose':
                handleUpdate(draft => { if (draft.hoseLog?.[id as number]) draft.hoseLog[id as number].initials = dataUrl; });
                break;
            case 'new_hose':
                setNewHose(prev => ({ ...prev, initials: dataUrl }));
                break;
            case 'observation':
                handleUpdate(draft => { if (draft.observationLog?.[id as number]) draft.observationLog[id as number].initials = dataUrl; });
                break;
            case 'new_observation':
                setNewObservation(prev => ({ ...prev, initials: dataUrl }));
                break;
        }
        setSigningTarget(null);
    };

    const getInitialSignature = (): string | undefined => {
        if (!signingTarget) return undefined;
        const { type, id } = signingTarget;
        let signature: string | undefined = undefined;

        switch(type) {
            case 'product':
                signature = plan.transferPlan.flatMap(l => l.transfers).find(t => t.id === id)?.surveyorSignature;
                break;
            case 'hose':
                signature = plan.hoseLog?.[id as number]?.initials;
                break;
            case 'new_hose':
                signature = newHose.initials;
                break;
            case 'observation':
                signature = plan.observationLog?.[id as number]?.initials;
                break;
            case 'new_observation':
                signature = newObservation.initials;
                break;
        }
        return signature?.startsWith('data:image') ? signature : undefined;
    };


    return (
        <>
            <SignatureModal
                isOpen={!!signingTarget}
                onClose={() => setSigningTarget(null)}
                onSave={handleSaveSignature}
                initialSignature={getInitialSignature()}
            />
            <div className="space-y-6 text-sm">
                <div className="grid grid-cols-2 gap-4">
                    <p><strong className="font-semibold text-text-secondary">Ship:</strong> {plan.transportId}</p>
                    <p><strong className="font-semibold text-text-secondary">Arrival Date:</strong> {new Date(plan.eta).toLocaleDateString()}</p>
                </div>
                
                <div className="card !p-0 overflow-hidden">
                    <h4 className="font-bold p-3 bg-slate-50 border-b">Product & Sample Log</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-100 text-xs uppercase">
                                <tr>
                                    <th className="p-2 text-left">Product</th><th className="p-2 text-left">Tonnes</th><th className="p-2 text-left">Tanks (From/To)</th><th className="p-2 text-left">Slop (MT)</th><th className="p-2 text-left">Samples Passed</th><th className="p-2 text-left">Surveyor Signature</th><th className="p-2 text-left">Additional Info</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plan.transferPlan.flatMap(line => line.transfers).map(t => (
                                    <tr key={t.id} className="border-t">
                                        <td className="p-1 font-semibold">{t.product}</td><td className="p-1">{t.tonnes}</td><td className="p-1">{t.from} &rarr; {t.to}</td>
                                        <td className="p-1"><input type="text" className="!py-1 !text-sm w-20" value={t.slop || ''} onChange={e => handleTransferLogChange(t.id!, 'slop', e.target.value)} /></td>
                                        <td className="p-1"><select className="!py-1 !text-sm w-20" value={t.samplesPassed || ''} onChange={e => handleTransferLogChange(t.id!, 'samplesPassed', e.target.value as 'Y' | 'N' | '')}><option value=""></option><option value="Y">Y</option><option value="N">N</option></select></td>
                                        <td className="p-1 w-32"><SignatureDisplay signature={t.surveyorSignature || ''} onClick={() => setSigningTarget({ type: 'product', id: t.id! })} /></td>
                                        <td className="p-1"><input type="text" className="!py-1 !text-sm w-full min-w-[150px]" value={t.additionalInformation || ''} onChange={e => handleTransferLogChange(t.id!, 'additionalInformation', e.target.value)} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card !p-0 overflow-hidden"><h4 className="font-bold p-3 bg-slate-50 border-b">Hand Over Log</h4><div className="p-2 space-y-2">{(plan.handOvers || []).map((h, i) => (<div key={i} className="flex gap-2 items-center text-xs p-1 bg-slate-100 rounded"><span className="font-semibold">BY:</span><span className="flex-1">{h.by}</span><span className="font-semibold">TO:</span><span className="flex-1">{h.to}</span></div>))}<div className="flex gap-2 items-center pt-2 border-t"><input type="text" placeholder="Hand over by..." className="!py-1 !text-sm" value={newHandover.by} onChange={e => setNewHandover({...newHandover, by: e.target.value})}/><input type="text" placeholder="To..." className="!py-1 !text-sm" value={newHandover.to} onChange={e => setNewHandover({...newHandover, to: e.target.value})}/><button className="btn-secondary !py-1 !px-2" onClick={handleAddHandover}>Add</button></div></div></div>
                    <div className="card !p-0 overflow-hidden"><h4 className="font-bold p-3 bg-slate-50 border-b">Hose Log</h4><div className="overflow-x-auto max-h-60"><table className="w-full text-xs"><thead><tr><th className="p-1">Hose #</th><th className="p-1">Product</th><th className="p-1">Test Date</th><th className="p-1">Pressure Test</th><th className="p-1">New Gasket</th><th className="p-1">Initials</th></tr></thead><tbody>{(plan.hoseLog || []).map((h,i) => (<tr key={i} className="border-t text-center"><td className="p-1">{h.hoseNumber}</td><td className="p-1">{h.product}</td><td className="p-1">{h.testDate ? new Date(h.testDate).toLocaleDateString() : ''}</td><td className="p-1">{h.pressureTestPassed}</td><td className="p-1">{h.newGasketUsed}</td><td className="p-1"><SignatureDisplay signature={h.initials || ''} onClick={() => setSigningTarget({ type: 'hose', id: i })} /></td></tr>))}</tbody></table></div><div className="p-2 border-t bg-slate-50 grid grid-cols-2 lg:grid-cols-4 gap-2 items-end"><input type="text" placeholder="Hose #" className="!py-1 !text-sm" value={newHose.hoseNumber} onChange={e => setNewHose({...newHose, hoseNumber: e.target.value})} /><select className="!py-1 !text-sm" value={newHose.product} onChange={e => setNewHose({...newHose, product: e.target.value})}><option value="">Product...</option>{plan.transferPlan.flatMap(l=>l.transfers).map(t => <option key={t.id} value={t.product}>{t.product}</option>)}</select><input type="date" className="!py-1 !text-sm" value={newHose.testDate} onChange={e => setNewHose({...newHose, testDate: e.target.value})} /><div className="flex gap-2 items-center"><select className="!py-1 !text-sm" value={newHose.pressureTestPassed} onChange={e => setNewHose({...newHose, pressureTestPassed: e.target.value as 'Y'|'N'|''})}><option value="">Pressure?</option><option value="Y">Y</option><option value="N">N</option></select><select className="!py-1 !text-sm" value={newHose.newGasketUsed} onChange={e => setNewHose({...newHose, newGasketUsed: e.target.value as 'Y'|'N'|''})}><option value="">Gasket?</option><option value="Y">Y</option><option value="N">N</option></select></div><div className="border bg-white rounded-md"><SignatureDisplay signature={newHose.initials} onClick={() => setSigningTarget({ type: 'new_hose', id: 'new' })} /></div><button className="btn-secondary !py-1 !px-2 lg:col-span-3" onClick={handleAddHose}>Add Hose Log</button></div></div>
                </div>

                <div className="card !p-0 overflow-hidden"><h4 className="font-bold p-3 bg-slate-50 border-b">Observation/Actions Log</h4><div className="overflow-x-auto max-h-80"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-1 text-left">Date/Time</th><th className="p-1 text-left">Pressure (kPa)</th><th className="p-1 text-left">Observation/Action</th><th className="p-1 text-left">Initial</th></tr></thead><tbody>{(plan.observationLog || []).map((log, i) => (<tr key={i} className="border-t"><td className="p-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td><td className="p-2">{log.pressure}</td><td className="p-2">{log.observation}</td><td className="p-2 w-24"><SignatureDisplay signature={log.initials || ''} onClick={() => setSigningTarget({ type: 'observation', id: i })}/></td></tr>))}</tbody></table></div><div className="p-2 border-t bg-slate-50 grid grid-cols-[1fr,1fr,auto,2fr,auto,auto] gap-2 items-center"><input type="date" className="!py-1 !text-sm" value={newObservation.timestamp_date} onChange={e => setNewObservation({...newObservation, timestamp_date: e.target.value})} /><select className="!py-1 !text-sm" value={newObservation.timestamp_time} onChange={e => setNewObservation({...newObservation, timestamp_time: e.target.value})}><option value="">Time...</option>{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select><input type="text" placeholder="Pressure" className="!py-1 !text-sm w-24" value={newObservation.pressure} onChange={e => setNewObservation({...newObservation, pressure: e.target.value})} /><input type="text" placeholder="Observation or Action..." className="!py-1 !text-sm" value={newObservation.observation} onChange={e => setNewObservation({...newObservation, observation: e.target.value})} /><div className="border bg-white rounded-md w-20"><SignatureDisplay signature={newObservation.initials} onClick={() => setSigningTarget({ type: 'new_observation', id: 'new' })} /></div><button className="btn-secondary !py-1 !px-2" onClick={handleAddObservation}>Add Log</button></div></div>
            </div>
        </>
    );
};

export default ShippingLog;
