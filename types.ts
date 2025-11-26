


















// FIX: Removed circular dependency by defining and exporting the 'Modality' type directly in this file.
export type Modality = 'vessel' | 'truck' | 'rail';

// This new content includes all necessary types inferred from their usage across the application.

export type OperationStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export type View = 
    'dashboard' | 
    'orders' |
    'planning' | 
    'active-operations-list' | 
    'operation-details' | 
    'product-transfer-details' |
    'operation-plan' | 
    'completed' | 
    'reports' | 
    'config-matrix' | 
    'master-data' |
    'outage-planning' |
    'maintenance' |
    'special-services' |
    'tank-status' |
    'tank-status-details' |
    'dip-sheet' |
    'user-permissions' |
    'manpower' |
    'terminal-simulation' |
    'lineup-manager';

export type ActivityAction = 'CREATE' | 'UPDATE' | 'SOF_UPDATE' | 'STATUS_UPDATE' | 'REQUEUE' | 'DATA_LOG' | 'COMMENT' | 'SOF_EDIT' | 'SOF_REVERT' | 'REPORT_UPDATE' | 'DOCUMENT_UPLOAD' | 'DOCUMENT_DELETE' | 'SIGNATURE' | 'REQUEUE_REQUEST' | string;

export type WorkOrderStatus = 'Requested' | 'Acknowledged' | 'In Progress' | 'Pending Parts' | 'Completed' | 'Closed';

export type OutageStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type ReportType = 'revenue' | 'throughput' | 'cycleTime' | 'downtime';

// --- NEW Historian Types ---
export interface HistorianDataPoint {
    timestamp: string; // ISO string
    value: number;
}

export type AssetHistory = {
    [measurement: string]: HistorianDataPoint[]; // e.g., 'level', 'temperature', 'flowRate'
}

export type HistorianData = {
    [assetId: string]: AssetHistory;
};
// --- END Historian Types ---

export interface User {
    name: string;
    role: string;
    originalRole?: string;
    delegatedBy?: string;
    assignedModalities?: Modality[];
    assignedAreas?: string[];
    shift?: 'Day' | 'Swing' | 'Night' | 'Off';
}

export interface ActivityLogItem {
    time: string;
    user: string;
    action: ActivityAction;
    details: string;
    context?: string;
}

export interface SOFItem {
    event: string;
    status: 'pending' | 'in-progress' | 'complete' | 'skipped';
    time: string;
    user: string;
    loop: number;
    logId?: string;
}

export interface SpecialServiceData {
    name: string;
    data: {
        status?: 'pending' | 'confirmed' | 'complete';
        notes?: string;
        log?: any[];
        [key: string]: any;
    };
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
    direction: string;
    specialServices: SpecialServiceData[];
    transferredTonnes?: number;
    slopsTransferredTonnes?: number;
    sof?: SOFItem[];
    preTransferCleaningSof?: SOFItem[];
    samplesPassed?: 'Y' | 'N' | '';
    slop?: string;
    surveyorSignature?: string;
    additionalInformation?: string;
    commodityTimestamps?: CommodityTimestamps;
    productNote?: string;
    transferLog?: ActivityLogItem[];
    // Truck specific SOF data
    sealNumber?: string;
    sealPhoto?: string; // base64
    loadedWeight?: number;
    bolData?: {
        id: string;
        generatedAt: string;
    };
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
    priority?: 'high' | 'normal';
    isRequest?: boolean;
}

