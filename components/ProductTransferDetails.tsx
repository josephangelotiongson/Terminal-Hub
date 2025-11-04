import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { SOFItem, SpecialServiceData, Transfer, Operation, DipSheetEntry, ActivityLogItem, ScadaData } from '../types';
import TankLevelIndicator from './TankLevelIndicator';
import { formatInfraName, interpolate } from '../utils/helpers';
import Modal from './Modal';
import SignatureModal from './SignatureModal';
import UndoSofModal from './UndoSofModal';
import HoseLogModal from './HoseLogModal';
import SampleLogModal from './SampleLogModal';
import SofDetailsModal from './SofDetailsModal';

// --- NEW SLIDER COMPONENT ---
const SofSlider: React.FC<{
    status: 'in-progress' | 'complete';
    onComplete: () => void;
    onUndo: () => void;
}> = ({ status, onComplete, onUndo }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const currentTranslateXRef = useRef(0);

    // This handles native MouseEvent and TouchEvent
    const getClientX = (e: MouseEvent | TouchEvent): number => {
        if (e instanceof MouseEvent) {
            return e.clientX;
        }
        if (window.TouchEvent && e instanceof TouchEvent) {
            if (e.touches.length > 0) {
                return e.touches[0].clientX;
            }
            if (e.changedTouches.length > 0) {
                return e.changedTouches[0].clientX;
            }
        }
        return 0;
    };
    
    // These will be attached to window, so they need to handle native events
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
        if (!isDraggingRef.current || !trackRef.current || !thumbRef.current) return;
    
        const currentX = getClientX(e);
        const deltaX = currentX - startXRef.current;
        
        const trackWidth = trackRef.current.offsetWidth;
        const thumbWidth = thumbRef.current.offsetWidth;
        const maxTranslate = trackWidth - thumbWidth;
    
        let newTranslateX: number;
        if (status === 'in-progress') {
            newTranslateX = Math.max(0, Math.min(deltaX, maxTranslate));
        } else { // 'complete'
            newTranslateX = maxTranslate + Math.min(0, Math.max(deltaX, -maxTranslate));
        }
        
        currentTranslateXRef.current = newTranslateX;
        thumbRef.current.style.transform = `translateX(${newTranslateX}px)`;
    };

    const handleDragEnd = (e: MouseEvent | TouchEvent) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        
        // Clean up all global listeners
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);

        if (!thumbRef.current || !trackRef.current) return;

        thumbRef.current.style.transition = ''; // Re-enable transition for snapping back
        
        const trackWidth = trackRef.current.offsetWidth;
        const thumbWidth = thumbRef.current.offsetWidth;
        const maxTranslate = trackWidth - thumbWidth;
        const triggerThreshold = maxTranslate * 0.7;

        if (status === 'in-progress') {
            if (currentTranslateXRef.current > triggerThreshold) {
                onComplete();
                // Let the useEffect handle the final position based on new 'status' prop
            } else {
                thumbRef.current.style.transform = `translateX(0px)`;
            }
        } else { // 'complete'
            if (currentTranslateXRef.current < maxTranslate - triggerThreshold) {
                onUndo();
            } else {
                thumbRef.current.style.transform = `translateX(${maxTranslate}px)`;
            }
        }
    };

    // This handles React's SyntheticEvent
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        // This prevents default scrolling/selection behavior on touch which is crucial for iOS
        if ('touches' in e.nativeEvent) {
             e.preventDefault();
        }
        if (!thumbRef.current) return;
        
        isDraggingRef.current = true;
        startXRef.current = getClientX(e.nativeEvent);
        thumbRef.current.style.transition = 'none'; // Disable transition during drag
        
        if (e.nativeEvent instanceof MouseEvent) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
        } else if (window.TouchEvent && e.nativeEvent instanceof TouchEvent) {
            // Adding global listeners for touch is the key fix for mobile.
            window.addEventListener('touchmove', handleDragMove);
            window.addEventListener('touchend', handleDragEnd);
        }
    };
    
    useEffect(() => {
        if (thumbRef.current && trackRef.current) {
            const maxTranslate = trackRef.current.offsetWidth - thumbRef.current.offsetWidth;
            // This useEffect will correctly set the initial position and also handle the final position after a successful onComplete()
            thumbRef.current.style.transform = status === 'complete' ? `translateX(${maxTranslate}px)` : 'translateX(0px)';
        }
    }, [status]); // Only run when status changes.

    // On unmount, make sure to clean up any lingering listeners if a drag is interrupted
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, []);


    return (
        <div
            className="sof-slider-track"
            ref={trackRef}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
        >
            {status === 'complete' && <i className="fas fa-undo sof-slider-target-icon"></i>}
            <div
                ref={thumbRef}
                className="sof-slider-thumb"
            >
                <i className={`fas ${status === 'in-progress' ? 'fa-arrow-right' : 'fa-check'} sof-slider-icon`}></i>
            </div>
            {status === 'in-progress' && <i className="fas fa-check sof-slider-target-icon"></i>}
        </div>
    );
};

