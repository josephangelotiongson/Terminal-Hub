import { AppSettings, Modality, TerminalSettings, ContractRates, Operation, ActivityLogItem, SOFItem } from '../types';
import { VESSEL_COMMON_EVENTS, VESSEL_COMMODITY_EVENTS, SOF_EVENTS_MODALITY } from '../constants';

// ===================================================================================
//  EXPANDED MASTER DATA
// ===================================================================================

export const MASTER_PRODUCTS: string[] = [
    'Petro-Fuel 95', 'ULP 98', 'Diesel Max', 'Jet A-1', 'Crude Oil', 'LNG',
    'Agri-Oil Prime', 'Palm Oil', 
    'Bio-Fuel E85', 'Ethanol',
    'Indu-Chem X7', 'Hexa-Solvent 200', 'N-Butanol X', 'Poly-Mondur 45', 
    'Glyco-Coolant B', 'Formic Solution 85', 'Methanol', 'Caustic Soda'
];

export const PRODUCT_GROUPS: { [product: string]: string } = {
    'Petro-Fuel 95': 'Hydrocarbon', 'ULP 98': 'Hydrocarbon', 'Diesel Max': 'Hydrocarbon',
    'Jet A-1': 'Hydrocarbon', 'Crude Oil': 'Hydrocarbon', 'LNG': 'Hydrocarbon',
    'Agri-Oil Prime': 'Edible Oil', 'Palm Oil': 'Edible Oil',
    'Bio-Fuel E85': 'Biofuel', 'Ethanol': 'Biofuel',
    'Indu-Chem X7': 'Caustic', 'Caustic Soda': 'Caustic',
    'Hexa-Solvent 200': 'Chemical', 'N-Butanol X': 'Chemical', 'Poly-Mondur 45': 'Chemical',
    'Glyco-Coolant B': 'Chemical', 'Formic Solution 85': 'Chemical', 'Methanol': 'Chemical'
};

export const SPECIAL_SERVICES: { [key in Modality]: string[] } = {
    vessel: [
        'Aquis Quarantine', 'Change of products', 'Customs arrival', 'Detailed Sample Logging',
        'Different batches', 'Emptying tanks', 'Heating tanks', 'Line Purge Volume Log',
        'Marpol surveyor', 'Multi-terminal vessel', 'Ship stability/positioning',
        'Slopping requirements', 'Stop dips on tanks', 'Tanks priority', 'Trucks during vessel',
        'Vessel tank inerting', 'Water dilution'
    ].sort(),
    truck: ['Trucks during vessel', 'Stop dips on tanks', 'Different batches', 'Nitrogen Purge'],
    rail: ['Slopping requirements', 'Water dilution', 'Tank priority', 'In-line Blending']
};

