

import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Transfer, SampleLogEntry } from '../types';
import { combineToIso } from '../utils/helpers';

// Helper component for inline signatures, defined within this file to avoid creating new files.
const InlineSignaturePad: React.FC<{
    signature: string;
    onSave: (dataUrl: string) => void;
}> = ({ signature, onSave }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = React.useState(false);

    const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if (e.nativeEvent instanceof MouseEvent) {
            clientX = e.nativeEvent.clientX;
            clientY = e.nativeEvent.clientY;
        } else if (e.nativeEvent instanceof TouchEvent && e.nativeEvent.touches.length > 0) {
            clientX = e.nativeEvent.touches[0].clientX;
            clientY = e.nativeEvent.touches[0].clientY;
        } else {
            return { x: 0, y: 0 };
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;
        
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.closePath();
        setIsDrawing(false);

        const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
        const isEmpty = !pixelBuffer.some(color => color !== 0);
        onSave(isEmpty ? '' : canvas.toDataURL('image/png'));
    };
    
    const clearCanvas = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onSave('');
    };
    
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        if (!parent) return;

        const setupCanvas = () => {
            const rect = parent.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (signature && signature.startsWith('data:image')) {
                    const img = new Image();
                    img.src = signature;
                    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }
            }
        };
        setupCanvas();
        window.addEventListener('resize', setupCanvas);
        return () => window.removeEventListener('resize', setupCanvas);
    }, [signature]);


    return (
        <div className="relative bg-white border border-slate-300 rounded-md w-full h-full min-h-[40px]">
             <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <button type="button" onClick={clearCanvas} className="absolute top-0 right-0 text-xs p-1 text-slate-500 hover:text-slate-800" title="Clear Signature">
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
};


interface ShippingLogProps {
    plan: Operation;
    setPlan: React.Dispatch<React.SetStateAction<Operation | null>>;
}

