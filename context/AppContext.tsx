import React, { createContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Operation, AppSettings, Hold, ScadaData, UIState, View, TerminalSettings, Modality, ActivityAction, ActivityLogItem, ViewHistoryItem, RequeueDetails, User, SOFItem, DipSheetEntry, WorkOrderStatus, WorkOrderNote, CycleTimeData, Transfer, OutageStatus } from '../types';
import { dataService } from '../services/api';
import useScada from '../hooks/useScada';
import { SOF_EVENTS_MODALITY, VESSEL_COMMODITY_EVENTS } from '../constants';
// FIX: Import formatInfraName to be used in conflict resolution logic.
import { getOperationDurationHours, validateOperationPlan, formatInfraName } from '../utils/helpers';

interface AppContextType {
    operations: Operation[];
    setOperations: React.Dispatch<React.SetStateAction<Operation[]>>;
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    holds: Hold[];
    setHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
    scadaData: ScadaData;
    uiState: UIState;
    setUiState: React.Dispatch<React.SetStateAction<UIState>>;
    online: boolean;
    lastUpdated: Date;
    selectedTerminal: string;
    setSelectedTerminal: (terminal: string) => void;
    currentTerminalSettings: TerminalSettings;
    getOperationById: (id: string | null) => Operation | undefined;
    
    // Navigation and UI State
    currentView: View;
    activeOpId: string | null;
    activeLineIndex: number | null;
    activeTransferIndex: number | null;
    switchView: (view: View, opId?: string | null, lineIndex?: number, transferIndex?: number, opToEdit?: Operation) => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    viewHistory: ViewHistoryItem[];
    goBack: () => void;
    workspaceFilter: Modality | 'all';
    setWorkspaceFilter: React.Dispatch<React.SetStateAction<Modality | 'all'>>;
    workspaceSearchTerm: string;
    setWorkspaceSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    rescheduleModalData: { opId: string | null; viewDate: Date; source?: 'dashboard-delay' };
    openRescheduleModal: (opId: string, viewDate?: Date, source?: 'dashboard-delay') => void;
    closeRescheduleModal: () => void;
    
    // Editing State
    editingOp: Operation | null;
    setEditingOp: React.Dispatch<React.SetStateAction<Operation | null>>;
    