export const CONTRACT_RATES: ContractRates = {
    serviceRates: {
        "Heating tanks": 500.00, "Detailed Sample Logging": 250.00, "Ship stability/positioning": 1000.00,
        "Multi-terminal vessel": 1500.00, "Line Purge Volume Log": 300.00, "Trucks during vessel": 75.00,
        "Stop dips on tanks": 50.00, "Different batches": 100.00, "Slopping requirements": 400.00,
        "Water dilution": 200.00, "Tank priority": 150.00, "Nitrogen Purge": 120.00, "In-line Blending": 600.00
    },
    customerRates: {
        'Apex Refining': { 'Petro-Fuel 95': { ratePerTonne: 5.50 }, 'ULP 98': { ratePerTonne: 5.60 }, 'Diesel Max': { ratePerTonne: 5.75 }, 'Jet A-1': { ratePerTonne: 9.50 } },
        'Terra Verde Agriculture': { 'Agri-Oil Prime': { ratePerTonne: 8.20 }, 'Bio-Fuel E85': { ratePerTonne: 7.90 }, 'Ethanol': { ratePerTonne: 8.10 } },
        'GlobalChem Industries': { 'Indu-Chem X7': { ratePerTonne: 12.50 }, 'Methanol': { ratePerTonne: 11.00 }, 'Petro-Fuel 95': { ratePerTonne: 5.65 } },
        'Coastal Energy Supply': { 'Diesel Max': { ratePerTonne: 5.85 }, 'Agri-Oil Prime': { ratePerTonne: 8.30 }, 'Crude Oil': { ratePerTonne: 4.50 } },
        'Vantage Polymers': { 'Hexa-Solvent 200': { ratePerTonne: 15.00 } },
        'Veridian Synthetics': { 'N-Butanol X': { ratePerTonne: 14.50 } },
        'Solara Chemicals': { 'Poly-Mondur 45': { ratePerTonne: 18.00 } },
        'Quantum Nitriles': { 'Glyco-Coolant B': { ratePerTonne: 11.75 } },
        'Axiom Materials': { 'Formic Solution 85': { ratePerTonne: 13.25 } },
        'Aviation Fuels Inc': { 'Jet A-1': { ratePerTonne: 9.80 } },
        'National Rail Freight': { 'Diesel Max': { ratePerTonne: 5.80 }, 'Ethanol': { ratePerTonne: 8.00 } },
        'BulkTrans': { 'ULP 98': { ratePerTonne: 5.55 }, 'Diesel Max': { ratePerTonne: 5.70 } },
        'Citywide Fuels': { 'Diesel Max': { ratePerTonne: 5.90 } },
        'Riverton Chemicals': { 'Methanol': { ratePerTonne: 11.20 }, 'Caustic Soda': { ratePerTonne: 14.00 } }
    }
};

