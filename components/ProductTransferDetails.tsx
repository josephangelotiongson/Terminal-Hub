
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { SOFItem, SpecialServiceData, Transfer, Operation, DipSheetEntry, ActivityLogItem, ScadaData, HoseLogEntry, SampleLogEntry, PressureCheckLogEntry } from '../types';
import { formatInfraName, interpolate, canPerformSofAction } from '../utils/helpers';
import Modal from './Modal';
import SignatureModal from './SignatureModal';
import UndoSofModal from './UndoSofModal';
import HoseLogModal from './HoseLogModal';
import SampleLogModal from './SampleLogModal';
import SofDetailsModal from './SofDetailsModal';
import PressureCheckModal from './PressureCheckModal';
import ServiceSlider from './ServiceSlider';

// --- ROBUST SLIDER COMPONENT ---
const SofSlider: React.FC<{
    status: 'in-progress' | 'complete';
    onComplete: () => void;
    onUndo: () => void;
}> = ({ status, onComplete, onUndo }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!thumbRef.current || !trackRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        thumbRef.current.setPointerCapture(e.pointerId);
        thumbRef.current.style.transition = 'none';
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !trackRef.current || !thumbRef.current) return;
        e.preventDefault();

        const trackRect = trackRef.current.getBoundingClientRect();
        const thumbWidth = thumbRef.current.offsetWidth;
        const maxTranslate = trackRect.width - thumbWidth;
        
        let newX = e.clientX - trackRect.left - (thumbWidth / 2);
        newX = Math.max(0, Math.min(newX, maxTranslate));

        thumbRef.current.style.transform = `translateX(${newX}px)`;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging || !trackRef.current || !thumbRef.current) return;
        
        setIsDragging(false);
        thumbRef.current.releasePointerCapture(e.pointerId);
        thumbRef.current.style.transition = 'transform 0.2s ease-out';

        const trackRect = trackRef.current.getBoundingClientRect();
        const thumbWidth = thumbRef.current.offsetWidth;
        const maxTranslate = trackRect.width - thumbWidth;
        
        let currentX = e.clientX - trackRect.left - (thumbWidth / 2);
        currentX = Math.max(0, Math.min(currentX, maxTranslate));

        const threshold = maxTranslate * 0.7;

        if (status === 'in-progress') {
            if (currentX > threshold) {
                onComplete();
            } else {
                thumbRef.current.style.transform = 'translateX(0px)';
            }
        } else {
            if (currentX < maxTranslate - threshold) {
                onUndo();
            } else {
                thumbRef.current.style.transform = `translateX(${maxTranslate}px)`;
            }
        }
    };

    useEffect(() => {
        if (thumbRef.current && trackRef.current) {
            const maxTranslate = trackRef.current.offsetWidth - thumbRef.current.offsetWidth;
            thumbRef.current.style.transform = status === 'complete' ? `translateX(${maxTranslate}px)` : 'translateX(0px)';
        }
    }, [status]);

    return (
        <div
            className="sof-slider-track touch-none"
            ref={trackRef}
        >
            {status === 'complete' && <i className="fas fa-undo sof-slider-target-icon"></i>}
            <div
                ref={thumbRef}
                className="sof-slider-thumb cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <i className={`fas ${status === 'in-progress' ? 'fa-arrow-right' : 'fa-check'} sof-slider-icon`}></i>
            </div>
            {status === 'in-progress' && <i className="fas fa-check sof-slider-target-icon"></i>}
        </div>
    );
};