    // User and Actions
    currentUser: User;
    users: User[];
    setCurrentUser: (user: User) => void;
    addActivityLog: (opId: string, action: ActivityAction | string, details: string) => void;
    saveCurrentPlan: (op: Operation) => void;
    createNewOperation: (details: { modality: Modality; transportId: string; eta: string; licensePlate?: string; driverName?: string; transfer: Partial<Transfer>; }) => void;
    cancelOperation: (opId: string, reason: string) => void;
    requeueTruckOperation: (opId: string, reason: string, details: { notes?: string; photo?: string }) => void;
    requeueOperation: (opId: string, reason: string) => void;
    reworkTruckOperation: (opId: string, reason: string, notes: string) => void;
    acceptTruckArrival: (opId: string) => void;
    callOffTruck: (opId: string) => void;
    revertCallOff: (opId: string) => void;
    requestCorrection: (opId: string, lineIndex: number, transferIndex: number) => void;
    updateInfrastructureLastProduct: (terminal: string, infraId: string, product: string) => void;
    saveHoldAndRequeueConflicts: (hold: Hold) => void;
    deleteHold: (holdId: string) => void;
    cancelHold: (holdId: string, reason: string) => void;
    approveOutage: (holdId: string) => void;
    rejectOutage: (holdId: string) => void;
    updateWorkOrderStatus: (holdId: string, newStatus: WorkOrderStatus, note?: string) => void;
    approveWorkOrderCompletion: (holdId: string) => void;
    logDelay: (opId: string, reason: string, notes: string) => void;
    handleCompleteOperation: (opId: string) => void; // Expose for use in OperationDetails
    // FIX: Add properties for conflict resolution modal to the context type.
    conflictData: { isOpen: boolean; conflictingOps: Operation[]; hold: Hold | null };
    closeConflictModal: () => void;
    resolveAndRescheduleConflicts: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const USERS: User[] = [
    { name: 'Ops Lead', role: 'Operations Lead' },
    { name: 'Operator 1', role: 'Operator' },
    { name: 'Maintenance Planner', role: 'Maintenance Planner' },
    { name: 'Maintenance Tech', role: 'Maintenance Tech' },
    { name: 'Commercials', role: 'Commercials' },
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [operations, setOperations] = useState<Operation[]>([]);
    const [settings, setSettings] = useState<AppSettings>(dataService.loadSettings());
    const [holds, setHolds] = useState<Hold[]>([]);
    const [uiState, setUiState] = useState<UIState>({ planningViewMode: 'grid' });
    const [online, setOnline] = useState(navigator.onLine);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [selectedTerminal, setSelectedTerminalState] = useState('PAL');
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [activeOpId, setActiveOpId] = useState<string | null>(null);
    const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
    const [activeTransferIndex, setActiveTransferIndex] = useState<number | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<User>(USERS[0]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
    const [workspaceFilter, setWorkspaceFilter] = useState<Modality | 'all'>('all');
    const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState('');
    const [rescheduleModalData, setRescheduleModalData] = useState<{ opId: string | null; viewDate: Date; source?: 'dashboard-delay' }>({ opId: null, viewDate: new Date() });
    const [editingOp, setEditingOp] = useState<Operation | null>(null);
    // FIX: Add state for conflict resolution modal data.
    const [conflictData, setConflictData] = useState<{ isOpen: boolean; conflictingOps: Operation[]; hold: Hold | null }>({ isOpen: false, conflictingOps: [], hold: null });
    const isSyncingEditingOpRef = useRef(false);

    const activeOperation = operations.find(op => op.id === activeOpId && op.status === 'active');
    const { scadaData } = useScada(activeOperation, setOperations);
    const currentTerminalSettings = settings[selectedTerminal] || {};

    useEffect(() => { /* Online/Offline listeners */ }, []);
    useEffect(() => { setOperations(dataService.loadOperations()); }, []);
    useEffect(() => { dataService.saveOperations(operations); setLastUpdated(new Date()); }, [operations]);
    useEffect(() => { dataService.saveSettings(settings); }, [settings]);
    useEffect(() => { setHolds(dataService.loadHolds(selectedTerminal)); }, [selectedTerminal]);
    useEffect(() => { dataService.saveHolds(holds, selectedTerminal); }, [holds, selectedTerminal]);

    const setSelectedTerminal = (terminal: string) => {
        setSelectedTerminalState(terminal);
        setWorkspaceSearchTerm('');
        switchView('dashboard');
    };

    const getOperationById = useCallback((id: string | null) => id ? operations.find(op => op.id === id) : undefined, [operations]);

    const switchView = (view: View, opId: string | null = null, lineIndex: number | null = null, transferIndex: number | null = null, opToEdit?: Operation) => {
        if (view !== currentView || opId !== activeOpId) {
             setViewHistory(prev => [...prev, { view: currentView, opId: activeOpId, lineIndex: activeLineIndex, transferIndex: activeTransferIndex }]);
        }
        
        const EDITING_VIEWS: View[] = ['operation-details', 'operation-plan', 'product-transfer-details', 'dip-sheet'];
        const isEditingView = EDITING_VIEWS.includes(view);
        if (isEditingView && opId && editingOp?.id !== opId) {
            if (opToEdit) { // Passed in object takes precedence to avoid race conditions
                setEditingOp(JSON.parse(JSON.stringify(opToEdit)));
            } else {
                const opFromList = operations.find(o => o.id === opId);
                if (opFromList) {
                    setEditingOp(JSON.parse(JSON.stringify(opFromList)));
                } else {
                    setEditingOp(null);
                }
            }
        } else if (!isEditingView && editingOp) {
            setEditingOp(null); // Clear editing state when leaving editing views
        }
        
        setCurrentView(view);
        setActiveOpId(opId);
        setActiveLineIndex(lineIndex);
        setActiveTransferIndex(transferIndex);
    };

    const goBack = () => {
        const lastView = viewHistory.pop();
        if (lastView) {
            setViewHistory([...viewHistory]);
            setCurrentView(lastView.view);
            setActiveOpId(lastView.opId);
            setActiveLineIndex(lastView.lineIndex);
            setActiveTransferIndex(lastView.transferIndex);
        }
    };
    
    const openRescheduleModal = (opId: string, viewDate: Date = new Date(), source?: 'dashboard-delay') => {
        setRescheduleModalData({ opId, viewDate, source });
    };

    const closeRescheduleModal = () => {
        setRescheduleModalData({ opId: null, viewDate: new Date() });
    };

    const addActivityLog = useCallback((opId: string, action: ActivityAction | string, details: string) => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            const newOps = [...prevOps];
            const newLog: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action, details };
            newOps[opIndex].activityHistory = [...newOps[opIndex].activityHistory, newLog];
            return newOps;
        });
    }, [currentUser.name]);

    const saveCurrentPlan = useCallback((opToSave: Operation) => {
        setOperations(prevOps => prevOps.map(op => op.id === opToSave.id ? opToSave : op));
    }, []);

    // Sync editingOp with the master operations list if it's stale
    useEffect(() => {
        if (editingOp) {
            const masterOp = operations.find(op => op.id === editingOp.id);
            if (masterOp) {
                // Use stringify for a simple deep comparison to prevent loops from minor differences
                if (JSON.stringify(masterOp) !== JSON.stringify(editingOp)) {
                    isSyncingEditingOpRef.current = true; // Signal that this is a sync update
                    setEditingOp(JSON.parse(JSON.stringify(masterOp)));
                }
            } else {
                // Op was removed from the list, so clear editing state
                setEditingOp(null);
            }
        }
    }, [operations]); // This effect depends only on the master list of operations

    // Auto-save effect
    useEffect(() => {
        // If the editingOp was just updated by the sync effect, don't save it back to prevent a loop.
        if (isSyncingEditingOpRef.current) {
            isSyncingEditingOpRef.current = false; // Reset the flag for the next user-initiated change
            return;
        }

        if (editingOp) {
            const handler = setTimeout(() => {
                saveCurrentPlan(editingOp);
            }, 1500); // 1.5 second debounce
            return () => clearTimeout(handler);
        }
    }, [editingOp, saveCurrentPlan]);

    // Effect to synchronize truck status with SOF progress
    useEffect(() => {
        const statusInterval = setInterval(() => {
            setOperations(prevOps => {
                let hasChanged = false;
                const updatedOps = prevOps.map(op => {
                    if (op.modality === 'truck' && op.status === 'active') {
                        const transfer = op.transferPlan?.[0]?.transfers?.[0];
                        if (!transfer?.sof) return op;

                        const completedSofEvents = new Set(
                            transfer.sof
                                .filter(s => s.status === 'complete')
                                .map(s => {
                                    const match = s.event.match(/^(?:Rework #\d+: )?(.*)$/);
                                    return match ? match[1] : s.event;
                                })
                        );

                        const truckSofEventSequence = SOF_EVENTS_MODALITY['truck'];
                        let latestCompletedStep: string | null = null;
                        for (let i = truckSofEventSequence.length - 1; i >= 0; i--) {
                            if (completedSofEvents.has(truckSofEventSequence[i])) {
                                latestCompletedStep = truckSofEventSequence[i];
                                break;
                            }
                        }

                        let newCurrentStatus = op.currentStatus;
                        let newTruckStatus = op.truckStatus;

                        // This logic respects the manual 'Accept' button flow while keeping SOF as source of truth for later steps
                        switch (latestCompletedStep) {
                            case 'Departed':
                                newCurrentStatus = 'Departed';
                                newTruckStatus = 'Departed';
                                break;
                            case 'Paperwork Done':
                                newCurrentStatus = 'Paperwork Complete';
                                newTruckStatus = 'Loading'; // Using 'Loading' to maintain grid color until departed
                                break;
                            case 'Pumping Stopped':
                                newCurrentStatus = 'Pumping Complete';
                                newTruckStatus = 'Loading';
                                break;
                            case 'Pumping Started':
                                newCurrentStatus = 'Pumping';
                                newTruckStatus = 'Loading';
                                break;
                            case 'On Bay':
                                newCurrentStatus = 'On Bay';
                                newTruckStatus = 'On Bay';
                                break;
                            case 'Directed to Bay':
                                newCurrentStatus = 'Directed to Bay';
                                newTruckStatus = 'Directed to Bay';
                                break;
                            case 'Arrived':
                                // Only set initial status if it hasn't been manually accepted yet
                                if (op.truckStatus === 'Registered') {
                                    newCurrentStatus = 'Awaiting Approval';
                                }
                                // Don't downgrade from 'Waiting' or 'Directed to Bay'
                                break;
                            default:
                                // No SOF steps completed, status is determined by creation or manual actions
                                break;
                        }

                        if (newCurrentStatus !== op.currentStatus || newTruckStatus !== op.truckStatus) {
                            hasChanged = true;
                            return { ...op, currentStatus: newCurrentStatus, truckStatus: newTruckStatus };
                        }
                    }
                    return op;
                });
                return hasChanged ? updatedOps : prevOps;
            });
        }, 2500); // Check every 2.5 seconds

        return () => clearInterval(statusInterval);
    }, []);

    const createNewOperation = (details: { modality: Modality; transportId: string; eta: string; licensePlate?: string; driverName?: string; transfer: Partial<Transfer>; }) => {
        const { modality, transportId, eta, licensePlate, driverName, transfer } = details;
        const newId = `op-${modality}-${Date.now()}`;
    
        const newOp: Operation = {
            id: newId,
            terminal: selectedTerminal,
            modality,
            status: 'planned',
            transportId,
            eta,
            queuePriority: new Date(eta).getTime(),
            currentStatus: 'Scheduled',
            activityHistory: [
                {
                    time: new Date().toISOString(),
                    user: currentUser.name,
                    action: 'CREATE',
                    details: `New ${modality} operation plan created.`
                }
            ],
            transferPlan: [
                {
                    infrastructureId: '', // To be assigned in the main planning screen
                    transfers: [
                        {
                            customer: transfer.customer || '',
                            product: transfer.product || '',
                            from: '',
                            to: (modality === 'truck' && transfer.direction === 'Tank to Truck') ? transportId : '',
                            tonnes: transfer.tonnes || 0,
                            direction: transfer.direction || '',
                            specialServices: [],
                            id: `transfer-${Date.now()}`,
                            transferredTonnes: 0,
                            sof: (modality === 'truck' || modality === 'rail')
                                ? SOF_EVENTS_MODALITY[modality].map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 }))
                                : (modality === 'vessel' ? VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })) : [])
                        }
                    ]
                }
            ],
            sof: modality === 'vessel' ? SOF_EVENTS_MODALITY.vessel.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })) : [],
            specialRequirements: [],
            lineWalks: [],
            samples: [],
            heatingLog: [],
            slopLog: [],
            dilutionLog: [],
            batchLog: [],
            dipSheetData: [],
            delay: { active: false },
        };
    
        if (modality === 'truck') {
            newOp.truckStatus = 'Planned';
            newOp.licensePlate = licensePlate || `NEW-${String(Date.now()).slice(-4)}`;
            newOp.driverName = driverName;
        }
    
        setOperations(prevOps => [...prevOps, newOp]);
        switchView('planning');
    };
    
    const cancelOperation = (opId: string, reason: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => op.id === opId);
            if (opIndex > -1) {
                const cancellationDetails = {
                    time: new Date().toISOString(),
                    user: currentUser.name,
                    reason: reason,
                };
                const newLog: ActivityLogItem = { 
                    time: cancellationDetails.time, 
                    user: cancellationDetails.user, 
                    action: 'STATUS_UPDATE', 
                    details: `Operation cancelled. Reason: ${reason}` 
                };
                
                newOps[opIndex] = {
                    ...newOps[opIndex],
                    status: 'cancelled',
                    currentStatus: 'Cancelled',
                    cancellationDetails: cancellationDetails,
                    activityHistory: [...newOps[opIndex].activityHistory, newLog]
                };
            }
            return newOps;
        });
        // After cancelling, stay on planning or go to dashboard
        if (currentView === 'operation-plan' || currentView === 'operation-details') {
            switchView('planning');
        }
    };
    
    const requeueTruckOperation = (opId: string, reason: string, details: { notes?: string; photo?: string }) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => op.id === opId);
            if (opIndex > -1) {
                const newLog: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action: 'REQUEUE', details: `Truck re-queued. Reason: ${reason}` };
                const requeueDetails: RequeueDetails = {
                    reason,
                    user: currentUser.name,
                    time: new Date().toISOString(),
                    details: details,
                };
                newOps[opIndex] = {
                    ...newOps[opIndex],
                    status: 'planned',
                    currentStatus: 'Reschedule Required',
                    truckStatus: 'Rejected',
                    requeueDetails: requeueDetails,
                    activityHistory: [...newOps[opIndex].activityHistory, newLog]
                };
            }
            return newOps;
        });
    };

    const requeueOperation = (opId: string, reason: string) => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            const newOps = [...prevOps];
            const opToRequeue = newOps[opIndex];
    
            const newLog: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action: 'REQUEUE', details: `Operation flagged for reschedule. Reason: ${reason}` };
            const requeueDetails: RequeueDetails = {
                reason,
                user: currentUser.name,
                time: new Date().toISOString(),
                details: {},
            };
            newOps[opIndex] = {
                ...opToRequeue,
                status: 'planned',
                currentStatus: 'Reschedule Required',
                truckStatus: opToRequeue.modality === 'truck' ? 'Rejected' : opToRequeue.truckStatus,
                requeueDetails: requeueDetails,
                activityHistory: [...opToRequeue.activityHistory, newLog]
            };
            return newOps;
        });
    };

    const reworkTruckOperation = (opId: string, reason: string, notes: string) => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
    
            const newOps = [...prevOps];
            const opToRework = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
            // Assume first transfer for trucks
            const transfer = opToRework.transferPlan[0]?.transfers[0];
    
            if (!transfer) return prevOps;
    
            // Find the highest existing loop number and create the next one
            const maxLoop = Math.max(0, ...(transfer.sof || []).map(s => s.loop));
            const newLoopNum = maxLoop + 1;
    
            // Create new SOF items for the new loop
            const newSofItems: SOFItem[] = SOF_EVENTS_MODALITY['truck'].map(event => ({
                event: `Rework #${newLoopNum}: ${event}`, // Add prefix to event name
                status: 'pending',
                time: '',
                user: '',
                loop: newLoopNum,
            }));
    
            // Append new SOF items
            transfer.sof = [...(transfer.sof || []), ...newSofItems];
            
            opToRework.status = 'planned';
            opToRework.currentStatus = 'Reschedule Required';
            opToRework.truckStatus = 'Rejected';
    
            opToRework.requeueDetails = {
                reason: `Rework: ${reason}`,
                user: currentUser.name,
                time: new Date().toISOString(),
                details: { notes },
            };
            
            const newLog: ActivityLogItem = {
                time: new Date().toISOString(),
                user: currentUser.name,
                action: 'REQUEUE',
                details: `Truck requires rework. Reason: ${reason}. Notes: ${notes}`
            };
            opToRework.activityHistory.push(newLog);
    
            newOps[opIndex] = opToRework;
            
            // This needs to happen after the state update to ensure the modal gets the new requeueDetails
            setTimeout(() => openRescheduleModal(opId), 100);
    
            return newOps;
        });
    
        switchView('planning'); // Navigate back to the planning board
    };

    const acceptTruckArrival = (opId: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => op.id === opId && op.modality === 'truck' && op.truckStatus === 'Registered');
            if (opIndex > -1) {
                const newLog: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action: 'STATUS_UPDATE', details: 'Truck arrival accepted. Operation is now active and waiting for bay.' };
                newOps[opIndex] = {
                    ...newOps[opIndex],
                    status: 'active',
                    currentStatus: 'Waiting for Bay',
                    truckStatus: 'Waiting',
                    activityHistory: [...newOps[opIndex].activityHistory, newLog]
                };
            }
            return newOps;
        });
    };
    
    const callOffTruck = (opId: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => op.id === opId && op.modality === 'truck' && op.truckStatus === 'Waiting');
            if (opIndex > -1) {
                const bay = newOps[opIndex].transferPlan[0]?.infrastructureId || 'N/A';
                const newLog: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action: 'STATUS_UPDATE', details: `Truck directed to bay ${bay}.` };
                newOps[opIndex] = {
                    ...newOps[opIndex],
                    currentStatus: 'Directed to Bay',
                    truckStatus: 'Directed to Bay',
                    activityHistory: [...newOps[opIndex].activityHistory, newLog]
                };
            }
            return newOps;
        });
    };
    
    const revertCallOff = (opId: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => op.id === opId && op.modality === 'truck' && op.truckStatus === 'Directed to Bay');
            if (opIndex > -1) {
                const newLog: ActivityLogItem = { time: new Date().toISOString(), user: currentUser.name, action: 'STATUS_UPDATE', details: 'Truck call-off reverted, now waiting for bay.' };
                newOps[opIndex] = {
                    ...newOps[opIndex],
                    currentStatus: 'Waiting for Bay',
                    truckStatus: 'Waiting',
                    activityHistory: [...newOps[opIndex].activityHistory, newLog]
                };
            }
            return newOps;
        });
    };

    const requestCorrection = (opId: string, lineIndex: number, transferIndex: number) => {
        // ...
    };

    const updateInfrastructureLastProduct = (terminal: string, infraId: string, product: string) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            if (newSettings[terminal]?.docklines?.[infraId]) {
                newSettings[terminal].docklines[infraId].lastProduct = product;
            }
            return newSettings;
        });
    };

    const revalidateOperationsForResolvedHold = (resolvedHoldId: string, currentHolds: Hold[]) => {
        setOperations(prevOps => {
            let opsChanged = false;
    
            const otherActiveHolds = currentHolds.filter(h =>
                h.id !== resolvedHoldId &&
                h.status === 'approved' &&
                !['Completed', 'Closed'].includes(h.workOrderStatus || '')
            );
    
            const updatedOps = prevOps.map(op => {
                if (op.requeueDetails?.details?.holdId === resolvedHoldId) {
                    const validation = validateOperationPlan(op, currentTerminalSettings, settings, otherActiveHolds);
    
                    if (validation.isValid) {
                        opsChanged = true;
                        const newLog: ActivityLogItem = {
                            time: new Date().toISOString(),
                            user: currentUser.name,
                            action: 'STATUS_UPDATE',
                            details: 'Conflicting hold resolved. Status automatically reverted to Scheduled.'
                        };
    
                        return {
                            ...op,
                            currentStatus: 'Scheduled',
                            truckStatus: 'Planned',
                            requeueDetails: undefined,
                            activityHistory: [...op.activityHistory, newLog]
                        };
                    }
                }
                return op;
            });
    
            return opsChanged ? updatedOps : prevOps;
        });
    };
    
    // FIX: Implement functions for conflict resolution modal.
    const closeConflictModal = () => {
        setConflictData({ isOpen: false, conflictingOps: [], hold: null });
    };

    const resolveAndRescheduleConflicts = () => {
        const opsToReschedule = conflictData.conflictingOps.map(op => op.id);
        const hold = conflictData.hold;
        if (!hold || opsToReschedule.length === 0) {
            closeConflictModal();
            return;
        }
    
        setOperations(prevOps => {
            return prevOps.map(op => {
                if (opsToReschedule.includes(op.id)) {
                    const newLog: ActivityLogItem = {
                        time: new Date().toISOString(),
                        user: 'System',
                        action: 'REQUEUE',
                        details: `Automatically re-queued due to conflict with hold on ${formatInfraName(hold.resource)}.`
                    };
                    return {
                        ...op,
                        currentStatus: 'Reschedule Required',
                        truckStatus: op.modality === 'truck' ? 'Rejected' : op.truckStatus,
                        requeueDetails: {
                            reason: 'Hold Conflict',
                            user: 'System',
                            time: new Date().toISOString(),
                            details: { holdId: hold.id, holdReason: hold.reason, resource: hold.resource }
                        },
                        activityHistory: [...op.activityHistory, newLog]
                    };
                }
                return op;
            });
        });
        
        closeConflictModal();
    };

    const saveHoldAndRequeueConflicts = (hold: Hold) => {
        const isNew = !hold.id;
        let savedHold: Hold;

        if (isNew) {
            const maintenanceReasons = ["Preventative Maintenance", "Corrective Maintenance", "Inspection", "Pump Failure"];
            const isMaintenanceRequest = maintenanceReasons.includes(hold.reason);

            savedHold = {
                ...hold,
                id: `hold-${Date.now()}`,
                user: currentUser.name,
                time: new Date().toISOString(),
                status: isMaintenanceRequest ? 'pending' : 'approved',
                workOrderStatus: isMaintenanceRequest ? 'Requested' : undefined,
                workOrderNotes: isMaintenanceRequest ? [{ time: new Date().toISOString(), user: currentUser.name, note: 'Work order created.' }] : [],
            };
            setHolds(prev => [...prev, savedHold]);
        } else {
            savedHold = hold;
            setHolds(prev => prev.map(h => h.id === hold.id ? hold : h));
        }

        if (savedHold.status !== 'approved') return;

        const conflictingOps: Operation[] = [];
        const opsToCheck = operations.filter(op => op.status === 'planned' && op.currentStatus !== 'Reschedule Required');

        for (const op of opsToCheck) {
            if (!op.eta || !op.transferPlan || op.transferPlan.length === 0) continue;

            const opStart = new Date(op.eta).getTime();
            if (isNaN(opStart)) continue;

            const opEnd = opStart + getOperationDurationHours(op) * 3600 * 1000;
            const holdStart = new Date(savedHold.startTime).getTime();
            const holdEnd = new Date(savedHold.endTime).getTime();

            if (isNaN(holdStart) || isNaN(holdEnd)) continue;

            const timeOverlap = opStart < holdEnd && opEnd > holdStart;
            if (!timeOverlap) continue;

            const conflicts = op.transferPlan.some(tp => {
                if (!tp.infrastructureId) return false;
                const resourceMatch = tp.infrastructureId === savedHold.resource;
                if (!resourceMatch) return false;

                if (savedHold.tank) {
                    return tp.transfers.some(t => t.from === savedHold.tank || t.to === savedHold.tank);
                }
                return true;
            });

            if (conflicts) {
                conflictingOps.push(op);
            }
        }

        if (conflictingOps.length > 0) {
            setConflictData({ isOpen: true, conflictingOps, hold: savedHold });
        }
    };

    const deleteHold = (holdId: string) => {
        setHolds(prev => prev.filter(h => h.id !== holdId));
    };

    const cancelHold = (holdId: string, reason: string) => {
        const newHolds = holds.map(h => {
            if (h.id === holdId) {
                const newLog: WorkOrderNote | undefined = h.workOrderStatus ? {
                    time: new Date().toISOString(),
                    user: currentUser.name,
                    note: `Work order cancelled. Reason: ${reason}`
                } : undefined;

// FIX: Explicitly type the updated hold object to prevent TypeScript from widening
// the 'status' property to a generic 'string', ensuring it matches the 'OutageStatus' type.
                const updatedHold: Hold = {
                    ...h,
                    status: 'cancelled',
                    cancellationDetails: {
                        time: new Date().toISOString(),
                        user: currentUser.name,
                        reason: reason,
                    },
                    workOrderStatus: h.workOrderStatus ? 'Closed' : undefined,
                    workOrderNotes: newLog ? [...(h.workOrderNotes || []), newLog] : h.workOrderNotes,
                };
                return updatedHold;
            }
            return h;
        });
        setHolds(newHolds);
        revalidateOperationsForResolvedHold(holdId, newHolds);
    };
    
    const approveOutage = (holdId: string) => {
        let approvedHold: Hold | undefined;
        let newHolds: Hold[] = [];
        setHolds(prev => {
            newHolds = prev.map(h => {
                if (h.id === holdId) {
                    approvedHold = {
                        ...h,
                        status: 'approved',
                        workOrderStatus: h.workOrderStatus || 'Requested'
                    };
                    return approvedHold;
                }
                return h;
            });
            return newHolds;
        });
        
        // After state update, check for conflicts
        setTimeout(() => {
            if (approvedHold) {
                saveHoldAndRequeueConflicts(approvedHold);
            }
        }, 100);
    };

    const rejectOutage = (holdId: string) => {
        setHolds(prev => prev.map(h => h.id === holdId ? { ...h, status: 'rejected' } : h));
    };

    const getUpdatedHoldsWithWorkOrderStatus = (holdId: string, newStatus: WorkOrderStatus, note?: string): Hold[] => {
        return holds.map(h => {
            if (h.id === holdId) {
                const newNotes = [...(h.workOrderNotes || [])];
                const noteText = note ? note : `Status changed to ${newStatus}.`;
                newNotes.push({ time: new Date().toISOString(), user: currentUser.name, note: noteText });
                return { ...h, workOrderStatus: newStatus, workOrderNotes: newNotes };
            }
            return h;
        });
    };

    const updateWorkOrderStatus = (holdId: string, newStatus: WorkOrderStatus, note?: string) => {
        const newHolds = getUpdatedHoldsWithWorkOrderStatus(holdId, newStatus, note);
        setHolds(newHolds);
    };

    const approveWorkOrderCompletion = (holdId: string) => {
        const newHolds = getUpdatedHoldsWithWorkOrderStatus(holdId, 'Closed', 'Work order completion approved by Operations Lead.');
        setHolds(newHolds);
        revalidateOperationsForResolvedHold(holdId, newHolds);
    };

    const logDelay = (opId: string, reason: string, notes: string) => {
        setOperations(prevOps => prevOps.map(op => {
            if (op.id === opId) {
                const time = new Date().toISOString();
                const newLog: ActivityLogItem = {
                    time: time,
                    user: currentUser.name,
                    action: 'STATUS_UPDATE',
                    details: `Operation delayed. Reason: ${reason}. Notes: ${notes}`
                };
                return {
                    ...op,
                    delay: { active: true, reason, notes, time },
                    currentStatus: `Delayed: ${reason}`,
                    activityHistory: [...op.activityHistory, newLog]
                };
            }
            return op;
        }));
    };

    const handleCompleteOperation = (opId: string) => {
        let completedOp: Operation | undefined;
        
        setOperations(prevOps => prevOps.map(op => {
            if (op.id === opId) {
                const completedTime = new Date().toISOString();
                const newLog: ActivityLogItem = {
                    time: completedTime,
                    user: currentUser.name,
                    action: 'STATUS_UPDATE',
                    details: 'Operation marked as completed.'
                };
                
                const cycleTimeData = { ...(op.cycleTimeData || {}) };
                const allSof = op.transferPlan.flatMap(tp => tp.transfers.flatMap(t => t.sof || []));
                (op.sof || []).forEach(s => allSof.push(s)); 
                
                allSof.forEach(s => {
                    if(s.status === 'complete') {
                        const eventName = s.event.replace(/^(Rework #\d+: )?(.*)$/, '$2');
                        if(!cycleTimeData[eventName]) {
                             cycleTimeData[eventName] = s.time;
                        }
                    }
                });

                completedOp = {
                    ...op,
                    status: 'completed',
                    currentStatus: 'Completed',
                    completedTime: completedTime,
                    activityHistory: [...op.activityHistory, newLog],
                    cycleTimeData: cycleTimeData,
                };
                return completedOp;
            }
            return op;
        }));

        // Post-completion logic
        setTimeout(() => {
            if (completedOp) {
                completedOp.transferPlan.forEach(line => {
                    const lastTransfer = line.transfers[line.transfers.length - 1];
                    if (lastTransfer) {
                        updateInfrastructureLastProduct(completedOp!.terminal, line.infrastructureId, lastTransfer.product);
                    }
                });
                switchView('completed');
            }
        }, 100);
    };

    const contextValue: AppContextType = {
        operations, setOperations,
        settings, setSettings,
        holds, setHolds,
        scadaData,
        uiState, setUiState,
        online,
        lastUpdated,
        selectedTerminal, setSelectedTerminal,
        currentTerminalSettings,
        getOperationById,
        currentView,
        activeOpId,
        activeLineIndex,
        activeTransferIndex,
        switchView,
        isSidebarOpen, setIsSidebarOpen,
        viewHistory,
        goBack,
        workspaceFilter, setWorkspaceFilter,
        workspaceSearchTerm, setWorkspaceSearchTerm,
        rescheduleModalData, openRescheduleModal, closeRescheduleModal,
        editingOp, setEditingOp,
        currentUser, users: USERS, setCurrentUser,
        addActivityLog,
        saveCurrentPlan,
        createNewOperation,
        cancelOperation,
        requeueTruckOperation,
        requeueOperation,
        reworkTruckOperation,
        acceptTruckArrival,
        callOffTruck,
        revertCallOff,
        requestCorrection,
        updateInfrastructureLastProduct,
        saveHoldAndRequeueConflicts,
        deleteHold,
        cancelHold,
        approveOutage,
        rejectOutage,
        updateWorkOrderStatus,
        approveWorkOrderCompletion,
        logDelay,
        handleCompleteOperation,
        // FIX: Provide the new conflict resolution state and functions in the context value.
        conflictData,
        closeConflictModal,
        resolveAndRescheduleConflicts,
    };
    
    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};