export const TERMINAL_MASTER_DATA: { [key: string]: Partial<TerminalSettings> } = {
    PAL: {
        customerMatrix: [
            // Existing + New
            { customer: 'Apex Refining', product: 'Petro-Fuel 95', tanks: ['B45', 'B46', 'A01'] }, { customer: 'Apex Refining', product: 'ULP 98', tanks: ['A01', 'A02'] }, { customer: 'Apex Refining', product: 'Diesel Max', tanks: ['C13', 'C38'] },
            { customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', tanks: ['B47'] }, { customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', tanks: ['A02'] },
            { customer: 'GlobalChem Industries', product: 'Indu-Chem X7', tanks: ['E14', 'E15'] }, { customer: 'GlobalChem Industries', product: 'Methanol', tanks: ['E15'] }, { customer: 'GlobalChem Industries', product: 'Petro-Fuel 95', tanks: ['A01'] },
            { customer: 'Coastal Energy Supply', product: 'Diesel Max', tanks: ['C13'] }, { customer: 'Coastal Energy Supply', product: 'Crude Oil', tanks: ['D05'] },
            { customer: 'Aviation Fuels Inc', product: 'Jet A-1', tanks: ['J10', 'J11'] },
            { customer: 'National Rail Freight', product: 'Diesel Max', tanks: ['C38'] }, { customer: 'National Rail Freight', product: 'Ethanol', tanks: ['A02'] },
            { customer: 'BulkTrans', product: 'ULP 98', tanks: ['A01', 'A02'] },
            { customer: 'Riverton Chemicals', product: 'Caustic Soda', tanks: ['E14'] },
        ],
        docklines: { 'L12': { lastProduct: 'Petro-Fuel 95' }, 'L13': { lastProduct: 'Bio-Fuel E85' }, 'L14': { lastProduct: 'Agri-Oil Prime' }, 'L23': { lastProduct: 'Diesel Max' } },
        infrastructureTankMapping: {
            'L12': ['A01', 'B45', 'B46'], 'L13': ['A02', 'B47'], 'L14': ['B47', 'J10', 'J11'], 'L23': ['C13', 'C38', 'D05'],
            'Bay 1': ['C13', 'C38', 'E14', 'E15'], 'Bay 2': ['C13', 'C38', 'B47'], 'Bay 3': ['A01', 'E14', 'E15'], 'Bay 4': ['A01', 'A02', 'J10', 'J11'],
            'Siding A': ['B45', 'B46', 'D05'], 'Siding B': ['C13', 'C38']
        },
        infrastructureModalityMapping: {
            'L12': 'vessel', 'L13': 'vessel', 'L14': 'vessel', 'L23': 'vessel',
            'Bay 1': 'truck', 'Bay 2': 'truck', 'Bay 3': 'truck', 'Bay 4': 'truck',
            'Siding A': 'rail', 'Siding B': 'rail'
        },
        assetHolds: { 'L12': { active: false, reason: '', user: '', time: null }, 'Bay 4': { active: true, reason: 'Pump Maintenance', user: 'Maint. Planner', time: new Date().toISOString() }, 'Siding A': { active: false, reason: '', user: '', time: null }, 'Siding B': { active: false, reason: '', user: '', time: null } },
        tankHolds: { 'B47': { active: true, reason: 'Inspection', user: 'Maint. Planner', time: new Date().toISOString() } },
        masterTanks: {
            'A01': { capacity: 15000, current: 8000 }, 'A02': { capacity: 15000, current: 2500 },
            'B45': { capacity: 20000, current: 11000 }, 'B46': { capacity: 20000, current: 18500 }, 'B47': { capacity: 10000, current: 1000 },
            'C13': { capacity: 25000, current: 22000 }, 'C38': { capacity: 25000, current: 5000 },
            'D05': { capacity: 50000, current: 35000 },
            'E14': { capacity: 5000, current: 1500 }, 'E15': { capacity: 5000, current: 1200 },
            'J10': { capacity: 12000, current: 9000 }, 'J11': { capacity: 12000, current: 4000 }
        },
        masterCustomers: ['Apex Refining', 'Terra Verde Agriculture', 'GlobalChem Industries', 'Coastal Energy Supply', 'Vantage Polymers', 'Veridian Synthetics', 'Solara Chemicals', 'Quantum Nitriles', 'Axiom Materials', 'Aviation Fuels Inc', 'National Rail Freight', 'BulkTrans', 'Riverton Chemicals'],
        activeOpsDisplayFields: { orderNumber: true, licensePlate: true, product: true, tonnes: false },
    },
    CBY: {
        customerMatrix: [{ customer: 'Citywide Fuels', product: 'Diesel Max', tanks: ['T50', 'T51'] }],
        docklines: { 'S1': { lastProduct: 'Diesel Max' } },
        infrastructureTankMapping: { 'S1': ['T50', 'T51'], 'Bay 1': ['T50'], 'Bay 2': ['T51'] },
        infrastructureModalityMapping: { 'S1': 'vessel', 'Bay 1': 'truck', 'Bay 2': 'truck' },
        assetHolds: {}, tankHolds: {},
        masterTanks: { 'T50': { capacity: 10000, current: 5000 }, 'T51': { capacity: 10000, current: 8000 } },
        masterCustomers: ['Citywide Fuels'],
        activeOpsDisplayFields: { orderNumber: true, licensePlate: true, product: true, tonnes: true },
    },
     RVE: {
        customerMatrix: [{ customer: 'Riverton Chemicals', product: 'Methanol', tanks: ['R1', 'R2'] }, { customer: 'Riverton Chemicals', product: 'Caustic Soda', tanks: ['R3'] }],
        infrastructureTankMapping: { 'L1': ['R1', 'R2', 'R3'], 'Rail 1': ['R1', 'R2', 'R3'] },
        infrastructureModalityMapping: { 'L1': 'vessel', 'Rail 1': 'rail' },
        assetHolds: {}, tankHolds: {},
        masterTanks: { 'R1': { capacity: 8000, current: 1000 }, 'R2': { capacity: 8000, current: 4000 }, 'R3': { capacity: 5000, current: 4500 } },
        masterCustomers: ['Riverton Chemicals'],
        activeOpsDisplayFields: { orderNumber: true, product: true, tonnes: true },
    },
};