const SofSection: React.FC<{
    sofItems: SOFItem[];
    onSofClick: (eventName: string, loop: number) => void;
    activeStepEvent: string | null;
    onDisabledClick: (item: SOFItem, index: number, items: SOFItem[]) => void;
    onUndoClick: (item: SOFItem) => void;
    onEditClick: (item: SOFItem) => void;
    optimisticUndoEvent: string | null;
    pendingCompletionEvent: string | null;
    setInfoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; title: string; message: string; }>>;
}> = ({ sofItems, onSofClick, activeStepEvent, onDisabledClick, onUndoClick, onEditClick, optimisticUndoEvent, pendingCompletionEvent, setInfoModal }) => {
    const { currentUser, editingOp: plan } = useContext(AppContext)!;
    
    return (
        <div className="grid grid-cols-1 gap-1">
            {sofItems.map((sofItem, index) => {
                let status = sofItem.status;
                if (optimisticUndoEvent === sofItem.event && status === 'complete') {
                    status = 'in-progress';
                } else if (status === 'pending' && sofItem.event === activeStepEvent) {
                    status = 'in-progress';
                } else if (pendingCompletionEvent === sofItem.event) {
                    status = 'complete'; // Visually complete while pending user input in modal
                }

                const hasPermission = canPerformSofAction(currentUser, plan!.modality, sofItem.event);

                const isSkipped = status === 'skipped';
                const isPendingOrLocked = status === 'pending' || (status !== 'complete' && !hasPermission);

                return (
                    <div 
                        key={sofItem.event} 
                        className={`sof-item ${status}`}
                        onClick={() => {
                            if (status === 'pending') {
                                onDisabledClick(sofItem, index, sofItems); 
                            } else if (status !== 'complete' && !hasPermission) {
                                setInfoModal({isOpen: true, title: "Permission Denied", message: "Your role does not have permission to perform this action."});
                            }
                        }}
                    >
                        {isSkipped ? (
                            <div className="sof-icon"><i className="fas fa-forward"></i></div>
                        ) : isPendingOrLocked ? (
                            <div className={`sof-icon`} title={!hasPermission ? "Permission Denied" : ""}>
                                <i className={`fas ${!hasPermission && status !== 'pending' ? 'fa-lock' : 'fa-clock'}`}></i>
                            </div>
                        ) : (
                            <SofSlider
                                status={status as 'in-progress' | 'complete'}
                                onComplete={() => onSofClick(sofItem.event, sofItem.loop)}
                                onUndo={() => onUndoClick(sofItem)}
                            />
                        )}
                        
                        <div className="flex-1">
                            <h5 className="font-semibold text-sm">{sofItem.event}</h5>
                            <p className="text-xs text-text-tertiary">
                                {isSkipped 
                                    ? 'Skipped (Rework)' 
                                    : sofItem.status === 'complete' 
                                        ? `${new Date(sofItem.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | ${sofItem.user}` 
                                        : 'Pending'}
                            </p>
                        </div>
                        {sofItem.status === 'complete' && (
                            <button onClick={(e) => { e.stopPropagation(); onEditClick(sofItem); }} className="sof-edit-btn">
                                <i className="fas fa-pen mr-2"></i> Edit
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const isPreviousStepComplete = (sofItems: SOFItem[], currentIndex: number): boolean => {
    if (currentIndex === 0) return true;
    const currentItem = sofItems[currentIndex];
    const previousItem = sofItems[currentIndex - 1];

    if (currentItem.loop > previousItem.loop) {
        return true;
    }

    return previousItem?.status === 'complete';
};

interface ProductTransferDetailsProps {
    lineIndex?: number;
    transferIndex?: number;
    setActiveTab?: (tab: 'sof' | 'lineCleaning' | 'services' | 'shippingLog' | 'documents' | 'auditLog' | 'arrivalChecklist') => void;
    activeTab?: 'sof' | 'lineCleaning' | 'services' | 'shippingLog' | 'documents' | 'auditLog' | 'arrivalChecklist';
}

const CompactTankIndicator: React.FC<{ tankName: string; transferVolume: number; transferDirection: 'in' | 'out' }> = ({ tankName, transferVolume, transferDirection }) => {
    const { tanks, switchView } = useContext(AppContext)!;
    const tankData = tanks?.[tankName];

    if (!tankData) return null;

    const { capacity, current } = tankData;
    const safeFillCapacity = capacity * 0.98;
    const finalVolume = transferDirection === 'in' ? current + transferVolume : current - transferVolume;
    const isOverfill = finalVolume > safeFillCapacity;
    const isNegative = finalVolume < 0;

    const toPercent = (val: number) => (capacity > 0 ? (val / capacity) * 100 : 0);

    const currentPct = toPercent(current);
    const transferPct = toPercent(transferVolume);

    return (
        <div className={`p-2 border rounded-lg flex items-center gap-3 text-xs ${isOverfill || isNegative ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <button onClick={() => switchView('tank-status-details', null, null, null, undefined, tankName)} className="font-bold text-slate-700 hover:text-brand-primary hover:underline">Tank: {tankName}</button>
            <div className="font-mono text-slate-500 w-20 text-right">
                {current.toLocaleString(undefined, { maximumFractionDigits: 0 })} T
            </div>
            <div className="flex-grow h-3 bg-slate-200 rounded-full relative overflow-hidden" title={`Current: ${currentPct.toFixed(1)}% | Transfer: ${transferPct.toFixed(1)}%`}>
                {/* Current Volume */}
                <div className="absolute top-0 bottom-0 h-full bg-slate-400" style={{ width: `${currentPct}%` }} />
                {/* Transfer Volume */}
                {transferDirection === 'in' ? (
                    <div className={`absolute top-0 bottom-0 h-full ${isOverfill ? 'bg-red-500' : 'bg-green-500'}`} style={{ left: `${currentPct}%`, width: `${transferPct}%` }} />
                ) : (
                    <div className="absolute top-0 bottom-0 h-full" style={{ background: 'repeating-linear-gradient(-45deg,#cbd5e1,#cbd5e1 4px,#e2e8f0 4px,#e2e8f0 8px)', left: `${toPercent(finalVolume)}%`, width: `${transferPct}%` }} />
                )}
                 {/* Safe Fill Line */}
                <div className="absolute top-0 h-full border-r-2 border-dashed border-red-500" style={{ left: '98%' }} title={`Safe Fill: ${safeFillCapacity.toLocaleString()} T`}></div>
            </div>
            <div className="font-mono text-slate-500 w-20 text-left">
                &rarr; {finalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} T
            </div>
            {(isOverfill || isNegative) && (
                 <div className="text-xs font-bold text-red-600 animate-pulse flex-shrink-0">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    {isOverfill ? 'OVERFILL' : 'NEGATIVE'}
                </div>
            )}
        </div>
    );
};

const TransferProgressBar: React.FC<{
    operation: Operation;
    transfer: Transfer;
}> = ({ operation, transfer }) => {
    const { simulatedTime } = useContext(AppContext)!;

    const {
        progressPct,
        pumpRate,
        etc,
        plannedCompletionMarkerPct,
        isOvertime
    } = useMemo(() => {
        const sof = transfer.sof || [];
        const maxLoop = Math.max(1, ...sof.map(s => s.loop));
        const currentLoopSof = sof.filter(s => s.loop === maxLoop);
        
        const pumpingStartedEvent = currentLoopSof.find(s => s.event.includes('Pumping Started') && s.status === 'complete');
        if (!pumpingStartedEvent) {
            return { progressPct: 0, pumpRate: 0, etc: 'N/A', plannedCompletionMarkerPct: null, isOvertime: false };
        }

        const startTime = new Date(pumpingStartedEvent.time).getTime();
        const now = simulatedTime.getTime();
        const elapsedHours = (now - startTime) / (1000 * 60 * 60);

        if (elapsedHours <= 0) {
            return { progressPct: 0, pumpRate: 0, etc: 'N/A', plannedCompletionMarkerPct: null, isOvertime: false };
        }
        
        const transferred = transfer.transferredTonnes || 0;
        const total = transfer.tonnes || 1;
        
        const progress = Math.min(100, (transferred / total) * 100);
        const rate = transferred / elapsedHours;
        
        const remainingTonnes = total - transferred;
        const etcHours = remainingTonnes > 0 && rate > 0 ? remainingTonnes / rate : 0;
        
        const etcMinutes = Math.round(etcHours * 60);
        const etcString = etcMinutes > 0 ? `${etcMinutes} min` : '< 1 min';
        
        const plannedDurationHours = operation.durationHours || 1;
        const projectedTotalHours = elapsedHours + etcHours;
        
        const markerPct = (plannedDurationHours / projectedTotalHours) * 100;
        
        const overTime = projectedTotalHours > plannedDurationHours;

        return {
            progressPct: progress,
            pumpRate: rate,
            etc: etcString,
            plannedCompletionMarkerPct: markerPct > 100 ? null : markerPct, // Don't show if already past planned time
            isOvertime: overTime,
        };
    }, [transfer, operation.durationHours, simulatedTime]);

    return (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                    <p className="font-semibold text-text-secondary">Pump Rate</p>
                    <p className="font-bold text-lg text-brand-dark">{pumpRate.toFixed(0)} T/hr</p>
                </div>
                <div>
                    <p className="font-semibold text-text-secondary">Progress</p>
                    <p className="font-bold text-lg text-brand-dark">{progressPct.toFixed(1)}%</p>
                </div>
                <div>
                    <p className="font-semibold text-text-secondary">Est. Time Remaining</p>
                    <p className={`font-bold text-lg ${isOvertime ? 'text-red-600 animate-pulse' : 'text-brand-dark'}`}>{etc}</p>
                </div>
            </div>
            <div className="relative w-full h-3 bg-slate-200 rounded-full mt-3">
                <div className="h-full bg-brand-primary rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
                {plannedCompletionMarkerPct !== null && (
                    <div 
                        className="absolute top-0 h-full w-0.5 bg-slate-500 border-l border-r border-dashed border-white" 
                        style={{ left: `${plannedCompletionMarkerPct}%` }}
                        title={`Planned completion time (${(operation.durationHours || 0).toFixed(2)} hrs)`}
                    ></div>
                )}
            </div>
        </div>
    );
};


const ProductTransferDetails: React.FC<ProductTransferDetailsProps> = ({ lineIndex: lineIndexProp, transferIndex: transferIndexProp, setActiveTab, activeTab = 'sof' }) => {
    const context = useContext(AppContext);
    
    // Safe defaults
    const activeLineIndex = context?.activeLineIndex;
    const activeTransferIndex = context?.activeTransferIndex;
    const currentUser = context?.currentUser || { name: 'Unknown', role: 'Operator' };
    const plan = context?.editingOp || null;
    const setPlan = context?.setEditingOp || (() => {});
    const currentTerminalSettings = context?.currentTerminalSettings || { infrastructureModalityMapping: {} };
    const settings = context?.settings || { modalityServices: {} };
    const scadaData = context?.scadaData || {};
    const saveCurrentPlan = context?.saveCurrentPlan || (() => {});
    const directTruckToBay = context?.directTruckToBay || (() => {});
    const simulatedTime = context?.simulatedTime || new Date();

    const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '' });
    const [undoModalState, setUndoModalState] = useState<{ isOpen: boolean; item: SOFItem | null, type: 'commodity' | 'cleaning' }>({ isOpen: false, item: null, type: 'commodity' });
    const [editingSof, setEditingSof] = useState<SOFItem | null>(null);
    const [optimisticUndoEvent, setOptimisticUndoEvent] = useState<string | null>(null);
    const [pendingCompletionEvent, setPendingCompletionEvent] = useState<string | null>(null);

    // Modals for SOF step actions
    const [isHoseLogModalOpen, setIsHoseLogModalOpen] = useState(false);
    const [isSampleLogModalOpen, setIsSampleLogModalOpen] = useState(false);
    const [isPressureCheckModalOpen, setIsPressureCheckModalOpen] = useState(false);

    const lineIndex = lineIndexProp ?? activeLineIndex;
    const transferIndex = transferIndexProp ?? activeTransferIndex;

    const transfer = useMemo(() => {
        if (!plan || lineIndex === null || transferIndex === null) return null;
        return plan.transferPlan[lineIndex]?.transfers[transferIndex];
    }, [plan, lineIndex, transferIndex]);

    const isPumping = useMemo(() => {
        if (!plan || (plan.modality !== 'truck' && plan.modality !== 'rail')) return false;

        const transfer = plan.transferPlan?.[lineIndex!]?.transfers?.[transferIndex!];
        if (!transfer?.sof) return false;

        const maxLoop = Math.max(1, ...transfer.sof.map(s => s.loop));
        const currentLoopSof = transfer.sof.filter(s => s.loop === maxLoop);

        const pumpingStarted = currentLoopSof.some(s => s.event.includes('Pumping Started') && s.status === 'complete');
        const pumpingStopped = currentLoopSof.some(s => s.event.includes('Pumping Stopped') && s.status === 'complete');

        return pumpingStarted && !pumpingStopped;
    }, [plan, lineIndex, transferIndex]);

    if (!context) return <div>Loading...</div>;

    if (!plan || !transfer || lineIndex === null || transferIndex === null) {
        return <div className="text-center p-8"><h2 className="text-xl font-semibold">Transfer Not Found</h2><p>Please go back and select a transfer to view its details.</p></div>;
    }

    const handleHoseLogClose = () => {
        setIsHoseLogModalOpen(false);
    };

    const handlePressureCheckClose = () => {
        setIsPressureCheckModalOpen(false);
    };

    const handleSampleLogClose = () => {
        setIsSampleLogModalOpen(false);
    };

    const handleServiceStatusChange = (serviceName: string, status: 'pending' | 'complete') => {
        setPlan(prev => {
            if (!prev) return null;
            const newOp = JSON.parse(JSON.stringify(prev)) as Operation;
            const existingIndex = (newOp.specialRequirements || []).findIndex((s: SpecialServiceData) => s.name === serviceName);
            
            if (existingIndex > -1) {
                newOp.specialRequirements[existingIndex].data = { ...newOp.specialRequirements[existingIndex].data, status };
            } else {
                if (!newOp.specialRequirements) newOp.specialRequirements = [];
                newOp.specialRequirements.push({ name: serviceName, data: { status } });
            }
            
            const logAction = status === 'complete' ? 'SERVICE_COMPLETE' : 'SERVICE_RESET';
            const logDetail = status === 'complete' ? `Service "${serviceName}" marked as complete.` : `Service "${serviceName}" reset to pending.`;
            newOp.activityHistory.push({ time: simulatedTime.toISOString(), user: currentUser.name, action: logAction, details: logDetail });
            
            return newOp;
        });
    };

    const handleSofClick = (eventName: string, loop: number) => {
        const baseEvent = eventName.replace(/^(Rework #\d+: )?/, '');

        if (baseEvent === 'Ready / Approved') {
            const checklist = plan.arrivalChecklist;
            const isChecklistComplete = checklist && Object.values(checklist).every(status => status === 'complete');
            
            if (!isChecklistComplete) {
                setInfoModal({
                    isOpen: true,
                    title: 'Checklist Incomplete',
                    message: 'The Arrival Checklist must be fully completed before this truck can be approved. Please go to the Arrival Checklist tab.'
                });
                if(setActiveTab) setActiveTab('arrivalChecklist');
                return; // Stop the function
            }
        }
        
        if (eventName.includes('HOSE CONNECTED')) {
            setIsHoseLogModalOpen(true);
            return;
        }
        if (eventName.includes('HOSE LEAK CHECK')) {
            setIsPressureCheckModalOpen(true);
            return;
        }
        if (eventName.includes('SLOPS SAMPLE PASSED')) {
            setIsSampleLogModalOpen(true);
            return;
        }

        if (eventName.includes('Directed to Bay')) {
             // Save any pending edits first
             saveCurrentPlan(plan);
             const infraId = plan.transferPlan[lineIndex!]?.infrastructureId;
             if (infraId) {
                 directTruckToBay(plan.id, infraId);
             }
             return;
        }
        
        // Intercept special truck events to prompt for data
        if (['Post-Load Weighing', 'Seal Applied', 'BOL Printed'].includes(baseEvent)) {
            setPendingCompletionEvent(eventName);
            setEditingSof({ event: eventName, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop });
            return; // Stop here, modal will open
        }
        
        const sofItem: SOFItem = { event: eventName, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop };
        
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;

        if (newOp.status === 'planned') {
            newOp.status = 'active';
            newOp.activityHistory.push({ time: sofItem.time, user: currentUser.name, action: 'STATUS_UPDATE', details: 'Operation automatically activated on first SOF step.' });
        }
        
        const t = newOp.transferPlan[lineIndex!].transfers[transferIndex!];
        if (!t) return;
        
        const sofIndex = (t.sof || []).findIndex(item => item.event === eventName && item.loop === loop);
        if (sofIndex > -1) {
            t.sof![sofIndex] = sofItem;
        } else {
            t.sof = [...(t.sof || []), sofItem];
        }

        const transferLogItem: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${eventName} marked complete.` };
        if (!t.transferLog) t.transferLog = [];
        t.transferLog.push(transferLogItem);
        newOp.activityHistory.push({ ...transferLogItem, details: `${eventName} marked complete for ${transfer.product}.` });
        
        setPlan(newOp);
        saveCurrentPlan(newOp);
    };

    const handleCleaningSofClick = (eventName: string, loop: number) => {
        const sofItem: SOFItem = { event: eventName, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop };
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;

        if (newOp.status === 'planned') {
            newOp.status = 'active';
            newOp.activityHistory.push({ time: sofItem.time, user: currentUser.name, action: 'STATUS_UPDATE', details: 'Operation automatically activated on first SOF step.' });
        }

        const t = newOp.transferPlan[lineIndex!].transfers[transferIndex!];
        if (!t || !t.preTransferCleaningSof) return;

        const sofIndex = t.preTransferCleaningSof.findIndex(item => item.event === eventName && item.loop === loop);
        if (sofIndex > -1) t.preTransferCleaningSof[sofIndex] = sofItem;

        const logItem: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `Line Cleaning: ${eventName} marked complete.` };
        if (!t.transferLog) t.transferLog = [];
        t.transferLog.push(logItem);
        newOp.activityHistory.push({ ...logItem, details: `Line Cleaning: ${eventName} marked complete for ${transfer.product}.` });

        setPlan(newOp);
        saveCurrentPlan(newOp);
    };
    
    const handleHoseLogSave = (logEntryData: Omit<HoseLogEntry, 'id'>) => {
        if (!plan) return;
        
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const t = newOp.transferPlan[lineIndex!].transfers[transferIndex!];
        const step = t.sof?.find(s => s.event.includes('HOSE CONNECTED') && s.status !== 'complete');

        if (step) {
            let logId = step.logId;
            let updatedOp = newOp;

            const updatePayload = {
                logEntryData,
                sofEvent: step.event,
                sofLoop: step.loop,
                logId
            };
            
            const { sofItem } = (() => {
                let currentLogId = updatePayload.logId;
                if (currentLogId) {
                    const logIndex = (updatedOp.hoseLog || []).findIndex(h => h.id === currentLogId);
                    if (logIndex > -1) updatedOp.hoseLog![logIndex] = { ...updatedOp.hoseLog![logIndex], ...updatePayload.logEntryData };
                } else {
                    currentLogId = `hose-${Date.now()}`;
                    if (!updatedOp.hoseLog) updatedOp.hoseLog = [];
                    updatedOp.hoseLog.push({ id: currentLogId, ...updatePayload.logEntryData });
                }

                const newSofItem: SOFItem = {
                    event: updatePayload.sofEvent, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop: updatePayload.sofLoop, logId: currentLogId
                };
                return { sofItem: newSofItem };
            })();

            const sofIndex = (t.sof || []).findIndex(item => item.event === updatePayload.sofEvent && item.loop === updatePayload.sofLoop);
            if (sofIndex > -1) t.sof![sofIndex] = sofItem;
            else t.sof = [...(t.sof || []), sofItem];
            
            const logItem: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${updatePayload.sofEvent} marked complete.` };
            if(!t.transferLog) t.transferLog = [];
            t.transferLog.push(logItem);
            updatedOp.activityHistory.push({ ...logItem, details: `${updatePayload.sofEvent} marked complete for ${transfer.product}.` });

            if (updatePayload.logEntryData.initials) {
                 const sigLog: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SIGNATURE', details: `Operator initials captured.` };
                 t.transferLog.push(sigLog);
                 updatedOp.activityHistory.push({ ...sigLog, details: `Operator initials captured for Hose Log (${transfer.product}).` });
            }

            setPlan(updatedOp);
            saveCurrentPlan(updatedOp);
        }
        
        setIsHoseLogModalOpen(false);
    };

    const handlePressureCheckSave = (logData: Omit<PressureCheckLogEntry, 'id' | 'transferId'>) => {
        if (!plan || !transfer?.id) return;

        if (logData.result !== 'Pass' || !logData.initials) {
            alert("Cannot complete step: The pressure test must pass and be initialed by the operator.");
            return;
        }

        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const t = newOp.transferPlan[lineIndex!].transfers[transferIndex!];
        const step = t.sof?.find(s => s.event.includes('HOSE LEAK CHECK') && s.status !== 'complete');

        if (step) {
            const updatePayload = {
                logData, sofEvent: step.event, sofLoop: step.loop, logId: step.logId, transferId: t.id,
            };

            let logId = updatePayload.logId;
            if (logId) { 
                const logIndex = (newOp.pressureCheckLog || []).findIndex(l => l.id === logId);
                if (logIndex > -1) newOp.pressureCheckLog![logIndex] = { ...newOp.pressureCheckLog![logIndex], ...updatePayload.logData };
            } else { 
                logId = `pressure-${Date.now()}`;
                if (!newOp.pressureCheckLog) newOp.pressureCheckLog = [];
                newOp.pressureCheckLog.push({ id: logId, transferId: updatePayload.transferId, ...updatePayload.logData });
            }
            
            const sofItem: SOFItem = { event: updatePayload.sofEvent, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop: updatePayload.sofLoop, logId };
            const logItem: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${updatePayload.sofEvent} marked complete.` };
            if(!t.transferLog) t.transferLog = [];
            t.transferLog.push(logItem);
            newOp.activityHistory.push({ ...logItem, details: `${updatePayload.sofEvent} marked complete for ${transfer.product}.` });

            if (updatePayload.logData.initials) {
                const sigLog: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SIGNATURE', details: `Operator initials captured.` };
                t.transferLog.push(sigLog);
                newOp.activityHistory.push({ ...sigLog, details: `Operator initials captured for Pressure Check (${transfer.product}).` });
            }
            
            const sofIndex = (t.sof || []).findIndex(item => item.event === updatePayload.sofEvent && item.loop === updatePayload.sofLoop);
            if (sofIndex > -1) t.sof![sofIndex] = sofItem;
            else t.sof = [...(t.sof || []), sofItem];

            setPlan(newOp);
            saveCurrentPlan(newOp);
        }

        setIsPressureCheckModalOpen(false);
    };

    const handleSampleLogSave = (logData: Partial<SampleLogEntry>) => {
        if (!plan || !transfer.id) return;
        
        if (logData.samplesPassed !== 'Y' || !logData.surveyorSignature) {
            alert("Cannot complete step: Samples must be marked as passed and the surveyor signature is required.");
            return;
        }

        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const t = newOp.transferPlan[lineIndex!].transfers[transferIndex!];
        const step = t.sof?.find(s => s.event.includes('SLOPS SAMPLE PASSED') && s.status !== 'complete');

        if (step) {
            const updatePayload = {
                logData, sofEvent: step.event, sofLoop: step.loop, logId: step.logId, transferId: transfer.id,
            };

            let logId = updatePayload.logId;
            if (logId) { 
                const logIndex = (newOp.sampleLog || []).findIndex(l => l.id === logId);
                if (logIndex > -1) newOp.sampleLog![logIndex] = { ...newOp.sampleLog![logIndex], ...updatePayload.logData };
            } else { 
                logId = `sample-${Date.now()}`;
                if (!newOp.sampleLog) newOp.sampleLog = [];
                newOp.sampleLog.push({ id: logId, transferId: updatePayload.transferId, samplesPassed: 'N', slop: '', surveyorSignature: '', ...updatePayload.logData });
            }
            
            const sofItem: SOFItem = { event: updatePayload.sofEvent, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop: updatePayload.sofLoop, logId };
            const logItem: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${updatePayload.sofEvent} marked complete.` };
            if(!t.transferLog) t.transferLog = [];
            t.transferLog.push(logItem);
            newOp.activityHistory.push({ ...logItem, details: `${updatePayload.sofEvent} marked complete for ${transfer.product}.` });

            if (updatePayload.logData.surveyorSignature) {
                const sigLog: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SIGNATURE', details: `Surveyor signature captured.` };
                t.transferLog.push(sigLog);
                newOp.activityHistory.push({ ...sigLog, details: `Surveyor signature captured for Sample Log (${transfer.product}).` });
            }
            
            const sofIndex = (t.sof || []).findIndex(item => item.event === updatePayload.sofEvent && item.loop === updatePayload.sofLoop);
            if (sofIndex > -1) t.sof![sofIndex] = sofItem;
            else t.sof = [...(t.sof || []), sofItem];

            setPlan(newOp);
            saveCurrentPlan(newOp);
        }

        setIsSampleLogModalOpen(false);
    };
    
    const handleCloseUndoModal = () => {
        setOptimisticUndoEvent(null);
        setUndoModalState({ isOpen: false, item: null, type: 'commodity' });
    };

    const handleUndo = (reason: string) => {
        if (!undoModalState.item || !plan) return;
        
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const transferToUpdate = newOp.transferPlan[lineIndex!].transfers[transferIndex!];
        
        const itemToUndo = undoModalState.item!;
        const isCleaning = undoModalState.type === 'cleaning';
        const sofArray = isCleaning ? transferToUpdate.preTransferCleaningSof : transferToUpdate.sof;
        
        if (!sofArray) return;
        
        const loopItems = sofArray.filter(s => s.loop === itemToUndo.loop);
        const itemIndexInLoop = loopItems.findIndex(s => s.event === itemToUndo.event);
        if (itemIndexInLoop === -1) return;

        const eventsToRevert = new Set(loopItems.slice(itemIndexInLoop).map(s => s.event));
        const updatedSof = sofArray.map(s => (s.loop === itemToUndo.loop && eventsToRevert.has(s.event)) ? { ...s, status: 'pending' as 'pending', time: '', user: '' } : s);
        
        if (isCleaning) {
            transferToUpdate.preTransferCleaningSof = updatedSof;
        } else {
            transferToUpdate.sof = updatedSof;
        }
        
        const logTime = simulatedTime.toISOString();
        const logContext = isCleaning ? 'Line Cleaning' : 'Transfer';
        const transferLogItem: ActivityLogItem = { time: logTime, user: currentUser.name, action: 'SOF_REVERT', details: `Reverted step "${itemToUndo.event}" for ${logContext}. Reason: ${reason}` };
        if(!transferToUpdate.transferLog) transferToUpdate.transferLog = [];
        transferToUpdate.transferLog.push(transferLogItem);

        newOp.activityHistory.push({ time: logTime, user: currentUser.name, action: 'SOF_REVERT', details: `Reverted step "${itemToUndo.event}" for ${transfer.product} (${logContext}). Reason: ${reason}` });
        
        setPlan(newOp);
        saveCurrentPlan(newOp);

        handleCloseUndoModal();
    };

    const handleDisabledClick = (item: SOFItem, index: number, items: SOFItem[]) => {
        if (index === 0 && transfer?.preTransferCleaningSof?.some(s => s.status !== 'complete')) {
            setInfoModal({ 
                isOpen: true, 
                title: 'Safety Check Failed', 
                message: 'Required line cleaning must be completed before starting this product transfer.' + (setActiveTab ? ' You will be redirected to the Line Cleaning tab.' : '')
            });
            if (setActiveTab) {
                setTimeout(() => setActiveTab('lineCleaning'), 50);
            }
            return;
        }

        if (!isPreviousStepComplete(items, index)) {
            setInfoModal({ isOpen: true, title: 'Step Unavailable', message: `Please complete the previous step first: "${items[index - 1].event}"` });
        } else {
            setInfoModal({ isOpen: true, title: 'Step Unavailable', message: `This step is not yet available.` });
        }
    };
    
    const getActiveSofEvent = (sofItems: SOFItem[], isCommodity: boolean): string | null => {
        for (let i = 0; i < sofItems.length; i++) {
            const item = sofItems[i];
            if (item.status === 'pending') {
                if (!isPreviousStepComplete(sofItems, i)) {
                    return null;
                }
                if (isCommodity && item.event.includes('START PUMPING')) {
                    const cleaningSof = transfer?.preTransferCleaningSof;
                    if (cleaningSof && cleaningSof.some(s => s.status !== 'complete')) {
                        return null;
                    }
                }
                return item.event;
            }
        }
        return null;
    };
    
    const activeSofEvent = getActiveSofEvent(transfer.sof || [], true);

    const isTankTransfer = transfer.direction.includes("Tank");
    const tankName = isTankTransfer ? (transfer.direction.endsWith(' to Tank') ? transfer.to : transfer.from) : null;
    const isIncoming = isTankTransfer && transfer.direction.endsWith(' to Tank');
    
    const infrastructureId = plan.transferPlan[lineIndex].infrastructureId;
    const infraScada = scadaData[infrastructureId];

    const hasCleaning = !!transfer.preTransferCleaningSof && transfer.preTransferCleaningSof.length > 0;
    const isCleaningDone = hasCleaning && transfer.preTransferCleaningSof!.every(s => s.status === 'complete');
    
    return (
        <div className="card">
            <HoseLogModal 
                isOpen={isHoseLogModalOpen}
                onClose={handleHoseLogClose}
                onSave={handleHoseLogSave}
                product={transfer.product}
            />
            <PressureCheckModal 
                isOpen={isPressureCheckModalOpen}
                onClose={handlePressureCheckClose}
                onSave={handlePressureCheckSave}
                transfer={transfer}
            />
             <SampleLogModal 
                isOpen={isSampleLogModalOpen}
                onClose={handleSampleLogClose}
                onSave={handleSampleLogSave}
                transfer={transfer}
                sampleLog={plan.sampleLog?.find(l => l.id === transfer.sof?.find(s => s.event.includes('SLOPS SAMPLE PASSED'))?.logId)}
            />
            {editingSof && (
                 <SofDetailsModal 
                    isOpen={!!editingSof}
                    onClose={() => { setEditingSof(null); setPendingCompletionEvent(null); }}
                    onSave={(opToSave) => {
                        setPlan(opToSave);
                        saveCurrentPlan(opToSave);
                        setPendingCompletionEvent(null);
                    }}
                    sofItem={editingSof}
                    plan={plan}
                    transfer={transfer}
                />
            )}
            <UndoSofModal isOpen={undoModalState.isOpen} onClose={handleCloseUndoModal} onConfirm={handleUndo} />
            <Modal isOpen={infoModal.isOpen} onClose={() => setInfoModal({isOpen: false, title: '', message: ''})} title={infoModal.title} footer={<button onClick={() => setInfoModal({isOpen: false, title: '', message: ''})} className="btn-primary">OK</button>}><p>{infoModal.message}</p></Modal>
            
            <div className="border-b">
                 <div className="p-4 sm:p-6 space-y-3">
                    <h3 className="font-bold text-lg text-brand-dark">
                        {transfer.product}
                        {plan.modality !== 'vessel' && <span className="text-base font-normal text-slate-600"> on {formatInfraName(infrastructureId)}</span>}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                        <p><strong className="font-semibold text-text-secondary">Customer:</strong> {transfer.customer}</p>
                        <p><strong className="font-semibold text-text-secondary">Tonnes:</strong> {transfer.tonnes}</p>
                        <p><strong className="font-semibold text-text-secondary">From:</strong> {transfer.from}</p>
                        <p><strong className="font-semibold text-text-secondary">To:</strong> {transfer.to}</p>
                    </div>
                    {isPumping && <TransferProgressBar operation={plan} transfer={transfer} />}
                    {tankName && <CompactTankIndicator tankName={tankName} transferVolume={transfer.tonnes} transferDirection={isIncoming ? 'in' : 'out'} />}
                </div>
            </div>
            <div className="p-4 sm:p-6">
                <div className="space-y-4">
                    {activeTab === 'services' && (
                        <div className="space-y-2">
                            {(settings.modalityServices?.[plan.modality] || []).map(serviceName => {
                                // Get service object from plan if it exists, or create dummy for display
                                const existing = plan.specialRequirements?.find(s => s.name === serviceName);
                                const serviceObj = existing || { name: serviceName, data: { status: 'pending' } };
                                
                                return (
                                    <ServiceSlider 
                                        key={serviceName}
                                        service={serviceObj}
                                        context="Standard Service"
                                        onStatusChange={(status) => handleServiceStatusChange(serviceName, status)}
                                    />
                                );
                            })}
                        </div>
                    )}
                    {activeTab === 'sof' && hasCleaning && (
                        <div className={`p-4 border rounded-lg ${isCleaningDone ? 'bg-green-50' : 'bg-orange-50'}`}>
                            <h4 className="font-bold text-base mb-2">{isCleaningDone ? <><i className="fas fa-check-circle text-green-600 mr-2"></i>Line Cleaning Complete</> : 'Line Cleaning Required'}</h4>
                            <SofSection sofItems={transfer.preTransferCleaningSof!} onSofClick={handleCleaningSofClick} activeStepEvent={getActiveSofEvent(transfer.preTransferCleaningSof!, false)} onDisabledClick={handleDisabledClick} onUndoClick={(item) => { setOptimisticUndoEvent(item.event); setUndoModalState({ isOpen: true, item, type: 'cleaning' }); }} onEditClick={(item) => setEditingSof(item)} optimisticUndoEvent={optimisticUndoEvent} pendingCompletionEvent={pendingCompletionEvent} setInfoModal={setInfoModal} />
                        </div>
                    )}
                    {activeTab === 'sof' && (
                        <SofSection sofItems={transfer.sof || []} onSofClick={handleSofClick} activeStepEvent={activeSofEvent} onDisabledClick={handleDisabledClick} onUndoClick={(item) => { setOptimisticUndoEvent(item.event); setUndoModalState({ isOpen: true, item, type: 'commodity' }); }} onEditClick={(item) => setEditingSof(item)} optimisticUndoEvent={optimisticUndoEvent} pendingCompletionEvent={pendingCompletionEvent} setInfoModal={setInfoModal} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductTransferDetails;
