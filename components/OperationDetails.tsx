
import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { SOFItem, SpecialServiceData, Transfer, Operation, DipSheetEntry, ActivityLogItem, ScadaData, HoseLogEntry, SampleLogEntry, PressureCheckLogEntry, ArrivalChecklist } from '../types';
import { formatInfraName, interpolate, canPerformSofAction, canApproveGate, validateOperationPlan, calculateOperationProgress, canReschedule, canRequestReschedule, getIcon, canEditPlan } from '../utils/helpers';
import Modal from './Modal';
import SignatureModal from './SignatureModal';
import UndoSofModal from './UndoSofModal';
import HoseLogModal from './HoseLogModal';
import SampleLogModal from './SampleLogModal';
import SofDetailsModal from './SofDetailsModal';
import PressureCheckModal from './PressureCheckModal';
import ServiceSlider from './ServiceSlider';
import ReworkModal from './ReworkModal';
import TruckRejectionModal from './TruckRejectionModal';
import RequeuePriorityModal from './RequeuePriorityModal';
import DocumentManager from './DocumentManager';
import ProductTransferDetails from './ProductTransferDetails';
import ShippingLog from './ShippingLog';
import DelayModal from './DelayModal';

const isPreviousStepComplete = (sofItems: SOFItem[], currentIndex: number): boolean => {
    if (currentIndex === 0) return true;
    const currentItem = sofItems[currentIndex];
    const previousItem = sofItems[currentIndex - 1];

    if (currentItem.loop > previousItem.loop) {
        return true;
    }

    return previousItem?.status === 'complete';
};

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