const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2);
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${String(hours).padStart(2, '0')}:${minutes}`;
});


const ShippingLog: React.FC<ShippingLogProps> = ({ plan, setPlan }) => {
    const { simulatedTime, addActivityLog } = useContext(AppContext)!;

    // State for new entries
    const [newHandover, setNewHandover] = useState({ by: '', to: '' });
    const [newHose, setNewHose] = useState({ hoseNumber: '', product: '', testDate: '', pressureTestPassed: '' as 'Y' | 'N' | '', newGasketUsed: '' as 'Y' | 'N' | '', initials: '' });
    const [newObservation, setNewObservation] = useState({ timestamp_date: '', timestamp_time: '', pressure: '', observation: '', initials: '' });
    
    // Initialize date fields with simulated time
    React.useEffect(() => {
        if (!newHose.testDate) {
            setNewHose(h => ({ ...h, testDate: simulatedTime.toISOString().split('T')[0] }));
        }
        if (!newObservation.timestamp_date) {
             setNewObservation(o => ({ ...o, timestamp_date: simulatedTime.toISOString().split('T')[0] }));
        }
    }, [simulatedTime]);


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
    
    const handleSampleLogChange = (transferId: string, field: keyof SampleLogEntry, value: any) => {
        const originalSignature = plan.sampleLog?.find(l => l.transferId === transferId)?.surveyorSignature || '';

        handleUpdate(draft => {
            if (!draft.sampleLog) draft.sampleLog = [];
            let log = draft.sampleLog.find(l => l.transferId === transferId);
            if (log) {
                (log as any)[field] = value;
            } else {
                const newLog: SampleLogEntry = { id: `sample-${Date.now()}`, transferId, samplesPassed: '', slop: '', surveyorSignature: '' };
                (newLog as any)[field] = value;
                draft.sampleLog.push(newLog);
            }
        });

        if (field === 'surveyorSignature' && value && !originalSignature) {
            const transferProduct = plan.transferPlan.flatMap(l => l.transfers).find(t => t.id === transferId)?.product || 'Unknown Product';
            addActivityLog(plan.id, 'SIGNATURE', `Surveyor Signature captured for product ${transferProduct}.`);
        }
    };


    const handleAddHandover = () => {
        if (newHandover.by && newHandover.to) {
            handleUpdate(draft => {
                if (!draft.handOvers) draft.handOvers = [];
                draft.handOvers.push({ id: `ho-${Date.now()}`, ...newHandover });
            });
            addActivityLog(plan.id, 'LOG_UPDATE', `Added Hand Over Log: From ${newHandover.by} to ${newHandover.to}.`);
            setNewHandover({ by: '', to: '' });
        }
    };

    const handleAddHose = () => {
        if (newHose.hoseNumber && newHose.initials) {
            handleUpdate(draft => {
                if (!draft.hoseLog) draft.hoseLog = [];
                draft.hoseLog.push({ id: `hose-${Date.now()}`, ...newHose });
            });
            addActivityLog(plan.id, 'LOG_UPDATE', `Added Hose Log: Hose #${newHose.hoseNumber} for ${newHose.product}.`);
            if (newHose.initials) {
                addActivityLog(plan.id, 'SIGNATURE', `Operator initials captured for new Hose Log entry.`);
            }
            setNewHose({ hoseNumber: '', product: '', testDate: simulatedTime.toISOString().split('T')[0], pressureTestPassed: '', newGasketUsed: '', initials: '' });
        } else {
            alert("Please provide a hose number and initial the entry.");
        }
    };
    
    const handleAddObservation = () => {
        if (newObservation.observation && newObservation.initials) {
            const timestamp = combineToIso(newObservation.timestamp_date, newObservation.timestamp_time) || simulatedTime.toISOString();
            handleUpdate(draft => {
                if (!draft.observationLog) draft.observationLog = [];
                draft.observationLog.push({
                    id: `obs-${Date.now()}`,
                    timestamp,
                    pressure: newObservation.pressure,
                    observation: newObservation.observation,
                    initials: newObservation.initials
                });
            });
            addActivityLog(plan.id, 'LOG_UPDATE', `Added Observation Log: "${newObservation.observation}"`);
             if (newObservation.initials) {
                addActivityLog(plan.id, 'SIGNATURE', `Operator initials captured for new Observation Log entry.`);
            }
            setNewObservation({ timestamp_date: simulatedTime.toISOString().split('T')[0], timestamp_time: '', pressure: '', observation: '', initials: '' });
        } else {
             alert("Please provide an observation and initial the entry.");
        }
    };
    
    const handleHoseLogSignatureUpdate = (index: number, signature: string) => {
        const originalSignature = plan.hoseLog?.[index]?.initials || '';
        handleUpdate(draft => {
            if (draft.hoseLog?.[index]) draft.hoseLog[index].initials = signature;
        });

        if (signature && !originalSignature) {
            const hoseNumber = plan.hoseLog?.[index]?.hoseNumber;
            addActivityLog(plan.id, 'SIGNATURE', `Operator initials updated for Hose Log entry #${hoseNumber}.`);
        }
    };

    const handleObservationLogSignatureUpdate = (index: number, signature: string) => {
        const originalSignature = plan.observationLog?.[index]?.initials || '';
        handleUpdate(draft => {
            if (draft.observationLog?.[index]) draft.observationLog[index].initials = signature;
        });

        if (signature && !originalSignature) {
            const observationText = plan.observationLog?.[index]?.observation.substring(0, 20);
            addActivityLog(plan.id, 'SIGNATURE', `Operator initials captured for Observation: "${observationText}...".`);
        }
    };

    return (
        <>
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
                                {plan.transferPlan.flatMap(line => line.transfers).map(t => {
                                    const sampleLog = plan.sampleLog?.find(l => l.transferId === t.id);
                                    return (
                                        <tr key={t.id} className="border-t">
                                            <td className="p-1 font-semibold">{t.product}</td><td className="p-1">{t.tonnes}</td><td className="p-1">{t.from} &rarr; {t.to}</td>
                                            <td className="p-1"><input type="text" className="!py-1 !text-sm w-20" value={sampleLog?.slop || ''} onChange={e => handleSampleLogChange(t.id!, 'slop', e.target.value)} /></td>
                                            <td className="p-1"><select className="!py-1 !text-sm w-20" value={sampleLog?.samplesPassed || ''} onChange={e => handleSampleLogChange(t.id!, 'samplesPassed', e.target.value as 'Y' | 'N' | '')}><option value=""></option><option value="Y">Y</option><option value="N">N</option></select></td>
                                            <td className="p-1 w-32"><InlineSignaturePad signature={sampleLog?.surveyorSignature || ''} onSave={(dataUrl) => handleSampleLogChange(t.id!, 'surveyorSignature', dataUrl)} /></td>
                                            <td className="p-1"><input type="text" className="!py-1 !text-sm w-full min-w-[150px]" value={t.additionalInformation || ''} onChange={e => handleTransferLogChange(t.id!, 'additionalInformation', e.target.value)} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card !p-0 overflow-hidden"><h4 className="font-bold p-3 bg-slate-50 border-b">Hand Over Log</h4><div className="p-2 space-y-2">{(plan.handOvers || []).map((h, i) => (<div key={i} className="flex gap-2 items-center text-xs p-1 bg-slate-100 rounded"><span className="font-semibold">BY:</span><span className="flex-1">{h.by}</span><span className="font-semibold">TO:</span><span className="flex-1">{h.to}</span></div>))}<div className="flex gap-2 items-center pt-2 border-t"><input type="text" placeholder="Hand over by..." className="!py-1 !text-sm" value={newHandover.by} onChange={e => setNewHandover({...newHandover, by: e.target.value})}/><input type="text" placeholder="To..." className="!py-1 !text-sm" value={newHandover.to} onChange={e => setNewHandover({...newHandover, to: e.target.value})}/><button className="btn-secondary !py-1 !px-2" onClick={handleAddHandover}>Add</button></div></div></div>
                    <div className="card !p-0 overflow-hidden"><h4 className="font-bold p-3 bg-slate-50 border-b">Hose Log</h4><div className="overflow-x-auto max-h-60"><table className="w-full text-xs"><thead><tr><th className="p-1">Hose #</th><th className="p-1">Product</th><th className="p-1">Test Date</th><th className="p-1">Pressure Test</th><th className="p-1">New Gasket</th><th className="p-1">Initials</th></tr></thead><tbody>{(plan.hoseLog || []).map((h,i) => (<tr key={i} className="border-t text-center"><td className="p-1">{h.hoseNumber}</td><td className="p-1">{h.product}</td><td className="p-1">{h.testDate ? new Date(h.testDate).toLocaleDateString() : ''}</td><td className="p-1">{h.pressureTestPassed}</td><td className="p-1">{h.newGasketUsed}</td><td className="p-1 h-12 w-24"><InlineSignaturePad signature={h.initials || ''} onSave={dataUrl => handleHoseLogSignatureUpdate(i, dataUrl)} /></td></tr>))}</tbody></table></div><div className="p-2 border-t bg-slate-50 grid grid-cols-2 lg:grid-cols-4 gap-2 items-end"><input type="text" placeholder="Hose #" className="!py-1 !text-sm" value={newHose.hoseNumber} onChange={e => setNewHose({...newHose, hoseNumber: e.target.value})} /><select className="!py-1 !text-sm" value={newHose.product} onChange={e => setNewHose({...newHose, product: e.target.value})}><option value="">Product...</option>{plan.transferPlan.flatMap(l=>l.transfers).map(t => <option key={t.id} value={t.product}>{t.product}</option>)}</select><input type="date" className="!py-1 !text-sm" value={newHose.testDate} onChange={e => setNewHose({...newHose, testDate: e.target.value})} /><div className="flex gap-2 items-center"><select className="!py-1 !text-sm" value={newHose.pressureTestPassed} onChange={e => setNewHose({...newHose, pressureTestPassed: e.target.value as 'Y'|'N'|''})}><option value="">Pressure?</option><option value="Y">Y</option><option value="N">N</option></select><select className="!py-1 !text-sm" value={newHose.newGasketUsed} onChange={e => setNewHose({...newHose, newGasketUsed: e.target.value as 'Y'|'N'|''})}><option value="">Gasket?</option><option value="Y">Y</option><option value="N">N</option></select></div><div className="h-12 w-24"><InlineSignaturePad signature={newHose.initials} onSave={dataUrl => setNewHose(p => ({...p, initials: dataUrl}))} /></div><button className="btn-secondary !py-1 !px-2 lg:col-span-3" onClick={handleAddHose}>Add Hose Log</button></div></div>
                </div>

                <div className="card !p-0 overflow-hidden"><h4 className="font-bold p-3 bg-slate-50 border-b">Observation/Actions Log</h4><div className="overflow-x-auto max-h-80"><table className="w-full text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-1 text-left">Date/Time</th><th className="p-1 text-left">Pressure (kPa)</th><th className="p-1 text-left">Observation/Action</th><th className="p-1 text-left">Initial</th></tr></thead><tbody>{(plan.observationLog || []).map((log, i) => (<tr key={i} className="border-t"><td className="p-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td><td className="p-2">{log.pressure}</td><td className="p-2">{log.observation}</td><td className="p-2 w-24 h-12"><InlineSignaturePad signature={log.initials || ''} onSave={dataUrl => handleObservationLogSignatureUpdate(i, dataUrl)} /></td></tr>))}</tbody></table></div><div className="p-2 border-t bg-slate-50 grid grid-cols-[1fr,1fr,auto,2fr,auto,auto] gap-2 items-center"><input type="date" className="!py-1 !text-sm" value={newObservation.timestamp_date} onChange={e => setNewObservation({...newObservation, timestamp_date: e.target.value})} /><select className="!py-1 !text-sm" value={newObservation.timestamp_time} onChange={e => setNewObservation({...newObservation, timestamp_time: e.target.value})}><option value="">Time...</option>{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select><input type="text" placeholder="Pressure" className="!py-1 !text-sm w-24" value={newObservation.pressure} onChange={e => setNewObservation({...newObservation, pressure: e.target.value})} /><input type="text" placeholder="Observation or Action..." className="!py-1 !text-sm" value={newObservation.observation} onChange={e => setNewObservation({...newObservation, observation: e.target.value})} /><div className="h-12 w-24"><InlineSignaturePad signature={newObservation.initials} onSave={dataUrl => setNewObservation(p => ({...p, initials: dataUrl}))} /></div><button className="btn-secondary !py-1 !px-2" onClick={handleAddObservation}>Add Log</button></div></div>
            </div>
        </>
    );
};

export default ShippingLog;