export const DEFAULT_SETTINGS: AppSettings = {
    productGroups: PRODUCT_GROUPS,
    compatibility: {
        'Hydrocarbon': { 'Hydrocarbon': 'C', 'Edible Oil': 'X', 'Biofuel': 'C', 'Caustic': 'X', 'Chemical': 'X' },
        'Edible Oil': { 'Hydrocarbon': 'X', 'Edible Oil': 'C', 'Biofuel': 'C', 'Caustic': 'X', 'Chemical': 'X' },
        'Biofuel': { 'Hydrocarbon': 'C', 'Edible Oil': 'C', 'Biofuel': 'C', 'Caustic': 'X', 'Chemical': 'X' },
        'Caustic': { 'Hydrocarbon': 'X', 'Edible Oil': 'X', 'Biofuel': 'X', 'Caustic': 'C', 'Chemical': 'X' },
        'Chemical': { 'Hydrocarbon': 'X', 'Edible Oil': 'X', 'Biofuel': 'X', 'Caustic': 'X', 'Chemical': 'C' }
    },
    masterProducts: MASTER_PRODUCTS,
    specialServices: SPECIAL_SERVICES,
    contracts: CONTRACT_RATES,
    ...TERMINAL_MASTER_DATA
};


// ===================================================================================
//  EXPANDED MOCK OPERATIONS GENERATION
// ===================================================================================

const now = new Date();
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);
const subMinutes = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60000);
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3600 * 1000);
const subHours = (date: Date, hours: number) => new Date(date.getTime() - hours * 3600 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 3600 * 1000);
const subDays = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 3600 * 1000);

const generateHistoryFromSof = (baseHistory: ActivityLogItem[], completedSof: SOFItem[]): ActivityLogItem[] => {
    const sofActivities = completedSof.map(s => ({
        time: s.time, user: s.user, action: 'SOF_UPDATE' as const, details: `${s.event} marked complete.`
    }));
    return [...baseHistory, ...sofActivities].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
};

const createCompletedOp = (
    id: string,
    modality: Modality,
    terminal: string,
    transportId: string,
    completedTime: Date,
    customer: string,
    product: string,
    tonnes: number,
    infraId: string,
    tank: string
): Operation => {
    
    let totalDurationHours: number;
    let events: string[];
    let specialCycleTimeEvents: Record<string, number> = {}; // in hours from start

    switch (modality) {
        case 'vessel':
            totalDurationHours = 8 + Math.random() * 8; // 8-16 hours
            events = SOF_EVENTS_MODALITY.vessel.concat(VESSEL_COMMODITY_EVENTS);
            specialCycleTimeEvents = { 'NOR Tendered': -2, 'Alongside Berth': 0.5, 'Departure': totalDurationHours + 1 };
            break;
        case 'rail':
            totalDurationHours = 2 + Math.random() * 2; // 2-4 hours
            events = SOF_EVENTS_MODALITY.rail;
            break;
        default: // truck
            totalDurationHours = 0.75 + Math.random() * 0.75; // 45-90 mins
            events = SOF_EVENTS_MODALITY.truck;
            break;
    }

    const eta = subHours(completedTime, totalDurationHours);
    const cycleTimeData: Record<string, string> = {};

    let lastTime = new Date(eta);
    // Add special vessel events
    for (const [event, hourOffset] of Object.entries(specialCycleTimeEvents)) {
        cycleTimeData[event] = addHours(eta, hourOffset).toISOString();
    }
    
    const completedSof = events.map((event, index) => {
        const stepDuration = (totalDurationHours * 3600 * 1000) / events.length;
        const randomFactor = (Math.random() * 0.4 + 0.8); // 80% to 120% of average step time
        lastTime = new Date(lastTime.getTime() + stepDuration * randomFactor);
        cycleTimeData[event] = lastTime.toISOString();
        return { event, status: 'complete', time: lastTime.toISOString(), user: 'AUTO', loop: 1 } as SOFItem;
    });

    return {
        id, terminal, modality, transportId, status: 'completed', eta: eta.toISOString(), completedTime: completedTime.toISOString(),
        queuePriority: eta.getTime(), currentStatus: 'Completed',
        activityHistory: generateHistoryFromSof([{ time: subHours(eta, 1).toISOString(), user: 'System', action: 'CREATE', details: 'Plan created' }], completedSof),
        transferPlan: [{
            infrastructureId: infraId,
            transfers: [{
                customer, product, from: tank, to: transportId, tonnes,
                transferredTonnes: tonnes, direction: `Tank to ${modality.charAt(0).toUpperCase() + modality.slice(1)}`,
                specialServices: [], sof: completedSof
            }]
        }],
        cycleTimeData
    } as Operation;
};


