


import React, { createContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Operation, AppSettings, Hold, ScadaData, UIState, View, TerminalSettings, Modality, ActivityAction, ActivityLogItem, ViewHistoryItem, RequeueDetails, User, SOFItem, DipSheetEntry, WorkOrderStatus, WorkOrderNote, CycleTimeData, Transfer, OutageStatus, TransferPlanItem, HistorianData, HistorianDataPoint, SpecialServiceData, ManpowerSchedule, ReportType } from '../types';
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
    setPlanningViewMode: (mode: 'grid' | 'list' | 'kanban') => void;
    // FIX: Removed duplicate identifier 'updateColumnVisibility'.
    setReportFilters: (filters: Partial<UIState['reports']>) => void;
    setCompletedOpsTab: (tab: 'report' | 'list') => void;
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
    isDesktopSidebarCollapsed: boolean;
    setIsDesktopSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    viewHistory: ViewHistoryItem[];
    goBack: () => void;
    workspaceFilter: Modality | 'all';
    setWorkspaceFilter: React.Dispatch<React.SetStateAction<Modality | 'all'>>;
    workspaceSearchTerm: string;
    setWorkspaceSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    visibleInfrastructure: string[];
    updateColumnVisibility: (newVisibleCols: string[]) => void;
    rescheduleModalData: { opId: string | null; viewDate: Date; source?: 'dashboard-delay', priority?: 'high' | 'normal' };
    openRescheduleModal: (opId: string, viewDate?: Date, source?: 'dashboard-delay', priority?: 'high' | 'normal') => void;
    closeRescheduleModal: () => void;
    isNewOpModalOpen: boolean;
    newOpInitialData: Partial<Operation> | null;
    openNewOpModal: (initialData?: Partial<Operation> | null) => void;
    closeNewOpModal: () => void;
    
    // State for No Show delay modal
    noShowDelayModalState: { isOpen: boolean; opId: string | null };
    closeNoShowDelayModal: () => void;
    handleConfirmNoShowDelay: (opId: string, reason: string, notes: string) => void;

    // New state for Accept No Show modal
    acceptNoShowModalState: { isOpen: boolean; opId: string | null };
    openAcceptNoShowModal: (opId: string) => void;
    closeAcceptNoShowModal: () => void;
    handleConfirmAcceptNoShow: (opId: string, reason: string) => void;

    // Placement Mode for Rescheduling
    placementOpId: string | null;
    startPlacementMode: (opId: string) => void;
    cancelPlacementMode: () => void;
    confirmPlacement: (opId: string, newEta: string, newResource: string) => void;
    isSchedulerMode: boolean;
    setIsSchedulerMode: React.Dispatch<React.SetStateAction<boolean>>;

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
    processReworkTruck: (opId: string) => void;
    markTruckArrived: (opId: string) => void;
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
    updateOperationServiceStatus: (opId: string, serviceName: string, status: 'pending' | 'confirmed' | 'complete') => void;
    updateTransferServiceStatus: (opId: string, transferId: string, serviceName: string, status: 'pending' | 'confirmed' | 'complete') => void;
    conflictData: { isOpen: boolean; conflictingOps: Operation[]; hold: Hold | null };
    closeConflictModal: () => void;
    resolveAndRescheduleConflicts: () => void;
    // FIX: Add `bayInfraId` to the type definition for directToBayModalState to match the state's shape.
    directToBayModalState: { isOpen: boolean; op: Operation | null; isRevert: boolean; bayInfraId?: string; };
    closeDirectToBayModal: () => void;
    handleConfirmBayAction: () => void;
    redirectBayModalState: { isOpen: boolean; op: Operation | null; occupiedByOp: Operation | null };
    closeRedirectBayModal: () => void;
    handleScheduleForLater: (opId: string) => void;
    
    // Simulation
    simulatedTime: Date;
    isTimePlaying: boolean;
    setIsTimePlaying: React.Dispatch<React.SetStateAction<boolean>>;

    // Manpower
    manpowerSchedule: ManpowerSchedule;
    setManpowerSchedule: React.Dispatch<React.SetStateAction<ManpowerSchedule>>;
    updateUserShift: (userName: string, shift: 'Day' | 'Swing' | 'Night' | 'Off') => void;
    updateUserAssignments: (userName: string, assignments: { modalities: Modality[], areas: string[] }) => void;
    
    // Bay Clearing
    lastCompletedOpByInfra: Record<string, string>;
    clearBayForNextOp: (infraId: string) => void;
    planningCustomerFilter: string[];
    setPlanningCustomerFilter: React.Dispatch<React.SetStateAction<string[]>>;

    // Request Reschedule
    requestRescheduleModalState: { isOpen: boolean; opId: string | null };
    openRequestRescheduleModal: (opId: string) => void;
    closeRequestRescheduleModal: () => void;
    requestReschedule: (opId: string, reason: string, notes: string) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_USERS: User[] = [
    { name: 'Ops Lead', role: 'Operations Lead', shift: 'Day' },
    { name: 'Operator 1', role: 'Operator', shift: 'Day', assignedModalities: ['truck'], assignedAreas: ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'] },
    { name: 'Operator 2', role: 'Operator', shift: 'Day', assignedModalities: ['vessel'], assignedAreas: ['L12', 'L13'] },
    { name: 'Operator 3', role: 'Operator', shift: 'Swing', assignedModalities: ['rail'], assignedAreas: ['Siding A', 'Siding B'] },
    { name: 'Operator 4', role: 'Operator', shift: 'Swing', assignedModalities: ['truck'], assignedAreas: [] },
    { name: 'Operator 5', role: 'Operator', shift: 'Night', assignedModalities: ['vessel', 'truck'], assignedAreas: [] },
    { name: 'Dispatch', role: 'Dispatch', shift: 'Day' },
    { name: 'Terminal Planner', role: 'Terminal Planner', shift: 'Day' },
    { name: 'Maintenance Planner', role: 'Maintenance Planner', shift: 'Day' },
    { name: 'Maintenance Tech', role: 'Maintenance Tech', shift: 'Day' },
    { name: 'Commercials', role: 'Commercials', shift: 'Day' },
];

const INITIAL_SCHEDULE: ManpowerSchedule = {
  'Operator 1': { 0: ['Bay 1'], 1: ['Bay 1'], 2: ['Bay 1'], 3: ['Bay 2'], 4: ['Bay 2'], 5: ['Bay 2'], 6: [], 7: [] },
  'Operator 2': { 0: ['L12'], 1: ['L12'], 2: ['L12'], 3: ['L12'], 4: ['L13'], 5: ['L13'], 6: ['L13'], 7: ['L13'] },
  'Operator 3': { 8: ['Siding A'], 9: ['Siding A'], 10: ['Siding B'], 11: ['Siding B'], 12: ['Siding B'], 13: ['Siding B'], 14: ['Siding B'], 15: ['Siding B'], 16: ['Siding B'] }, // Over 8 hours
  'Operator 4': { 8: ['Bay 5'], 9: ['Bay 5'], 10: ['Bay 6'], 11: ['Bay 6']},
  'Operator 5': {},
};

const lastYear = new Date().getFullYear() - 1;
const INITIAL_UI_STATE: UIState = {
    planningViewMode: 'grid',
    columnVisibility: {},
    reports: {
        reportType: 'cycleTime',
        startDate: `${lastYear}-01-01`,
        endDate: `${lastYear}-12-31`,
        customer: 'All',
        productGroup: 'All',
    },
    completedOps: { activeTab: 'list' }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [operations, setOperations] = useState<Operation[]>([]);
    const [settings, setSettings] = useState<AppSettings>(dataService.loadSettings());
    const [holds, setHolds] = useState<Hold[]>([]);
    const [scadaData, setScadaData] = useState<ScadaData>({});
    const [historianData, setHistorianData] = useState<HistorianData>({});
    const [uiState, setUiState] = useState<UIState>(INITIAL_UI_STATE);
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
    const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
    const [users, setUsers] = useState<User[]>(INITIAL_USERS);
    const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
    const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
    const [workspaceFilter, setWorkspaceFilter] = useState<Modality | 'all'>('truck');
    const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState('');
    const [visibleInfrastructure, setVisibleInfrastructure] = useState<string[]>([]);
    const [userAllowedInfra, setUserAllowedInfra] = useState<string[]>([]);
    const [rescheduleModalData, setRescheduleModalData] = useState<{ opId: string | null; viewDate: Date; source?: 'dashboard-delay', priority?: 'high' | 'normal' }>({ opId: null, viewDate: MOCK_CURRENT_TIME });
    const [editingOp, setEditingOp] = useState<Operation | null>(null);
    const [isNewOpModalOpen, setIsNewOpModalOpen] = useState(false);
    const [newOpInitialData, setNewOpInitialData] = useState<Partial<Operation> | null>(null);
    const [conflictData, setConflictData] = useState<{ isOpen: boolean; conflictingOps: Operation[]; hold: Hold | null }>({ isOpen: false, conflictingOps: [], hold: null });
    const [placementOpId, setPlacementOpId] = useState<string | null>(null);
    const [noShowDelayModalState, setNoShowDelayModalState] = useState<{ isOpen: boolean; opId: string | null }>({ isOpen: false, opId: null });
    const [acceptNoShowModalState, setAcceptNoShowModalState] = useState<{ isOpen: boolean; opId: string | null }>({ isOpen: false, opId: null });
    const [directToBayModalState, setDirectToBayModalState] = useState<{
        isOpen: boolean;
        op: Operation | null;
        isRevert: boolean;
        bayInfraId?: string;
    }>({ isOpen: false, op: null, isRevert: false });
    const [redirectBayModalState, setRedirectBayModalState] = useState<{ isOpen: boolean; op: Operation | null; occupiedByOp: Operation | null; }>({ isOpen: false, op: null, occupiedByOp: null });
    const [manpowerSchedule, setManpowerSchedule] = useState<ManpowerSchedule>(INITIAL_SCHEDULE);
    const [isSchedulerMode, setIsSchedulerMode] = useState(false);
    const [lastCompletedOpByInfra, setLastCompletedOpByInfra] = useState<Record<string, string>>({});
    const [planningCustomerFilter, setPlanningCustomerFilter] = useState<string[]>(['All']);
    const [requestRescheduleModalState, setRequestRescheduleModalState] = useState<{ isOpen: boolean; opId: string | null }>({ isOpen: false, opId: null });


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

            const newScadaData: ScadaData = {};
            
            // DEMO-ONLY SCADA: This section is for UI demonstration only.
            // It generates fake SCADA data but does NOT update operation progress or tank levels.
            // This prevents excessive writes to localStorage in the demo environment.
            activeOps.forEach(activeOp => {
                const startPumpEventName = activeOp.modality === 'vessel' ? 'START PUMPING' : 'Pumping Started';
                const stopPumpEventName = activeOp.modality === 'vessel' ? 'STOP PUMPING' : 'Pumping Stopped';

                (activeOp.transferPlan || []).forEach((line: TransferPlanItem) => {
                    // Check if any transfer on this infrastructure line is actively pumping.
                    const isPumping = (line.transfers || []).some((t: Transfer) =>
                        (t.sof || []).some(s => s.event.includes(startPumpEventName) && s.status === 'complete') &&
                        !(t.sof || []).some(s => s.event.includes(stopPumpEventName) && s.status === 'complete')
                    );
                    
                    // Generate fake data for the SCADA modal UI.
                    const flowRate = isPumping ? (line.infrastructureId.startsWith('L') ? 1200 : line.infrastructureId.startsWith('Bay') ? 150 : 300) + (Math.random() * 50 - 25) : 0;
                    const temperature = isPumping ? 45 + (Math.random() * 5 - 2.5) : 20;
                    const pressure = isPumping ? 5.5 + (Math.random() * 1 - 0.5) : 0;
                    newScadaData[line.infrastructureId] = { flowRate, pumpStatus: isPumping ? 'ON' : 'OFF', temperature, pressure };
                });
            });

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
                        } else if (op.modality !== 'truck') { // Only flag non-trucks as generically overdue
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

    // EFFECT 1: Determine user's total scope and set initial UI filter on login/user change.
    useEffect(() => {
        const infraMap = currentTerminalSettings.infrastructureModalityMapping || {};
        const allTerminalInfra = Object.keys(infraMap);

        // For leads, allow everything and reset filters.
        if (currentUser && (currentUser.role === 'Operations Lead' || currentUser.delegatedBy)) {
            setUserAllowedInfra(allTerminalInfra);
            setWorkspaceFilter('truck');
            return;
        }
        
        // For other users (operators, etc.), determine their scope from assignments.
        if (currentUser) {
            const { assignedModalities, assignedAreas } = currentUser;

            let allowedInfra: string[] = [];
            // If specific areas are assigned, that's their entire scope.
            if (assignedAreas && assignedAreas.length > 0) {
                allowedInfra = assignedAreas;
            } 
            // If not, but modalities are assigned, their scope is all infra for those modalities.
            else if (assignedModalities && assignedModalities.length > 0) {
                allowedInfra = allTerminalInfra.filter(infraId => 
                    assignedModalities.includes(infraMap[infraId])
                );
            } 
            // If no assignments, default to showing everything to avoid a blank screen.
            else {
                allowedInfra = allTerminalInfra;
            }
            setUserAllowedInfra(allowedInfra);

            // Set a sensible initial UI filter based on assigned modalities.
            if (assignedModalities && assignedModalities.length === 1) {
                setWorkspaceFilter(assignedModalities[0]);
            } else {
                setWorkspaceFilter('truck'); // Handles 0 or >1 modalities.
            }
        }
    }, [currentUser, settings, selectedTerminal]);


    // EFFECT 2: Determine what's actually visible on screen based on the user's scope AND their selected UI filter.
    useEffect(() => {
         const infraMap = currentTerminalSettings.infrastructureModalityMapping || {};

        // All infrastructure that could be shown for this filter.
        const allPossibleInfraForFilter = userAllowedInfra.filter(infraId => {
            if (workspaceFilter === 'all') return true;
            return infraMap[infraId] === workspaceFilter;
        });

        // Check for user preference for the current terminal and filter.
        const preferredCols = uiState.columnVisibility?.[selectedTerminal]?.[workspaceFilter];

        let finalVisible: string[];
        
        if (preferredCols) {
            // User has preferences. Use them, but ensure they are still valid for the current context.
            finalVisible = preferredCols.filter(col => allPossibleInfraForFilter.includes(col));
        } else {
            // No preference found, default to showing all possible columns.
            finalVisible = allPossibleInfraForFilter;
        }
        
        // Sort the final list for a consistent display order.
        finalVisible.sort(naturalSort);

        setVisibleInfrastructure(finalVisible);
    }, [userAllowedInfra, workspaceFilter, settings, selectedTerminal, uiState.columnVisibility]);


    const setSelectedTerminal = (terminal: string) => {
        setSelectedTerminalState(terminal);
        setWorkspaceSearchTerm('');
        setPlanningCustomerFilter(['All']);
        switchView('dashboard');
    };

    const getOperationById = useCallback((id: string | null) => id ? operations.find(op => op.id === id) : undefined, [operations]);
    
    const getHistoryForAsset = useCallback((assetId: string, measurement: string): HistorianDataPoint[] => {
        return historianData[assetId]?.[measurement] || [];
    }, [historianData]);

    const setPlanningViewMode = (mode: 'grid' | 'list' | 'kanban') => {
        setUiState(prev => ({ ...prev, planningViewMode: mode }));
    };

    const updateColumnVisibility = (newVisibleCols: string[]) => {
        setVisibleInfrastructure(newVisibleCols);
        setUiState(prev => {
            const newUiState = JSON.parse(JSON.stringify(prev));
            if (!newUiState.columnVisibility) newUiState.columnVisibility = {};
            if (!newUiState.columnVisibility[selectedTerminal]) newUiState.columnVisibility[selectedTerminal] = {};
            newUiState.columnVisibility[selectedTerminal][workspaceFilter] = newVisibleCols;
            return newUiState;
        });
    };

    const setReportFilters = (filters: Partial<UIState['reports']>) => {
        setUiState(prev => ({
            ...prev,
            reports: {
                ...prev.reports!,
                ...filters,
            }
        }));
    };

    const setCompletedOpsTab = (tab: 'report' | 'list') => {
        setUiState(prev => ({ ...prev, completedOps: { ...prev.completedOps!, activeTab: tab } }));
    };


    const switchView = (view: View, opId: string | null = null, lineIndex: number | null = null, transferIndex: number | null = null, opToEdit?: Operation, tankId?: string | null) => {
        if (view !== currentView || opId !== activeOpId || tankId !== activeTankId) {
             setViewHistory(prev => [...prev, { view: currentView, opId: activeOpId, lineIndex: activeLineIndex, transferIndex: activeTransferIndex, tankId: activeTankId }]);
        }
        
        const EDITING_VIEWS: View[] = ['operation-details', 'operation-plan', 'product-transfer-details', 'dip-sheet'];
        const isNavigatingToEditingView = EDITING_VIEWS.includes(view);
        const isCurrentlyEditing = editingOp !== null;
    
        // If we are leaving an editing context, save any pending changes.
        // This happens if we are currently editing AND (we are navigating to a non-editing view OR we are navigating to a different operation).
        if (isCurrentlyEditing && (!isNavigatingToEditingView || editingOp.id !== opId)) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            // Save immediately before changing context
            saveCurrentPlan(editingOp);
        }
        
        // Now handle the state for the new view
        if (isNavigatingToEditingView && opId) {
            // Only load if we are not already editing the correct operation
            if (editingOp?.id !== opId) {
                const opToLoad = opToEdit || operations.find(o => o.id === opId);
                if (opToLoad) {
                    setEditingOp(JSON.parse(JSON.stringify(opToLoad)));
                } else {
                    setEditingOp(null); // Op not found
                }
            }
        } else if (!isNavigatingToEditingView) {
            // Clear editing state if moving to a non-editing view
            setEditingOp(null);
        }
        
        setCurrentView(view);
        setActiveOpId(opId);
        setActiveLineIndex(lineIndex);
        setActiveTransferIndex(transferIndex);
        setActiveTankId(tankId || null);
    };

    const goBack = () => {
        // 1. Save current work if any
        const isCurrentlyEditing = editingOp !== null;
        if (isCurrentlyEditing) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            saveCurrentPlan(editingOp);
        }
    
        // 2. Pop the history stack
        const lastViewItem = viewHistory.pop();
        if (lastViewItem) {
            setViewHistory([...viewHistory]); // Update state after pop
    
            // 3. Set the state for the previous view
            const EDITING_VIEWS: View[] = ['operation-details', 'operation-plan', 'product-transfer-details', 'dip-sheet'];
            const isGoingToEditingView = EDITING_VIEWS.includes(lastViewItem.view);
    
            if (isGoingToEditingView && lastViewItem.opId) {
                const opToLoad = operations.find(o => o.id === lastViewItem.opId);
                if (opToLoad) {
                    setEditingOp(JSON.parse(JSON.stringify(opToLoad)));
                } else {
                    setEditingOp(null);
                }
            } else {
                setEditingOp(null);
            }
    
            setCurrentView(lastViewItem.view);
            setActiveOpId(lastViewItem.opId);
            setActiveLineIndex(lastViewItem.lineIndex);
            setActiveTransferIndex(lastViewItem.transferIndex);
            setActiveTankId(lastViewItem.tankId || null);
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

    const confirmPlacement = (opId: string, newEta: string, newResource: string) => {
        if (!opId) return;
    
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
    
            const newOps = [...prevOps];
            const opToPlace = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
            
            const isRework = opToPlace.requeueDetails?.reason?.startsWith('Rework:');
            
            const originalEta = opToPlace.eta;
            const originalResource = opToPlace.transferPlan[0]?.infrastructureId || 'Unassigned';
    
            // Update common fields
            opToPlace.eta = newEta;
            opToPlace.queuePriority = new Date(newEta).getTime();
            opToPlace.transferPlan = opToPlace.transferPlan.map((tp: TransferPlanItem) => ({
                ...tp,
                infrastructureId: newResource
            }));
    
            // Clear flags
            opToPlace.delay = { active: false };
            opToPlace.requeueDetails = undefined;
            
            let logDetails = '';
    
            if (isRework) {
                // A reworked truck has already arrived, so it goes back to 'Waiting' state.
                opToPlace.status = 'active';
                opToPlace.truckStatus = 'Waiting';
                opToPlace.currentStatus = 'Waiting for Bay';
                logDetails = `Reworked truck rescheduled from ${formatDateTime(originalEta)} at ${formatInfraName(originalResource)} to ${formatDateTime(newEta)} at ${formatInfraName(newResource)}. Status is now 'Waiting for Bay'.`;
            } else {
                // A normal reschedule goes back to a 'Planned' state.
                opToPlace.status = 'planned';
                opToPlace.truckStatus = 'Planned';
                opToPlace.currentStatus = 'Scheduled';
                logDetails = `Rescheduled from ${formatDateTime(originalEta)} at ${formatInfraName(originalResource)} to ${formatDateTime(newEta)} at ${formatInfraName(newResource)}.`;
            }
            
            const newLog: ActivityLogItem = {
                time: simulatedTimeRef.current.toISOString(),
                user: currentUser.name,
                action: 'UPDATE',
                details: logDetails
            };
            opToPlace.activityHistory.push(newLog);
    
            newOps[opIndex] = opToPlace;
            return newOps;
        });
        
        // Exit placement mode if it was active
        if (placementOpId === opId) {
            setPlacementOpId(null);
        }
    };

    const openAcceptNoShowModal = (opId: string) => {
        setAcceptNoShowModalState({ isOpen: true, opId });
    };

    const closeAcceptNoShowModal = () => {
        setAcceptNoShowModalState({ isOpen: false, opId: null });
    };

    const handleConfirmAcceptNoShow = (opId: string, reason: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => 
                op.id === opId && 
                op.modality === 'truck' && 
                (['Reschedule Required', 'No Show'].includes(op.currentStatus))
            );
            if (opIndex > -1) {
                const opToValidate = newOps[opIndex];
    
                const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
                const validation = validateOperationPlan(opToValidate, currentTerminalSettings, settings, activeHolds);
                if (!validation.isValid) {
                    alert(`Cannot activate truck. Plan has issues:\n- ${validation.issues.join('\n- ')}`);
                    return prevOps;
                }
                
                const time = simulatedTimeRef.current.toISOString();
                const logDetails = `Overdue truck accepted and has arrived. Status changed from '${opToValidate.currentStatus}' to 'Awaiting Gate Approval'. Reason: ${reason}`;
                const newLog: ActivityLogItem = { time, user: currentUser.name, action: 'STATUS_UPDATE', details: logDetails };
                
                const updatedOp = JSON.parse(JSON.stringify(opToValidate)) as Operation;
                const transfer = updatedOp.transferPlan?.[0]?.transfers?.[0];
                if (transfer?.sof) {
                    const stepsToComplete = ['Arrived'];
                    stepsToComplete.forEach(stepName => {
                        const latestLoopNum = Math.max(1, ...transfer.sof!.map(s => s.loop));
                        const stepIndex = transfer.sof!.findIndex(s => s.event.includes(stepName) && s.status === 'pending' && s.loop === latestLoopNum);
                        if (stepIndex > -1) {
                            transfer.sof![stepIndex] = { ...transfer.sof![stepIndex], status: 'complete', time, user: currentUser.name };
                        }
                    });
                }
    
                updatedOp.status = 'active';
                const newStatuses = deriveStatusFromSof(updatedOp, true);
    
                newOps[opIndex] = {
                    ...updatedOp, ...newStatuses,
                    activityHistory: [...updatedOp.activityHistory, newLog],
                    requeueDetails: undefined,
                    delay: { active: false },
                };
            }
            return newOps;
        });
        closeAcceptNoShowModal();
    };

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
                    const wasConflicted = ['Reschedule Required', 'No Show'].includes(opToUpdate.currentStatus);

                    opToUpdate.transferPlan[0].infrastructureId = finalBayInfraId;
                    
                    if (wasConflicted) {
                        opToUpdate.eta = simulatedTimeRef.current.toISOString();
                        opToUpdate.queuePriority = simulatedTimeRef.current.getTime();
                    }

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
                    
                    const newStatuses = deriveStatusFromSof(opToUpdate, true);
                    if (newStatuses) {
                        Object.assign(opToUpdate, newStatuses);
                    } else {
                        opToUpdate.currentStatus = 'Directed to Bay';
                        opToUpdate.truckStatus = 'Directed to Bay';
                    }
                    
                    if (opToUpdate.requeueDetails?.priority === 'high') {
                        opToUpdate.requeueDetails = undefined;
                    }
                    if (wasConflicted) {
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

    const closeRedirectBayModal = () => {
        setRedirectBayModalState({ isOpen: false, op: null, occupiedByOp: null });
    };

    const handleScheduleForLater = (opId: string) => {
        const op = getOperationById(opId);
        if (!op) return;
    
        setOperations(prevOps => prevOps.map(o => {
            if (o.id === opId) {
                const time = simulatedTimeRef.current.toISOString();
                const newLog: ActivityLogItem = { time, user: currentUser.name, action: 'REQUEUE', details: `Bay occupied. Manually flagged for reschedule.` };
                const requeueDetails: RequeueDetails = { reason: 'Bay Occupied - Reschedule', user: currentUser.name, time, details: {}, priority: 'normal' };
                
                // Revert SOF state to 'Ready / Approved'
                const updatedOp = JSON.parse(JSON.stringify(o));
                const transfer = updatedOp.transferPlan?.[0]?.transfers?.[0];
                if (transfer?.sof) {
                    const readyStepIndex = transfer.sof.findIndex((s: SOFItem) => s.event.includes('Ready / Approved'));
                    if (readyStepIndex > -1) {
                        transfer.sof.forEach((step: SOFItem, index: number) => {
                            if (index > readyStepIndex) {
                                step.status = 'pending';
                                step.time = '';
                                step.user = '';
                            }
                        });
                    }
                }
                const newStatuses = deriveStatusFromSof(updatedOp, true);
    
                return { 
                    ...updatedOp,
                    ...newStatuses,
                    currentStatus: 'Reschedule Required',
                    requeueDetails,
                    activityHistory: [...o.activityHistory, newLog]
                };
            }
            return o;
        }));
        
        closeRedirectBayModal();
        switchView('planning'); // Switch to the planning board
        startPlacementMode(opId); // Then activate placement mode
    };

    const openRequestRescheduleModal = (opId: string) => {
        setRequestRescheduleModalState({ isOpen: true, opId });
    };

    const closeRequestRescheduleModal = () => {
        setRequestRescheduleModalState({ isOpen: false, opId: null });
    };

    const requestReschedule = (opId: string, reason: string, notes: string) => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            
            const newOps = [...prevOps];
            const opToUpdate = newOps[opIndex];
            const time = simulatedTimeRef.current.toISOString();

            const newLog: ActivityLogItem = {
                time,
                user: currentUser.name,
                action: 'REQUEUE_REQUEST',
                details: `Reschedule requested. Reason: ${reason}. Notes: ${notes}`
            };

            const requeueDetails: RequeueDetails = {
                reason,
                user: currentUser.name,
                time,
                details: { notes },
                isRequest: true,
            };

            newOps[opIndex] = {
                ...opToUpdate,
                currentStatus: 'Reschedule Requested',
                requeueDetails,
                activityHistory: [...opToUpdate.activityHistory, newLog],
            };
            
            return newOps;
        });
        closeRequestRescheduleModal();
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
                    infrastructureId: details.transferPlan?.[0]?.infrastructureId || '',
                    transfers: [{
                        id: `transfer-${Date.now()}`,
                        customer: transfer.customer || '',
                        product: transfer.product || '',
                        from: transfer.from || '',
                        to: transfer.to || '',
                        tonnes: transfer.tonnes || 0,
                        direction: transfer.direction || '',
                        specialServices: transfer.specialServices || [],
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
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
    
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
    
            const newOps = [...prevOps];
            const opToRework = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
            const transfer = opToRework.transferPlan[0]?.transfers[0];
    
            if (!transfer || opToRework.modality !== 'truck') return prevOps;
    
            const truckEvents = SOF_EVENTS_MODALITY['truck'];
            const maxLoop = Math.max(1, ...(transfer.sof || []).map(s => s.loop || 1));
            
            const lastLoopSof = (transfer.sof || []).filter(s => s.loop === maxLoop && s.status === 'complete');
    
            const lastCompletedStepIndex = Math.max(
                -1, 
                ...lastLoopSof.map(s => {
                    const baseEvent = s.event.replace(/^(Rework #\d+: )/, '');
                    return truckEvents.indexOf(baseEvent);
                })
            );
            
            const pumpingStoppedIndex = truckEvents.indexOf('Pumping Stopped');
            const hasFinishedPumping = lastCompletedStepIndex >= pumpingStoppedIndex;
    
            const newLoopNum = maxLoop + 1;
            let eventsToAdd: string[];
            
            if (hasFinishedPumping) {
                eventsToAdd = [
                    'Directed to Bay',
                    'On Bay',
                    'Pumping Started',
                    'Pumping Stopped',
                    'Post-Load Weighing',
                    'Seal Applied',
                    'BOL Printed',
                    'Departed',
                ];
            } else {
                const startIndex = truckEvents.indexOf('Pumping Started');
                eventsToAdd = startIndex !== -1 ? truckEvents.slice(startIndex) : [];
            }
    
            const newSofItems: SOFItem[] = eventsToAdd.map(event => ({
                event: `Rework #${newLoopNum}: ${event}`,
                status: 'pending',
                time: '',
                user: '',
                loop: newLoopNum,
            }));
    
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
            
            return newOps;
        });
    };
    
    const processReworkTruck = (opId: string) => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId && op.requeueDetails?.reason?.startsWith('Rework:'));
            if (opIndex === -1) return prevOps;
    
            const newOps = [...prevOps];
            const opToProcess = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
    
            const transfer = opToProcess.transferPlan[0]?.transfers[0];
            if (transfer?.sof) {
                const reworkLoop = transfer.sof.find(s => s.event.startsWith('Rework #'));
                const reworkLoopNum = reworkLoop ? reworkLoop.loop : -1;
    
                if (reworkLoopNum > 1) {
                    transfer.sof = transfer.sof.map(s => {
                        if (s.loop < reworkLoopNum && s.status === 'pending') {
                            return { ...s, status: 'skipped' };
                        }
                        return s;
                    });
                }
            }
    
            opToProcess.status = 'active';
            opToProcess.truckStatus = 'Waiting';
            opToProcess.currentStatus = 'Waiting for Bay';
            opToProcess.requeueDetails = undefined;
    
            const newLog: ActivityLogItem = {
                time: simulatedTimeRef.current.toISOString(),
                user: currentUser.name,
                action: 'STATUS_UPDATE',
                details: 'Rework process initiated. Original pending steps bypassed. Truck is now waiting for a bay assignment.'
            };
            opToProcess.activityHistory.push(newLog);
    
            newOps[opIndex] = opToProcess;
            return newOps;
        });
    };

    const markTruckArrived = (opId: string) => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId && op.modality === 'truck' && op.status === 'planned');
            if (opIndex === -1) return prevOps;
    
            const newOps = [...prevOps];
            const opToUpdate = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
            const time = simulatedTimeRef.current.toISOString();
    
            // Update SOF
            const transfer = opToUpdate.transferPlan?.[0]?.transfers?.[0];
            if (transfer?.sof) {
                const stepIndex = transfer.sof.findIndex(s => s.event.includes('Arrived') && s.status === 'pending');
                if (stepIndex > -1) {
                    transfer.sof[stepIndex] = { ...transfer.sof[stepIndex], status: 'complete', time, user: currentUser.name };
                }
            }
    
            // Update statuses derived from SOF
            const newStatuses = deriveStatusFromSof(opToUpdate, true);
            if (newStatuses) {
                Object.assign(opToUpdate, newStatuses);
            } else {
                // Fallback statuses if derivation fails
                opToUpdate.status = 'active';
                opToUpdate.truckStatus = 'Registered';
                opToUpdate.currentStatus = 'Awaiting Gate Approval';
            }
    
            // Add log
            const newLog: ActivityLogItem = { time, user: currentUser.name, action: 'STATUS_UPDATE', details: 'Truck marked as arrived at terminal.' };
            opToUpdate.activityHistory.push(newLog);
    
            newOps[opIndex] = opToUpdate;
            return newOps;
        });
    };

    const acceptTruckArrival = (opId: string) => {
        setOperations(prevOps => {
            const newOps = [...prevOps];
            const opIndex = newOps.findIndex(op => 
                op.id === opId && 
                op.modality === 'truck' && 
                (op.truckStatus === 'Registered' || op.currentStatus === 'Awaiting Approval')
            );
            if (opIndex > -1) {
                const opToValidate = newOps[opIndex];

                const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
                const validation = validateOperationPlan(opToValidate, currentTerminalSettings, settings, activeHolds);
                if (!validation.isValid) {
                    alert(`Cannot activate truck. Plan has issues:\n- ${validation.issues.join('\n- ')}`);
                    return prevOps;
                }
                const time = simulatedTimeRef.current.toISOString();
                
                const logDetails = 'Truck arrival approved. Operation is now waiting for bay assignment.';

                const newLog: ActivityLogItem = { time, user: currentUser.name, action: 'STATUS_UPDATE', details: logDetails };
                
                const updatedOp = JSON.parse(JSON.stringify(opToValidate)) as Operation;
                const transfer = updatedOp.transferPlan?.[0]?.transfers?.[0];
                if (transfer?.sof) {
                    const stepsToComplete = ['Ready / Approved'];
                    stepsToComplete.forEach(stepName => {
                        const latestLoopNum = Math.max(1, ...transfer.sof!.map(s => s.loop));
                        const stepIndex = transfer.sof!.findIndex(s => s.event.includes(stepName) && s.status === 'pending' && s.loop === latestLoopNum);
                        if (stepIndex > -1) {
                            transfer.sof![stepIndex] = { ...transfer.sof![stepIndex], status: 'complete', time, user: currentUser.name };
                        }
                    });
                }

                updatedOp.status = 'active';
                
                const newStatuses = deriveStatusFromSof(updatedOp);

                newOps[opIndex] = {
                    ...updatedOp, ...newStatuses,
                    activityHistory: [...updatedOp.activityHistory, newLog],
                    requeueDetails: undefined,
                    delay: { active: false },
                };
            }
            return newOps;
        });
    };
    
    const callOffTruck = (opId: string) => {
        const op = getOperationById(opId);
        if (op) {
            setDirectToBayModalState({ isOpen: true, op, isRevert: false });
        }
    };
    
    const directTruckToBay = (opId: string, bayInfraId: string) => {
        const opToDirect = getOperationById(opId);
        if (!opToDirect) return;
    
        const OCCUPYING_STATUSES = ['Directed to Bay', 'On Bay', 'Loading'];
    
        const occupyingOp = operations.find(op =>
            op.id !== opId &&
            op.modality === 'truck' &&
            op.status === 'active' &&
            op.transferPlan[0]?.infrastructureId === bayInfraId &&
            OCCUPYING_STATUSES.includes(op.truckStatus || '')
        );
    
        if (occupyingOp) {
            setRedirectBayModalState({
                isOpen: true,
                op: opToDirect,
                occupiedByOp: occupyingOp,
            });
            return;
        }

        const now = simulatedTimeRef.current.getTime();
        const conflictingHold = holds.find(hold => 
            hold.resource === bayInfraId &&
            hold.status === 'approved' &&
            !['Completed', 'Closed'].includes(hold.workOrderStatus || '') &&
            now >= new Date(hold.startTime).getTime() &&
            now < new Date(hold.endTime).getTime()
        );

        if (conflictingHold) {
            alert(`Cannot direct truck to ${formatInfraName(bayInfraId)}. The bay is currently on hold for "${conflictingHold.reason}".`);
            return;
        }
    
        const opWithBayAssigned = JSON.parse(JSON.stringify(opToDirect));
        opWithBayAssigned.transferPlan[0].infrastructureId = bayInfraId;
    
        setDirectToBayModalState({ isOpen: true, op: opWithBayAssigned, isRevert: false, bayInfraId: bayInfraId });
    };

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
    const closeNoShowDelayModal = () => {
        setNoShowDelayModalState({ isOpen: false, opId: null });
    };

    const handleConfirmNoShowDelay = (opId: string, reason: string, notes: string) => {
        logDelay(opId, reason, notes);
        closeNoShowDelayModal();
    };

    const clearBayForNextOp = (infraId: string) => {
        setLastCompletedOpByInfra(prev => {
            const newState = { ...prev };
            delete newState[infraId];
            return newState;
        });
    };

    const handleCompleteOperation = (opId: string) => {
        const opToComplete = operationsRef.current.find(op => op.id === opId);
        if (!opToComplete) return;

        const completedTime = simulatedTimeRef.current.toISOString();
        const newLog: ActivityLogItem = {
            time: completedTime,
            user: currentUser.name,
            action: 'STATUS_UPDATE',
            details: 'Operation marked as completed.'
        };
        
        const opWithCycleTime = calculateAndSetCycleTime(opToComplete);

        const completedOp: Operation = {
            ...opWithCycleTime,
            status: 'completed',
            currentStatus: 'Completed',
            completedTime: completedTime,
            activityHistory: [...opToComplete.activityHistory, newLog],
        };
        
        // Perform all state updates together. React 18 will batch them.
        setOperations(prevOps => prevOps.map(op => (op.id === opId ? completedOp : op)));
        
        // Side effects using the newly created completedOp object.
        if (completedOp.modality === 'truck') {
            const infraId = completedOp.transferPlan[0]?.infrastructureId;
            if (infraId) {
                setLastCompletedOpByInfra(prev => ({ ...prev, [infraId]: completedOp.id }));
            }
        }
        
        completedOp.transferPlan.forEach(line => {
            const lastTransfer = line.transfers[line.transfers.length - 1];
            if (lastTransfer) {
                updateInfrastructureLastProduct(completedOp.terminal, line.infrastructureId, lastTransfer.product);
            }
        });
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

    const updateOperationServiceStatus = (opId: string, serviceName: string, status: 'pending' | 'confirmed' | 'complete') => {
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

                addActivityLog(opId, 'UPDATE', `Status for vessel service '${serviceName}' updated to ${status}.`);
            }
            
            newOps[opIndex] = opToUpdate;
            return newOps;
        });
    };

    const updateTransferServiceStatus = (opId: string, transferId: string, serviceName: string, status: 'pending' | 'confirmed' | 'complete') => {
        setOperations(prevOps => {
            const opIndex = prevOps.findIndex(op => op.id === opId);
            if (opIndex === -1) return prevOps;
            
            const newOps = [...prevOps];
            const opToUpdate = JSON.parse(JSON.stringify(newOps[opIndex])) as Operation;
            
            let transferFound = false;
            let product = 'Unknown Product';
            for (const line of opToUpdate.transferPlan) {
                const transferIndex = line.transfers.findIndex(t => t.id === transferId);
                if (transferIndex > -1) {
                    const serviceIndex = (line.transfers[transferIndex].specialServices || []).findIndex(s => s.name === serviceName);
                    if (serviceIndex > -1) {
                        if (!line.transfers[transferIndex].specialServices[serviceIndex].data) {
                            line.transfers[transferIndex].specialServices[serviceIndex].data = {};
                        }
                        line.transfers[transferIndex].specialServices[serviceIndex].data.status = status;
                        product = line.transfers[transferIndex].product;
                        transferFound = true;
                        break;
                    }
                }
            }

            if (transferFound) {
                addActivityLog(opId, 'UPDATE', `Status for service '${serviceName}' (${product}) updated to ${status}.`);
            }
            
            newOps[opIndex] = opToUpdate;
            return newOps;
        });
    };

    const updateUserShift = (userName: string, shift: 'Day' | 'Swing' | 'Night' | 'Off') => {
        setUsers(prevUsers => prevUsers.map(user => 
            user.name === userName ? { ...user, shift } : user
        ));
    };
    
    const updateUserAssignments = (userName: string, assignments: { modalities: Modality[], areas: string[] }) => {
        setUsers(prevUsers => prevUsers.map(user =>
            user.name === userName ? { ...user, assignedModalities: assignments.modalities, assignedAreas: assignments.areas } : user
        ));
    };

    const contextValue: AppContextType = {
        operations, setOperations,
        settings, setSettings,
        holds, setHolds,
        scadaData,
        uiState,
        setPlanningViewMode,
        updateColumnVisibility,
        setReportFilters, setCompletedOpsTab,
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
        isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed,
        viewHistory,
        goBack,
        workspaceFilter, setWorkspaceFilter,
        workspaceSearchTerm, setWorkspaceSearchTerm,
        visibleInfrastructure,
        rescheduleModalData, openRescheduleModal, closeRescheduleModal,
        isNewOpModalOpen, newOpInitialData, openNewOpModal, closeNewOpModal,
        noShowDelayModalState, closeNoShowDelayModal, handleConfirmNoShowDelay,
        acceptNoShowModalState, openAcceptNoShowModal, closeAcceptNoShowModal, handleConfirmAcceptNoShow,
        placementOpId, startPlacementMode, cancelPlacementMode, confirmPlacement,
        isSchedulerMode, setIsSchedulerMode,
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
        processReworkTruck,
        markTruckArrived,
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
        updateOperationServiceStatus,
        updateTransferServiceStatus,
        conflictData,
        closeConflictModal,
        resolveAndRescheduleConflicts,
        // FIX: Remove the `as any` cast by using the corrected type.
        directToBayModalState,
        closeDirectToBayModal,
        handleConfirmBayAction,
        redirectBayModalState,
        closeRedirectBayModal,
        handleScheduleForLater,
        simulatedTime,
        isTimePlaying,
        setIsTimePlaying,
        manpowerSchedule,
        setManpowerSchedule,
        updateUserShift,
        updateUserAssignments,
        lastCompletedOpByInfra,
        clearBayForNextOp,
        planningCustomerFilter,
        setPlanningCustomerFilter,
        requestRescheduleModalState,
        openRequestRescheduleModal,
        closeRequestRescheduleModal,
        requestReschedule,
    };
    
    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};