export interface DipSheetEntry {
    id: string;
    isStartRow?: boolean;
    time: string;
    dipReading: string;
    tankInnage: string;
    initials: string;
    calculated?: {
        totalQtyTransferred: string;
        transferRate: string;
        ullageRemaining: string;
        estTimeToComplete: string;
    }
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

export interface HoseLogEntry {
    id: string;
    hoseNumber: string;
    product: string;
    testDate: string;
    pressureTestPassed: 'Y' | 'N' | '';
    newGasketUsed: 'Y' | 'N' | '';
    initials: string;
}

export interface SampleLogEntry {
    id: string;
    transferId: string;
    samplesPassed: 'Y' | 'N' | '';
    slop: string; // number as string
    surveyorSignature: string; // data url
}

export interface PressureCheckLogEntry {
    id: string;
    transferId: string;
    pressure: string;
    result: 'Pass' | 'Fail' | '';
    initials: string; // data url
}

export interface HandOverLogEntry {
    id: string;
    by: string;
    to: string;
}

export interface ObservationLogEntry {
    id: string;
    timestamp: string;
    pressure: string;
    observation: string;
    initials: string;
}

export interface CycleTimeData {
    [eventName: string]: string;
}

export interface Document {
    name: string;
    size: number;
    type: string;
    data: string; // base64 data URL
    uploadedAt: string; // ISO string
    uploadedBy: string;
}

export interface ArrivalChecklist {
    tiresOk: 'pending' | 'complete';
    leaksOk: 'pending' | 'complete';
    hosesOk: 'pending' | 'complete';
    safetySealsOk: 'pending' | 'complete';
    bolReceived: 'pending' | 'complete';
    coaReceived: 'pending' | 'complete';
    driverLicenseOk: 'pending' | 'complete';
    arrivalPhoto?: string; // base64
}

export interface Operation {
    id: string;
    terminal: string;
    modality: Modality;
    status: OperationStatus;
    transportId: string;
    eta: string;
    durationHours?: number;
    queuePriority: number;
    currentStatus: string;
    orderNumber?: string;
    truckStatus?: string; // e.g. 'Planned', 'Registered', 'Waiting', 'Directed to Bay', 'On Bay', 'Loading', 'Completing', 'Departed'
    licensePlate?: string;
    driverName?: string;
    driverPhone?: string;
    driverEmail?: string;
    activityHistory: ActivityLogItem[];
    documents?: Document[];
    sof?: SOFItem[]; // For vessel common SOF
    transferPlan: TransferPlanItem[];
    completedTime?: string;
    cancellationDetails?: {
        time: string;
        user: string;
        reason: string;
    };
    delay: {
        active: boolean;
        reason?: string;
        notes?: string;
        time?: string;
    };
    requeueDetails?: RequeueDetails;
    specialRequirements: SpecialServiceData[];
    vesselCommonTimestamps?: VesselCommonTimestamps;
    preArrivalChecks?: {
        [checkName: string]: {
            status: 'pending' | 'complete';
            user?: string;
            time?: string;
        }
    };
    arrivalChecklist?: ArrivalChecklist;

    // Optional detailed logs
    lineWalks: any[];
    samples: any[];
    heatingLog: any[];
    slopLog: any[];
    dilutionLog: any[];
    batchLog: any[];
    dipSheetData: DipSheetEntry[];
    handOvers?: HandOverLogEntry[];
    hoseLog?: HoseLogEntry[];
    sampleLog?: SampleLogEntry[];
    pressureCheckLog?: PressureCheckLogEntry[];
    observationLog?: ObservationLogEntry[];
    cycleTimeData?: CycleTimeData;

    // Fields for historical report
    labourRecovery?: number;
    otherRecoveries?: number;
    dateInvoiced?: string; // YYYY-MM-DD format
    
