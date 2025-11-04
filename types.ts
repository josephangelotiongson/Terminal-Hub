
// FIX: Removed circular import of 'Modality' that was causing a name conflict.

// FIX: Replaced constants and circular import with actual type definitions.
export type Modality = 'vessel' | 'truck' | 'rail';
// FIX: Add 'dip-sheet' to the View type to resolve type error in AppContext.tsx.
export type View = 'dashboard' | 'planning' | 'active-operations-list' | 'operation-details' | 'operation-plan' | 'completed' | 'reports' | 'config-matrix' | 'master-data' | 'outage-planning' | 'maintenance' | 'special-services' | 'product-transfer-details' | 'dip-sheet';
export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_UPDATE' | 'SOF_UPDATE' | 'DATA_LOG' | 'REQUEUE';
export type OperationStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type SofStatus = 'pending' | 'in-progress' | 'complete';
export type OutageStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ReportType = 'cycleTime' | 'revenue' | 'throughput' | 'downtime';
export type WorkOrderStatus = 'Requested' | 'Acknowledged' | 'In Progress' | 'Pending Parts' | 'Completed' | 'Closed';

export interface User {
    name: string;
    role: string;
}

export interface ActivityLogItem {
    time: string;
    user: string;
    action: ActivityAction | string;
    details: string;
}

export interface SOFItem {
    event: string;
    status: SofStatus | string;
    time: string;
    user: string;
    loop: number;
}

export interface SpecialServiceData {
    name: string;
    data: any;
}

export interface DipSheetEntry {
    id: string;
    isStartRow?: boolean;
    time: string;
    dipReading: string;
    tankInnage: string;
    initials: string;
}

export interface VesselCommonTimestamps {
    startPreparations?: string;
    crewArriveToWharf?: string;
    vesselAlongside?: string;
    vesselAllfast?: string;
    gangwayDown?: string;
    surveyorOnboard?: string;
    surveyorChecksCompleted?: string;
    lastHoseDisconnected?: string;
    cleanUpCompletion?: string;
    crewCompletedSiteSecure?: string;
}

export interface CommodityTimestamps {
    hoseConnected?: string;
    hoseLeakCheck?: string;
    startPumping?: string;
    liquidAtWharf?: string;
    liquidAtTerminal?: string;
    slopsSamplePassed?: string;
    stopPumping?: string;
    hosesBlown?: string;
    hosesDisconnected?: string;
    pigAway?: string;
    pigReceived?: string;
}

export interface Transfer {
    id?: string;
    customer: string;
    product: string;
    from: string;
    to: string;
    tonnes: number;
    transferredTonnes?: number;
    direction: string;
    specialServices: SpecialServiceData[];
    sof?: SOFItem[];
    dipSheetData?: DipSheetEntry[];
    slop?: string;
    samplesPassed?: 'Y' | 'N' | '';
    surveyorSignature?: string;
    additionalInformation?: string;
    commodityTimestamps?: CommodityTimestamps;
}

export interface TransferPlanItem {
    infrastructureId: string;
    transfers: Transfer[];
}

export interface RequeueDetails {
    reason: string;
    user: string;
    time: string;
    details: any;
}

export interface Delay {
    active: boolean;
    reason?: string;
    notes?: string;
    time?: string;
}

export interface Operation {
    id: string;
    terminal: string;
    modality: Modality;
    status: OperationStatus;
    transportId: string;
    eta: string;
    queuePriority: number;
    currentStatus: string;
    delay?: Delay;
    orderNumber?: string;
    activityHistory: ActivityLogItem[];
    transferPlan: TransferPlanItem[];
    
    sof?: SOFItem[];
    specialRequirements?: SpecialServiceData[];
    vesselCommonTimestamps?: VesselCommonTimestamps;
    handOvers?: { by: string; to: string; }[];
    hoseLog?: { hoseNumber: string; product: string; testDate: string; pressureTestPassed: 'Y' | 'N' | ''; newGasketUsed: 'Y' | 'N' | ''; initials: string; }[];
    observationLog?: { timestamp: string; pressure: string; observation: string; initials: string; }[];

    truckStatus?: string;
    licensePlate?: string;
    driverName?: string;
    driverPhone?: string;
    driverEmail?: string;
    requeueDetails?: RequeueDetails;
    
    completedTime?: string;
    cancellationDetails?: {
        time: string;
        user: string;
        reason: string;
    };

    lineWalks?: any[];
    samples?: any[];
    heatingLog?: any[];
    slopLog?: any[];
    dilutionLog?: any[];
    batchLog?: any[];
    
    dipSheetData?: DipSheetEntry[];

    cycleTimeData?: { [eventName: string]: string };
}

export interface CalibrationPoint {
    dip: number;
    volume: number;
}

export interface TerminalSettings {
    customerMatrix: { customer: string; product: string; tanks: string[] }[];
    docklines: { [id: string]: { lastProduct: string } };
    infrastructureTankMapping: { [infraId: string]: string[] };
    infrastructureModalityMapping: { [infraId:string]: Modality };
    assetHolds: { [id: string]: { active: boolean, reason: string, user: string, time: string | null } };
    tankHolds: { [id: string]: { active: boolean, reason: string, user: string, time: string | null } };
    masterTanks: { [tankName: string]: { capacity: number, current: number, calibrationData?: CalibrationPoint[] } };
    masterCustomers: string[];
    activeOpsDisplayFields: { [key: string]: boolean };
}

export interface ContractRates {
    serviceRates: { [serviceName: string]: number };
    customerRates: { [customer: string]: { [product: string]: { ratePerTonne: number } } };
}

export interface AppSettings {
    productGroups: { [product: string]: string };
    compatibility: { [groupA: string]: { [groupB: string]: 'C' | 'X' } };
    masterProducts: string[];
    specialServices: { [key in Modality]: string[] };
    contracts: ContractRates;
    [terminalCode: string]: Partial<TerminalSettings> | any;
}

export interface WorkOrderNote {
    time: string;
    user: string;
    note: string;
}

export interface Hold {
    id?: string;
    resource: string;
    tank?: string;
    terminal: string;
    startTime: string;
    endTime: string;
    reason: string;
    user?: string;
    time?: string;
    status: OutageStatus;
    workOrderStatus?: WorkOrderStatus;
    workOrderNotes?: WorkOrderNote[];
    cancellationDetails?: {
        time: string;
        user: string;
        reason: string;
    };
}

export interface ScadaData {
    [infrastructureId: string]: {
        flowRate: number;
        pumpStatus: 'ON' | 'OFF';
        temperature: number;
        pressure: number;
    };
}

export interface UIState {
    planningViewMode: 'grid' | 'list';
}

export interface ViewHistoryItem {
    view: View;
    opId: string | null;
    lineIndex: number | null;
    transferIndex: number | null;
}

export interface CycleTimeData {
    [eventName: string]: string;
}