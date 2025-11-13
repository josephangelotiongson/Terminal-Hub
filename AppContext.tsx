import React, { createContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Operation, AppSettings, Hold, ScadaData, UIState, View, TerminalSettings, Modality, ActivityAction, ActivityLogItem, ViewHistoryItem, RequeueDetails, User, SOFItem, DipSheetEntry, WorkOrderStatus, WorkOrderNote, CycleTimeData, Transfer, OutageStatus, TransferPlanItem, HistorianData, HistorianDataPoint, SpecialServiceData } from '../types';
import { dataService } from '../services/api';
import { tankService } from '../services/tankService';
import { historianService } from '../services/historianService';
import { SOF_EVENTS_MODALITY, VESSEL_COMMODITY_EVENTS, MOCK_CURRENT_TIME } from '../constants';
// FIX: Import formatInfraName to be used in conflict resolution logic.
import { getOperationDurationHours, validateOperationPlan, formatInfraName, deriveStatusFromSof, calculateAndSetCycleTime, createDocklineToWharfMap, naturalSort, formatDateTime } from '../utils/helpers';

export type CreateOperationDetails = {
    modality: Modality;
    transportId: string;
    eta: string;
    durationHours: number;
    // Truck/Rail specific
    licensePlate?: string;
    driverName?: string;
    transfer?: Partial<Transfer>; // for simple truck/rail
    // Vessel specific
    transferPlan?: TransferPlanItem[]; // for vessel
    specialRequirements?: SpecialServiceData[];
}

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
    tanks: TerminalSettings['masterTanks'];
    getOperationById: (id: string | null) => Operation | undefined;
    
    // Historian Data
    getHistoryForAsset: (assetId: string, measurement: string) => HistorianDataPoint[];

    // Navigation and UI State
    currentView: View;
    activeOpId: string | null;
    activeLineIndex: number | null;
    activeTransferIndex: number | null;
    activeTankId: string | null;
    switchView: (view: View, opId?: string | null, lineIndex?: number, transferIndex?: number, opToEdit?: Operation, tankId?: string) => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    viewHistory: ViewHistoryItem[];
    goBack: () => void;
    workspaceFilter: Modality | 'all';
    setWorkspaceFilter: React.Dispatch<React.SetStateAction<Modality | 'all'>>;
    workspaceSearchTerm: string;
    setWorkspaceSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    visibleInfrastructure: string[];
    setVisibleInfrastructure: React.Dispatch<React.SetStateAction<string[]>>;
    rescheduleModalData: { opId: string | null; viewDate: Date; source?: 'dashboard-delay', priority?: 'high' | 'normal' };
    openRescheduleModal: (opId: string, viewDate?: Date, source?: 'dashboard-delay', priority?: 'high' | 'normal') => void;
    closeRescheduleModal: () => void;
    isNewOpModalOpen: boolean;
    newOpInitialData: Partial<Operation> | null;
    openNewOpModal: (initialData?: Partial<Operation> | null) => void;
    closeNewOpModal: () => void;
    
    // Placement Mode for Rescheduling
    placementOpId: string | null;
    startPlacementMode: (opId: string) => void;
    cancelPlacementMode: () => void;
    confirmPlacement: (newEta: string, newResource: string) => void;

    // Editing State
    editingOp: Operation | null;
    setEditingOp: React.Dispatch<React.SetStateAction<Operation | null>>;
    
    // User and Actions
    currentUser: User;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setCurrentUser: (user: User) => void;
    delegateRole: (targetUserName: string) => void;
    revokeDelegation: (targetUserName: string) => void;
    addActivityLog: (opId: string, action: ActivityAction | string, details: string) => void;
    saveCurrentPlan: (op: Operation) => void;
    createNewOperation: (details: CreateOperationDetails) => void;
    cancelOperation: (opId: string, reason: string) => void;
    requeueTruckOperation: (opId: string, reason: string, details: { notes?: string; photo?: string }, priority?: 'high' | 'normal') => void;
    requeueOperation: (opId: string, reason: string, priority?: 'high' | 'normal') => void;
    reworkTruckOperation: (opId: string, reason: string, notes: string, priority?: 'high' | 'normal') => void;
    acceptTruckArrival: (opId: string) => void;
    callOffTruck: (opId: string) => void;
    directTruckToBay: (opId: string, bayInfraId: string) => void;
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
    updateCompletedOperationDetails: (opId: string, opUpdates: Partial<Operation>, transferId?: string, transferUpdates?: Partial<Transfer>) => void;
    updatePreArrivalCheck: (opId: string, checkName: string, status: 'pending' | 'complete') => void;
    updateVesselServiceStatus: (opId: string, serviceName: string, status: 'pending' | 'confirmed' | 'complete') => void;
    // FIX: Add properties for conflict resolution modal to the context type.
    conflictData: { isOpen: boolean; conflictingOps: Operation[]; hold: Hold | null };
    closeConflictModal: () => void;
    resolveAndRescheduleConflicts: () => void;

    // FIX: Add properties for DirectToBayModal
    directToBayModalState: { isOpen: boolean; op: Operation | null; isRevert: boolean };
    closeDirectToBayModal: () => void;
    handleConfirmBayAction: () => void;
    
    // Simulation
    simulatedTime: Date;
    isTimePlaying: boolean;
    setIsTimePlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_USERS: User[] = [
    { name: 'Ops Lead', role: 'Operations Lead' },
    { name: 'Operator 1', role: 'Operator' },
    { name: 'Operator 2', role: 'Operator' },
    { name: 'Dispatch', role: 'Dispatch' },
    { name: 'Terminal Planner', role: 'Terminal Planner' },
    { name: 'Maintenance Planner', role: 'Maintenance Planner' },
    { name: 'Maintenance Tech', role: 'Maintenance Tech' },
    { name: 'Commercials', role: 'Commercials' },
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [operations, setOperations] = useState<Operation[]>([]);
    const [settings, setSettings] = useState<AppSettings>(dataService.loadSettings());
    const [holds, setHolds] = useState<Hold[]>([]);
    const [scadaData, setScadaData] = useState<ScadaData>({});
    const [historianData, setHistorianData] = useState<HistorianData>({});
    const [uiState, setUiState] = useState<UIState>({ planningViewMode: 'grid' });
    const [online, setOnline] = useState(navigator.onLine);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [selectedTerminal, setSelectedTerminalState] = useState('PAL');
    const [tanks, setTanks] = useState<TerminalSettings['masterTanks']>({});
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [activeOpId, setActiveOpId] = useState<string | null>(null);
    const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
    const [activeTransferIndex, setActiveTransferIndex] = useState<number | null>(null);
    const [activeTankId, setActiveTankId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [users, setUsers] = useState<User[]>(INITIAL_USERS);
    const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
    const [workspaceFilter, setWorkspaceFilter] = useState<Modality | 'all'>('all');
    const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState('');
    const [visibleInfrastructure, setVisibleInfrastructure] = useState<string[]>([]);
    const [rescheduleModalData, setRescheduleModalData] = useState<{ opId: string | null; viewDate: Date; source?: 'dashboard-delay', priority?: 'high' | 'normal' }>({ opId: null, viewDate: MOCK_CURRENT_TIME });
    const [editingOp, setEditingOp] = useState<Operation | null>(null);
    const [isNewOpModalOpen, setIsNewOpModalOpen] = useState(false);
    const [newOpInitialData, setNewOpInitialData] = useState<Partial<Operation> | null>(null);
    // FIX: Add state for conflict resolution modal data.
    const [conflictData, setConflictData] = useState<{ isOpen: boolean; conflictingOps: Operation[]; hold: Hold | null }>({ isOpen: false, conflictingOps: [], hold: null });
    
    const [placementOpId, setPlacementOpId] = useState<string | null>(null);

    // FIX: Add state for DirectToBayModal.
    const [directToBayModalState, setDirectToBayModalState] = useState<{
        isOpen: boolean;
        op: Operation | null;
        isRevert: boolean;
        bayInfraId?: string;
    }>({ isOpen: false, op: null, isRevert: false });

    // Simulation State
    const [simulatedTime, setSimulatedTime] = useState<Date>(MOCK_CURRENT_TIME);
    const [isTimePlaying, setIsTimePlaying] = useState(false);
    const simulatedTimeRef = useRef(simulatedTime);
    simulatedTimeRef.current = simulatedTime;

    // Time simulation effect
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;
        if (isTimePlaying) {
            intervalId = setInterval(() => {
                setSimulatedTime(prev => new Date(prev.getTime() + 60000)); // +1 minute every tick
            }, 1000);
        }
        return () => clearInterval(intervalId);
    }, [isTimePlaying]);

    // Refs for improved state management and stability
    const isSyncingEditingOpRef = useRef(false);
    const debounceTimerRef = useRef<number | null>(null);
    const operationsRef = useRef(operations);
    operationsRef.current = operations;
    const tanksRef = useRef(tanks);
    tanksRef.current = tanks;

    const currentTerminalSettings = settings[selectedTerminal] || {};

    useEffect(() => { /* Online/Offline listeners */ }, []);
    
    // Load initial data and perform one-time sync
    useEffect(() => {
        const initialOps = dataService.loadOperations();
        
        const syncedOps = initialOps.map(op => {
            const newStatuses = deriveStatusFromSof(op);
            if (newStatuses) {
                return { ...op, ...newStatuses };
            }
            return op;
        });
        
        setOperations(syncedOps);
        
        // Load/Generate historian data based on all operations
        const terminalSettings = settings[selectedTerminal] as TerminalSettings;
        if (terminalSettings) {
            const history = historianService.loadHistorianData(selectedTerminal, terminalSettings, initialOps);
            setHistorianData(history);
        }

    }, [selectedTerminal, settings]); // Re-run if terminal changes.

    useEffect(() => { dataService.saveOperations(operations); setLastUpdated(new Date()); }, [operations]);
    useEffect(() => { dataService.saveSettings(settings); }, [settings]);
    useEffect(() => { setHolds(dataService.loadHolds(selectedTerminal)); }, [selectedTerminal]);
    useEffect(() => { dataService.saveHolds(holds, selectedTerminal); }, [holds, selectedTerminal]);
    
    // Load and save tank data
    useEffect(() => {
        setTanks(tankService.loadTanks(selectedTerminal));
    }, [selectedTerminal]);

    useEffect(() => {
        if (Object.keys(tanks).length > 0) {
            tankService.saveTanks(selectedTerminal, tanks);
        }
    }, [tanks, selectedTerminal]);

    // FIX: This effect ensures that if the current user's role is changed via delegation/revocation,
    // their permissions are updated instantly without requiring a manual user re-selection.
    useEffect(() => {
        if (currentUser) {
            const freshUserData = users.find(u => u.name === currentUser.name);
            if (freshUserData && JSON.stringify(freshUserData) !== JSON.stringify(currentUser)) {
                setCurrentUser(freshUserData);
            }
        }
    }, [users, currentUser]);


    // Global SCADA simulation - Rewritten for stability and performance
    useEffect(() => {
        const intervalId = setInterval(() => {
            const currentOperations = operationsRef.current; // Read from ref to get latest state
            const activeOps = currentOperations.filter(op => op.status === 'active');
            
            if (activeOps.length === 0) {
                setScadaData(currentScada => (Object.keys(currentScada).length > 0 ? {} : currentScada));
                return;
            }

            let wasModified = false;
            const newScadaData: ScadaData = {};
            const opsCopy = JSON.parse(JSON.stringify(currentOperations)) as Operation[];
            
            // Create a mutable copy of tanks for this interval's updates
            let tanksCopy = JSON.parse(JSON.stringify(tanksRef.current));
            let tanksWereModified = false;

            activeOps.forEach(activeOp => {
                const opIndex = opsCopy.findIndex((o: Operation) => o.id === activeOp.id);
                if (opIndex === -1) return;

                let currentOp = opsCopy[opIndex];
                
                const linesToSimulate: { [key: string]: boolean } = {};
                const startPumpEventName = currentOp.modality === 'vessel' ? 'START PUMPING' : 'Pumping Started';
                const stopPumpEventName = currentOp.modality === 'vessel' ? 'STOP PUMPING' : 'Pumping Stopped';

                (currentOp.transferPlan || []).forEach((line: TransferPlanItem) => {
                    linesToSimulate[line.infrastructureId] = (line.transfers || []).some((t: Transfer) =>
                        (t.sof || []).some(s => s.event.includes(startPumpEventName) && s.status === 'complete') &&
                        !(t.sof || []).some(s => s.event.includes(stopPumpEventName) && s.status === 'complete')
                    );
                });

                currentOp.transferPlan = currentOp.transferPlan.map((line: TransferPlanItem) => {
                    const isPumping = linesToSimulate[line.infrastructureId];
                    const flowRate = isPumping ? (line.infrastructureId.startsWith('L') ? 1200 : line.infrastructureId.startsWith('Bay') ? 150 : 300) + (Math.random() * 50 - 25) : 0;
                    
                    if (isPumping) {
                        wasModified = true;
                        
                        const activeTransfersOnLine = line.transfers.filter((t: Transfer) => {
                            const totalPumped = (t.transferredTonnes || 0) + (t.slopsTransferredTonnes || 0);
                            return ((t.tonnes || 0) - totalPumped > 0) &&
                                (t.sof || []).some(s => s.event.includes(startPumpEventName) && s.status === 'complete') &&
                                !(t.sof || []).some(s => s.event.includes(stopPumpEventName) && s.status === 'complete');
                        }).length;
                        
                        const flowPerTransfer = activeTransfersOnLine > 0 ? flowRate / activeTransfersOnLine : 0;
                        const increment = (flowPerTransfer * 1.5) / 3600;

                        line.transfers = line.transfers.map((t: Transfer) => {
                            const isToTank = t.direction.endsWith(' to Tank');
                            const isFromTank = t.direction.startsWith('Tank to');

                            if (isFromTank && t.from && tanksCopy[t.from]) {
                                tanksCopy[t.from].current = Math.max(0, (tanksCopy[t.from].current || 0) - increment);
                                tanksWereModified = true;
                            }
                            if (isToTank && t.to && tanksCopy[t.to]) {
                                const capacity = tanksCopy[t.to].capacity || Infinity;
                                tanksCopy[t.to].current = Math.min(capacity, (tanksCopy[t.to].current || 0) + increment);
                                tanksWereModified = true;
                            }

                            const totalPumped = (t.transferredTonnes || 0) + (t.slopsTransferredTonnes || 0);
                            if (totalPumped >= t.tonnes) return t;
                            
                            const slopsPassed = (t.sof || []).some(s => s.event.includes('SLOPS SAMPLE PASSED') && s.status === 'complete');
                            
                            const newTotalPumped = totalPumped + increment;

                            if (newTotalPumped >= t.tonnes) {
                                const remainingToPump = t.tonnes - totalPumped;
                                if (currentOp.modality === 'vessel' && !slopsPassed) {
                                    t.slopsTransferredTonnes = (t.slopsTransferredTonnes || 0) + remainingToPump;
                                } else {
                                    t.transferredTonnes = (t.transferredTonnes || 0) + remainingToPump;
                                }

                                const sofByLoop: Record<number, SOFItem[]> = (t.sof || []).reduce((acc: Record<number, SOFItem[]>, s: SOFItem) => { (acc[s.loop] = acc[s.loop] || []).push(s); return acc; }, {});
                                let loopToStop: number | null = null;
                                for (const loopNum of Object.keys(sofByLoop).map(Number).sort((a, b) => b - a)) {
                                    const loopEvents = sofByLoop[loopNum];
                                    const hasStarted = loopEvents.some(s => s.event.includes(startPumpEventName) && s.status === 'complete');
                                    const hasStopped = loopEvents.some(s => s.event.includes(stopPumpEventName));
                                    if (hasStarted && !hasStopped) { loopToStop = loopNum; break; }
                                }
                                if (loopToStop !== null) {
                                    const finalEventName = loopToStop > 1 ? `Rework #${loopToStop}: ${stopPumpEventName}` : stopPumpEventName;
                                    const stopItemIndex = (t.sof || []).findIndex(s => s.event === finalEventName && s.loop === loopToStop);
                                    if (stopItemIndex === -1) { t.sof!.push({ event: finalEventName, status: 'complete', time: simulatedTimeRef.current.toISOString(), user: 'AUTO', loop: loopToStop }); }
                                }
                            } else {
                                if (currentOp.modality === 'vessel' && !slopsPassed) {
                                    t.slopsTransferredTonnes = (t.slopsTransferredTonnes || 0) + increment;
                                } else {
                                    let slopsToAdd = 0;
                                    if (t.slopsTransferredTonnes && t.slopsTransferredTonnes > 0) {
                                        slopsToAdd = t.slopsTransferredTonnes;
                                        t.slopsTransferredTonnes = 0;
                                    }
                                    t.transferredTonnes = (t.transferredTonnes || 0) + slopsToAdd + increment;
                                }
                            }
                            return t;
                        });
                    }
                    
                    const temperature = isPumping ? 45 + (Math.random() * 5 - 2.5) : 20;
                    const pressure = isPumping ? 5.5 + (Math.random() * 1 - 0.5) : 0;
                    newScadaData[line.infrastructureId] = { flowRate, pumpStatus: isPumping ? 'ON' : 'OFF', temperature, pressure };
                    return line;
                });
                
                const newStatuses = deriveStatusFromSof(currentOp);
                if (newStatuses) {
                    currentOp = { ...currentOp, ...newStatuses };
                    wasModified = true;
                }

                opsCopy[opIndex] = currentOp;
            });

            if (wasModified) {
                // Use a functional update to prevent race conditions with user interactions.
                // This merges the simulation's changes (tonnes, auto-stop events) onto the latest state.
                setOperations(prevOps => {
                    const simulatedOpsMap = new Map(opsCopy.map(op => [op.id, op]));

                    return prevOps.map(currentOp => {
                        const simulatedOp = simulatedOpsMap.get(currentOp.id);
                        if (!simulatedOp) {
                            return currentOp; // Not simulated, return as is.
                        }

                        // Create a mutable deep copy to avoid direct state mutation.
                        const newOp = JSON.parse(JSON.stringify(currentOp));
                        const stopPumpEventName = newOp.modality === 'vessel' ? 'STOP PUMPING' : 'Pumping Stopped';

                        // Merge simulation-specific data from `simulatedOp` to `newOp`.
                        newOp.transferPlan.forEach((line: TransferPlanItem, lineIndex: number) => {
                            line.transfers.forEach((transfer: Transfer, transferIndex: number) => {
                                const simulatedTransfer = simulatedOp.transferPlan?.[lineIndex]?.transfers?.[transferIndex];
                                if (simulatedTransfer) {
                                    // Simulation is the source of truth for transferred volumes.
                                    transfer.transferredTonnes = simulatedTransfer.transferredTonnes;
                                    transfer.slopsTransferredTonnes = simulatedTransfer.slopsTransferredTonnes;

                                    // If simulation auto-completed a stop event, merge it.
                                    const currentSof = transfer.sof || [];
                                    const simulatedSof = simulatedTransfer.sof || [];
                                    if (simulatedSof.length > currentSof.length) {
                                        const newStopEvent = simulatedSof.find(s => 
                                            s.event.includes(stopPumpEventName) && 
                                            s.status === 'complete' &&
                                            !currentSof.some(cs => cs.event === s.event && cs.loop === cs.loop)
                                        );
                                        if (newStopEvent) {
                                            transfer.sof = [...currentSof, newStopEvent];
                                        }
                                    }
                                }
                            });
                        });
                        
                        // Simulation also derives truck status. Apply derived status from the simulated op.
                        const derivedStatus = deriveStatusFromSof(simulatedOp);
                        if(derivedStatus){
                             Object.assign(newOp, derivedStatus);
                        }

                        return newOp;
                    });
                });
            }

            if (tanksWereModified) {
                setTanks(tanksCopy);
            }
            setScadaData(newScadaData);

        }, 1500);

        return () => clearInterval(intervalId);
    }, []); // Empty dependency array ensures this runs only once.

    // Automatically flag overdue planned operations for rescheduling
    useEffect(() => {
        const intervalId = setInterval(() => {
            const now = simulatedTimeRef.current;
            const opsToUpdate: { id: string; type: 'no-show' | 'overdue' }[] = [];
    
            operationsRef.current.forEach(op => {
                if (op.status === 'planned' && !['Reschedule Required', 'No Show'].includes(op.currentStatus)) {
                    const etaTime = new Date(op.eta).getTime();
                    const isOverdue = etaTime < now.getTime();
    
                    if (isOverdue) {
                        if (op.modality === 'truck' && etaTime < (now.getTime() - 30 * 60 * 1000)) {
                            opsToUpdate.push({ id: op.id, type: 'no-show' });
                        } else {
                            opsToUpdate.push({ id: op.id, type: 'overdue' });
                        }
                    }
                }
            });
    
            if (opsToUpdate.length > 0) {
                setOperations(prevOps => {
                    let opsWereChanged = false;
                    const updatedOps = prevOps.map(op => {
                        const updateInfo = opsToUpdate.find(u => u.id === op.id);
                        if (updateInfo) {
                            opsWereChanged = true;
                            const time = simulatedTimeRef.current.toISOString();
                            if (updateInfo.type === 'no-show') {
                                const reason = 'Truck did not arrive within 30 minutes of ETA.';
                                const newLog: ActivityLogItem = { time, user: 'System', action: 'REQUEUE', details: `Automatically flagged as No Show. Reason: ${reason}` };
                                const requeueDetails: RequeueDetails = { reason: 'No Show', user: 'System', time, details: {}, priority: 'normal' };
                                return { ...op, currentStatus: 'No Show', requeueDetails, activityHistory: [...op.activityHistory, newLog] };
                            } else { // 'overdue'
                                const reason = 'Scheduled start time has passed.';
                                const newLog: ActivityLogItem = { time, user: 'System', action: 'REQUEUE', details: `Automatically flagged for reschedule. Reason: ${reason}` };
                                const requeueDetails: RequeueDetails = { reason, user: 'System', time, details: {}, priority: 'normal' };
                                return { ...op, currentStatus: 'Reschedule Required', requeueDetails, activityHistory: [...op.activityHistory, newLog] };
                            }
                        }
                        return op;
                    });
                    return opsWereChanged ? updatedOps : prevOps;
                });
            }
        }, 30000); // Check every 30 seconds for responsiveness
    
        return () => clearInterval(intervalId);
    }, []); // Empty dependency array, runs once on mount.

    // Effect to update visible infrastructure
    useEffect(() => {
        const infraMap = currentTerminalSettings.infrastructureModalityMapping || {};
        const wharfMap = createDocklineToWharfMap(currentTerminalSettings);
        
        const allInfra = Object.keys(infraMap).sort((a, b) => {
            const wharfA = wharfMap[a] || 'zzz';
            const wharfB = wharfMap[b] || 'zzz';
            if (wharfA < wharfB) return -1;
            if (wharfA > wharfB) return 1;
            return naturalSort(a, b);
        });

        const modalityFiltered = workspaceFilter === 'all'
            ? allInfra
            : allInfra.filter(infra => currentTerminalSettings.infrastructureModalityMapping[infra] === workspaceFilter);
        
        setVisibleInfrastructure(modalityFiltered);
    }, [selectedTerminal, workspaceFilter, settings]);


    const setSelectedTerminal = (terminal: string) => {
        setSelectedTerminalState(terminal);
        setWorkspaceSearchTerm('');
        switchView('dashboard');
    };

    const getOperationById = useCallback((id: string | null) => id ? operations.find(op => op.id === id) : undefined, [operations]);
    
    const getHistoryForAsset = useCallback((assetId: string, measurement: string): HistorianDataPoint[] => {
        return historianData[assetId]?.[measurement] || [];
    }, [historianData]);


    const switchView = (view: View, opId: string | null = null, lineIndex: number | null = null, transferIndex: number | null = null, opToEdit?: Operation, tankId?: string | null) => {
        if (view !== currentView || opId !== activeOpId || tankId !== activeTankId) {
             setViewHistory(prev => [...prev, { view: currentView, opId: activeOpId, lineIndex: activeLineIndex, transferIndex: activeTransferIndex, tankId: activeTankId }]);
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
        setActiveTankId(tankId || null);
    };

    const goBack = () => {
        const lastView = viewHistory.pop();
        if (lastView) {
            setViewHistory([...viewHistory]);
            setCurrentView(lastView.view);
            setActiveOpId(lastView.opId);
            setActiveLineIndex(lastView.lineIndex);
            setActiveTransferIndex(lastView.transferIndex);
            setActiveTankId(lastView.tankId || null);
        }
    };
    
    const openRescheduleModal = (opId: string, viewDate: Date = simulatedTimeRef.current, source?: 'dashboard-delay', priority: 'high' | 'normal' = 'normal') => {
        setRescheduleModalData({ opId, viewDate, source, priority });
    };

    const closeRescheduleModal = () => {
        setRescheduleModalData({ opId: null, viewDate: simulatedTimeRef.current });
    };

    const openNewOpModal = (initialData: Partial<Operation> | null = null) => {
        setNewOpInitialData(initialData);
        setIsNewOpModalOpen(true);
    };

    const closeNewOpModal = () => {
        setIsNewOpModalOpen(false);
        setNewOpInitialData(null);
    };
    
    const startPlacementMode = (opId: string) => {
        setPlacementOpId(opId);
    };
    
    const cancelPlacementMode = () => {
        setPlacementOpId(null);
    };

    const confirmPlacement = (newEta: string, newResource: string) => {
        if (!placementOpId) return;
    
        setOperations(prevOps => prevOps.map(op => {
            if (op.id === placementOpId) {
                const updatedOp = JSON.parse(JSON.stringify(op));
                
                const originalEta = op.eta;
                const originalResource = op.transferPlan[0]?.infrastructureId || 'Unassigned';
    
                updatedOp.eta = newEta;
                updatedOp.queuePriority = new Date(newEta).getTime();
                updatedOp.currentStatus = 'Scheduled';
                updatedOp.truckStatus = 'Planned';
                updatedOp.delay = { active: false }; // Clear delay if it was set
                
                // Clear requeue details, as it's now rescheduled
                updatedOp.requeueDetails = undefined; 
    
                // Update infrastructure for all transfers on all lines (though for trucks it's usually one)
                updatedOp.transferPlan = updatedOp.transferPlan.map((tp: TransferPlanItem) => ({
                    ...tp,
                    infrastructureId: newResource
                }));
    
                // Add activity log
                const newLog: ActivityLogItem = {
                    time: simulatedTimeRef.current.toISOString(),
                    user: currentUser.name,
                    action: 'UPDATE',
                    details: `Rescheduled from ${formatDateTime(originalEta)} at ${formatInfraName(originalResource)} to ${formatDateTime(newEta)} at ${formatInfraName(newResource)} via board placement.`
                };
                updatedOp.activityHistory.push(newLog);
    
                return updatedOp;
            }
            return op;
        }));
        
        // Exit placement mode
        setPlacementOpId(null);
    };

    // FIX: Add handlers for DirectToBayModal
    const closeDirectToBayModal = () => {
        setDirectToBayModalState({ isOpen: false, op: null, isRevert: false, bayInfraId: undefined });
    };

    const handleConfirmBayAction = () => {
        const { op, isRevert, bayInfraId } = directToBayModalState;
        if (!op) return;

        if (isRevert) {
            // Logic from original revertCallOff
            setOperations(prevOps => {
                const newOps = [...prevOps];
                const opIndex = newOps.findIndex(o => o.id === op.id && o.modality === 'truck' && o.truckStatus === 'Directed to Bay');
                if (opIndex > -1) {
                    const opToUpdate = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
                    
                    const transfer = opToUpdate.transferPlan[0]?.transfers[0];
                    if (transfer?.sof) {
                        // Find the highest loop and revert 'Directed to Bay' and subsequent steps in that loop
                        const latestLoopNum = Math.max(1, ...transfer.sof.map(s => s.loop));
                        const stepToRevertIndex = transfer.sof.findIndex(s => s.event.includes('Directed to Bay') && s.loop === latestLoopNum);
                        
                        if (stepToRevertIndex > -1) {
                            transfer.sof.forEach((step, index) => {
                                if (index >= stepToRevertIndex && step.loop === latestLoopNum) {
                                    step.status = 'pending';
                                    step.time = '';
                                    step.user = '';
                                }
                            });
                        }
                    }

                    const newLog: ActivityLogItem = { time: simulatedTimeRef.current.toISOString(), user: currentUser.name, action: 'STATUS_UPDATE', details: 'Truck call-off reverted, now waiting for bay.' };
                    opToUpdate.activityHistory.push(newLog);

                    const newStatuses = deriveStatusFromSof(opToUpdate);
                    Object.assign(opToUpdate, newStatuses);

                    newOps[opIndex] = opToUpdate;
                }
                return newOps;
            });
        } else {
            const opId = op.id;
            const finalBayInfraId = bayInfraId || op.transferPlan[0]?.infrastructureId;

            if (!finalBayInfraId) {
                console.error("Cannot direct truck: No bay specified.");
                closeDirectToBayModal();
                return;
            }

            setOperations(prevOps => {
                const newOps = [...prevOps];
                const opIndex = newOps.findIndex(o => o.id === opId);
                if (opIndex > -1) {
                    const opToUpdate = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;

                    opToUpdate.transferPlan[0].infrastructureId = finalBayInfraId;

                    const transfer = opToUpdate.transferPlan[0]?.transfers[0];
                    if (transfer?.sof) {
                        const latestLoopNum = Math.max(1, ...transfer.sof.map(s => s.loop));
                        const stepToComplete = transfer.sof.find(s => s.event.includes('Directed to Bay') && s.loop === latestLoopNum);

                        if (stepToComplete) {
                            const sofIndex = transfer.sof.findIndex(s => s.event === stepToComplete.event && s.loop === stepToComplete.loop);
                            if (sofIndex > -1) {
                                transfer.sof[sofIndex] = { ...stepToComplete, status: 'complete', time: simulatedTimeRef.current.toISOString(), user: currentUser.name };
                            }
                        }
                    }
                    
                    const newStatuses = deriveStatusFromSof(opToUpdate);
                    if (newStatuses) {
                        Object.assign(opToUpdate, newStatuses);
                    } else {
                        opToUpdate.currentStatus = 'Directed to Bay';
                        opToUpdate.truckStatus = 'Directed to Bay';
                    }
                    
                    if (opToUpdate.requeueDetails?.priority === 'high') {
                        opToUpdate.requeueDetails = undefined;
                    }

                    const newLog: ActivityLogItem = { time: simulatedTimeRef.current.toISOString(), user: currentUser.name, action: 'STATUS_UPDATE', details: `Truck directed to bay ${finalBayInfraId}.` };
                    opToUpdate.activityHistory.push(newLog);

                    newOps[opIndex] = opToUpdate;
                }
                return newOps;
            });
        }
    };

    const delegateRole = (targetUserName: string) => {
        if (currentUser.role !== 'Operations Lead') return;
        setUsers(prevUsers => prevUsers.map(user => {
            if (user.name === targetUserName && !user.delegatedBy) {
                return {
                    ...user,
                    originalRole: user.role,
                    delegatedBy: currentUser.name,
                    role: currentUser.role,
                };
            }
            return user;
        }));
    };

    const revokeDelegation = (targetUserName: string) => {
        setUsers(prevUsers => prevUsers.map(user => {
            if (user.name === targetUserName && user.originalRole) {
                return {
                    ...user,
                    role: user.originalRole,
                    originalRole: undefined,
                    delegatedBy: undefined,
                };
            }
            return user;
        }));
    };

    const addActivityLog = useCallback((opId: string, action: ActivityAction | string, details: string) => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            const newOps = [...prevOps];
            const newLog: ActivityLogItem = { time: simulatedTimeRef.current.toISOString(), user: currentUser.name, action, details };
            newOps[opIndex].activityHistory = [...newOps[opIndex].activityHistory, newLog];
            return newOps;
        });
    }, [currentUser.name]);

    const saveCurrentPlan = useCallback((opToSave: Operation) => {
        setOperations(prevOps => {
            const originalOp = prevOps.find(op => op.id === opToSave.id);
            let opWithUpdatedStatus = { ...opToSave };
            const newLogs: ActivityLogItem[] = [];
            const time = simulatedTimeRef.current.toISOString();
    
            // --- SOF Status Derivation ---
            const newStatuses = deriveStatusFromSof(opWithUpdatedStatus);
            if (newStatuses) {
                opWithUpdatedStatus = { ...opWithUpdatedStatus, ...newStatuses };
                
                if (newStatuses.status === 'completed' && (!originalOp || !originalOp.completedTime)) {
                    opWithUpdatedStatus = calculateAndSetCycleTime(opWithUpdatedStatus);
                    opWithUpdatedStatus.completedTime = time;
                    newLogs.push({
                        time,
                        user: 'System',
                        action: 'STATUS_UPDATE',
                        details: 'Operation automatically completed based on SOF.'
                    });
                }
            }
    
            // --- Plan Diffing for Audit Log ---
            if (originalOp) {
                const checkField = (field: keyof Operation, label: string) => {
                    const oldValue = (originalOp as any)[field] || '';
                    const newValue = (opWithUpdatedStatus as any)[field] || '';
                    if (oldValue !== newValue) {
                        newLogs.push({
                            time, user: currentUser.name, action: 'PLAN_UPDATE',
                            details: `${label} changed from "${oldValue || 'N/A'}" to "${newValue || 'N/A'}".`
                        });
                    }
                };
        
                if (new Date(originalOp.eta).toISOString() !== new Date(opWithUpdatedStatus.eta).toISOString()) {
                    newLogs.push({
                        time, user: currentUser.name, action: 'PLAN_UPDATE',
                        details: `ETA changed from ${formatDateTime(originalOp.eta)} to ${formatDateTime(opWithUpdatedStatus.eta)}.`
                    });
                }
                checkField('transportId', 'Transport ID');
                checkField('licensePlate', 'License Plate');
                checkField('driverName', 'Driver Name');
                checkField('driverPhone', 'Driver Phone');
                checkField('driverEmail', 'Driver Email');

                if (JSON.stringify(originalOp.hoseLog || []) !== JSON.stringify(opWithUpdatedStatus.hoseLog || [])) {
                    newLogs.push({ time, user: currentUser.name, action: 'LOG_UPDATE', details: 'Hose Log was updated.' });
                }
                if (JSON.stringify(originalOp.handOvers || []) !== JSON.stringify(opWithUpdatedStatus.handOvers || [])) {
                    newLogs.push({ time, user: currentUser.name, action: 'LOG_UPDATE', details: 'Hand Over Log was updated.' });
                }
                if (JSON.stringify(originalOp.observationLog || []) !== JSON.stringify(opWithUpdatedStatus.observationLog || [])) {
                    newLogs.push({ time, user: currentUser.name, action: 'LOG_UPDATE', details: 'Observation Log was updated.' });
                }
                if (JSON.stringify(originalOp.dipSheetData || []) !== JSON.stringify(opWithUpdatedStatus.dipSheetData || [])) {
                    newLogs.push({ time, user: currentUser.name, action: 'LOG_UPDATE', details: 'Dip Calculation Sheet was updated.' });
                }
        
                const originalLines = originalOp.transferPlan || [];
                const newLines = opWithUpdatedStatus.transferPlan || [];
        
                if (originalLines.length !== newLines.length) {
                    newLogs.push({
                        time, user: currentUser.name, action: 'PLAN_UPDATE',
                        details: `Number of infrastructure lineups changed from ${originalLines.length} to ${newLines.length}.`
                    });
                }
        
                const maxLines = Math.max(originalLines.length, newLines.length);
                for (let i = 0; i < maxLines; i++) {
                    const oldLine = originalLines[i];
                    const newLine = newLines[i];
                    
                    if (!oldLine) {
                        newLogs.push({ time, user: currentUser.name, action: 'PLAN_UPDATE', details: `Added infrastructure lineup for ${formatInfraName(newLine.infrastructureId) || 'Unassigned'}.` });
                        continue;
                    }
                    if (!newLine) {
                        newLogs.push({ time, user: currentUser.name, action: 'PLAN_UPDATE', details: `Removed infrastructure lineup for ${formatInfraName(oldLine.infrastructureId) || 'Unassigned'}.` });
                        continue;
                    }
        
                    if (oldLine.infrastructureId !== newLine.infrastructureId) {
                        newLogs.push({ time, user: currentUser.name, action: 'PLAN_UPDATE', details: `Lineup #${i+1} infrastructure changed from ${formatInfraName(oldLine.infrastructureId) || 'Unassigned'} to ${formatInfraName(newLine.infrastructureId) || 'Unassigned'}.` });
                    }
        
                    const oldTransfers = oldLine.transfers || [];
                    const newTransfers = newLine.transfers || [];
                    
                    if (oldTransfers.length !== newTransfers.length) {
                        newLogs.push({ time, user: currentUser.name, action: 'PLAN_UPDATE', details: `Number of transfers on lineup ${formatInfraName(newLine.infrastructureId) || `(#${i+1})`} changed from ${oldTransfers.length} to ${newTransfers.length}.` });
                    }
        
                    const maxTransfers = Math.max(oldTransfers.length, newTransfers.length);
                    for (let j = 0; j < maxTransfers; j++) {
                        const oldT = oldTransfers[j];
                        const newT = newTransfers[j];
                        const context = `on lineup ${formatInfraName(newLine.infrastructureId) || `(#${i+1})`}, Transfer #${j+1}`;
        
                        if (!oldT) {
                            newLogs.push({ time, user: currentUser.name, action: 'PLAN_UPDATE', details: `Added new transfer for ${newT.product} ${context}.` });
                            continue;
                        }
                        if (!newT) {
                            newLogs.push({ time, user: currentUser.name, action: 'PLAN_UPDATE', details: `Removed transfer for ${oldT.product} ${context}.` });
                            continue;
                        }
                        
                        const checkTransferField = (field: keyof Transfer, label: string) => {
                            const oldValue = (oldT as any)[field] || '';
                            const newValue = (newT as any)[field] || '';
                            if (oldValue !== newValue) {
                                newLogs.push({ time, user: currentUser.name, action: 'PLAN_UPDATE', details: `${label} changed from "${oldValue || 'N/A'}" to "${newValue || 'N/A'}" ${context}.` });
                            }
                        };
        
                        checkTransferField('customer', 'Customer');
                        checkTransferField('product', 'Product');
                        checkTransferField('tonnes', 'Tonnes');
                        checkTransferField('direction', 'Direction');
                        checkTransferField('from', 'From');
                        checkTransferField('to', 'To');
                        checkTransferField('additionalInformation', 'Additional Information');
                        
                        const oldServices = (oldT.specialServices || []).map(s => s.name).sort();
                        const newServices = (newT.specialServices || []).map(s => s.name).sort();
                        if (JSON.stringify(oldServices) !== JSON.stringify(newServices)) {
                            const oldServicesStr = oldServices.join(', ') || 'none';
                            const newServicesStr = newServices.join(', ') || 'none';
                            newLogs.push({
                                time, user: currentUser.name, action: 'PLAN_UPDATE',
                                details: `Services changed from "${oldServicesStr}" to "${newServicesStr}" ${context}.`
                            });
                        }
                    }
                }
                
                const oldReqs = (originalOp.specialRequirements || []).map(r => r.name).sort();
                const newReqs = (opWithUpdatedStatus.specialRequirements || []).map(r => r.name).sort();
                 if (JSON.stringify(oldReqs) !== JSON.stringify(newReqs)) {
                    const oldReqsStr = oldReqs.join(', ') || 'none';
                    const newReqsStr = newReqs.join(', ') || 'none';
                    newLogs.push({
                        time, user: currentUser.name, action: 'PLAN_UPDATE',
                        details: `Vessel-level services changed from "${oldReqsStr}" to "${newReqsStr}".`
                    });
                }
            }
        
            if (newLogs.length > 0) {
                opWithUpdatedStatus.activityHistory = [...(opWithUpdatedStatus.activityHistory || []), ...newLogs];
            }
            
            return prevOps.map(op => op.id === opWithUpdatedStatus.id ? opWithUpdatedStatus : op);
        });
    }, [currentUser.name]);


    // Sync editingOp with the master operations list if it's stale, but protect user edits
    useEffect(() => {
        // If a user edit is pending a debounced save, do not overwrite it.
        if (debounceTimerRef.current) {
            return;
        }

        if (editingOp) {
            const masterOp = operations.find(op => op.id === editingOp.id);
            if (masterOp) {
                if (JSON.stringify(masterOp) !== JSON.stringify(editingOp)) {
                    isSyncingEditingOpRef.current = true;
                    setEditingOp(JSON.parse(JSON.stringify(masterOp)));
                }
            } else {
                setEditingOp(null);
            }
        }
    }, [operations]);

    // Auto-save effect with debounce and protection
    useEffect(() => {
        if (isSyncingEditingOpRef.current) {
            isSyncingEditingOpRef.current = false;
            return;
        }

        if (editingOp) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = window.setTimeout(() => {
                saveCurrentPlan(editingOp);
                debounceTimerRef.current = null; // Signal save is complete
            }, 1500);
            
            return () => {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                }
            };
        }
    }, [editingOp, saveCurrentPlan]);

    const createNewOperation = (details: CreateOperationDetails) => {
        const newId = `op-${details.modality}-${Date.now()}`;
        const time = simulatedTimeRef.current.toISOString();
        let newOp: Operation = {
            id: newId,
            terminal: selectedTerminal,
            modality: details.modality,
            status: 'planned',
            transportId: details.transportId,
            eta: details.eta,
            durationHours: details.durationHours,
            queuePriority: new Date(details.eta).getTime(),
            currentStatus: 'Scheduled',
            activityHistory: [{ time, user: currentUser.name, action: 'CREATE', details: `New ${details.modality} operation plan created.` }],
            transferPlan: [],
            delay: { active: false },
            lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
            specialRequirements: [],
        };
    
        if (details.modality === 'vessel') {
            newOp = {
                ...newOp,
                transferPlan: details.transferPlan || [],
                specialRequirements: details.specialRequirements || [],
                sof: SOF_EVENTS_MODALITY.vessel.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
            };
        } else { // Truck or Rail
            const transfer = details.transfer || {};
            newOp = {
                ...newOp,
                transferPlan: [{
                    infrastructureId: '', // To be assigned in the main planning screen
                    transfers: [{
                        id: `transfer-${Date.now()}`,
                        customer: transfer.customer || '',
                        product: transfer.product || '',
                        from: '',
                        to: (details.modality === 'truck' && transfer.direction === 'Tank to Truck') ? details.transportId : '',
                        tonnes: transfer.tonnes || 0,
                        direction: transfer.direction || '',
                        specialServices: [],
                        transferredTonnes: 0,
                        slopsTransferredTonnes: 0,
                        sof: SOF_EVENTS_MODALITY[details.modality].map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
                    }],
                }],
            };
            if (details.modality === 'truck') {
                newOp.truckStatus = 'Planned';
                newOp.licensePlate = details.licensePlate || `NEW-${String(Date.now()).slice(-4)}`;
                newOp.driverName = details.driverName;
            }
        }
    
        setOperations(prevOps => [...prevOps, newOp]);
        switchView('planning');
    };
    
    const cancelOperation = (opId: string, reason: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => op.id === opId);
            if (opIndex > -1) {
                const time = simulatedTimeRef.current.toISOString();
                const cancellationDetails = {
                    time,
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
    
    const requeueTruckOperation = (opId: string, reason: string, details: { notes?: string; photo?: string }, priority: 'high' | 'normal' = 'normal') => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => op.id === opId);
            if (opIndex > -1) {
                const time = simulatedTimeRef.current.toISOString();
                const newLog: ActivityLogItem = { time, user: currentUser.name, action: 'REQUEUE', details: `Truck re-queued. Reason: ${reason}` };
                const requeueDetails: RequeueDetails = {
                    reason,
                    user: currentUser.name,
                    time,
                    details: details,
                    priority: priority,
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

    const requeueOperation = (opId: string, reason: string, priority: 'high' | 'normal' = 'normal') => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            const newOps = [...prevOps];
            const opToRequeue = newOps[opIndex];
            const time = simulatedTimeRef.current.toISOString();
            const newLog: ActivityLogItem = { time, user: currentUser.name, action: 'REQUEUE', details: `Operation flagged for reschedule. Reason: ${reason}` };
            const requeueDetails: RequeueDetails = {
                reason,
                user: currentUser.name,
                time,
                details: {},
                priority,
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

    const reworkTruckOperation = (opId: string, reason: string, notes: string, priority: 'high' | 'normal' = 'normal') => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
    
            const newOps = [...prevOps];
            const opToRework = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
            // Assume first transfer for trucks
            const transfer = opToRework.transferPlan[0]?.transfers[0];
    
            if (!transfer) return prevOps;
    
            // Find the highest existing loop number
            const maxLoop = Math.max(0, ...(transfer.sof || []).map(s => s.loop));

            // Remove pending steps from the current loop to "insert" the rework loop before them (effectively replacing them)
            if (transfer.sof) {
                transfer.sof = transfer.sof.filter(s => !(s.loop === maxLoop && s.status === 'pending'));
            }
            
            const newLoopNum = maxLoop + 1;
    
            // Create new SOF items for the new loop, starting from 'Directed to Bay'
            // The truck events are:
            // ['Arrived', 'Ready / Approved', 'Directed to Bay', 'On Bay', 'Pumping Started', 'Pumping Stopped', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Departed']
            const truckEvents = SOF_EVENTS_MODALITY['truck'];
            const startIndex = truckEvents.indexOf('Directed to Bay');
            const eventsToAdd = startIndex >= 0 ? truckEvents.slice(startIndex) : truckEvents;

            const newSofItems: SOFItem[] = eventsToAdd.map(event => ({
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
            const time = simulatedTimeRef.current.toISOString();
            opToRework.requeueDetails = {
                reason: `Rework: ${reason}`,
                user: currentUser.name,
                time,
                details: { notes },
                priority,
            };
            
            const newLog: ActivityLogItem = {
                time,
                user: currentUser.name,
                action: 'REQUEUE',
                details: `Truck requires rework. Reason: ${reason}. Notes: ${notes}`
            };
            opToRework.activityHistory.push(newLog);
    
            newOps[opIndex] = opToRework;
            
            // This needs to happen after the state update to ensure the modal gets the new requeueDetails
            setTimeout(() => openRescheduleModal(opId, undefined, undefined, priority), 100);
    
            return newOps;
        });
    
        switchView('planning'); // Navigate back to the planning board
    };

    const acceptTruckArrival = (opId: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => 
                op.id === opId && 
                op.modality === 'truck' && 
                (op.truckStatus === 'Registered' || ['Reschedule Required', 'No Show'].includes(op.currentStatus))
            );
            if (opIndex > -1) {
                const opToValidate = newOps[opIndex];

                // --- SAFETY CHECK ---
                const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
                const validation = validateOperationPlan(opToValidate, currentTerminalSettings, settings, activeHolds);
                if (!validation.isValid) {
                    alert(`Cannot activate truck. Plan has issues:\n- ${validation.issues.join('\n- ')}`);
                    return prevOps; // Abort state change
                }
                // --- END OF CHECK ---
                const time = simulatedTimeRef.current.toISOString();
                
                const logDetails = opToValidate.truckStatus === 'Registered' 
                    ? 'Truck arrival accepted. Operation is now active and waiting for bay.'
                    : `Overdue truck accepted. Status changed from '${opToValidate.currentStatus}' to active.`;

                const newLog: ActivityLogItem = { time, user: currentUser.name, action: 'STATUS_UPDATE', details: logDetails };
                
                const updatedOp = JSON.parse(JSON.stringify(opToValidate)) as Operation;
                const transfer = updatedOp.transferPlan?.[0]?.transfers?.[0];
                if (transfer?.sof) {
                    const stepsToComplete = ['Arrived', 'Ready / Approved'];
                    stepsToComplete.forEach(stepName => {
                        const latestLoopNum = Math.max(1, ...transfer.sof!.map(s => s.loop));
                        const stepIndex = transfer.sof!.findIndex(s => s.event.includes(stepName) && s.status === 'pending' && s.loop === latestLoopNum);
                        if (stepIndex > -1) {
                            transfer.sof![stepIndex] = {
                                ...transfer.sof![stepIndex],
                                status: 'complete',
                                time,
                                user: currentUser.name,
                            };
                        }
                    });
                }

                updatedOp.status = 'active';
                
                // Immediately derive new status from SOF change
                const newStatuses = deriveStatusFromSof(updatedOp);

                newOps[opIndex] = {
                    ...updatedOp,
                    ...newStatuses, // Apply derived statuses
                    activityHistory: [...updatedOp.activityHistory, newLog],
                    requeueDetails: undefined,
                    delay: { active: false },
                };
            }
            return newOps;
        });
    };
    
    // FIX: Modified to open modal instead of directly updating state.
    const callOffTruck = (opId: string) => {
        const op = getOperationById(opId);
        if (op) {
            setDirectToBayModalState({ isOpen: true, op, isRevert: false });
        }
    };
    
    const directTruckToBay = (opId: string, bayInfraId: string) => {
        const op = getOperationById(opId);
        if (op) {
            // The operation object in state doesn't have the bay assigned yet.
            // But the modal needs to know it to display the message.
            // So, create a temporary copy with the bay assigned.
            const opWithBayAssigned = JSON.parse(JSON.stringify(op));
            opWithBayAssigned.transferPlan[0].infrastructureId = bayInfraId;

            setDirectToBayModalState({ isOpen: true, op: opWithBayAssigned, isRevert: false, bayInfraId: bayInfraId });
        }
    };

    // FIX: Modified to open modal instead of directly updating state.
    const revertCallOff = (opId: string) => {
        const op = getOperationById(opId);
        if (op) {
            setDirectToBayModalState({ isOpen: true, op, isRevert: true });
        }
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
                        const time = simulatedTimeRef.current.toISOString();
                        const newLog: ActivityLogItem = {
                            time,
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
                    const time = simulatedTimeRef.current.toISOString();
                    const newLog: ActivityLogItem = {
                        time,
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
                            time,
                            details: { holdId: hold.id, holdReason: hold.reason, resource: hold.resource },
                            priority: 'high',
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
            const time = simulatedTimeRef.current.toISOString();
            savedHold = {
                ...hold,
                id: `hold-${Date.now()}`,
                user: currentUser.name,
                time,
                status: isMaintenanceRequest ? 'pending' : 'approved',
                workOrderStatus: isMaintenanceRequest ? 'Requested' : undefined,
                workOrderNotes: isMaintenanceRequest ? [{ time, user: currentUser.name, note: 'Work order created.' }] : [],
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

                // FIX: Changed incorrect variable `line` to `tp`.
                return (tp.transfers || []).some(t => t.from === savedHold.tank || t.to === savedHold.tank);
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
                const time = simulatedTimeRef.current.toISOString();
                const newLog: WorkOrderNote | undefined = h.workOrderStatus ? {
                    time,
                    user: currentUser.name,
                    note: `Work order cancelled. Reason: ${reason}`
                } : undefined;

// FIX: Explicitly type the updated hold object to prevent TypeScript from widening
// the 'status' property to a generic 'string', ensuring it matches the 'OutageStatus' type.
                const updatedHold: Hold = {
                    ...h,
                    status: 'cancelled',
                    cancellationDetails: {
                        time,
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
                newNotes.push({ time: simulatedTimeRef.current.toISOString(), user: currentUser.name, note: noteText });
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
                const time = simulatedTimeRef.current.toISOString();
                const newLog: ActivityLogItem = {
                    time,
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
                const completedTime = simulatedTimeRef.current.toISOString();
                const newLog: ActivityLogItem = {
                    time: completedTime,
                    user: currentUser.name,
                    action: 'STATUS_UPDATE',
                    details: 'Operation marked as completed.'
                };
                
                let opWithCycleTime = calculateAndSetCycleTime(op);

                completedOp = {
                    ...opWithCycleTime,
                    status: 'completed',
                    currentStatus: 'Completed',
                    completedTime: completedTime,
                    activityHistory: [...op.activityHistory, newLog],
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
                switchView('active-operations-list');
            }
        }, 100);
    };

    const updateCompletedOperationDetails = (opId: string, opUpdates: Partial<Operation>, transferId?: string, transferUpdates?: Partial<Transfer>) => {
        setOperations(prevOps => {
          const opIndex = prevOps.findIndex(op => op.id === opId);
          if (opIndex === -1) return prevOps;
    
          const originalOp = prevOps[opIndex];
          const newOps = [...prevOps];
          let opToUpdate = JSON.parse(JSON.stringify(originalOp)); // Use a deep copy to avoid mutation issues
    
          const newLogs: ActivityLogItem[] = [];
          const time = simulatedTimeRef.current.toISOString();
    
          // Apply and log operation-level updates
          if (opUpdates && Object.keys(opUpdates).length > 0) {
            Object.assign(opToUpdate, opUpdates);
            for (const key in opUpdates) {
                const oldValue = (originalOp as any)[key];
                const newValue = (opUpdates as any)[key];
                if (String(oldValue) !== String(newValue)) { // Use string comparison to handle different types (e.g., number vs string)
                    newLogs.push({
                        time: simulatedTimeRef.current.toISOString(),
                        user: currentUser.name,
                        action: 'REPORT_UPDATE',
                        details: `Updated ${key} from "${oldValue || 'N/A'}" to "${newValue || 'N/A'}".`
                    });
                }
            }
          }
    
          // Apply and log transfer-level updates
          if (transferId && transferUpdates && Object.keys(transferUpdates).length > 0) {
            let originalTransfer: Transfer | undefined;
            let transferProduct = '';
    
            opToUpdate.transferPlan = opToUpdate.transferPlan.map((line: TransferPlanItem) => ({
              ...line,
              transfers: line.transfers.map((t: Transfer) => {
                if (t.id === transferId) {
                    originalTransfer = originalOp.transferPlan.flatMap(l => l.transfers).find(ot => ot.id === transferId);
                    transferProduct = t.product;
                    return { ...t, ...transferUpdates };
                }
                return t;
              })
            }));
    
            if (originalTransfer) {
                for (const key in transferUpdates) {
                    const oldValue = (originalTransfer as any)[key];
                    const newValue = (transferUpdates as any)[key];
                     if (String(oldValue) !== String(newValue)) {
                         newLogs.push({
                            time: simulatedTimeRef.current.toISOString(),
                            user: currentUser.name,
                            action: 'REPORT_UPDATE',
                            details: `Updated ${key} from "${oldValue || 'N/A'}" to "${newValue || 'N/A'}" for product ${transferProduct}.`
                        });
                    }
                }
            }
          }
    
          if (newLogs.length > 0) {
            opToUpdate.activityHistory = [...opToUpdate.activityHistory, ...newLogs];
          }
    
          newOps[opIndex] = opToUpdate;
          return newOps;
        });
      };
      
    const updatePreArrivalCheck = (opId: string, checkName: string, newStatus: 'pending' | 'complete') => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            
            const newOps = [...prevOps];
            const opToUpdate = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;

            if (!opToUpdate.preArrivalChecks) opToUpdate.preArrivalChecks = {};
            
            const oldStatus = opToUpdate.preArrivalChecks[checkName]?.status || 'pending';

            if (oldStatus !== newStatus) {
                opToUpdate.preArrivalChecks[checkName] = { 
                    status: newStatus, 
                    user: currentUser.name, 
                    time: simulatedTimeRef.current.toISOString() 
                };
                addActivityLog(opId, 'UPDATE', `Pre-arrival check '${checkName}' marked as ${newStatus}.`);
            }
            
            newOps[opIndex] = opToUpdate;
            return newOps;
        });
    };

    const updateVesselServiceStatus = (opId: string, serviceName: string, status: 'pending' | 'confirmed' | 'complete') => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            
            const newOps = [...prevOps];
            const opToUpdate = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;

            const serviceIndex = (opToUpdate.specialRequirements || []).findIndex(s => s.name === serviceName);
            if (serviceIndex > -1) {
                if (!opToUpdate.specialRequirements[serviceIndex].data) {
                    opToUpdate.specialRequirements[serviceIndex].data = {};
                }
                opToUpdate.specialRequirements[serviceIndex].data.status = status;

                addActivityLog(opId, 'UPDATE', `Status for service '${serviceName}' updated to ${status}.`);
            }
            
            newOps[opIndex] = opToUpdate;
            return newOps;
        });
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
        tanks,
        getOperationById,
        getHistoryForAsset,
        currentView,
        activeOpId,
        activeLineIndex,
        activeTransferIndex,
        activeTankId,
        switchView,
        isSidebarOpen, setIsSidebarOpen,
        viewHistory,
        goBack,
        workspaceFilter, setWorkspaceFilter,
        workspaceSearchTerm, setWorkspaceSearchTerm,
        visibleInfrastructure, setVisibleInfrastructure,
        rescheduleModalData, openRescheduleModal, closeRescheduleModal,
        isNewOpModalOpen, newOpInitialData, openNewOpModal, closeNewOpModal,
        placementOpId, startPlacementMode, cancelPlacementMode, confirmPlacement,
        editingOp, setEditingOp,
        currentUser, users, setUsers, setCurrentUser,
        delegateRole, revokeDelegation,
        addActivityLog,
        saveCurrentPlan,
        createNewOperation,
        cancelOperation,
        requeueTruckOperation,
        requeueOperation,
        reworkTruckOperation,
        acceptTruckArrival,
        callOffTruck,
        directTruckToBay,
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
        updateCompletedOperationDetails,
        updatePreArrivalCheck,
        updateVesselServiceStatus,
        // FIX: Provide the new conflict resolution state and functions in the context value.
        conflictData,
        closeConflictModal,
        resolveAndRescheduleConflicts,
        // FIX: Provide new properties for DirectToBayModal
        directToBayModalState: directToBayModalState as any, // Cast to avoid changing type everywhere
        closeDirectToBayModal,
        handleConfirmBayAction,
        simulatedTime,
        isTimePlaying,
        setIsTimePlaying,
    };
    
    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};