export const createMockOperations = (): Operation[] => {
    const emptyVesselCommonSof: SOFItem[] = VESSEL_COMMON_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 }));
    const emptyVesselCommoditySof: SOFItem[] = VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 }));
    const emptyTruckSof: SOFItem[] = SOF_EVENTS_MODALITY['truck'].map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 }));

    const activeVesselSof: SOFItem[] = VESSEL_COMMON_EVENTS.map((event, i) => {
        const isComplete = i < 5; // First 5 steps are complete: START PREPARATIONS -> GANGWAY DOWN
        return {
            event,
            status: isComplete ? 'complete' : 'pending',
            time: isComplete ? subMinutes(now, (5 - i) * 15).toISOString() : '', // Stagger times
            user: isComplete ? 'Ops Lead' : '',
            loop: 1
        };
    });

    // Keep a few live operations for demonstration
    let operations: Operation[] = [
        // --- ACTIVE OPERATIONS (Increased Variety) ---
        {
            id: 'op-vessel-1', terminal: 'PAL', modality: 'vessel', status: 'active', transportId: 'MV Alpha', eta: subHours(now, 4).toISOString(), queuePriority: subHours(now, 4).getTime(),
            currentStatus: 'Gangway Down', delay: { active: false }, orderNumber: 'ORD-54321', activityHistory: [],
            sof: activeVesselSof,
            transferPlan: [
                { infrastructureId: 'L12', transfers: [
                    { id: 'op-vessel-1-L12-0', customer: 'Apex Refining', product: 'Petro-Fuel 95', from: '2S', to: 'B45', tonnes: 8500, direction: 'Vessel to Tank', transferredTonnes: 0, specialServices: [], sof: emptyVesselCommoditySof },
                    { id: 'op-vessel-1-L12-1', customer: 'GlobalChem Industries', product: 'Petro-Fuel 95', from: '4S', to: 'A01', tonnes: 2000, direction: 'Vessel to Tank', transferredTonnes: 0, specialServices: [], sof: emptyVesselCommoditySof }
                ]},
                { infrastructureId: 'L23', transfers: [ { id: 'op-vessel-1-L23-0', customer: 'Coastal Energy Supply', product: 'Diesel Max', from: '5P', to: 'C38', tonnes: 8000, direction: 'Vessel to Tank', transferredTonnes: 0, specialServices: [], sof: emptyVesselCommoditySof }] }
        },
        // --- NEW TRUCK VARIETY ---
        { // Truck - Awaiting Gate Approval
            id: 'op-truck-attention-1', terminal: 'PAL', modality: 'truck', status: 'active', transportId: 'QuickHaul', eta: subMinutes(now, 15).toISOString(), queuePriority: subMinutes(now, 15).getTime(),
            currentStatus: 'Awaiting Approval', truckStatus: 'Registered', licensePlate: 'QH-551', driverName: 'Sarah Connor', activityHistory: [],
            transferPlan: [{ infrastructureId: 'Bay 3', transfers: [{ id: 'op-truck-attention-1-t1', customer: 'BulkTrans', product: 'ULP 98', from: 'A01', to: 'QuickHaul', tonnes: 32, direction: 'Tank to Truck', specialServices: [], sof: SOF_EVENTS_MODALITY['truck'].map((e, i) => ({ event: e, status: i < 1 ? 'complete' : 'pending', time: subMinutes(now, 15).toISOString(), user: 'AUTO', loop: 1 }))}] }],
        },
        { // Truck - Waiting > 15 mins (will trigger attention)
            id: 'op-truck-attention-2', terminal: 'PAL', modality: 'truck', status: 'active', transportId: 'TerraTrans', eta: subMinutes(now, 20).toISOString(), queuePriority: subMinutes(now, 20).getTime(),
            currentStatus: 'Waiting for Bay', truckStatus: 'Waiting', licensePlate: 'TT-820', driverName: 'Kyle Reese', 
            activityHistory: [{ time: subMinutes(now, 18).toISOString(), user: 'Ops Lead', action: 'STATUS_UPDATE', details: 'Truck arrival accepted.' }],
            transferPlan: [{ infrastructureId: 'Bay 2', transfers: [{ id: 'op-truck-attention-2-t1', customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', from: 'B47', to: 'TerraTrans', tonnes: 30, direction: 'Tank to Truck', specialServices: [], sof: SOF_EVENTS_MODALITY['truck'].map((e, i) => ({ event: e, status: i < 1 ? 'complete' : 'pending', time: subMinutes(now, 20).toISOString(), user: 'AUTO', loop: 1 }))}] }],
        },
        { // Truck - Pumping
            id: 'op-truck-active-pumping', terminal: 'PAL', modality: 'truck', status: 'active', transportId: 'ChemEx', eta: subMinutes(now, 45).toISOString(), queuePriority: subMinutes(now, 45).getTime(),
            // FIX: Removed 'transferredTonnes' from the top-level Operation object as it's not a valid property. It belongs in the Transfer object.
            currentStatus: 'Pumping', truckStatus: 'Loading', licensePlate: 'CE-303', driverName: 'Ellen Ripley',
            activityHistory: [],
            transferPlan: [{ infrastructureId: 'Bay 1', transfers: [{ id: 'op-truck-active-pumping-t1', customer: 'GlobalChem Industries', product: 'Indu-Chem X7', from: 'E14', to: 'ChemEx', tonnes: 25, transferredTonnes: 15, direction: 'Tank to Truck', specialServices: [], sof: SOF_EVENTS_MODALITY['truck'].map((e, i) => ({ event: e, status: i < 4 ? 'complete' : 'pending', time: subMinutes(now, 45 - i*5).toISOString(), user: 'Operator 1', loop: 1 }))}] }],
        },
        { // Truck - On Bay
            id: 'op-truck-on-bay', terminal: 'PAL', modality: 'truck', status: 'active', transportId: 'Logistics Inc', eta: subHours(now, 0.5).toISOString(), queuePriority: subHours(now, 0.5).getTime(),
            currentStatus: 'On Bay', truckStatus: 'On Bay', orderNumber: 'ORD-9876', licensePlate: 'XYZ-123', driverName: 'Jane Smith', activityHistory: [],
            transferPlan: [{ infrastructureId: 'Bay 1', transfers: [{ id: 'op-truck-on-bay-t1', customer: 'Apex Refining', product: 'Diesel Max', from: 'C38', to: 'Logistics Inc', tonnes: 30, direction: 'Tank to Truck', specialServices: [], sof: SOF_EVENTS_MODALITY['truck'].map((e, i) => ({ event: e, status: i < 3 ? 'complete' : 'pending', time: subMinutes(now, 30 - i*2).toISOString(), user: 'Ops Lead', loop: 1 }))}] }],
        },
        // Original Active Ops
        {
            id: 'op-truck-2', terminal: 'PAL', modality: 'truck', status: 'active', transportId: 'Haulage Co', eta: subHours(now, 1).toISOString(), queuePriority: subHours(now, 1).getTime(),
            currentStatus: 'Waiting', truckStatus: 'Waiting', orderNumber: 'ORD-5432', licensePlate: 'GHI-456', driverName: 'Mike Johnson', activityHistory: [],
            transferPlan: [{ infrastructureId: 'Bay 2', transfers: [{ id: 'op-truck-2-Bay 2-0', customer: 'Coastal Energy Supply', product: 'Diesel Max', from: 'C13', to: 'Haulage Co', tonnes: 28, direction: 'Tank to Truck', specialServices: [], sof: SOF_EVENTS_MODALITY['truck'].map((e, i) => ({ event: e, status: i < 1 ? 'complete' : 'pending', time: subMinutes(now, 60).toISOString(), user: 'AUTO', loop: 1 })) }]}]
        },
        {
            id: 'op-rail-1', terminal: 'PAL', modality: 'rail', status: 'active', transportId: 'NRF 7891', eta: subHours(now, 2).toISOString(), queuePriority: subHours(now, 2).getTime(),
            currentStatus: 'Pumping', orderNumber: 'RAIL-556', activityHistory: [],
            transferPlan: [{ infrastructureId: 'Siding A', transfers: [{ id: 'op-rail-1-Siding A-0', customer: 'National Rail Freight', product: 'Ethanol', from: 'A02', to: 'NRF 7891', tonnes: 1500, transferredTonnes: 600, direction: 'Tank to Rail', specialServices: [], sof: SOF_EVENTS_MODALITY['rail'].map((e, i) => ({ event: e, status: i < 5 ? 'complete' : 'pending', time: subMinutes(now, 120 - i*15).toISOString(), user: 'Operator 1', loop: 1 })) }]}]
        },
        // --- PLANNED OPERATIONS ---
        {
            id: 'op-vessel-planned-1', terminal: 'PAL', modality: 'vessel', status: 'planned', transportId: 'MV Neptune', eta: addHours(now, 3).toISOString(), queuePriority: addHours(now, 3).getTime(),
            currentStatus: 'Scheduled', orderNumber: 'ORD-V987', activityHistory: [], sof: emptyVesselCommonSof,
            transferPlan: [{ infrastructureId: 'L14', transfers: [{ id: 'op-vessel-planned-1-t1', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '1P/S', to: 'J10', tonnes: 12000, direction: 'Vessel to Tank', specialServices: [], sof: emptyVesselCommoditySof }]}]
        },
        {
            id: 'op-truck-planned-1', terminal: 'PAL', modality: 'truck', status: 'planned', transportId: 'BulkTrans', eta: addMinutes(now, 25).toISOString(), queuePriority: addMinutes(now, 25).getTime(),
            currentStatus: 'Scheduled', licensePlate: 'BT-001', orderNumber: 'ORD-T101', activityHistory: [],
            transferPlan: [{ infrastructureId: 'Bay 1', transfers: [{ id: 'op-truck-planned-1-t1', customer: 'BulkTrans', product: 'ULP 98', from: 'A01', to: 'BulkTrans', tonnes: 35, direction: 'Tank to Truck', specialServices: [], sof: emptyTruckSof }]}]
        },
        {
            id: 'op-truck-planned-2', terminal: 'PAL', modality: 'truck', status: 'planned', transportId: 'Apex Logistics', eta: addHours(now, 1.5).toISOString(), queuePriority: addHours(now, 1.5).getTime(),
            currentStatus: 'Scheduled', licensePlate: 'APX-789', orderNumber: 'ORD-T102', activityHistory: [],
            transferPlan: [{ infrastructureId: 'Bay 3', transfers: [{ id: 'op-truck-planned-2-t1', customer: 'Apex Refining', product: 'Petro-Fuel 95', from: 'B46', to: 'Apex Logistics', tonnes: 33, direction: 'Tank to Truck', specialServices: [], sof: emptyTruckSof }]}]
        },
        {
            id: 'op-truck-planned-3', terminal: 'PAL', modality: 'truck', status: 'planned', transportId: 'Riverton Haul', eta: addHours(now, 4).toISOString(), queuePriority: addHours(now, 4).getTime(),
            currentStatus: 'Scheduled', licensePlate: 'RIV-440', orderNumber: 'ORD-T103', activityHistory: [],
            transferPlan: [{ infrastructureId: 'Bay 1', transfers: [{ id: 'op-truck-planned-3-t1', customer: 'Riverton Chemicals', product: 'Caustic Soda', from: 'E14', to: 'Riverton Haul', tonnes: 20, direction: 'Tank to Truck', specialServices: [], sof: emptyTruckSof }]}]
        },
    ];

    // --- GENERATE HISTORICAL DATA ---
    const historicalOps: Operation[] = [];
    // Add one completed truck for today
    historicalOps.push(createCompletedOp('op-truck-completed-today', 'truck', 'PAL', 'JetFuel Express', subHours(now, 2), 'Aviation Fuels Inc', 'Jet A-1', 22, 'Bay 4', 'J10'));

    const NUM_HISTORICAL_OPS = 400;

    for (let i = 0; i < NUM_HISTORICAL_OPS; i++) {
        const completedDaysAgo = Math.floor(Math.random() * 540) + 1; // Last 18 months
        const completedTime = subDays(now, completedDaysAgo);
        
        const terminalId = (['PAL', 'PAL', 'PAL', 'CBY', 'RVE'] as const)[Math.floor(Math.random() * 5)];
        const terminalData = TERMINAL_MASTER_DATA[terminalId];
        if (!terminalData) continue;

        const modality = (['truck', 'truck', 'truck', 'truck', 'vessel', 'rail'] as const)[Math.floor(Math.random() * 6)];

        const validInfra = Object.keys(terminalData.infrastructureModalityMapping || {}).filter(
            id => (terminalData.infrastructureModalityMapping as Record<string, Modality>)[id] === modality
        );
        if (validInfra.length === 0) continue;
        const infraId = validInfra[Math.floor(Math.random() * validInfra.length)];

        const validMappings = (terminalData.customerMatrix || []).filter(m => {
            const tanks = (terminalData.infrastructureTankMapping as Record<string, string[]>)?.[infraId] || [];
            return m.tanks.some(t => tanks.includes(t));
        });
        if (validMappings.length === 0) continue;
        const mapping = validMappings[Math.floor(Math.random() * validMappings.length)];
        
        const validTanks = mapping.tanks.filter(t => 
            ((terminalData.infrastructureTankMapping as Record<string, string[]>)?.[infraId] || []).includes(t)
        );
        if(validTanks.length === 0) continue;
        const tank = validTanks[Math.floor(Math.random() * validTanks.length)];

        const transportId = `${modality.slice(0,1).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const tonnes = modality === 'vessel' ? 5000 + Math.random() * 15000 : modality === 'rail' ? 800 + Math.random() * 1200 : 25 + Math.random() * 10;

        const newOp = createCompletedOp(`op-comp-${i}`, modality, terminalId, transportId, completedTime, mapping.customer, mapping.product, Math.round(tonnes), infraId, tank);
        
        // Sprinkle in some delays and cancellations
        if (i % 20 === 0) {
            newOp.status = 'cancelled';
            newOp.completedTime = undefined;
            // FIX: Convert `newOp.eta` string to a Date object for `subHours`.
            newOp.cancellationDetails = { time: subHours(new Date(newOp.eta), 1).toISOString(), user: 'AUTO', reason: 'Customer Request' };
        } else if (i % 15 === 0) {
            newOp.delay = { active: true, reason: 'Equipment Failure', time: subHours(completedTime, 2).toISOString() };
        }
        
        historicalOps.push(newOp);
    }

    operations.push(...historicalOps);
    
    // Add empty fields to all operations to ensure type consistency
    operations = operations.map(op => ({
        lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [],
        specialRequirements: [], handOvers: [], hoseLog: [], observationLog: [],
        dipSheetData: [], ...op
    }));

    return operations;
};


export const MOCK_OPERATIONS = createMockOperations();