const isPreviousStepComplete = (sofItems: SOFItem[], currentIndex: number): boolean => {
    if (currentIndex === 0) return true;
    const previousItem = sofItems[currentIndex - 1];
    return previousItem?.status === 'complete';
};

const ProductTransferDetails: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading...</div>;

    const { activeOpId, activeLineIndex, activeTransferIndex, currentUser, switchView, editingOp: plan, setEditingOp: setPlan, currentTerminalSettings, scadaData, saveCurrentPlan } = context;

    const transfer = useMemo(() => {
        if (!plan || activeLineIndex === null || activeTransferIndex === null) return null;
        return plan.transferPlan[activeLineIndex]?.transfers[activeTransferIndex];
    }, [plan, activeLineIndex, activeTransferIndex]);

    const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '' });
    const [activeTab, setActiveTab] = useState('sof');
    const [undoModalState, setUndoModalState] = useState<{ isOpen: boolean, item: SOFItem | null }>({ isOpen: false, item: null });
    const [isScadaSidebarCollapsed, setIsScadaSidebarCollapsed] = useState(true);
    const [editingSof, setEditingSof] = useState<SOFItem | null>(null);
    const [optimisticUndoEvent, setOptimisticUndoEvent] = useState<string | null>(null);

    // Modals for SOF step actions
    const [isHoseLogModalOpen, setIsHoseLogModalOpen] = useState(false);
    const [isSampleLogModalOpen, setIsSampleLogModalOpen] = useState(false);
    
    const [dipSheetEntry, setDipSheetEntry] = useState<{ id: string, dipReading: string, initials: string }>({ id: '', dipReading: '', initials: '' });

    const ScadaDataSidebar: React.FC<{ isCollapsed: boolean; onToggle: () => void; }> = ({ isCollapsed, onToggle }) => {
        const activeLines = Object.entries(scadaData).filter(([_, data]) => (data as ScadaData[string]).pumpStatus === 'ON');
        return (
            <div className={`fixed bottom-6 right-6 z-[80] transition-all duration-300 ${isCollapsed ? 'w-16 h-16' : 'w-72'}`}>
                <div className="card shadow-2xl overflow-hidden">
                    <div className="p-2 bg-slate-800 text-white flex justify-between items-center cursor-pointer" onClick={onToggle}>
                        <h4 className="font-bold text-sm">
                            {isCollapsed ? <i className="fas fa-tachometer-alt p-2"></i> : 'Live SCADA Data'}
                        </h4>
                        <i className={`fas ${isCollapsed ? 'fa-expand-alt' : 'fa-compress-alt'}`}></i>
                    </div>
                    {!isCollapsed && (
                        <div className="p-3 bg-white max-h-80 overflow-y-auto">
                            {activeLines.length > 0 ? activeLines.map(([lineId, data]) => {
                                const scadaPoint = data as ScadaData[string];
                                return (
                                <div key={lineId} className="mb-3 p-2 bg-slate-50 rounded">
                                    <p className="font-bold text-sm">{formatInfraName(lineId)}</p>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        <p>Flow: <strong>{scadaPoint.flowRate.toFixed(1)} m³/hr</strong></p>
                                        <p>Pump: <strong className="text-green-600">{scadaPoint.pumpStatus}</strong></p>
                                        <p>Temp: <strong>{scadaPoint.temperature.toFixed(1)} °C</strong></p>
                                        <p>Pressure: <strong>{scadaPoint.pressure.toFixed(2)} kPa</strong></p>
                                    </div>
                                </div>
                            )}) : <p className="text-sm text-center text-slate-500 italic p-4">No lines are actively pumping.</p>}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!plan || !transfer || activeLineIndex === null || activeTransferIndex === null) {
        return <div className="text-center p-8"><h2 className="text-xl font-semibold">Transfer Not Found</h2><p>Please go back and select a transfer to view its details.</p></div>;
    }
    
    const completeSofStep = (eventName: string, loop: number) => {
        if (!plan) return;
        
        const sofItem: SOFItem = { event: eventName, status: 'complete', time: new Date().toISOString(), user: currentUser.name, loop };
        const logItem: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${eventName} marked complete for ${transfer.product}.` };
        
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const t = newOp.transferPlan[activeLineIndex!].transfers[activeTransferIndex!];
        if (!t) return;
        
        const sofIndex = (t.sof || []).findIndex(item => item.event === eventName && item.loop === loop);
        if (sofIndex > -1) {
            t.sof![sofIndex] = sofItem;
        } else {
            t.sof = [...(t.sof || []), sofItem];
        }
        newOp.activityHistory.push(logItem);
        
        setPlan(newOp);
        saveCurrentPlan(newOp);
    };

    const handleSofClick = (eventName: string, loop: number) => {
         // --- PRE-STEP CHECKS (Popups) ---
        if (eventName.includes('HOSE CONNECTED')) {
            const hoseLog = plan.hoseLog || [];
            const productHoses = hoseLog.filter(h => h.product === transfer.product);
            if (productHoses.length === 0) {
                setIsHoseLogModalOpen(true);
                return; // Stop processing until modal is handled
            }
        }
        
        completeSofStep(eventName, loop);
    };
    
    const handleHoseLogSave = (logEntry: any) => {
        if (!plan) return;
        
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        if (!newOp.hoseLog) newOp.hoseLog = [];
        newOp.hoseLog.push(logEntry);
        
        // Find and complete the step in the same update
        const t = newOp.transferPlan[activeLineIndex!].transfers[activeTransferIndex!];
        const step = t.sof?.find(s => s.event.includes('HOSE CONNECTED') && s.status !== 'complete');
        if (step) {
            const sofIndex = t.sof!.findIndex(s => s.event === step.event && s.loop === step.loop);
            if(sofIndex > -1) {
                 t.sof![sofIndex] = { event: step.event, status: 'complete', time: new Date().toISOString(), user: currentUser.name, loop: step.loop };
                 const logItem: ActivityLogItem = { time: t.sof![sofIndex].time, user: currentUser.name, action: 'SOF_UPDATE', details: `${step.event} marked complete for ${transfer.product}.` };
                 newOp.activityHistory.push(logItem);
            }
        }
        
        setPlan(newOp);
        saveCurrentPlan(newOp);

        setIsHoseLogModalOpen(false);
    };

    const handleSampleLogSave = (logData: Partial<Transfer>) => {
        if (!plan) return;

        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const t = newOp.transferPlan[activeLineIndex!].transfers[activeTransferIndex!];
        if (t) {
            t.samplesPassed = logData.samplesPassed;
            t.slop = logData.slop;
            t.surveyorSignature = logData.surveyorSignature;
        }

        const step = t.sof?.find(s => s.event.includes('SLOPS SAMPLE PASSED') && s.status !== 'complete');
        if (step) {
            const sofIndex = t.sof!.findIndex(s => s.event === step.event && s.loop === step.loop);
            if(sofIndex > -1) {
                t.sof![sofIndex] = { event: step.event, status: 'complete', time: new Date().toISOString(), user: currentUser.name, loop: step.loop };
                const logItem: ActivityLogItem = { time: t.sof![sofIndex].time, user: currentUser.name, action: 'SOF_UPDATE', details: `${step.event} marked complete for ${transfer.product}.` };
                newOp.activityHistory.push(logItem);
            }
        }
        
        setPlan(newOp);
        saveCurrentPlan(newOp);
        
        setIsSampleLogModalOpen(false);
    };
    
    const handleCloseUndoModal = () => {
        setOptimisticUndoEvent(null);
        setUndoModalState({ isOpen: false, item: null });
    };

    const handleUndo = (reason: string) => {
        if (!undoModalState.item || !plan) return;
        
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const transferToUpdate = newOp.transferPlan[activeLineIndex!].transfers[activeTransferIndex!];
        
        const itemToUndo = undoModalState.item!;
        const sofArray = transferToUpdate.sof || [];
        
        const loopItems = sofArray.filter(s => s.loop === itemToUndo.loop);
        const itemIndexInLoop = loopItems.findIndex(s => s.event === itemToUndo.event);
        if (itemIndexInLoop === -1) return;

        const eventsToRevert = new Set(loopItems.slice(itemIndexInLoop).map(s => s.event));
        transferToUpdate.sof = sofArray.map(s => (s.loop === itemToUndo.loop && eventsToRevert.has(s.event)) ? { ...s, status: 'pending', time: '', user: '' } : s);

        const logItem: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action: 'SOF_UPDATE', details: `Reverted step "${itemToUndo.event}" for ${transfer.product}. Reason: ${reason}` };
        newOp.activityHistory.push(logItem);
        
        setPlan(newOp);
        saveCurrentPlan(newOp);

        handleCloseUndoModal();
    };

    const handleDisabledClick = (item: SOFItem, index: number, items: SOFItem[]) => {
        if (!isPreviousStepComplete(items, index)) {
            setInfoModal({ isOpen: true, title: 'Step Unavailable', message: `Please complete the previous step first: "${items[index - 1].event}"` });
        } else {
            setInfoModal({ isOpen: true, title: 'Step Unavailable', message: `This step is not yet available.` });
        }
    };
    
    const getActiveSofEvent = (sofItems: SOFItem[]): string | null => {
        for (let i = 0; i < sofItems.length; i++) {
            if (sofItems[i].status === 'pending') {
                if (isPreviousStepComplete(sofItems, i)) {
                    return sofItems[i].event;
                }
                return null; 
            }
        }
        return null; 
    };
    
    const activeSofEvent = getActiveSofEvent(transfer.sof || []);

    const loops: { [loopNum: number]: SOFItem[] } = {};
    (transfer.sof || []).forEach(item => {
        if (!loops[item.loop]) loops[item.loop] = [];
        loops[item.loop].push(item);
    });
    const sofLoops = Object.entries(loops).map(([loopNum, items]) => ({ loopNum: parseInt(loopNum), items })).sort((a, b) => a.loopNum - b.loopNum);

    const transferred = transfer.transferredTonnes || 0;
    const total = transfer.tonnes || 0;
    const tankName = transfer.direction.endsWith(' to Tank') ? transfer.to : transfer.from;
    const transferDirection = transfer.direction.endsWith(' to Tank') ? 'in' : 'out';
    
    const handleSaveSofDetails = (opToSave: Operation) => {
        setPlan(opToSave);
    };

    return (
        <>
            {editingSof && transfer && (
                <SofDetailsModal
                    isOpen={!!editingSof}
                    onClose={() => setEditingSof(null)}
                    onSave={handleSaveSofDetails}
                    sofItem={editingSof}
                    plan={plan}
                    transfer={transfer}
                />
            )}
            <Modal isOpen={infoModal.isOpen} onClose={() => setInfoModal({isOpen: false, title: '', message: ''})} title={infoModal.title} footer={<button onClick={() => setInfoModal({isOpen: false, title: '', message: ''})} className="btn-primary">OK</button>}><p>{infoModal.message}</p></Modal>
            <UndoSofModal isOpen={undoModalState.isOpen} onClose={handleCloseUndoModal} onConfirm={handleUndo} />
            {plan.modality === 'vessel' && <>
                <HoseLogModal isOpen={isHoseLogModalOpen} onClose={() => setIsHoseLogModalOpen(false)} onSave={handleHoseLogSave} product={transfer.product} />
                <SampleLogModal isOpen={isSampleLogModalOpen} onClose={() => setIsSampleLogModalOpen(false)} onSave={handleSampleLogSave} transfer={transfer} />
            </>}
            <div className="relative">
                {plan.status === 'active' && <ScadaDataSidebar isCollapsed={isScadaSidebarCollapsed} onToggle={() => setIsScadaSidebarCollapsed(p => !p)} />}
                <div className="p-4 sm:p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-brand-dark">{transfer.product}</h2>
                            <p className="text-lg text-text-secondary">{transfer.customer}</p>
                        </div>
                         <button onClick={() => switchView('operation-details', plan.id)} className="btn-secondary">
                            <i className="fas fa-arrow-left mr-2"></i>Back to Overview
                        </button>
                    </div>

                    <div className="card p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                            <div><p className="font-semibold text-text-secondary">Infrastructure</p><p className="text-xl font-bold">{formatInfraName(plan.transferPlan[activeLineIndex].infrastructureId)}</p></div>
                            <div><p className="font-semibold text-text-secondary">Direction</p><p className="text-xl font-bold">{transfer.direction}</p></div>
                            <div><p className="font-semibold text-text-secondary">Planned Tonnes</p><p className="text-xl font-bold">{total.toLocaleString()}</p></div>
                            <div className="bg-blue-50 p-2 rounded-lg"><p className="font-bold text-blue-700">Transferred</p><p className="text-2xl font-bold text-blue-800">{transferred.toFixed(2)} T</p></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card p-6">
                            <h3 className="text-xl font-bold text-brand-dark mb-4">Statement of Facts</h3>
                            <div className="space-y-6">
                                {sofLoops.map(({ loopNum, items }) => (
                                    <div key={loopNum}>
                                        {sofLoops.length > 1 && <h5 className="font-bold text-sm mb-2 uppercase text-text-secondary">{loopNum > 1 ? `Rework Loop #${loopNum}` : 'Initial Loop'}</h5>}
                                        <div className="grid grid-cols-1 gap-2">
                                            {items.map((sofItem, index) => {
                                                let status = sofItem.status;
                                                if (optimisticUndoEvent === sofItem.event && status === 'complete') {
                                                    status = 'in-progress';
                                                } else if (status === 'pending' && sofItem.event === activeSofEvent) {
                                                    status = 'in-progress';
                                                }
                                                
                                                let hasIncompleteData = false;
                                                let incompleteDataMessage = '';

                                                if (sofItem.status === 'complete') {
                                                    if (sofItem.event.includes('HOSE CONNECTED') && !plan.hoseLog?.some(h => h.product === transfer.product)) {
                                                        hasIncompleteData = true;
                                                        incompleteDataMessage = 'Hose log is missing for this connection.';
                                                    }
                                                    if (sofItem.event.includes('SLOPS SAMPLE PASSED') && (transfer.samplesPassed !== 'Y' || !transfer.surveyorSignature)) {
                                                        hasIncompleteData = true;
                                                        incompleteDataMessage = 'Sample log is incomplete or samples not marked as passed.';
                                                    }
                                                }
                                                
                                                return (
                                                     <div 
                                                        key={sofItem.event} 
                                                        className={`sof-item ${status}`}
                                                        onClick={() => {
                                                            if (status === 'pending') handleDisabledClick(sofItem, index, items); 
                                                        }}
                                                    >
                                                         {status === 'pending' ? (
                                                            <div className={`sof-icon`}><i className={`fas fa-clock`}></i></div>
                                                        ) : (
                                                            <SofSlider
                                                                status={status as 'in-progress' | 'complete'}
                                                                onComplete={() => handleSofClick(sofItem.event, sofItem.loop)}
                                                                onUndo={() => { setOptimisticUndoEvent(sofItem.event); setUndoModalState({isOpen: true, item: sofItem}); }}
                                                            />
                                                        )}
                                                        
                                                        <div className="flex-1">
                                                            <h5 className="font-semibold text-base flex items-center gap-2">
                                                                {sofItem.event}
                                                                {hasIncompleteData && <i className="fas fa-exclamation-triangle text-yellow-500" title={incompleteDataMessage}></i>}
                                                            </h5>
                                                            <p className="text-sm text-text-tertiary">{sofItem.status === 'complete' ? `${new Date(sofItem.time).toLocaleTimeString()} | ${sofItem.user}` : 'Pending'}</p>
                                                        </div>
                                                        {sofItem.status === 'complete' && (
                                                            <button onClick={() => setEditingSof(sofItem)} className="sof-edit-btn">
                                                                <i className="fas fa-pen mr-2"></i> Edit
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-6">
                            <TankLevelIndicator tankName={tankName} transferVolume={total} transferDirection={transferDirection} />
                            
                            <div className="card p-6">
                                 <h3 className="text-xl font-bold text-brand-dark mb-4">Special Services</h3>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {transfer.specialServices.length > 0 ? transfer.specialServices.map(s => (
                                        <span key={s.name} className="text-sm font-semibold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full">{s.name}</span>
                                    )) : <span className="text-sm italic text-text-tertiary">None</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProductTransferDetails;