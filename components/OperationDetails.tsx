import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
// FIX: Import ScadaData type to allow for proper casting.
import { SOFItem, ActivityLogItem, SpecialServiceData, Transfer, Operation, TransferPlanItem, Modality, ScadaData, User, Hold } from '../types';
import DelayModal from './DelayModal';
import TankLevelIndicator from './TankLevelIndicator';
import { calculateOperationProgress, formatInfraName, calculateOperationValue, formatCurrency, formatDateTime, combineToIso, validateOperationPlan } from '../utils/helpers';
import { VESSEL_COMMON_EVENTS, SOF_EVENTS_MODALITY } from '../constants';
import Modal from './Modal';
import ShippingLog from './ShippingLog';
import UndoSofModal from './UndoSofModal';
import SofDetailsModal from './SofDetailsModal';
import SignatureModal from './SignatureModal';
import ReworkModal from './ReworkModal';
import TruckRejectionModal from './TruckRejectionModal';
import DirectToBayModal from './DirectToBayModal';

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


// --- SOF LOGIC HELPERS ---
const findSofStatus = (sof: SOFItem[], eventName: string): SOFItem['status'] | undefined => {
    return sof.find(s => s.event.endsWith(eventName))?.status;
};
const areAllCommoditiesFinishedPumping = (transferPlan: TransferPlanItem[] = []): boolean => {
    if (transferPlan.length === 0) return true;
    return transferPlan.every(line => 
        line.transfers.every(transfer => 
            findSofStatus(transfer.sof || [], 'HOSES DISCONNECTED') === 'complete'
        )
    );
};
const isPreviousStepComplete = (sofItems: SOFItem[], currentIndex: number): boolean => {
    if (currentIndex === 0) return true;
    const previousItem = sofItems[currentIndex - 1];
    return previousItem?.status === 'complete';
};

const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2);
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${String(hours).padStart(2, '0')}:${minutes}`;
});

const SofSection: React.FC<{
    sofItems: SOFItem[],
    onSofClick: (eventName: string, loop: number) => void,
    onUndoClick: (item: SOFItem) => void,
    onEditClick: (item: SOFItem) => void,
    onRevertCallClick?: (item: SOFItem) => void,
    activeStepEvent?: string | null,
    onDisabledClick?: (item: SOFItem, indexInLoop: number, loopItems: SOFItem[]) => void;
    optimisticUndoEvent?: string | null;
}> = ({ sofItems, onSofClick, onUndoClick, onEditClick, onRevertCallClick, activeStepEvent, onDisabledClick, optimisticUndoEvent }) => {
    const loops: { [loopNum: number]: SOFItem[] } = {};
    (sofItems || []).forEach(item => {
        if (!loops[item.loop]) loops[item.loop] = [];
        loops[item.loop].push(item);
    });
    const sofLoops = Object.entries(loops).map(([loopNum, items]) => ({ loopNum: parseInt(loopNum), items })).sort((a, b) => a.loopNum - b.loopNum);

    return (
        <div className="space-y-6 pt-4 mt-2">
            {sofLoops.map(({ loopNum, items }) => (
                <div key={loopNum}>
                    {sofLoops.length > 1 && <h5 className="font-bold text-sm mb-2 uppercase text-text-secondary">{loopNum > 1 ? `Rework Loop #${loopNum}` : 'Initial Loop'}</h5>}
                    <div className="grid grid-cols-1 gap-2">
                        {items.map((sofItem, index) => {
                            let status: SOFItem['status'] = sofItem.status;
                            if (optimisticUndoEvent === sofItem.event && status === 'complete') {
                                status = 'in-progress';
                            } else if (status === 'pending' && sofItem.event === activeStepEvent) {
                                status = 'in-progress';
                            }
                            
                            return (
                                <div 
                                    key={sofItem.event} 
                                    className={`sof-item ${status}`}
                                    onClick={() => {
                                        if (status === 'pending' && onDisabledClick) onDisabledClick(sofItem, index, items); 
                                    }}
                                >
                                    {status === 'pending' ? (
                                        <div className={`sof-icon`}><i className={`fas fa-clock`}></i></div>
                                    ) : (
                                        <SofSlider
                                            status={status as 'in-progress' | 'complete'}
                                            onComplete={() => onSofClick(sofItem.event, sofItem.loop)}
                                            onUndo={() => onUndoClick(sofItem)}
                                        />
                                    )}
                                    
                                    <div className="flex-1">
                                        <h5 className="font-semibold text-base">{sofItem.event}</h5>
                                        <p className="text-sm text-text-tertiary">{sofItem.status === 'complete' ? `${new Date(sofItem.time).toLocaleTimeString()} | ${sofItem.user}` : 'Pending'}</p>
                                    </div>

                                    {sofItem.status === 'complete' && (
                                        <div className="flex items-center gap-2">
                                            {sofItem.event.includes('Directed to Bay') && onRevertCallClick && (
                                                 <button onClick={() => onRevertCallClick(sofItem)} className="sof-edit-btn">
                                                    <i className="fas fa-undo mr-2"></i> Revert Call
                                                </button>
                                            )}
                                            <button onClick={() => onEditClick(sofItem)} className="sof-edit-btn">
                                                <i className="fas fa-pen mr-2"></i> Edit
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

const FinancialSummary: React.FC<{ op: Operation }> = ({ op }) => {
    const { settings } = useContext(AppContext)!;
    const { throughputValue, servicesValue, totalValue } = calculateOperationValue(op, settings);
    return (
        <div className="card p-4 bg-green-50 border-green-200">
            <h3 className="font-bold text-xl text-green-800 mb-3">Financial Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div><p className="text-sm font-semibold text-text-secondary">Throughput</p><p className="text-2xl font-bold">{formatCurrency(throughputValue)}</p></div>
                <div><p className="text-sm font-semibold text-text-secondary">Services</p><p className="text-2xl font-bold">{formatCurrency(servicesValue)}</p></div>
                <div className="bg-green-100 rounded-lg p-2"><p className="text-sm font-bold text-green-700">Total Value</p><p className="text-2xl font-bold text-green-800">{formatCurrency(totalValue)}</p></div>
            </div>
        </div>
    );
};

const VesselRequirementLogger: React.FC<{ requirement: SpecialServiceData, onLog: (data: any) => void }> = ({ requirement, onLog }) => {
    const { currentUser } = useContext(AppContext)!;
    const [formState, setFormState] = useState<Record<string, any>>({});
    const handleInputChange = (field: string, value: any) => setFormState(prev => ({ ...prev, [field]: value }));
    const handleLog = (extraData: any = {}) => {
        let logData = { ...formState, ...extraData };
        if (logData.time_date && logData.time_time) logData.time = combineToIso(logData.time_date, logData.time_time);
        if (logData.start_date && logData.start_time) logData.start = combineToIso(logData.start_date, logData.start_time);
        if (logData.end_date && logData.end_time) logData.end = combineToIso(logData.end_date, logData.end_time);
        const eventTimestamp = logData.time || logData.start || new Date().toISOString();
        onLog({ ...logData, time: eventTimestamp, user: currentUser.name });
        setFormState({});
    };
    const simpleNoteLogger = (<div className="p-3 bg-slate-100 rounded-lg"><div className="flex gap-2"><input type="text" value={formState.notes || ''} onChange={e => handleInputChange('notes', e.target.value)} placeholder="Log notes..." className="flex-grow !py-1.5"/><button onClick={() => handleLog()} className="btn-secondary !py-1.5">Log</button></div></div>);
    switch (requirement.name) {
        case 'Customs arrival': return (<div className="p-3 bg-slate-100 rounded-lg space-y-2"><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><div><label className="text-xs font-semibold">Officer Name</label><input type="text" value={formState.officer || ''} onChange={e => handleInputChange('officer', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Clearance Date</label><input type="date" value={formState.time_date || ''} onChange={e => handleInputChange('time_date', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Clearance Time</label><select value={formState.time_time || '12:00'} onChange={e => handleInputChange('time_time', e.target.value)} className="!py-1.5">{timeOptions.map(t=><option key={t} value={t}>{t}</option>)}</select></div><div className="sm:col-span-3"><label className="text-xs font-semibold">Notes</label><input type="text" value={formState.notes || ''} onChange={e => handleInputChange('notes', e.target.value)} className="!py-1.5" /></div></div><button onClick={() => handleLog()} className="btn-secondary w-full">Log Entry</button></div>);
        case 'Aquis Quarantine': return (<div className="p-3 bg-slate-100 rounded-lg space-y-2"><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><div><label className="text-xs font-semibold">Inspector Name</label><input type="text" value={formState.inspector || ''} onChange={e => handleInputChange('inspector', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Inspection Date</label><input type="date" value={formState.time_date || ''} onChange={e => handleInputChange('time_date', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Inspection Time</label><select value={formState.time_time || '12:00'} onChange={e => handleInputChange('time_time', e.target.value)} className="!py-1.5">{timeOptions.map(t=><option key={t} value={t}>{t}</option>)}</select></div><div className="sm:col-span-2"><label className="text-xs font-semibold">Notes</label><input type="text" value={formState.notes || ''} onChange={e => handleInputChange('notes', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Status</label><select value={formState.status || ''} onChange={e => handleInputChange('status', e.target.value)} className="!py-1.5"><option value="">Select...</option><option value="Passed">Passed</option><option value="Failed">Failed</option><option value="Pending">Pending</option></select></div></div><button onClick={() => handleLog()} className="btn-secondary w-full">Log Entry</button></div>);
        case 'Marpol surveyor': return (<div className="p-3 bg-slate-100 rounded-lg space-y-2"><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><div><label className="text-xs font-semibold">Surveyor Name</label><input type="text" value={formState.surveyor || ''} onChange={e => handleInputChange('surveyor', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Survey Date</label><input type="date" value={formState.time_date || ''} onChange={e => handleInputChange('time_date', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Survey Time</label><select value={formState.time_time || '12:00'} onChange={e => handleInputChange('time_time', e.target.value)} className="!py-1.5">{timeOptions.map(t=><option key={t} value={t}>{t}</option>)}</select></div><div className="sm:col-span-3"><label className="text-xs font-semibold">Survey Notes</label><input type="text" value={formState.notes || ''} onChange={e => handleInputChange('notes', e.target.value)} className="!py-1.5" /></div></div><button onClick={() => handleLog()} className="btn-secondary w-full">Log Entry</button></div>);
        case 'Ship stability/positioning': return simpleNoteLogger;
        case 'Vessel tank inerting': return (<div className="p-3 bg-slate-100 rounded-lg space-y-2"><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><div><label className="text-xs font-semibold">Tank ID</label><input type="text" value={formState.tankId || ''} onChange={e => handleInputChange('tankId', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Oxygen Level (%)</label><input type="number" value={formState.oxygenLevel || ''} onChange={e => handleInputChange('oxygenLevel', e.target.value)} className="!py-1.5" /></div><div><label className="text-xs font-semibold">Status</label><select value={formState.status || ''} onChange={e => handleInputChange('status', e.target.value)} className="!py-1.5"><option value="">Select...</option><option value="Inerted">Inerted</option><option value="Not Required">Not Required</option><option value="Pending">Pending</option></select></div></div><button onClick={() => handleLog()} className="btn-secondary w-full">Log Tank Status</button></div>);
        default: return simpleNoteLogger;
    }
};

const SignatureDisplay: React.FC<{ signature: string; onClick: () => void }> = ({ signature, onClick }) => {
    const isSigned = signature && signature.startsWith('data:image');
    return (
        <div onClick={onClick} className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-slate-100 p-1 min-h-[30px] rounded-md border border-transparent hover:border-slate-300">
            {isSigned ? <img src={signature} alt="signature" className="h-6 w-auto" /> : <span className="text-blue-600 text-xs font-semibold">SIGN</span>}
        </div>
    );
};

const ServiceLogger: React.FC<{ service: SpecialServiceData, onLog: (note: string) => void }> = ({ service, onLog }) => {
    const [note, setNote] = useState('');
    const handleLog = () => {
        if (note.trim()) {
            onLog(note.trim());
            setNote('');
        }
    };

    return (
        <div className="p-3 border rounded-lg">
            <h4 className="font-bold text-base mb-2">{service.name}</h4>
            <div className="flex gap-2">
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Log notes..." className="flex-grow !py-1.5"/>
                <button onClick={handleLog} className="btn-secondary !py-1.5">Log</button>
            </div>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {(service.data.log || []).slice().reverse().map((logItem: any, i: number) => (
                    <div key={i} className="text-xs p-1.5 bg-slate-50 rounded">
                        <span className="font-semibold text-slate-600">{formatDateTime(logItem.time)} ({logItem.user}): </span>
                        <span className="text-slate-500">{logItem.note}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const NonVesselDetails: React.FC<{
    plan: Operation;
    setPlan: React.Dispatch<React.SetStateAction<Operation | null>>;
    saveCurrentPlan: (op: Operation) => void;
    op: Operation; // for transportId in log
    currentUser: User;
    setInfoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; title: string; message: string }>>;
    setUndoModalState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; item: SOFItem | null; context: any }>>;
    setEditingSof: React.Dispatch<React.SetStateAction<SOFItem | null>>;
    onReworkClick: () => void;
    onRejectClick: () => void;
    onDirectToBay: () => void;
    onRevertCall: (item: SOFItem) => void;
    optimisticUndoEvent: string | null;
    handleUndoClick: (item: SOFItem) => void;
}> = ({ plan, setPlan, saveCurrentPlan, op, currentUser, setInfoModal, setUndoModalState, setEditingSof, onReworkClick, onRejectClick, onDirectToBay, onRevertCall, optimisticUndoEvent, handleUndoClick }) => {
    const [activeTab, setActiveTab] = useState<'sof' | 'services'>('sof');
    const lineIndex = 0;
    const transferIndex = 0;
    const transfer = plan.transferPlan[lineIndex]?.transfers[transferIndex];
    const services = transfer?.specialServices || [];

    if (!transfer) {
        return <p className="p-4 text-text-secondary">No transfer information available for this operation.</p>;
    }

    const sofByLoop: Record<number, SOFItem[]> = (transfer.sof || []).reduce((acc: Record<number, SOFItem[]>, s: SOFItem) => {
        (acc[s.loop] = acc[s.loop] || []).push(s);
        return acc;
    }, {});
    const latestLoopNum = Math.max(0, ...Object.keys(sofByLoop).map(Number));
    const latestLoopSof = sofByLoop[latestLoopNum] || [];
    const canRework = latestLoopSof.some(s => s.event.includes('Pumping Stopped') && s.status === 'complete');
    const hasNextLoop = !!sofByLoop[latestLoopNum + 1]; 
    const canReject = plan.modality === 'truck' && plan.status === 'active' && plan.truckStatus !== 'Departed' && plan.truckStatus !== 'Rejected';


    const handleSofClick = (eventName: string, loop: number) => {
        if (eventName.includes('Directed to Bay')) {
            onDirectToBay();
            return;
        }

        const sofItem: SOFItem = { event: eventName, status: 'complete', time: new Date().toISOString(), user: currentUser.name, loop };
        const logItem: ActivityLogItem = { time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${eventName} marked complete for ${op.transportId}.` };
        
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const t = newOp.transferPlan[lineIndex].transfers[transferIndex];
        if (!t) return;

        const sofIndex = (t.sof || []).findIndex(item => item.event === eventName && item.loop === loop);
        if (sofIndex > -1) {
            t.sof![sofIndex] = sofItem;
        } else {
            t.sof = [...(t.sof || []), sofItem];
        }
        newOp.activityHistory.push(logItem);

        // Update local editing state and immediately save to the main list to prevent race conditions
        setPlan(newOp);
        saveCurrentPlan(newOp);
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
                return null; // The next step isn't ready
            }
        }
        return null; // All steps are complete
    };
    
    const activeSofEvent = getActiveSofEvent(transfer.sof || []);

    const handleLogServiceNote = (serviceName: string, note: string) => {
        setPlan(prev => {
            if (!prev) return null;
            const newOp = JSON.parse(JSON.stringify(prev)) as Operation;
            
            // Assume first transfer for trucks/rail
            const t = newOp.transferPlan[0]?.transfers[0];
            if (!t) return newOp;

            const service = t.specialServices.find((s: SpecialServiceData) => s.name === serviceName);
            if (service) {
                if (!service.data.log) service.data.log = [];
                service.data.log.push({ time: new Date().toISOString(), user: currentUser.name, note });
            }
            return newOp;
        });
    };

    return (
        <div className="card">
            <div className="border-b">
                <nav className="-mb-px flex space-x-6 px-6">
                    <button onClick={() => setActiveTab('sof')} className={`tab ${activeTab === 'sof' ? 'active' : ''}`}>Statement of Facts</button>
                    <button onClick={() => setActiveTab('services')} className={`tab ${activeTab === 'services' ? 'active' : ''}`}>Services ({services.length})</button>
                </nav>
            </div>
             <div className="p-6">
                {activeTab === 'sof' && (
                    <>
                        <SofSection 
                            sofItems={transfer.sof || []} 
                            onSofClick={handleSofClick}
                            activeStepEvent={activeSofEvent}
                            onDisabledClick={handleDisabledClick}
                            onUndoClick={handleUndoClick}
                            onEditClick={(item) => setEditingSof(item)}
                            onRevertCallClick={onRevertCall}
                            optimisticUndoEvent={optimisticUndoEvent}
                        />
                        {(canRework || canReject) && (
                            <div className="mt-6 pt-6 border-t text-center flex justify-center items-start gap-6">
                                {canReject && (
                                    <div>
                                        <button className="btn-danger" onClick={onRejectClick}>
                                            <i className="fas fa-ban mr-2"></i> Reject & Reschedule
                                        </button>
                                        <p className="text-xs text-text-tertiary mt-2">Use for issues on arrival, e.g., safety violation.</p>
                                    </div>
                                )}
                                {canRework && !hasNextLoop && (
                                    <div><button className="btn-secondary" onClick={onReworkClick}><i className="fas fa-redo mr-2"></i> Log Rework & Reschedule</button><p className="text-xs text-text-tertiary mt-2">Use for issues found after pumping, like underloading.</p></div>
                                )}
                            </div>
                        )}
                    </>
                )}
                {activeTab === 'services' && (
                    <div className="space-y-4">
                        {services.length > 0 ? services.map(service => (
                            <ServiceLogger key={service.name} service={service} onLog={(note) => handleLogServiceNote(service.name, note)} />
                        )) : (
                            <p className="text-sm text-center text-slate-500 italic p-4">No special services for this operation.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const OperationDetails: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading...</div>;

    const { activeOpId, getOperationById, switchView, handleCompleteOperation, currentUser, scadaData, editingOp: plan, setEditingOp: setPlan, saveCurrentPlan, holds, settings, currentTerminalSettings } = context;
    
    const op = getOperationById(activeOpId);
    
    const [delayModalOpen, setDelayModalOpen] = useState(false);
    const [infoModal, setInfoModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
    const [isScadaSidebarCollapsed, setIsScadaSidebarCollapsed] = useState(true);
    const [activeTab, setActiveTab] = useState<'sof' | 'requirements' | 'shippingLog'>('sof');
    const [undoModalState, setUndoModalState] = useState<{ isOpen: boolean; item: SOFItem | null; context: 'vessel' | { lineIndex: number; transferIndex: number } }>({ isOpen: false, item: null, context: 'vessel' });
    const [editingSof, setEditingSof] = useState<SOFItem | null>(null);
    const [isSurveyorModalOpen, setIsSurveyorModalOpen] = useState(false);
    const [surveyorModalData, setSurveyorModalData] = useState<Transfer[] | null>(null);
    const [signingTarget, setSigningTarget] = useState<{ index: number } | null>(null);
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
    const [directToBayModalState, setDirectToBayModalState] = useState({ isOpen: false, isRevert: false });
    const [optimisticUndoEvent, setOptimisticUndoEvent] = useState<string | null>(null);

    const validation = useMemo(() => {
        if (!plan) return { isValid: true, issues: [] }; // If no plan, assume valid to avoid blocking UI
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        return validateOperationPlan(plan, currentTerminalSettings, settings, activeHolds);
    }, [plan, holds, currentTerminalSettings, settings]);

    const isOperationCompletable = useMemo(() => {
        if (!plan) return false;
        if (plan.modality === 'vessel') {
            const lastStepName = VESSEL_COMMON_EVENTS[VESSEL_COMMON_EVENTS.length-1];
            return findSofStatus(plan.sof || [], lastStepName) === 'complete';
        } else {
            return plan.transferPlan.every(line => line.transfers.every(transfer => {
                const modalityEvents = SOF_EVENTS_MODALITY[plan.modality];
                const lastStepName = modalityEvents[modalityEvents.length - 1];
                return findSofStatus(transfer.sof || [], lastStepName) === 'complete';
            }));
        }
    }, [plan]);

    if (!op || !plan) { return <div className="text-center p-8"><h2 className="text-xl font-semibold">No Operation Selected</h2></div>; }
    
    const handleConfirmBayAction = () => {
        if (!plan) return;
    
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const transfer = newOp.transferPlan[0]?.transfers[0];
        if (!transfer?.sof) return;
    
        if (!directToBayModalState.isRevert) { // Directing TO bay
            const latestLoopNum = Math.max(0, ...transfer.sof.map(s => s.loop));
            const stepToComplete = transfer.sof.find(s => s.event.includes('Directed to Bay') && s.loop === latestLoopNum);
            
            if (stepToComplete) {
                const sofIndex = transfer.sof.findIndex(s => s.event === stepToComplete.event && s.loop === stepToComplete.loop);
                transfer.sof[sofIndex] = { ...stepToComplete, status: 'complete', time: new Date().toISOString(), user: currentUser.name };
    
                newOp.truckStatus = 'Directed to Bay';
                newOp.currentStatus = 'Directed to Bay';
                newOp.activityHistory.push({ time: new Date().toISOString(), user: currentUser.name, action: 'STATUS_UPDATE', details: `Truck directed to bay ${formatInfraName(newOp.transferPlan[0].infrastructureId)}.` });
    
                setPlan(newOp);
                saveCurrentPlan(newOp);
            }
        } else { // Reverting the call
            const latestCompletedLoopNum = Math.max(0, ...transfer.sof.filter(s => s.status === 'complete').map(s => s.loop));
            const itemToUndo = transfer.sof.find(s => s.event.includes('Directed to Bay') && s.loop === latestCompletedLoopNum && s.status === 'complete');
            
            if (itemToUndo) {
                const loopItems = transfer.sof.filter(s => s.loop === itemToUndo.loop);
                const itemIndexInLoop = loopItems.findIndex(s => s.event === itemToUndo.event);
                const eventsToRevert = new Set(loopItems.slice(itemIndexInLoop).map(s => s.event));
                
                transfer.sof = transfer.sof.map(s => 
                    (s.loop === itemToUndo.loop && eventsToRevert.has(s.event)) 
                    ? { ...s, status: 'pending', time: '', user: '' } 
                    : s
                );
                
                newOp.truckStatus = 'Waiting';
                newOp.currentStatus = 'Waiting for Bay';
                newOp.activityHistory.push({ time: new Date().toISOString(), user: currentUser.name, action: 'STATUS_UPDATE', details: 'Truck call-off reverted, now waiting for bay.' });
    
                setPlan(newOp);
                saveCurrentPlan(newOp);
            }
        }
    
        setDirectToBayModalState({ isOpen: false, isRevert: false });
    };

    const handleSaveSurveyorData = () => {
        if (!plan) return;
        const allDataEntered = surveyorModalData?.every(t => t.samplesPassed === 'Y' && t.surveyorSignature);
        if (!allDataEntered) {
            alert("Please confirm samples have passed and capture a signature for all products to proceed.");
            return;
        }

        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        
        let transferCounter = 0;
        newOp.transferPlan.forEach(line => {
            line.transfers.forEach(t => {
                const modalDataForThisTransfer = surveyorModalData?.[transferCounter];
                if (modalDataForThisTransfer) {
                    t.samplesPassed = modalDataForThisTransfer.samplesPassed;
                    t.slop = modalDataForThisTransfer.slop;
                    t.surveyorSignature = modalDataForThisTransfer.surveyorSignature;
                }
                transferCounter++;
            });
        });

        const eventName = 'SURVEYOR CHECKS COMPLETED';
        const sofIndex = (newOp.sof || []).findIndex(item => item.event === eventName && item.status === 'pending');
        if (sofIndex > -1) {
            newOp.sof![sofIndex] = {
                event: eventName,
                status: 'complete',
                time: new Date().toISOString(),
                user: currentUser.name,
                loop: newOp.sof![sofIndex].loop
            };
            newOp.activityHistory.push({ time: new Date().toISOString(), user: currentUser.name, action: 'SOF_UPDATE', details: `${eventName} marked complete.` });
            newOp.activityHistory.push({ time: new Date().toISOString(), user: currentUser.name, action: 'DATA_LOG', details: `Surveyor data logged for all products.` });
        } else {
             console.warn("Could not find pending 'SURVEYOR CHECKS COMPLETED' step to complete.");
        }
        
        setPlan(newOp);
        saveCurrentPlan(newOp);

        setIsSurveyorModalOpen(false);
        setSurveyorModalData(null);
    };

    const handleSurveyorDataChange = (index: number, field: keyof Transfer, value: any) => {
        setSurveyorModalData(currentData => {
            if (!currentData) return null;
            return currentData.map((transfer, i) => {
                if (i === index) {
                    return { ...transfer, [field]: value };
                }
                return transfer;
            });
        });
    };

    const handleCommonSofClick = (eventName: string, loop: number) => {
        if (eventName === 'SURVEYOR CHECKS COMPLETED') {
            const allTransfers = plan.transferPlan.flatMap(line => line.transfers);
            setSurveyorModalData(JSON.parse(JSON.stringify(allTransfers)));
            setIsSurveyorModalOpen(true);
            return; 
        }

        const sofItem: SOFItem = { event: eventName, status: 'complete', time: new Date().toISOString(), user: currentUser.name, loop };
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const sofIndex = (newOp.sof || []).findIndex(item => item.event === eventName && item.loop === loop);
        if (sofIndex > -1) newOp.sof![sofIndex] = sofItem; else newOp.sof = [...(newOp.sof || []), sofItem];
        newOp.activityHistory.push({ time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${eventName} marked as complete.` });
        
        setPlan(newOp);
        saveCurrentPlan(newOp);
    };

    const handleCloseUndoModal = () => {
        setOptimisticUndoEvent(null);
        setUndoModalState({ isOpen: false, item: null, context: 'vessel' });
    };

    const handleUndo = (reason: string) => {
        if (!undoModalState.item || !plan) return;

        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const itemToUndo = undoModalState.item!;
        let sofArray: SOFItem[] | undefined;
        let logContext = '';

        if (undoModalState.context === 'vessel') {
            sofArray = newOp.sof;
            logContext = 'vessel';
        } else {
            const { lineIndex, transferIndex } = undoModalState.context as { lineIndex: number; transferIndex: number };
            const transfer = newOp.transferPlan[lineIndex].transfers[transferIndex];
            sofArray = transfer.sof;
            logContext = transfer.product;
        }

        if (!sofArray) {
            handleCloseUndoModal();
            return;
        }

        const loopItems = sofArray.filter(s => s.loop === itemToUndo.loop);
        const itemIndexInLoop = loopItems.findIndex(s => s.event === itemToUndo.event);
        if (itemIndexInLoop === -1) {
            handleCloseUndoModal();
            return;
        }

        const eventsToRevert = new Set(loopItems.slice(itemIndexInLoop).map(s => s.event));
        const updatedSofArray = sofArray.map(s => (s.loop === itemToUndo.loop && eventsToRevert.has(s.event)) ? { ...s, status: 'pending' as 'pending', time: '', user: '' } : s);


        if (undoModalState.context === 'vessel') {
            newOp.sof = updatedSofArray;
        } else {
            const { lineIndex, transferIndex } = undoModalState.context as { lineIndex: number; transferIndex: number };
            newOp.transferPlan[lineIndex].transfers[transferIndex].sof = updatedSofArray;
        }

        const logItem: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action: 'SOF_UPDATE', details: `Reverted step "${itemToUndo.event}" for ${logContext}. Reason: ${reason}` };
        newOp.activityHistory.push(logItem);

        // Update local editing state and immediately save to the main list
        setPlan(newOp);
        saveCurrentPlan(newOp);

        handleCloseUndoModal();
    };

    const handleRequirementLog = (requirementName: string, data: any) => {
        setPlan(prev => {
            if (!prev) return null;
            const newOp = JSON.parse(JSON.stringify(prev));
            const reqIndex = (newOp.specialRequirements || []).findIndex((r: SpecialServiceData) => r.name === requirementName);
            if (reqIndex > -1) {
                if (!newOp.specialRequirements[reqIndex].data.log) {
                    newOp.specialRequirements[reqIndex].data.log = [];
                }
                newOp.specialRequirements[reqIndex].data.log.push(data);
            }
            return newOp;
        });
    };

    const handleSaveSofDetails = (opToSave: Operation) => {
        setPlan(opToSave);
    };

    const progress = calculateOperationProgress(op);
    const ScadaDataSidebar: React.FC<{ isCollapsed: boolean; onToggle: () => void; }> = ({ isCollapsed, onToggle }) => {
        // FIX: Cast scadaData values to the correct type to resolve 'unknown' type errors.
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
    
    const TransferOverviewRow: React.FC<{ transfer: any, onClick: () => void, scadaData: ScadaData, operationEta: string }> = ({ transfer, onClick, scadaData, operationEta }) => {
        const transferred = transfer.transferredTonnes || 0;
        const total = transfer.tonnes || 0;
        const pumpingStarted = (transfer.sof || []).some((s: SOFItem) => (s.event.includes('START PUMPING') || s.event.includes('Pumping Started')) && s.status === 'complete');
        const pumpingStopped = (transfer.sof || []).some((s: SOFItem) => (s.event.includes('STOP PUMPING') || s.event.includes('Pumping Stopped')) && s.status === 'complete');
        
        let status: 'Pumping' | 'Completed' | 'Pending' = 'Pending';
        if (transferred >= total && total > 0) {
            status = 'Completed';
        } else if (pumpingStarted && !pumpingStopped) {
            status = 'Pumping';
        }
    
        const statusColor = status === 'Pumping' ? 'bg-green-200 text-green-800' : status === 'Completed' ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-800';
    
        const renderEtcColumn = () => {
            const scadaPoint = scadaData[transfer.infrastructureId];
            const flowRate = scadaPoint?.flowRate || 0;

            if (status === 'Pumping') {
                if (flowRate > 0) {
                    const tonnesRemaining = (transfer.tonnes || 0) - transferred;
                    if (tonnesRemaining <= 0) {
                         return <p className="font-semibold text-sm text-green-600">Finishing...</p>;
                    }
                    // Assuming 1 m^3/hr is roughly 1 tonne/hr for simplification
                    const hoursRemaining = tonnesRemaining / flowRate;
                    const etcDate = new Date(Date.now() + hoursRemaining * 3600 * 1000);
                    return (
                        <div>
                            <p className="font-bold text-base text-blue-600" title={`@ ${flowRate.toFixed(0)} T/hr`}>
                                ETC: {etcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-text-tertiary">{flowRate.toFixed(0)} T/hr</p>
                        </div>
                    );
                }
                return <div><p className="font-semibold text-sm text-orange-600">Stalled</p><p className="text-xs text-text-tertiary">Flow Rate: 0 T/hr</p></div>;
            }
            
            if (status === 'Completed') {
                const stopSof = (transfer.sof || []).find((s: SOFItem) => (s.event.includes('STOP PUMPING') || s.event.includes('Pumping Stopped')) && s.status === 'complete');
                if (stopSof?.time) {
                    return <div><p className="font-semibold text-sm">Completed at</p><p className="text-xs text-text-tertiary">{new Date(stopSof.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>;
                }
                return <p className="font-semibold text-sm">Completed</p>;
            }
    
            // Pending
            return <div><p className="font-semibold text-sm">Starts at</p><p className="text-xs text-text-tertiary">{new Date(operationEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>;
        };
    
        return (
            <div 
                onClick={onClick}
                className="grid grid-cols-[2fr,1.2fr,1fr,1.2fr,1fr] gap-4 items-center p-3 rounded-lg cursor-pointer hover:bg-slate-50 border border-slate-200"
            >
                <div>
                    <p className="font-bold text-base text-text-primary truncate">{transfer.product}</p>
                    <p className="text-xs text-text-tertiary truncate">{transfer.customer}</p>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-sm">{transferred.toFixed(0)} / {total.toLocaleString()} T</p>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                        <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${total > 0 ? (transferred / total) * 100 : 0}%` }}></div>
                    </div>
                </div>
                <div className="text-center">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${statusColor}`}>{status}</span>
                </div>
                <div className="text-right">
                    {renderEtcColumn()}
                </div>
                <div className="text-right font-mono text-sm text-text-secondary">{formatInfraName(transfer.infrastructureId)}</div>
            </div>
        );
    };
    
    const allTransfers = plan.transferPlan.flatMap((line, lineIndex) => line.transfers.map((t, transferIndex) => ({ ...t, lineIndex, transferIndex, infrastructureId: line.infrastructureId })));

    const renderVesselContent = () => {
        const getActiveVesselSofEvent = (sofItems: SOFItem[]): string | null => {
            for (let i = 0; i < sofItems.length; i++) {
                const item = sofItems[i];
                if (item.status === 'pending') {
                    if (!isPreviousStepComplete(sofItems, i)) return null;
                    const baseEventName = item.event.replace(/^(Rework #\d+: )/, '');
                    if (baseEventName === 'LAST HOSE DISCONNECTED' && !areAllCommoditiesFinishedPumping(plan.transferPlan || [])) return null;
                    return item.event;
                }
            }
            return null;
        };
        const activeVesselSof = getActiveVesselSofEvent(plan.sof || []);
        const handleDisabledVesselSofClick = (item: SOFItem, index: number, items: SOFItem[]) => {
            if (!isPreviousStepComplete(items, index)) setInfoModal({ isOpen: true, title: 'Step Unavailable', message: `Please complete the previous step first: "${items[index - 1].event}"` });
            else if (item.event.includes('LAST HOSE DISCONNECTED') && !areAllCommoditiesFinishedPumping(plan.transferPlan || [])) setInfoModal({ isOpen: true, title: 'Vessel Not Ready', message: "Cannot disconnect until all product transfers are complete." });
            else setInfoModal({ isOpen: true, title: 'Step Unavailable', message: 'This step is not yet available.' });
        };
        return (
            <div>
                <SofSection 
                    sofItems={plan.sof || []} 
                    onSofClick={handleCommonSofClick} 
                    activeStepEvent={activeVesselSof} 
                    onDisabledClick={handleDisabledVesselSofClick} 
                    onUndoClick={(item) => { setOptimisticUndoEvent(item.event); setUndoModalState({ isOpen: true, item, context: 'vessel' }); }}
                    onEditClick={(item) => setEditingSof(item)}
                    optimisticUndoEvent={optimisticUndoEvent}
                />
            </div>
        );
    };

    const InvalidPlanWarning = () => (
        <div className="card p-6 bg-red-50 border-red-300 text-center">
            <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
            <h3 className="font-bold text-red-800 text-xl mb-2">Operation Plan is Incomplete or Unsafe</h3>
            <p className="text-red-700 mb-4">The Statement of Facts and other operational controls are hidden until the following issues are resolved:</p>
            <ul className="list-disc list-inside text-left max-w-md mx-auto mb-6 text-red-700 font-medium text-sm">
                {validation.issues.map((issue, index) => <li key={index}>{issue}</li>)}
            </ul>
            <button onClick={() => switchView('operation-plan', plan.id)} className="btn-primary">
                <i className="fas fa-edit mr-2"></i>Go to Plan Editor to Resolve
            </button>
        </div>
    );

    return (
        <>
            <DirectToBayModal
                isOpen={directToBayModalState.isOpen}
                onClose={() => setDirectToBayModalState({ isOpen: false, isRevert: false })}
                onConfirm={handleConfirmBayAction}
                operation={plan}
                isRevert={directToBayModalState.isRevert}
            />
            <ReworkModal 
                isOpen={isReworkModalOpen}
                onClose={() => setIsReworkModalOpen(false)}
                operation={plan}
            />
            <TruckRejectionModal
                isOpen={isRejectionModalOpen}
                onClose={() => setIsRejectionModalOpen(false)}
                operation={plan}
            />
            {editingSof && (
                <SofDetailsModal
                    isOpen={!!editingSof}
                    onClose={() => setEditingSof(null)}
                    onSave={handleSaveSofDetails}
                    sofItem={editingSof}
                    plan={plan}
                    transfer={plan.transferPlan.flatMap(l => l.transfers).find(t => (t.sof || []).some(s => s.event === editingSof.event && s.loop === editingSof.loop))}
                />
            )}
            <SignatureModal
                isOpen={!!signingTarget}
                onClose={() => setSigningTarget(null)}
                onSave={(dataUrl) => {
                    if (signingTarget !== null) {
                        handleSurveyorDataChange(signingTarget.index, 'surveyorSignature', dataUrl);
                    }
                    setSigningTarget(null);
                }}
                initialSignature={signingTarget !== null ? surveyorModalData?.[signingTarget.index]?.surveyorSignature : undefined}
            />
            <Modal
                isOpen={isSurveyorModalOpen}
                onClose={() => setIsSurveyorModalOpen(false)}
                title="Surveyor Check Data Entry"
                footer={<>
                    <button onClick={() => setIsSurveyorModalOpen(false)} className="btn-secondary">Cancel</button>
                    <button onClick={handleSaveSurveyorData} className="btn-primary">Save and Complete Step</button>
                </>}
            >
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Please enter the sample status, slop quantity, and surveyor signature for each product before completing this step.</p>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {(surveyorModalData || []).map((transfer, index) => (
                            <div key={transfer.id || index} className="p-3 border rounded-lg bg-slate-50">
                                <h5 className="font-bold text-base mb-2">{transfer.product}</h5>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                    <div>
                                        <label>Samples Passed?</label>
                                        <select className="w-full" value={transfer.samplesPassed || ''} onChange={e => handleSurveyorDataChange(index, 'samplesPassed', e.target.value as 'Y' | 'N' | '')}>
                                            <option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Slop (MT)</label>
                                        <input type="number" className="w-full" value={transfer.slop || ''} onChange={e => handleSurveyorDataChange(index, 'slop', e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Surveyor Signature</label>
                                        <div className="border bg-white rounded-md">
                                            <SignatureDisplay signature={transfer.surveyorSignature || ''} onClick={() => setSigningTarget({ index })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
            <Modal isOpen={infoModal.isOpen} onClose={() => setInfoModal({ isOpen: false, title: '', message: '' })} title={infoModal.title} footer={<button onClick={() => setInfoModal({ isOpen: false, title: '', message: '' })} className="btn-primary">OK</button>}><p>{infoModal.message}</p></Modal>
            <UndoSofModal isOpen={undoModalState.isOpen} onClose={handleCloseUndoModal} onConfirm={handleUndo} />
            <div className="relative">
                {op.status === 'active' && <ScadaDataSidebar isCollapsed={isScadaSidebarCollapsed} onToggle={() => setIsScadaSidebarCollapsed(p => !p)} />}
                <div className="p-4 sm:p-6 space-y-6">
                    <div className="card p-4">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h3 className="font-bold text-2xl sm:text-3xl">{op.transportId} ({op.modality})</h3>
                                <p className="text-sm">Progress: {progress.completed} of {progress.total} steps completed</p>
                            </div>
                            <div className="flex items-center flex-wrap gap-2 justify-end">
                                <button onClick={() => switchView('operation-plan', op.id)} className="btn-secondary"><i className="fas fa-edit mr-2"></i>Edit Plan</button>
                                <button onClick={() => setDelayModalOpen(true)} className="btn-danger"><i className="fas fa-exclamation-triangle mr-2"></i>Log Delay</button>
                                <button onClick={() => handleCompleteOperation(op.id)} disabled={!isOperationCompletable} className="btn-primary disabled:!bg-slate-400"><i className="fas fa-check-circle mr-2"></i>Completed</button>
                            </div>
                        </div>
                    </div>
                    
                     {op.modality === 'vessel' ? (
                        <>
                            {!validation.isValid ? <InvalidPlanWarning /> : (
                                <>
                                <div className="card !p-5">
                                    <h3 className="text-xl font-bold text-brand-dark mb-4">All Transfers Overview</h3>
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                        {allTransfers.map(t => (
                                            <TransferOverviewRow 
                                                key={`${t.lineIndex}-${t.transferIndex}`} 
                                                transfer={t}
                                                onClick={() => switchView('product-transfer-details', op.id, t.lineIndex, t.transferIndex)}
                                                scadaData={scadaData}
                                                operationEta={plan.eta}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="border-b"><nav className="-mb-px flex space-x-6 px-6"><button onClick={() => setActiveTab('sof')} className={`tab ${activeTab === 'sof' ? 'active' : ''}`}>Statement of Facts</button><button onClick={() => setActiveTab('requirements')} className={`tab ${activeTab === 'requirements' ? 'active' : ''}`}>Special Requirements</button><button onClick={() => setActiveTab('shippingLog')} className={`tab ${activeTab === 'shippingLog' ? 'active' : ''}`}>Shipping Log</button></nav></div>
                                    <div className="p-6">
                                        {activeTab === 'sof' && renderVesselContent()}
                                        {activeTab === 'requirements' && (
                                            <div className="space-y-4">
                                                {(plan.specialRequirements || []).length > 0 ? (plan.specialRequirements || []).map(req => (
                                                    <div key={req.name} className="p-3 border rounded-lg">
                                                        <h4 className="font-bold text-base mb-2">{req.name}</h4>
                                                        <VesselRequirementLogger requirement={req} onLog={(data) => handleRequirementLog(req.name, data)} />
                                                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                                            {(req.data.log || []).slice().reverse().map((logItem: any, i: number) => (
                                                                <div key={i} className="text-xs p-1.5 bg-slate-50 rounded">
                                                                    <span className="font-semibold text-slate-600">{formatDateTime(logItem.time)} ({logItem.user}): </span>
                                                                    <span className="text-slate-500">{Object.entries(logItem).filter(([k]) => !['time', 'user'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )) : <p className="text-sm text-center text-slate-500 italic p-4">No special requirements for this vessel.</p>}
                                            </div>
                                        )}
                                        {activeTab === 'shippingLog' && <ShippingLog plan={plan} setPlan={setPlan} />}
                                    </div>
                                </div>
                                </>
                            )}
                        </>
                    ) : ( 
                        !validation.isValid ? <InvalidPlanWarning /> : (
                            <NonVesselDetails 
                                plan={plan}
                                setPlan={setPlan}
                                saveCurrentPlan={saveCurrentPlan}
                                op={op}
                                currentUser={currentUser}
                                setInfoModal={setInfoModal}
                                setUndoModalState={setUndoModalState}
                                setEditingSof={setEditingSof}
                                onReworkClick={() => setIsReworkModalOpen(true)}
                                onRejectClick={() => setIsRejectionModalOpen(true)}
                                onDirectToBay={() => setDirectToBayModalState({ isOpen: true, isRevert: false })}
                                onRevertCall={(item) => setDirectToBayModalState({ isOpen: true, isRevert: true })}
                                optimisticUndoEvent={optimisticUndoEvent}
                                handleUndoClick={(item) => { setOptimisticUndoEvent(item.event); setUndoModalState({ isOpen: true, item, context: { lineIndex: 0, transferIndex: 0 } }); }}
                            /> 
                        )
                    )}
                </div>
            </div>
        </>
    );
};

export default OperationDetails;