const TransferSidebarCard: React.FC<{ transfer: any, onClick: () => void, isSelected: boolean }> = ({ transfer, onClick, isSelected }) => {
    const { scadaData, switchView } = useContext(AppContext)!;

    const { phase, isPumping, percentage, eta } = useMemo(() => {
        const sof = transfer.sof || [];
        if (!sof || sof.length === 0) return { phase: 'Pending', isPumping: false, percentage: 0, eta: null };

        const completedSteps = sof.filter((s: SOFItem) => s.status === 'complete' && s.time).sort((a: SOFItem, b: SOFItem) => new Date(b.time).getTime() - new Date(a.time).getTime());
        
        if (completedSteps.length === 0) return { phase: 'Scheduled', isPumping: false, percentage: 0, eta: null };
        
        const pumpingStartedStep = completedSteps.find((s: SOFItem) => s.event.includes('START PUMPING'));
        const pumpingStopped = completedSteps.some((s: SOFItem) => s.event.includes('STOP PUMPING'));
        const slopsPassedStep = completedSteps.find((s: SOFItem) => s.event.includes('SLOPS SAMPLE PASSED'));

        const isCurrentlyPumping = !!pumpingStartedStep && !pumpingStopped;
        const isProductInTank = !!slopsPassedStep;
        const isFullyComplete = pumpingStopped;

        let progressPercentage = 0;
        const transferred = (transfer.transferredTonnes || 0) + (transfer.slopsTransferredTonnes || 0);
        const total = transfer.tonnes || 0;
        if (total > 0) {
            progressPercentage = (transferred / total) * 100;
        }

        let calculatedEta: string | null = null;
        if (isCurrentlyPumping && isProductInTank) {
            const flowRate = scadaData[transfer.infrastructureId]?.flowRate;
            if (flowRate && flowRate > 0) {
                const remainingTonnes = total - transferred;
                if (remainingTonnes > 0) {
                    const etcHours = remainingTonnes / flowRate;
                    const etaTime = new Date(Date.now() + etcHours * 3600 * 1000);
                    calculatedEta = etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            }
        }

        if (isFullyComplete) return { phase: 'Completed', isPumping: false, percentage: 100, eta: null };
        
        const latestStep = completedSteps[0];
        const phaseName = latestStep.event.replace(/^(Rework #\d+: )/, '');

        return { phase: phaseName, isPumping: isCurrentlyPumping, percentage: progressPercentage, eta: calculatedEta };

    }, [transfer.sof, transfer.tonnes, transfer.transferredTonnes, transfer.slopsTransferredTonnes, transfer.infrastructureId, scadaData]);

    const cleaningStatus = useMemo(() => {
        const cleaningSof = transfer.preTransferCleaningSof;
        if (cleaningSof && cleaningSof.length > 0) {
            const isCleaningComplete = cleaningSof.every((s: SOFItem) => s.status === 'complete');
            return isCleaningComplete ? 'complete' : 'pending';
        }
        return 'none';
    }, [transfer.preTransferCleaningSof]);

    const baseClasses = "p-2 rounded-lg border-2 transition-all duration-200 bg-white";
    const selectedClasses = isSelected ? "border-indigo-500 shadow-md" : "border-slate-200";
    
    const tank = transfer.direction.includes(' to Tank') ? transfer.to : transfer.from;
    const handleTankClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        switchView('tank-status-details', null, null, null, undefined, tank);
    };

    return (
         <div onClick={onClick} className={`${baseClasses} ${selectedClasses} shadow-sm cursor-pointer hover:border-slate-400`}>
            <div className="flex justify-between items-center text-xs">
                <p className="font-bold text-text-primary truncate" title={transfer.product}>{transfer.product}</p>
                <div className="flex items-center gap-2">
                    {cleaningStatus === 'pending' && (
                        <i className="fas fa-shower text-orange-500" title="Line cleaning required before this transfer"></i>
                    )}
                    {cleaningStatus === 'complete' && (
                        <i className="fas fa-check-circle text-green-500" title="Line cleaning complete"></i>
                    )}
                    <span className={`px-1 text-[0.6rem] font-bold rounded ${isPumping ? 'bg-green-200 text-green-800' : 'bg-slate-200 text-slate-700'}`}>{phase}</span>
                </div>
            </div>
            {isPumping ? (
                <>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 my-1 relative">
                        <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                        <span className="absolute -top-0.5 -right-1.5 text-[0.6rem] font-bold">{Math.floor(percentage)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-[0.65rem]">
                        <button onClick={handleTankClick} className="text-blue-600 hover:underline truncate" title={`View status for tank ${tank}`}>{transfer.from} &rarr; {transfer.to}</button>
                        <p className="text-text-tertiary truncate font-semibold">{eta ? `ETA: ${eta}` : ''}</p>
                    </div>
                </>
            ) : (
                <div className="my-1">
                    <button onClick={handleTankClick} className="text-blue-600 hover:underline text-[0.65rem] truncate" title={`View status for tank ${tank}`}>{transfer.from} &rarr; {transfer.to}</button>
                </div>
            )}
        </div>
    );
};

const StatusBanner: React.FC<{ plan: Operation | null, processReworkTruck: (id: string) => void, openAcceptNoShowModal: (id: string) => void }> = ({ plan, processReworkTruck, openAcceptNoShowModal }) => {
    if (!plan || (plan.currentStatus !== 'No Show' && plan.currentStatus !== 'Reschedule Required' && plan.currentStatus !== 'Reschedule Requested')) {
        return null;
    }

    const isNoShow = plan.currentStatus === 'No Show';
    const isRework = plan.requeueDetails?.reason?.startsWith('Rework:');
    const isRequest = plan.currentStatus === 'Reschedule Requested';

    let actionButton = null;
    if (plan.modality === 'truck' && !isRequest) {
        if (isRework) {
            actionButton = (
                <button
                    onClick={() => processReworkTruck(plan.id)}
                    className="btn-primary !bg-orange-500 hover:!bg-orange-600"
                >
                    Process Rework
                </button>
            );
        } else {
            actionButton = (
                <button
                    onClick={() => openAcceptNoShowModal(plan.id)}
                    className="btn-primary"
                >
                    Process Arrival
                </button>
            );
        }
    }

    const bgColor = isRework ? 'bg-orange-50' : isNoShow ? 'bg-red-50' : 'bg-yellow-50';
    const borderColor = isRework ? 'border-orange-300' : isNoShow ? 'border-red-300' : 'border-yellow-300';
    const textColor = isRework ? 'text-orange-800' : isNoShow ? 'text-red-800' : 'text-yellow-800';
    const iconColor = isRework ? 'text-orange-500' : isNoShow ? 'text-red-500' : 'text-yellow-500';
    const icon = isRequest ? 'fa-question-circle' : isRework ? 'fa-tools' : isNoShow ? 'fa-calendar-times' : 'fa-calendar-alt';
    const title = isRequest ? 'Reschedule Requested by Operator' : isRework ? 'Rework Required' : isNoShow ? 'Truck is a No Show' : 'Reschedule Required';
    const reason = plan.requeueDetails?.reason || 'No reason specified.';

    return (
        <div className={`p-4 flex items-center justify-between gap-4 rounded-lg border ${bgColor} ${borderColor}`}>
            <div className="flex items-center gap-4">
                <i className={`fas ${icon} ${iconColor} text-3xl`}></i>
                <div>
                    <h3 className={`font-bold ${textColor} text-xl`}>{title}</h3>
                    <p className={`text-sm ${textColor.replace('800', '700')}`}>Reason: {reason}</p>
                </div>
            </div>
            {actionButton}
        </div>
    );
};

const InvalidPlanWarning: React.FC<{ plan: Operation, validation: { isValid: boolean; issues: string[] }, switchView: (view: any, opId?: string) => void }> = ({ plan, validation, switchView }) => (
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

// --- NEW Checklist Item Component to prevent re-render issues ---
const ChecklistItem: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; }> = ({ label, checked, onChange }) => (
    <label className="flex items-center space-x-3 p-3 rounded-md bg-white border cursor-pointer hover:bg-slate-50">
        <input
            type="checkbox"
            className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
        />
        <span className="font-medium">{label}</span>
    </label>
);

const CHECKLIST_ITEMS = {
    inspection: [
        { key: 'tiresOk', label: 'Tires & Brakes Check' },
        { key: 'leaksOk', label: 'No Visible Leaks' },
        { key: 'hosesOk', label: 'Hoses & Fittings Secure' },
        { key: 'safetySealsOk', label: 'Safety Seals Intact' },
    ],
    documentation: [
        { key: 'bolReceived', label: 'Bill of Lading (BOL) Received' },
        { key: 'coaReceived', label: 'Certificate of Analysis (COA) Received' },
        { key: 'driverLicenseOk', label: "Driver's License & Credentials Verified" },
    ]
};

const ArrivalChecklistContent: React.FC<{
    plan: Operation;
    setPlan: React.Dispatch<React.SetStateAction<Operation | null>>;
    onDocumentUpdate: (op: Operation, details: { action: string; details: string }) => void;
}> = ({ plan, setPlan, onDocumentUpdate }) => {
    const { acceptTruckArrival, currentUser } = useContext(AppContext)!;
    const canApprove = canApproveGate(currentUser);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && plan) {
            try {
                const base64 = await blobToBase64(file);
                setPlan(prev => {
                    if (!prev) return null;
                    const newChecklist = {
                        ...(prev.arrivalChecklist || {
                            tiresOk: 'pending', leaksOk: 'pending', hosesOk: 'pending', safetySealsOk: 'pending',
                            bolReceived: 'pending', coaReceived: 'pending', driverLicenseOk: 'pending'
                        }),
                        arrivalPhoto: base64
                    };
                    return { ...prev, arrivalChecklist: newChecklist as ArrivalChecklist };
                });
            } catch (error) {
                console.error("Error converting file to base64:", error);
                alert("Could not process the selected file.");
            }
        }
    };

    const handleClearPhoto = () => {
        setPlan(prev => {
            if (!prev || !prev.arrivalChecklist) return prev;
            const { arrivalPhoto, ...restOfChecklist } = prev.arrivalChecklist;
            return { ...prev, arrivalChecklist: restOfChecklist };
        });
    };

    const handleChecklistChange = (key: keyof ArrivalChecklist, isChecked: boolean) => {
        if (!plan) return;
        setPlan(prev => {
            if (!prev) return null;
            const newChecklist = {
                ...(prev.arrivalChecklist || {
                    tiresOk: 'pending', leaksOk: 'pending', hosesOk: 'pending', safetySealsOk: 'pending',
                    bolReceived: 'pending', coaReceived: 'pending', driverLicenseOk: 'pending'
                }),
                [key]: isChecked ? 'complete' : 'pending'
            };
            return { ...prev, arrivalChecklist: newChecklist as ArrivalChecklist };
        });
    };

    const checklist = plan.arrivalChecklist || {};
    const allKeys: (keyof ArrivalChecklist)[] = [
        ...CHECKLIST_ITEMS.inspection.map(i => i.key as keyof ArrivalChecklist),
        ...CHECKLIST_ITEMS.documentation.map(i => i.key as keyof ArrivalChecklist)
    ];
    const isChecklistComplete = allKeys.every(key => checklist[key as keyof typeof checklist] === 'complete');

    return (
        <div className="space-y-6">
            <div>
                <h3 className="font-semibold text-lg text-text-primary mb-2">Industry Standards Inspection Checklist</h3>
                <div className="space-y-2">
                    {CHECKLIST_ITEMS.inspection.map(item => (
                        <ChecklistItem
                            key={item.key}
                            label={item.label}
                            checked={plan.arrivalChecklist?.[item.key as keyof ArrivalChecklist] === 'complete'}
                            onChange={isChecked => handleChecklistChange(item.key as keyof ArrivalChecklist, isChecked)}
                        />
                    ))}
                </div>
            </div>
            <div>
                <h3 className="font-semibold text-lg text-text-primary mb-2">Documentation Required</h3>
                <div className="space-y-2">
                    {CHECKLIST_ITEMS.documentation.map(item => (
                        <ChecklistItem
                            key={item.key}
                            label={item.label}
                            checked={plan.arrivalChecklist?.[item.key as keyof ArrivalChecklist] === 'complete'}
                            onChange={isChecked => handleChecklistChange(item.key as keyof ArrivalChecklist, isChecked)}
                        />
                    ))}
                </div>
            </div>
            <div>
                <h3 className="font-semibold text-lg text-text-primary mb-2">Arrival Photo (Optional)</h3>
                {plan.arrivalChecklist?.arrivalPhoto ? (
                    <div className="mt-2 space-y-2">
                        <img src={plan.arrivalChecklist.arrivalPhoto} alt="Arrival evidence" className="max-h-60 w-auto rounded-lg border" />
                        <button onClick={handleClearPhoto} className="btn-secondary">Clear Photo</button>
                    </div>
                ) : (
                    <div className="mt-2 flex gap-2">
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex-1">
                            <i className="fas fa-upload mr-2"></i>Upload Photo
                        </button>
                        <button
                            className="btn-secondary flex-1 opacity-50 cursor-not-allowed"
                            disabled
                            title="Camera functionality is disabled for this demo."
                        >
                            <i className="fas fa-camera mr-2"></i>Take Photo
                        </button>
                    </div>
                )}
            </div>
            <div className="pt-6 border-t">
                <h3 className="font-semibold text-lg text-text-primary mb-2">Supporting Documents</h3>
                <DocumentManager operation={plan} onUpdate={onDocumentUpdate} />
            </div>
            <div className="mt-6 pt-6 border-t">
                <button
                    onClick={() => acceptTruckArrival(plan.id)}
                    disabled={!isChecklistComplete || !canApprove}
                    className="btn-primary w-full disabled:opacity-50"
                    title={!canApprove ? "Permission Denied" : !isChecklistComplete ? "Complete all checklist items to approve" : "Approve Truck Arrival"}
                >
                    <i className="fas fa-check-circle mr-2"></i>
                    Approve Truck Arrival
                </button>
            </div>
        </div>
    );
};

const OperationDetails: React.FC = () => {
    const context = useContext(AppContext);
    
    // Safe defaults for hooks to execute unconditionally
    const activeOpId = context?.activeOpId || null;
    const getOperationById = context?.getOperationById || (() => undefined);
    const switchView = context?.switchView || (() => {});
    const handleCompleteOperation = context?.handleCompleteOperation || (() => {});
    const currentUser = context?.currentUser || { role: 'Operator', name: 'Unknown' };
    const scadaData = context?.scadaData || {};
    const plan = context?.editingOp || null;
    const setPlan = context?.setEditingOp || (() => {});
    const saveCurrentPlan = context?.saveCurrentPlan || (() => {});
    const holds = context?.holds || [];
    const settings = context?.settings || { modalityServices: {} };
    const currentTerminalSettings = context?.currentTerminalSettings || { masterTanks: {} };
    const addActivityLog = context?.addActivityLog || (() => {});
    const revertCallOff = context?.revertCallOff || (() => {});
    const simulatedTime = context?.simulatedTime || new Date();
    const openAcceptNoShowModal = context?.openAcceptNoShowModal || (() => {});
    const requeueOperation = context?.requeueOperation || (() => {});
    const openRescheduleModal = context?.openRescheduleModal || (() => {});
    const processReworkTruck = context?.processReworkTruck || (() => {});
    const updateOperationServiceStatus = context?.updateOperationServiceStatus || (() => {});
    const updateTransferServiceStatus = context?.updateTransferServiceStatus || (() => {});
    const acceptTruckArrival = context?.acceptTruckArrival || (() => {});
    const openRequestRescheduleModal = context?.openRequestRescheduleModal || (() => {});

    const op = getOperationById(activeOpId);
    
    const [delayModalOpen, setDelayModalOpen] = useState(false);
    const [infoModal, setInfoModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });
    const [activeTab, setActiveTab] = useState<'sof' | 'shippingLog' | 'documents' | 'auditLog' | 'lineCleaning' | 'arrivalChecklist' | 'services'>('sof');
    const [undoModalState, setUndoModalState] = useState<{ isOpen: boolean; item: SOFItem | null; context: 'vessel' | { lineIndex: number; transferIndex: number, type: 'commodity' | 'cleaning' } }>({ isOpen: false, item: null, context: 'vessel' });
    const [editingSof, setEditingSof] = useState<SOFItem | null>(null);
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [optimisticUndoEvent, setOptimisticUndoEvent] = useState<string | null>(null);
    const [priorityModalState, setPriorityModalState] = useState<{isOpen: boolean, source: 'reschedule' | 'rework' | null}>({isOpen: false, source: null});
    const [rejectionPriority, setRejectionPriority] = useState<'high' | 'normal'>('normal');
    const [viewingTransferIndices, setViewingTransferIndices] = useState<{ lineIndex: number; transferIndex: number } | null>(null);
    const [comment, setComment] = useState('');
    const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);

    const validation = useMemo(() => {
        if (!plan) return { isValid: true, issues: [] };
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        return validateOperationPlan(plan, currentTerminalSettings, settings, activeHolds);
    }, [plan, holds, currentTerminalSettings, settings]);

    useEffect(() => {
        if (plan?.truckStatus === 'Registered') {
            setActiveTab('arrivalChecklist');
        } else if (activeTab === 'arrivalChecklist' && plan?.truckStatus !== 'Registered') {
            setActiveTab('sof');
        }
    }, [plan?.id, plan?.truckStatus]);

    const hasPendingCleaning = useMemo(() => {
        if (!plan || plan.modality !== 'vessel') return false;
        return (plan.transferPlan || []).some(line => 
            line.transfers.some(t => 
                t.preTransferCleaningSof && t.preTransferCleaningSof.some(s => s.status !== 'complete')
            )
        );
    }, [plan]);

    const isChecklistIncompleteAndArrived = useMemo(() => {
        if (!plan || plan.modality !== 'truck' || plan.truckStatus !== 'Registered') {
            return false;
        }
        const checklist = plan.arrivalChecklist;
        return !checklist || Object.values(checklist).some(status => status !== 'complete');
    }, [plan]);

    useEffect(() => {
        if (!plan || plan.modality !== 'vessel') return;

        const mainSurveyorStep = plan.sof?.find(s => s.event === 'SURVEYOR CHECKS COMPLETED' && s.status === 'pending');
        if (!mainSurveyorStep) return;

        const allTransfers = (plan.transferPlan || []).flatMap(line => line.transfers);
        if (allTransfers.length === 0) return;

        const allSamplesPassed = allTransfers.every(transfer => 
            transfer.sof?.some(s => s.event.includes('SLOPS SAMPLE PASSED') && s.status === 'complete')
        );

        if (allSamplesPassed) {
            const newOp = JSON.parse(JSON.stringify(plan));
            const sofIndex = newOp.sof.findIndex((s: SOFItem) => s.event === 'SURVEYOR CHECKS COMPLETED' && s.status === 'pending');
            
            if (sofIndex > -1) {
                const time = simulatedTime.toISOString();
                newOp.sof[sofIndex] = {
                    ...newOp.sof[sofIndex],
                    status: 'complete',
                    time: time,
                    user: 'System',
                };
                newOp.activityHistory.push({
                    time: time,
                    user: 'System',
                    action: 'SOF_UPDATE',
                    details: 'SURVEYOR CHECKS COMPLETED automatically marked complete as all product samples have passed.'
                });
                
                setPlan(newOp);
            }
        }
    }, [plan, setPlan, simulatedTime]);

    const isOperationCompletable = useMemo(() => {
        if (!plan) return false;
        
        if (plan.modality === 'vessel') {
            const lastCommonStepName = 'CREW COMPLETED / SITE SECURE'; // Updated to match VESSEL_COMMON_EVENTS last step
            const isCommonSofComplete = (() => {
                if (!plan.sof || plan.sof.length === 0) return false;
                const maxLoop = Math.max(1, ...plan.sof.map(s => s.loop || 1));
                const finalStep = plan.sof.find(s => s.loop === maxLoop && s.event.endsWith(lastCommonStepName));
                return finalStep?.status === 'complete';
            })();
    
            const lastCommodityStepName = 'PIG RECEIVED / COMMODITY COMPLETED'; // Updated to match VESSEL_COMMODITY_EVENTS
            const allCommoditiesComplete = (plan.transferPlan || []).every(line => 
                line.transfers.every(transfer => {
                    if (!transfer.sof || transfer.sof.length === 0) return false;
                    const maxLoop = Math.max(1, ...transfer.sof.map(s => s.loop || 1));
                    const finalStep = transfer.sof.find(s => s.loop === maxLoop && s.event.endsWith(lastCommodityStepName));
                    return finalStep?.status === 'complete';
                })
            );
            
            return isCommonSofComplete && allCommoditiesComplete;
    
        } else { // Truck or Rail
            if (!plan.transferPlan || plan.transferPlan.length === 0) return false;
            
            return plan.transferPlan.every(line => 
                line.transfers.every(transfer => {
                    if (!transfer.sof || transfer.sof.length === 0) {
                        return false;
                    }

                    const maxLoop = Math.max(1, ...transfer.sof.map(s => s.loop || 1));
                    
                    const latestSequenceSof = transfer.sof.filter(s => s.loop === maxLoop);

                    if (latestSequenceSof.length === 0) return false;

                    return latestSequenceSof.every(s => s.status === 'complete');
                })
            );
        }
    }, [plan]);
    
    const overallLog = useMemo(() => {
        if (!plan) return [];
        const allLogs: (ActivityLogItem & { context?: string })[] = [...plan.activityHistory];
        
        plan.transferPlan.forEach(line => {
            line.transfers.forEach(transfer => {
                if (transfer.transferLog) {
                    const contextualLogs = transfer.transferLog.map(log => ({
                        ...log,
                        context: transfer.product
                    }));
                    allLogs.push(...contextualLogs);
                }
            });
        });

        return allLogs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }, [plan]);

    const isPumping = useMemo(() => {
        if (!plan || plan.modality !== 'truck') return false;
        return ['Loading', 'Pumping'].includes(plan.truckStatus || '');
    }, [plan]);

    // Only return early after ALL hooks have been called.
    if (!context) return <div>Loading...</div>;
    if (!op || !plan) { return <div className="text-center p-8"><h2 className="text-xl font-semibold">No Operation Selected</h2></div>; }
    
    const handleAddComment = () => {
        if (comment.trim() && plan) {
            addActivityLog(plan.id, 'COMMENT', comment.trim());
            setComment('');
        }
    };
    
    const handleDocumentUpdate = (updatedOperation: Operation, auditDetails: { action: string; details: string; }) => {
        if (plan) {
            const newLog: ActivityLogItem = {
                time: simulatedTime.toISOString(),
                user: currentUser.name,
                action: auditDetails.action,
                details: auditDetails.details,
            };
            const finalOp = {
                ...updatedOperation,
                activityHistory: [...(updatedOperation.activityHistory || []), newLog]
            };
            setPlan(finalOp);
        }
    };
    
    const handleCommonSofClick = (eventName: string, loop: number) => {
        if (eventName === 'SURVEYOR CHECKS COMPLETED') {
            const pendingTransfers = (plan.transferPlan || [])
                .flatMap(line => line.transfers)
                .filter(transfer => 
                    !transfer.sof?.some(s => s.event.includes('SLOPS SAMPLE PASSED') && s.status === 'complete')
                )
                .map(t => t.product);

            if (pendingTransfers.length > 0) {
                setInfoModal({
                    isOpen: true,
                    title: 'Step Not Ready',
                    message: `Cannot complete surveyor checks. The following products are still awaiting sample pass confirmation:\n\n- ${pendingTransfers.join('\n- ')}`
                });
            }
            return;
        }

        const sofItem: SOFItem = { event: eventName, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop };
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;

        if (newOp.status === 'planned') {
            newOp.status = 'active';
            newOp.activityHistory.push({ time: sofItem.time, user: currentUser.name, action: 'STATUS_UPDATE', details: `Operation automatically activated on first SOF step.` });
        }

        const sofIndex = (newOp.sof || []).findIndex(item => item.event === eventName && item.loop === loop);
        if (sofIndex > -1) newOp.sof![sofIndex] = sofItem; else newOp.sof = [...(newOp.sof || []), sofItem];
        newOp.activityHistory.push({ time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `${eventName} marked as complete.` });
        
        // Check for completion based on last event. The string must match exactly from constants.
        const lastStepName = 'CREW COMPLETED / SITE SECURE';
        if (eventName.endsWith(lastStepName) && (plan.transferPlan || []).every(line => line.transfers.every(t => (t.sof||[]).some(s => s.event.includes('COMMODITY COMPLETED') && s.status === 'complete')))) {
            handleCompleteOperation(newOp.id);
        } else {
            setPlan(newOp);
            saveCurrentPlan(newOp);
        }
    };
    
    const handleCleaningSofClick = (lineIndex: number, transferIndex: number, eventName: string, loop: number) => {
        const sofItem: SOFItem = { event: eventName, status: 'complete', time: simulatedTime.toISOString(), user: currentUser.name, loop };
        const newOp = JSON.parse(JSON.stringify(plan)) as Operation;
        const transfer = newOp.transferPlan?.[lineIndex]?.transfers?.[transferIndex];
        if (!transfer?.preTransferCleaningSof) return;
        
        const sofIndex = transfer.preTransferCleaningSof.findIndex(item => item.event === eventName && item.loop === loop);
        if (sofIndex > -1) {
            transfer.preTransferCleaningSof[sofIndex] = sofItem;
        }
        
        newOp.activityHistory.push({ time: sofItem.time, user: currentUser.name, action: 'SOF_UPDATE', details: `Line Cleaning: ${eventName} marked complete for ${transfer.product}.` });
        
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
            const { lineIndex, transferIndex, type } = undoModalState.context as { lineIndex: number; transferIndex: number; type: 'commodity' | 'cleaning' };
            const transfer = newOp.transferPlan[lineIndex].transfers[transferIndex];
            sofArray = type === 'cleaning' ? transfer.preTransferCleaningSof : transfer.sof;
            logContext = `${type} for ${transfer.product}`;
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
            const { lineIndex, transferIndex, type } = undoModalState.context as { lineIndex: number; transferIndex: number; type: 'commodity' | 'cleaning' };
            if (type === 'cleaning') {
                newOp.transferPlan[lineIndex].transfers[transferIndex].preTransferCleaningSof = updatedSofArray;
            } else {
                newOp.transferPlan[lineIndex].transfers[transferIndex].sof = updatedSofArray;
            }
        }

        const logItem: ActivityLogItem = { time: simulatedTime.toISOString(), user: currentUser.name, action: 'SOF_REVERT', details: `Reverted step "${itemToUndo.event}" for ${logContext}. Reason: ${reason}` };
        newOp.activityHistory.push(logItem);

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

    const handleRescheduleClick = () => {
        if (!plan) return;
    
        const hasTransferStarted = plan.transferPlan?.[0]?.transfers?.[0]?.sof?.some(s => s.event.includes('Pumping Started') && s.status === 'complete');
        
        if (hasTransferStarted) {
            setIsReworkModalOpen(true);
        } else {
            setPriorityModalState({isOpen: true, source: 'reschedule'});
        }
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

    const renderVesselContent = () => {
        const getActiveVesselSofEvent = (sofItems: SOFItem[]): string | null => {
            for (let i = 0; i < sofItems.length; i++) {
                const item = sofItems[i];
                if (item.status === 'pending') {
                    if (!isPreviousStepComplete(sofItems, i)) return null;
                    const baseEventName = item.event.replace(/^(Rework #\d+: )/, '');
                    // Check for hardcoded last event dependency
                    if (baseEventName === 'LAST HOSE DISCONNECTED' && !(plan.transferPlan || []).every(line => line.transfers.every(t => (t.sof||[]).some(s => s.event.includes('COMMODITY COMPLETED') && s.status === 'complete')))) return null;
                    return item.event;
                }
            }
            return null;
        };
        const activeVesselSof = getActiveVesselSofEvent(plan.sof || []);
        const handleDisabledVesselSofClick = (item: SOFItem, index: number, items: SOFItem[]) => {
            if (!isPreviousStepComplete(items, index)) setInfoModal({ isOpen: true, title: 'Step Unavailable', message: `Please complete the previous step first: "${items[index - 1].event}"` });
            else if (item.event.includes('LAST HOSE DISCONNECTED') && !(plan.transferPlan || []).every(line => line.transfers.every(t => (t.sof||[]).some(s => s.event.includes('COMMODITY COMPLETED') && s.status === 'complete')))) setInfoModal({ isOpen: true, title: 'Vessel Not Ready', message: "Cannot disconnect until all product transfers are complete." });
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
                    pendingCompletionEvent={null}
                    setInfoModal={setInfoModal}
                />
            </div>
        );
    };

    const renderLineCleaningContent = () => {
        const cleaningTasks = (plan.transferPlan || []).flatMap((line, lineIdx) =>
            (line.transfers || []).map((t, transferIdx) => ({
                transfer: t,
                line: line,
                lineIndex: lineIdx,
                transferIndex: transferIdx,
            }))
        ).filter(item => item.transfer.preTransferCleaningSof && item.transfer.preTransferCleaningSof.length > 0);
    
        if (cleaningTasks.length === 0) {
            return <p className="text-sm text-center text-slate-500 italic p-8">No line cleaning procedures required for this operation.</p>;
        }
    
        return (
            <div className="space-y-6">
                {cleaningTasks.map(({ transfer, line, lineIndex, transferIndex }) => {
                    const activeCleaningSof = getActiveCleaningSofEvent(transfer.preTransferCleaningSof!);
    
                    return (
                        <div key={`${lineIndex}-${transferIndex}`} className="p-4 border rounded-lg bg-slate-50">
                            <h4 className="font-bold text-base mb-2">
                                Cleaning on {formatInfraName(line.infrastructureId)}
                                <span className="font-normal text-sm text-slate-600"> (before {transfer.product})</span>
                            </h4>
                            <SofSection 
                                sofItems={transfer.preTransferCleaningSof!}
                                onSofClick={(eventName, loop) => handleCleaningSofClick(lineIndex, transferIndex, eventName, loop)}
                                activeStepEvent={activeCleaningSof}
                                onDisabledClick={(item, index, items) => handleDisabledVesselSofClick(item, index, items, 'cleaning')}
                                onUndoClick={(item) => { setOptimisticUndoEvent(item.event); setUndoModalState({ isOpen: true, item, context: { lineIndex, transferIndex, type: 'cleaning' } }); }}
                                onEditClick={(item) => setEditingSof(item)}
                                optimisticUndoEvent={optimisticUndoEvent}
                                pendingCompletionEvent={null}
                                setInfoModal={setInfoModal}
                            />
                        </div>
                    );
                })}
            </div>
        );
    };
    
    const getActiveCleaningSofEvent = (sofItems: SOFItem[]): string | null => {
        for (let i = 0; i < sofItems.length; i++) {
            if (sofItems[i].status === 'pending') {
                return isPreviousStepComplete(sofItems, i) ? sofItems[i].event : null;
            }
        }
        return null;
    };
    
    const handleDisabledVesselSofClick = (item: SOFItem, index: number, items: SOFItem[], type: 'common' | 'cleaning') => {
        if (!isPreviousStepComplete(items, index)) {
            setInfoModal({ isOpen: true, title: 'Step Unavailable', message: `Please complete the previous step first: "${items[index-1].event}"`});
        }
    };
    
    const canUserReschedule = canReschedule(currentUser);
    const canUserRequest = canRequestReschedule(currentUser);

    return (
        <>
            <DelayModal isOpen={delayModalOpen} onClose={() => setDelayModalOpen(false)} opId={op.id} />
            <ReworkModal 
                isOpen={isReworkModalOpen}
                onClose={() => setIsReworkModalOpen(false)}
                operation={plan}
            />
            <RequeuePriorityModal 
                isOpen={priorityModalState.isOpen} 
                onClose={() => setPriorityModalState({isOpen: false, source: null})} 
                onSelect={(priority) => { 
                    setPriorityModalState({isOpen: false, source: null}); 
                    if (priorityModalState.source === 'reschedule') {
                        if (plan) {
                            requeueOperation(plan.id, "Manual Reschedule Request", priority);
                            openRescheduleModal(plan.id, undefined, undefined, priority);
                        }
                    } else { // 'rework' is now handled directly by handleRescheduleClick
                        setRejectionPriority(priority); 
                        setIsRejectionModalOpen(true); 
                    }
                }} 
            />
            <TruckRejectionModal isOpen={isRejectionModalOpen} onClose={() => setIsRejectionModalOpen(false)} operation={plan} priority={rejectionPriority} />
            {editingSof && <SofDetailsModal isOpen={!!editingSof} onClose={() => setEditingSof(null)} onSave={handleSaveSofDetails} sofItem={editingSof} plan={plan} transfer={plan.transferPlan.flatMap(l => l.transfers).find(t => (t.sof || []).some(s => s.event === editingSof.event && s.loop === editingSof.loop))} />}
            <Modal isOpen={infoModal.isOpen} onClose={() => setInfoModal({isOpen: false, title: '', message: ''})} title={infoModal.title} footer={<button onClick={() => setInfoModal({isOpen: false, title: '', message: ''})} className="btn-primary">OK</button>}><p>{infoModal.message}</p></Modal>
            <UndoSofModal isOpen={undoModalState.isOpen} onClose={handleCloseUndoModal} onConfirm={handleUndo} />
            
            <div className="card p-3 m-3 sm:p-4 sm:m-4">
                <div className="border-b pb-4 mb-4">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        {/* Left Side: Main Info & Driver */}
                        <div className="flex-grow min-w-0 w-full">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="font-bold text-3xl text-brand-dark">{op.transportId}</h1>
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border border-slate-200">
                                    <i className={`fas ${getIcon(op.modality)} mr-1`}></i>{op.modality}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-full max-w-xs h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                     <div className="h-full bg-brand-primary transition-all duration-500" style={{ width: `${progress.percentage}%` }}></div>
                                </div>
                                <span className="text-sm font-semibold text-text-secondary whitespace-nowrap">
                                    {progress.completed.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {progress.total.toLocaleString()} T
                                </span>
                            </div>

                            {op.modality === 'truck' && (
                                <div className="flex flex-wrap gap-6 text-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                            <i className="fas fa-user"></i>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Driver</span>
                                            <span className="font-bold text-text-primary text-lg">{op.driverName || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100">
                                            <i className="fas fa-phone"></i>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Phone</span>
                                            <span className="font-bold text-text-primary text-lg">{op.driverPhone || 'N/A'}</span>
                                        </div>
                                    </div>
                                    {op.driverEmail && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                                                <i className="fas fa-envelope"></i>
                                            </div>
                                            <div>
                                                <span className="block text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Email</span>
                                                <span className="font-bold text-text-primary text-base truncate max-w-[200px]" title={op.driverEmail}>{op.driverEmail}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right Side: Giant Plate */}
                        {op.modality === 'truck' && (
                            <div className="w-full lg:w-auto flex-shrink-0">
                                <div className="bg-slate-900 text-white p-1 rounded-xl shadow-xl border-4 border-slate-700">
                                    <div className="border border-white/20 rounded-lg px-8 py-4 bg-slate-800/50 backdrop-blur-sm text-center">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">License Plate</span>
                                        <span className="font-mono font-black text-5xl sm:text-6xl tracking-widest text-white drop-shadow-md block">
                                            {op.licensePlate}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center flex-wrap gap-2 justify-start">
                    {canEditPlan(currentUser) && <button onClick={() => switchView('operation-plan', op.id)} className="btn-secondary !py-1.5 !px-3 !text-xs"><i className="fas fa-edit mr-1.5"></i>Edit Plan</button>}
                    
                    {canUserReschedule && op.modality === 'truck' && op.status !== 'completed' && (
                         <button 
                            onClick={handleRescheduleClick}
                            className="btn-secondary !py-1.5 !px-3 !text-xs !bg-orange-100 !border-orange-300 !text-orange-800 hover:!bg-orange-200"
                            title={isPumping ? "Cannot reschedule while pumping is in progress" : "Initiate rework and reschedule"}
                        >
                            <i className="fas fa-calendar-alt mr-1.5"></i>Reschedule
                        </button>
                    )}
                    
                    {canUserRequest && op.status !== 'completed' && (
                        <button 
                            onClick={() => openRequestRescheduleModal(op.id)}
                            className="btn-secondary !py-1.5 !px-3 !text-xs !bg-orange-100 !border-orange-300 !text-orange-800 hover:!bg-orange-200"
                        >
                            <i className="fas fa-calendar-alt mr-1.5"></i>Request Reschedule
                        </button>
                    )}

                    {op.modality === 'truck' && plan.truckStatus === 'Directed to Bay' && (
                        <button onClick={() => revertCallOff(plan.id)} className="btn-secondary !py-1.5 !px-3 !text-xs !bg-yellow-100 !border-yellow-300 !text-yellow-800 hover:!bg-yellow-200">
                            <i className="fas fa-undo mr-1.5"></i>Revert Call
                        </button>
                    )}
                    <button onClick={() => setDelayModalOpen(true)} className="btn-danger !py-1.5 !px-3 !text-xs"><i className="fas fa-exclamation-triangle mr-1.5"></i>Log Delay</button>
                    <button 
                        onClick={() => {
                            handleCompleteOperation(op.id);
                            switchView('active-operations-list');
                        }} 
                        disabled={!isOperationCompletable} 
                        className="btn-primary !py-1.5 !px-3 !text-xs disabled:!bg-slate-400"
                    >
                        <i className="fas fa-check-circle mr-1.5"></i>Completed
                    </button>
                </div>
            </div>
            
            <div className="px-3 sm:px-4 pb-4">
                <div className="space-y-4">
                    <StatusBanner plan={plan} processReworkTruck={processReworkTruck} openAcceptNoShowModal={openAcceptNoShowModal} />
                    {!validation.isValid ? <InvalidPlanWarning plan={plan} validation={validation} switchView={switchView} /> : (
                        op.modality === 'vessel' ? (
                            <div className="grid grid-cols-3 gap-6">
                                <main className="col-span-2">
                                    {viewingTransferIndices ? (
                                        <ProductTransferDetails 
                                            lineIndex={viewingTransferIndices.lineIndex} 
                                            transferIndex={viewingTransferIndices.transferIndex} 
                                            setActiveTab={setActiveTab as any}
                                            activeTab={activeTab}
                                        />
                                    ) : (
                                        <div className="card">
                                            <div className="border-b"><nav className="-mb-px flex space-x-6 px-6"><button onClick={() => setActiveTab('sof')} className={`tab ${activeTab === 'sof' ? 'active' : ''}`}>Statement of Facts</button><button onClick={() => setActiveTab('lineCleaning')} className={`tab ${activeTab === 'lineCleaning' ? 'active' : ''}`}>Line Cleaning{hasPendingCleaning && <span className="blinking-dot"></span>}</button><button onClick={() => setActiveTab('services')} className={`tab ${activeTab === 'services' ? 'active' : ''}`}>Services</button><button onClick={() => setActiveTab('shippingLog')} className={`tab ${activeTab === 'shippingLog' ? 'active' : ''}`}>Shipping Log</button><button onClick={() => setActiveTab('documents')} className={`tab ${activeTab === 'documents' ? 'active' : ''}`}>Documents</button><button onClick={() => setActiveTab('auditLog')} className={`tab ${activeTab === 'auditLog' ? 'active' : ''}`}>Audit Log</button></nav></div>
                                            <div className="p-6">
                                                {activeTab === 'sof' && renderVesselContent()}
                                                {activeTab === 'lineCleaning' && renderLineCleaningContent()}
                                                {activeTab === 'services' && (
                                                    <div className="space-y-2">
                                                        {(settings.modalityServices?.[op.modality] || []).map(serviceName => {
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
                                                {activeTab === 'shippingLog' && <ShippingLog plan={plan} setPlan={setPlan} />}
                                                {activeTab === 'documents' && (<DocumentManager operation={plan} onUpdate={handleDocumentUpdate as any} />)}
                                                {activeTab === 'auditLog' && (
                                                    <div className="flex flex-col h-full">
                                                        <div className="flex gap-2 mb-2">
                                                            <input
                                                                type="text"
                                                                value={comment}
                                                                onChange={(e) => setComment(e.target.value)}
                                                                placeholder="Add a comment..."
                                                                className="flex-grow !py-1 !text-sm"
                                                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                                                            />
                                                            <button onClick={handleAddComment} className="btn-secondary !py-1 !px-3 text-sm">Add</button>
                                                        </div>
                                                        <div className="flex-grow space-y-2 overflow-y-auto p-2 border rounded-md bg-slate-50 max-h-[65vh]">
                                                            {overallLog.map((log, index) => (
                                                                <div key={index} className="text-xs p-1.5 rounded bg-white shadow-sm">
                                                                    <div className="flex justify-between items-baseline">
                                                                        <div className="flex items-baseline min-w-0">
                                                                            <span className="font-semibold text-slate-700 truncate">
                                                                                {log.context && <span className="font-normal bg-blue-100 text-blue-800 rounded px-1 mr-2">{log.context}</span>}
                                                                                {log.action.replace(/_/g, ' ')} by {log.user}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-slate-400 flex-shrink-0 ml-2">{new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}</span>
                                                                    </div>
                                                                    <p className="text-slate-600 whitespace-pre-wrap mt-1">{log.details}</p>
                                                                </div>
                                                            ))}
                                                            {overallLog.length === 0 && <p className="text-center text-sm text-slate-500 italic py-8">No log entries found.</p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </main>
                                <aside className="col-span-1 self-start bg-slate-100 border rounded-lg p-2 overflow-y-auto max-h-[calc(100vh-280px)] sticky top-6">
                                     <div className="flex flex-col h-full gap-2">
                                        <div>
                                            <h4 className="font-semibold text-xs text-text-secondary uppercase tracking-wider px-1 mb-1">Main</h4>
                                            <div onClick={() => setViewingTransferIndices(null)} className={`p-2 rounded-lg cursor-pointer border-2 transition-all duration-200 bg-white ${viewingTransferIndices === null ? "border-indigo-500 shadow-md" : "border-slate-200 hover:border-slate-400"}`}><div className="flex items-center gap-2 text-sm"><i className="fas fa-ship w-4 text-center text-slate-600"></i><p className="font-bold text-text-primary truncate">Vessel SOF</p></div></div>
                                        </div>
                                        {plan.transferPlan.map((line, lineIndex) => (
                                            <div key={line.infrastructureId}>
                                                <h4 className="font-semibold text-xs text-text-secondary uppercase tracking-wider px-1 mb-1">{formatInfraName(line.infrastructureId)}</h4>
                                                <div className="space-y-1.5">
                                                    {line.transfers.map((t, transferIndex) => (
                                                        <TransferSidebarCard key={`${lineIndex}-${transferIndex}`} transfer={{...t, infrastructureId: line.infrastructureId}} onClick={() => setViewingTransferIndices({ lineIndex, transferIndex })} isSelected={viewingTransferIndices?.lineIndex === lineIndex && viewingTransferIndices?.transferIndex === transferIndex} />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </aside>
                            </div>
                        ) : (
                             <div className="card">
                               <div className="border-b">
                                    <nav className="-mb-px flex space-x-6 px-6">
                                        <button onClick={() => setActiveTab('sof')} className={`tab ${activeTab === 'sof' ? 'active' : ''}`}>Statement of Facts</button>
                                        <button onClick={() => setActiveTab('arrivalChecklist')} className={`tab ${activeTab === 'arrivalChecklist' ? 'active' : ''}`}>
                                            Arrival Checklist
                                            {isChecklistIncompleteAndArrived && <span className="blinking-dot"></span>}
                                        </button>
                                        <button onClick={() => setActiveTab('services')} className={`tab ${activeTab === 'services' ? 'active' : ''}`}>Services</button>
                                        <button onClick={() => setActiveTab('documents')} className={`tab ${activeTab === 'documents' ? 'active' : ''}`}>Documents</button>
                                        <button onClick={() => setActiveTab('auditLog')} className={`tab ${activeTab === 'auditLog' ? 'active' : ''}`}>Audit Log</button>
                                    </nav>
                                </div>
                                <div className="p-6">
                                    {activeTab === 'sof' && <ProductTransferDetails lineIndex={0} transferIndex={0} setActiveTab={setActiveTab as any} activeTab='sof' />}
                                    {activeTab === 'arrivalChecklist' && <ArrivalChecklistContent plan={plan} setPlan={setPlan} onDocumentUpdate={handleDocumentUpdate} />}
                                    {activeTab === 'services' && (
                                        <div className="space-y-2">
                                            {(settings.modalityServices?.[op.modality] || []).map(serviceName => {
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
                                    {activeTab === 'documents' && (<DocumentManager operation={plan} onUpdate={handleDocumentUpdate as any} />)}
                                    {activeTab === 'auditLog' && (
                                        <div className="flex flex-col h-full">
                                            <div className="flex gap-2 mb-2">
                                                <input
                                                    type="text"
                                                    value={comment}
                                                    onChange={(e) => setComment(e.target.value)}
                                                    placeholder="Add a comment..."
                                                    className="flex-grow !py-1 !text-sm"
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                                                />
                                                <button onClick={handleAddComment} className="btn-secondary !py-1 !px-3 text-sm">Add</button>
                                            </div>
                                            <div className="flex-grow space-y-2 overflow-y-auto p-2 border rounded-md bg-slate-50 max-h-[65vh]">
                                                {overallLog.map((log, index) => (
                                                    <div key={index} className="text-xs p-1.5 rounded bg-white shadow-sm">
                                                        <div className="flex justify-between items-baseline">
                                                            <div className="flex items-baseline min-w-0">
                                                                <span className="font-semibold text-slate-700 truncate">
                                                                    {log.context && <span className="font-normal bg-blue-100 text-blue-800 rounded px-1 mr-2">{log.context}</span>}
                                                                    {log.action.replace(/_/g, ' ')} by {log.user}
                                                                </span>
                                                            </div>
                                                            <span className="text-slate-400 flex-shrink-0 ml-2">{new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}</span>
                                                        </div>
                                                        <p className="text-slate-600 whitespace-pre-wrap mt-1">{log.details}</p>
                                                    </div>
                                                ))}
                                                {overallLog.length === 0 && <p className="text-center text-sm text-slate-500 italic py-8">No log entries found.</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );
};

export default OperationDetails;