    // Flag to distinguish static historical data from live mock data
    isHistorical?: boolean;
}

export interface WorkOrderNote {
    time: string;
    user: string;
    note: string;
}

export interface Hold {
    id?: string;
    resource: string;
    terminal: string;
    tank?: string;
    startTime: string;
    endTime: string;
    reason: string;
    user: string;
    time?: string;
    status: OutageStatus;
    cancellationDetails?: {
        time: string;
        user: string;
        reason: string;
    };
    workOrderStatus?: WorkOrderStatus;
    workOrderNotes?: WorkOrderNote[];
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
    planningViewMode: 'grid' | 'list' | 'kanban' | 'calendar';
    columnVisibility?: {
        [terminal: string]: {
            [modality: string]: string[];
        }
    };
    reports?: {
        reportType: ReportType;
        startDate: string;
        endDate: string;
        customer: string;
        productGroup: string;
    };
    completedOps?: {
        activeTab: 'report' | 'list';
    };
}

export interface ViewHistoryItem {
    view: View;
    opId: string | null;
    lineIndex: number | null;
    transferIndex: number | null;
    tankId?: string | null;
}

export interface CalibrationPoint {
    dip: number;
    volume: number;
}

// --- NEW LINEUP TYPES ---
export interface LineSegment {
    id: string;
    name: string;
    sourceId: string;
    targetId: string;
    lengthMeters?: number;
    volumeBarrels?: number;
    diameterInches?: number;
    status: 'active' | 'maintenance' | 'out-of-service';
    lastProduct?: string;
}

export interface Lineup {
    id: string;
    name: string;
    sourceId: string;
    destinationId: string;
    segmentIds: string[];
    valid: boolean;
}
// ------------------------

export interface TerminalSettings {
    masterCustomers: string[];
    masterTanks: {
        [tankName: string]: {
            capacity: number;
            current: number;
            group?: string;
            productCompatibilityGroup?: string;
            calibrationData?: CalibrationPoint[];
            // New fields for Tank History
            customer?: string;
            product?: string;
            lastUpdated?: string; // ISO string
            measurements?: {
                temperature: number;
                level: number; // in feet
                waterCut: number; // in inches
                flowRate: number; // in BBL/HR
                pressure: number; // in inWC (inches of Water Column)
            }
        }
    };
    docklines: {
        [docklineId: string]: {
            lastProduct: string;
        }
    };
    wharfDocklineMapping?: {
        [wharfName: string]: string[];
    };
    customerMatrix: {
        customer: string;
        product: string;
        tanks: string[];
    }[];
    infrastructureTankMapping: {
        [infraId: string]: string[];
    };
    infrastructureModalityMapping: {
        [infraId: string]: Modality;
    };
    parkingLots?: string[];
    bayParkingMapping?: {
        [bayId: string]: string;
    };
    tankHolds: {
        [tankName: string]: {
            active: boolean;
            reason: string;
            user: string;
            time: string | null;
        }
    };
    assetHolds: {
        [assetId: string]: {
            active: boolean;
            reason: string;
            user: string;
            time: string | null;
        }
    };
    activeOpsDisplayFields: {
        orderNumber?: boolean;
        licensePlate?: boolean;
        product?: boolean;
        tonnes?: boolean;
    };
    // New field for storing map node coordinates
    mapLayout?: {
        [nodeId: string]: { x: number; y: number };
    };
    // --- NEW Lineup Fields ---
    masterIntermediates?: string[]; // List of manifold/pump IDs
    lineSegments?: LineSegment[];
    lineups?: Lineup[];
}

export interface ManpowerSchedule {
  [operatorName: string]: {
    // hour index (0-23) maps to an array of infrastructure IDs
    [hour: number]: string[];
  };
}

export interface ContractRates {
    serviceRates: { [serviceName: string]: number };
    customerRates: {
        [customer: string]: {
            [product: string]: {
                ratePerTonne: number;
            }
        }
    };
}

export interface AppSettings extends Record<string, any> {
    productGroups: { [product: string]: string };
    compatibility: { [groupA: string]: { [groupB: string]: 'C' | 'X' } };
    masterProducts: string[];
    vesselServices: string[];
    modalityServices: { [key in Modality]: string[] };
    productServices: string[];
    contracts: ContractRates;
    // Terminal specific settings are indexed by terminal ID string
    PAL: TerminalSettings;
    CBY: TerminalSettings;
    RVE: TerminalSettings;
}