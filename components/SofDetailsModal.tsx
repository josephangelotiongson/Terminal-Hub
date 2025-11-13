
import React, { useState, useEffect, useContext, useRef } from 'react';
import Modal from './Modal';
import { SOFItem, Operation, User, Transfer, HoseLogEntry, SampleLogEntry, PressureCheckLogEntry, ActivityLogItem } from '../types';
import { AppContext } from '../context/AppContext';
import DateTimePicker from './DateTimePicker';

interface SofDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (opToSave: Operation) => void;
    sofItem: SOFItem | null;
    plan: Operation; // The full operation plan being edited
    transfer?: Transfer; // The specific transfer this SOF belongs to (optional)
}

const SofDetailsModal: React.FC<SofDetailsModalProps> = ({ isOpen, onClose, onSave, sofItem, plan, transfer }) => {
    const { users, currentUser, simulatedTime } = useContext(AppContext)!;

    const [time, setTime] = useState('');
    const [user, setUser] = useState('');
    
    // Hose Log State
    const [hoseLogEntry, setHoseLogEntry] = useState<Partial<HoseLogEntry>>({});

    // Sample Log State
    const [sampleLogEntry, setSampleLogEntry] = useState<Partial<SampleLogEntry>>({});
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Pressure Check Log State
    const [pressureCheckLogEntry, setPressureCheckLogEntry] = useState<Partial<PressureCheckLogEntry>>({});
    
    // Truck specific fields
    const [loadedWeight, setLoadedWeight] = useState<string>('');
    const [sealNumber, setSealNumber] = useState<string>('');
    const [sealPhoto, setSealPhoto] = useState<string | null>(null);
    
    // Camera states
    const [isTakingPhoto, setIsTakingPhoto] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const photoCanvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isHoseStep = sofItem?.event.includes('HOSE CONNECTED') && transfer;
    const isSampleStep = sofItem?.event.includes('SLOPS SAMPLE PASSED') && transfer;
    const isPressureCheckStep = sofItem?.event.includes('HOSE LEAK CHECK') && transfer;
    const isWeighingStep = sofItem?.event.includes('Post-Load Weighing') && transfer;
    const isSealStep = sofItem?.event.includes('Seal Applied') && transfer;
    const isBolStep = sofItem?.event.includes('BOL Printed') && transfer;
    
    useEffect(() => {
        if (isOpen && sofItem) {
            setTime(sofItem.time || simulatedTime.toISOString());
            setUser(sofItem.user || currentUser.name);

            if (isHoseStep && sofItem.logId) {
                const existingLog = plan.hoseLog?.find(h => h.id === sofItem.logId);
                setHoseLogEntry(existingLog || {});
            }
            if (isSampleStep && sofItem.logId) {
                const existingLog = plan.sampleLog?.find(s => s.id === sofItem.logId);
                setSampleLogEntry(existingLog || {});
            }
            if (isPressureCheckStep && sofItem.logId) {
                const existingLog = plan.pressureCheckLog?.find(p => p.id === sofItem.logId);
                setPressureCheckLogEntry(existingLog || {});
            }
            
            if (transfer) {
                if (isWeighingStep) {
                    setLoadedWeight(transfer.loadedWeight?.toString() || '');
                }
                if (isSealStep) {
                    setSealNumber(transfer.sealNumber || '');
                    setSealPhoto(transfer.sealPhoto || null);
                }
            }
        }
        setIsTakingPhoto(false);
    }, [isOpen, sofItem, plan, transfer, isHoseStep, isSampleStep, isPressureCheckStep, isWeighingStep, isSealStep, simulatedTime, currentUser.name]);

    // Camera Logic
    useEffect(() => {
        let stream: MediaStream | null = null;
        const startCamera = async () => {
            if (isTakingPhoto) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    alert("Could not access camera.");
                    setIsTakingPhoto(false);
                }
            }
        };
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isTakingPhoto]);

    const handleCapture = () => {
        if (videoRef.current && photoCanvasRef.current) {
            const video = videoRef.current;
            const canvas = photoCanvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setSealPhoto(dataUrl);
            }
        }
        setIsTakingPhoto(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSealPhoto(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        const newPlan = JSON.parse(JSON.stringify(plan));
        let auditDetails: string[] = [];

        let targetSofArray: SOFItem[] | undefined;
        let targetTransfer: Transfer | undefined;

        if (transfer) {
            for (const line of newPlan.transferPlan) {
                const transferIndex = line.transfers.findIndex((t: Transfer) => t.id === transfer.id);
                if (transferIndex > -1) {
                    targetTransfer = line.transfers[transferIndex];
                    targetSofArray = targetTransfer.sof;
                    break;
                }
            }
        } else {
            targetSofArray = newPlan.sof;
        }

        const sofIndex = (targetSofArray || []).findIndex((s: SOFItem) => s.event === sofItem?.event && s.loop === sofItem?.loop);
        
        if (targetSofArray && sofIndex > -1) {
            const originalSof = targetSofArray[sofIndex];
            const isCompleting = originalSof.status === 'pending';
            
            if (originalSof.time !== time) auditDetails.push(`time updated to ${new Date(time).toLocaleString()}`);
            if (originalSof.user !== user) auditDetails.push(`user updated to ${user}`);

            targetSofArray[sofIndex].time = time;
            targetSofArray[sofIndex].user = user;
            targetSofArray[sofIndex].status = 'complete'; // Ensure it is marked complete

            if (isHoseStep && sofItem?.logId) {
                const logIndex = (newPlan.hoseLog || []).findIndex((h: HoseLogEntry) => h.id === sofItem.logId);
                if (logIndex > -1) {
                    newPlan.hoseLog[logIndex] = { ...newPlan.hoseLog[logIndex], ...hoseLogEntry };
                }
            }
            if (isSampleStep && sofItem?.logId) {
                const logIndex = (newPlan.sampleLog || []).findIndex((s: SampleLogEntry) => s.id === sofItem.logId);
                if (logIndex > -1) {
                    newPlan.sampleLog[logIndex] = { ...newPlan.sampleLog[logIndex], ...sampleLogEntry };
                }
            }
            if (isPressureCheckStep && sofItem?.logId) {
                const logIndex = (newPlan.pressureCheckLog || []).findIndex((p: PressureCheckLogEntry) => p.id === sofItem.logId);
                if (logIndex > -1) {
                    newPlan.pressureCheckLog[logIndex] = { ...newPlan.pressureCheckLog[logIndex], ...pressureCheckLogEntry };
                }
            }
            
            if (targetTransfer) {
                if (isWeighingStep) {
                    targetTransfer.loadedWeight = parseFloat(loadedWeight) || 0;
                    auditDetails.push(`loaded weight set to ${targetTransfer.loadedWeight}`);
                }
                if (isSealStep) {
                    targetTransfer.sealNumber = sealNumber;
                    targetTransfer.sealPhoto = sealPhoto || undefined;
                    auditDetails.push(`seal number set to ${sealNumber}`);
                }
                if (isBolStep) {
                    if (!targetTransfer.bolData) {
                        targetTransfer.bolData = {
                            id: `BOL-${plan.transportId}-${Date.now().toString().slice(-4)}`,
                            generatedAt: simulatedTime.toISOString()
                        };
                        auditDetails.push(`BOL generated: ${targetTransfer.bolData.id}`);
                    }
                }
            }

            if (isCompleting) {
                const completionLog: ActivityLogItem = {
                    time: simulatedTime.toISOString(),
                    user: currentUser.name,
                    action: 'SOF_UPDATE',
                    details: `${sofItem?.event} marked complete. ${auditDetails.join(', ')}`
                };
                if (!newPlan.activityHistory) newPlan.activityHistory = [];
                newPlan.activityHistory.push(completionLog);
                
                if (targetTransfer) {
                    if (!targetTransfer.transferLog) targetTransfer.transferLog = [];
                    targetTransfer.transferLog.push(completionLog);
                }
            } else if (auditDetails.length > 0) {
                 const logItem: ActivityLogItem = {
                     time: simulatedTime.toISOString(),
                     user: currentUser.name,
                     action: 'SOF_EDIT',
                     details: `Data for '${sofItem?.event}' was updated. Changes: ${auditDetails.join(', ')}.`
                 };
                 if (!newPlan.activityHistory) newPlan.activityHistory = [];
                 newPlan.activityHistory.push(logItem);
            }

            onSave(newPlan);
            onClose();
        } else {
            console.error("Could not find SOF item to update.");
            onClose();
        }
    };
    
    // --- Signature Canvas Logic ---
    useEffect(() => {
        if (isOpen && isSampleStep && canvasRef.current) {
            const canvas = canvasRef.current;
            const parent = canvas.parentElement;
            if (!parent) return;

            const setupCanvas = () => {
                const rect = parent.getBoundingClientRect();
                canvas.width = rect.width; canvas.height = 120;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    if (sampleLogEntry.surveyorSignature) {
                        const img = new Image();
                        img.src = sampleLogEntry.surveyorSignature;
                        img.onload = () => ctx.drawImage(img, 0, 0);
                    }
                }
            };
            setupCanvas();
            window.addEventListener('resize', setupCanvas);
            return () => window.removeEventListener('resize', setupCanvas);
        }
    }, [isOpen, isSampleStep, sampleLogEntry.surveyorSignature]);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientX : e.nativeEvent.touches[0].clientX;
        let clientY = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientY : e.nativeEvent.touches[0].clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); const { x, y } = getCoords(e); const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); };
    const draw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); if (!isDrawing) return; const { x, y } = getCoords(e); const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; ctx.lineTo(x, y); ctx.stroke(); };
    const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; ctx.closePath(); setIsDrawing(false);
        const dataUrl = canvasRef.current?.toDataURL('image/png') || '';
        const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height).data.buffer);
        setSampleLogEntry(p => ({ ...p, surveyorSignature: pixelBuffer.some(color => color !== 0) ? dataUrl : '' }));
    };
    const clearCanvas = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return; ctx.clearRect(0, 0, canvas.width, canvas.height); setSampleLogEntry(p => ({ ...p, surveyorSignature: '' })); };
    
    const handlePrintBol = () => {
        alert("Simulating BOL Print...");
    };

    if (!sofItem) return null;
    
    const isWeighingValid = !isWeighingStep || (loadedWeight && parseFloat(loadedWeight) > 0);
    // SEAL PHOTO IS NOW OPTIONAL. Only Seal Number is required.
    const isSealValid = !isSealStep || (sealNumber.trim() !== '');
    
    let title = `Edit SOF Step: ${sofItem.event}`;
    let saveLabel = "Save Changes";
    
    if (sofItem.status === 'complete' && plan.sof?.some(s => s.event === sofItem.event && s.status === 'pending')) {
        // If we are completing a pending step (passed via constructed item)
        title = `Complete Step: ${sofItem.event}`;
        saveLabel = "Confirm & Complete";
    }
    
    if (isBolStep) {
        saveLabel = "Confirm";
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={<>
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary" disabled={!isWeighingValid || !isSealValid}>{saveLabel}</button>
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
                
                {isWeighingStep && (
                    <div className="p-4 border rounded-lg bg-slate-50">
                        <h4 className="font-semibold text-base mb-3">Weighbridge Data</h4>
                        <div>
                            <label>Loaded Weight (kg/T)</label>
                            <input 
                                type="number" 
                                value={loadedWeight} 
                                onChange={e => setLoadedWeight(e.target.value)} 
                                placeholder="Enter net loaded weight..."
                                className="text-lg font-mono"
                                autoFocus
                            />
                            {transfer?.tonnes && parseFloat(loadedWeight) > 0 && (
                                <p className={`text-xs mt-1 ${Math.abs(parseFloat(loadedWeight) - transfer.tonnes) > transfer.tonnes * 0.05 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                    Target: {transfer.tonnes} T | Variance: {(parseFloat(loadedWeight) - transfer.tonnes).toFixed(2)} T
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {isSealStep && (
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                         <h4 className="font-semibold text-base">Security Seal</h4>
                         <div>
                             <label>Seal Number</label>
                             <input type="text" value={sealNumber} onChange={e => setSealNumber(e.target.value)} placeholder="Enter seal number..." autoFocus />
                         </div>
                         <div>
                             <label>Seal Photo <span className="text-gray-500 font-normal text-xs">(Optional)</span></label>
                             {isTakingPhoto ? (
                                <div className="space-y-2">
                                    <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black"></video>
                                    <div className="flex gap-2">
                                        <button onClick={handleCapture} className="btn-primary flex-1">Capture</button>
                                        <button onClick={() => setIsTakingPhoto(false)} className="btn-secondary flex-1">Cancel</button>
                                    </div>
                                </div>
                             ) : sealPhoto ? (
                                 <div className="space-y-2">
                                     <img src={sealPhoto} alt="Seal" className="w-full max-h-60 object-contain rounded-lg border" />
                                     <button onClick={() => setSealPhoto(null)} className="btn-secondary w-full">Retake Photo</button>
                                 </div>
                             ) : (
                                 <div className="flex gap-2">
                                     <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                     <button onClick={() => setIsTakingPhoto(true)} className="btn-primary flex-1"><i className="fas fa-camera mr-2"></i>Take Photo</button>
                                     <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex-1"><i className="fas fa-upload mr-2"></i>Upload</button>
                                 </div>
                             )}
                             <canvas ref={photoCanvasRef} className="hidden"></canvas>
                         </div>
                    </div>
                )}

                {isBolStep && (
                    <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                        <h4 className="font-semibold text-base text-blue-800 mb-3"><i className="fas fa-file-invoice mr-2"></i>Bill of Lading Preview</h4>
                        <div className="bg-white p-3 rounded-md shadow-sm text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Transport ID:</span>
                                <span className="font-mono">{plan.transportId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Product:</span>
                                <span>{transfer?.product}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Weight:</span>
                                <span className="font-bold">{(transfer?.loadedWeight || transfer?.transferredTonnes)?.toLocaleString()} T</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-text-secondary">Seal #:</span>
                                <span>{transfer?.sealNumber || 'N/A'}</span>
                            </div>
                            <div className="pt-3 border-t mt-2 flex justify-between items-center">
                                <span className="text-xs text-text-tertiary">BOL will be generated upon confirmation.</span>
                                <button onClick={handlePrintBol} className="btn-secondary !text-xs !py-1 !px-2">
                                    <i className="fas fa-print mr-1"></i> Print Preview
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {isHoseStep && (
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                        <h4 className="font-semibold text-base">Hose Log Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label>Hose Number</label><input type="text" value={hoseLogEntry.hoseNumber || ''} onChange={e => setHoseLogEntry({...hoseLogEntry, hoseNumber: e.target.value})} /></div>
                            <div><label>Test Date</label><input type="date" value={hoseLogEntry.testDate ? hoseLogEntry.testDate.split('T')[0] : ''} onChange={e => setHoseLogEntry({...hoseLogEntry, testDate: e.target.value})} /></div>
                            <div><label>Pressure Test Passed?</label><select value={hoseLogEntry.pressureTestPassed || ''} onChange={e => setHoseLogEntry({...hoseLogEntry, pressureTestPassed: e.target.value as any})} className="w-full"><option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option></select></div>
                            <div><label>New Gasket Used?</label><select value={hoseLogEntry.newGasketUsed || ''} onChange={e => setHoseLogEntry({...hoseLogEntry, newGasketUsed: e.target.value as any})} className="w-full"><option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option></select></div>
                        </div>
                    </div>
                )}

                {isPressureCheckStep && (
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                        <h4 className="font-semibold text-base">Pressure Check Log Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label>Pressure Reading (kPa)</label>
                                <input type="text" value={pressureCheckLogEntry.pressure || ''} onChange={e => setPressureCheckLogEntry({...pressureCheckLogEntry, pressure: e.target.value})} />
                            </div>
                            <div>
                                <label>Test Result</label>
                                <select value={pressureCheckLogEntry.result || ''} onChange={e => setPressureCheckLogEntry({...pressureCheckLogEntry, result: e.target.value as any})} className="w-full">
                                    <option value="">Select...</option><option value="Pass">Pass</option><option value="Fail">Fail</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {isSampleStep && (
                     <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                        <h4 className="font-semibold text-base">Sample & Surveyor Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label>Samples Passed?</label>
                                <select value={sampleLogEntry.samplesPassed || ''} onChange={e => setSampleLogEntry(p => ({...p, samplesPassed: e.target.value as any}))} className="w-full">
                                    <option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option>
                                </select>
                            </div>
                            <div>
                                <label>Slop Quantity (MT)</label>
                                <input type="number" value={sampleLogEntry.slop || ''} onChange={e => setSampleLogEntry(p => ({...p, slop: e.target.value}))} placeholder="0"/>
                            </div>
                        </div>
                         <div>
                            <div className="flex justify-between items-center mb-1">
                                <label>Surveyor Signature</label>
                                <button type="button" onClick={clearCanvas} className="btn-secondary !text-xs !py-1">Clear</button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                className="border border-slate-300 rounded-lg cursor-crosshair touch-none bg-white w-full"
                                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                            />
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SofDetailsModal;
