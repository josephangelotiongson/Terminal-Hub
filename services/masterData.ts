import { AppSettings, Modality, TerminalSettings, ContractRates } from '../types';

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

// FIX: Renamed VESSEL_REQUIREMENTS to VESSEL_SERVICES to match AppSettings type
export const VESSEL_SERVICES: string[] = [
    'Aquis Quarantine',
    'Customs arrival',
    'Marpol surveyor',
    'Multi-terminal vessel',
    'Ship stability/positioning',
    'Trucks during vessel'
].sort();

// FIX: Replaced TRANSFER_SERVICES with correctly structured MODALITY_SERVICES and PRODUCT_SERVICES
export const MODALITY_SERVICES: { [key in Modality]: string[] } = {
    vessel: [
        'Change of products', 'Different batches', 'Emptying tanks', 
        'Heating tanks', 'Line Purge Volume Log', 'Slopping requirements', 
        'Stop dips on tanks', 'Tanks priority', 'Vessel tank inerting', 'Water dilution'
    ].sort(),
    truck: [
        'Driver Assist Loading', 'Nitrogen Purge', 'Specialized Hose Required', 'Weight Ticket Required'
    ].sort(),
    rail: [
        'In-line Blending', 'Railcar Heating', 'Shunting Required', 'Multi-car loading'
    ].sort()
};

export const PRODUCT_SERVICES: string[] = [
    'Detailed Sample Logging',
    'In-line Additive Injection',
    'Temperature Control',
    'Product Filtering',
    'Dedicated Line Required'
].sort();


export const CONTRACT_RATES: ContractRates = {
    serviceRates: {
        // Vessel-level Services
        "Aquis Quarantine": 750.00,
        "Customs arrival": 300.00,
        "Marpol surveyor": 800.00,
        "Multi-terminal vessel": 1500.00,
        "Ship stability/positioning": 1000.00,
        "Trucks during vessel": 75.00,

        // Vessel Transfer Services
        "Change of products": 200.00, // ADDED
        "Different batches": 100.00,
        "Emptying tanks": 450.00, // ADDED
        "Heating tanks": 500.00,
        "Line Purge Volume Log": 300.00,
        "Slopping requirements": 400.00,
        "Stop dips on tanks": 50.00,
        "Tanks priority": 150.00, // KEY RENAMED
        "Vessel tank inerting": 650.00,
        "Water dilution": 200.00,

        // Truck Services
        "Driver Assist Loading": 40.00,
        "Nitrogen Purge": 120.00,
        "Specialized Hose Required": 90.00,
        "Weight Ticket Required": 25.00,

        // Rail Services
        "In-line Blending": 600.00,
        "Railcar Heating": 350.00,
        "Shunting Required": 500.00,
        "Multi-car loading": 450.00,

        // General Product Services
        "Detailed Sample Logging": 250.00,
        "In-line Additive Injection": 180.00,
        "Temperature Control": 220.00,
        "Product Filtering": 110.00,
        "Dedicated Line Required": 1000.00
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

const rand = (min: number, max: number, decimals: number = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export const TERMINAL_MASTER_DATA: { [key: string]: Partial<TerminalSettings> } = {
    PAL: {
        customerMatrix: [
            // Existing + New
            { customer: 'Apex Refining', product: 'Petro-Fuel 95', tanks: ['B45', 'B46', 'A01'] }, { customer: 'Apex Refining', product: 'ULP 98', tanks: ['A01', 'A02'] }, { customer: 'Apex Refining', product: 'Diesel Max', tanks: ['C13', 'C38'] },
            { customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', tanks: ['B47', 'C13'] }, { customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', tanks: ['A02'] },
            { customer: 'GlobalChem Industries', product: 'Indu-Chem X7', tanks: ['E14', 'E15'] }, { customer: 'GlobalChem Industries', product: 'Methanol', tanks: ['E15'] }, { customer: 'GlobalChem Industries', product: 'Petro-Fuel 95', tanks: ['A01'] },
            { customer: 'Coastal Energy Supply', product: 'Diesel Max', tanks: ['C13'] }, { customer: 'Coastal Energy Supply', product: 'Crude Oil', tanks: ['D05'] },
            { customer: 'Aviation Fuels Inc', product: 'Jet A-1', tanks: ['J10', 'J11', 'A01'] },
            { customer: 'National Rail Freight', product: 'Diesel Max', tanks: ['C38'] }, { customer: 'National Rail Freight', product: 'Ethanol', tanks: ['A02'] },
            { customer: 'BulkTrans', product: 'ULP 98', tanks: ['A01', 'A02'] },
            { customer: 'Riverton Chemicals', product: 'Caustic Soda', tanks: ['E14'] },
        ],
        docklines: { 
            'L12': { lastProduct: 'Petro-Fuel 95' }, 'L13': { lastProduct: 'Bio-Fuel E85' }, 'L14': { lastProduct: 'Agri-Oil Prime' }, 'L23': { lastProduct: 'Diesel Max' }, 'L15': { lastProduct: '' }, 'L16': { lastProduct: '' }, 'L24': { lastProduct: '' }, 'L25': { lastProduct: '' },
            'L31': { lastProduct: '' }, 'L32': { lastProduct: '' }, 'L33': { lastProduct: '' }, 'L34': { lastProduct: '' } 
        },
        wharfDocklineMapping: {
            'Wharf 1': ['L12', 'L13', 'L15', 'L16'],
            'Wharf 2': ['L14', 'L23', 'L24', 'L25'],
            'Wharf 3': ['L31', 'L32', 'L33', 'L34'],
        },
        infrastructureTankMapping: {
            'L12': ['A01', 'B45', 'B46'], 'L13': ['A02', 'B47'], 'L14': ['B47', 'J10', 'J11'], 'L23': ['C13', 'C38', 'D05'],
            'L15': ['A01', 'A02'], 'L16': ['B45', 'B46', 'B47'], 'L24': ['C13', 'C38'], 'L25': ['D05', 'J10', 'J11'],
            'L31': ['A01', 'A02', 'J10'], 'L32': ['B45', 'B46', 'B47'], 'L33': ['C13', 'C38'], 'L34': ['D05', 'E14', 'E15'],
            'Bay 1': ['C13', 'C38', 'E14', 'E15'], 'Bay 2': ['C13', 'C38', 'B47'], 'Bay 3': ['A01', 'E14', 'E15'], 'Bay 4': ['A01', 'A02', 'J10', 'J11'],
            'Bay 5': ['C13', 'C38'], 'Bay 6': ['A01', 'A02'], 'Bay 7': ['E14', 'E15'], 'Bay 8': ['B47', 'J10'], 'Bay 9': ['A01', 'C13'], 'Bay 10': ['A02', 'C38'],
            'Siding A': ['B45', 'B46', 'D05'], 'Siding B': ['C13', 'C38']
        },
        infrastructureModalityMapping: {
            'L12': 'vessel', 'L13': 'vessel', 'L14': 'vessel', 'L23': 'vessel', 'L15': 'vessel', 'L16': 'vessel', 'L24': 'vessel', 'L25': 'vessel',
            'L31': 'vessel', 'L32': 'vessel', 'L33': 'vessel', 'L34': 'vessel',
            'Bay 1': 'truck', 'Bay 2': 'truck', 'Bay 3': 'truck', 'Bay 4': 'truck', 'Bay 5': 'truck', 'Bay 6': 'truck', 'Bay 7': 'truck', 'Bay 8': 'truck', 'Bay 9': 'truck', 'Bay 10': 'truck',
            'Siding A': 'rail', 'Siding B': 'rail'
        },
        assetHolds: { },
        tankHolds: { },
        masterTanks: {
            'A01': { capacity: 15000, current: 8000, customer: 'Apex Refining', product: 'ULP 98', lastUpdated: daysAgo(2), measurements: { temperature: rand(75,85), level: rand(30,40), waterCut: rand(5,7), flowRate: 0, pressure: rand(1, 5) } }, 
            'A02': { capacity: 15000, current: 2500, customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', lastUpdated: daysAgo(3), measurements: { temperature: rand(80,90), level: rand(10,15), waterCut: rand(4,6), flowRate: 0, pressure: rand(1, 5) } },
            'B45': { capacity: 20000, current: 11000, customer: 'Apex Refining', product: 'Petro-Fuel 95', lastUpdated: daysAgo(1), measurements: { temperature: rand(72,82), level: rand(35,45), waterCut: rand(6,8), flowRate: 0, pressure: rand(1, 5) } }, 
            'B46': { capacity: 20000, current: 18500, customer: 'Apex Refining', product: 'Petro-Fuel 95', lastUpdated: daysAgo(5), measurements: { temperature: rand(74,84), level: rand(55,65), waterCut: rand(5,7), flowRate: 0, pressure: rand(1, 5) } }, 
            'B47': { capacity: 10000, current: 1000, customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', lastUpdated: daysAgo(4), measurements: { temperature: rand(90,100), level: rand(5,10), waterCut: rand(8,10), flowRate: 0, pressure: rand(1, 5) } },
            'C13': { capacity: 25000, current: 22000, customer: 'Coastal Energy Supply', product: 'Diesel Max', lastUpdated: daysAgo(2), measurements: { temperature: rand(65,75), level: rand(50,60), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } }, 
            'C38': { capacity: 25000, current: 5000, customer: 'National Rail Freight', product: 'Diesel Max', lastUpdated: daysAgo(6), measurements: { temperature: rand(68,78), level: rand(10,15), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } },
            'D05': { capacity: 50000, current: 35000, customer: 'Coastal Energy Supply', product: 'Crude Oil', lastUpdated: daysAgo(10), measurements: { temperature: rand(110,120), level: rand(45,55), waterCut: rand(10,15), flowRate: 0, pressure: rand(1, 5) } },
            'E14': { capacity: 5000, current: 1500, customer: 'GlobalChem Industries', product: 'Indu-Chem X7', lastUpdated: daysAgo(7), measurements: { temperature: rand(88,98), level: rand(15,20), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } }, 
            'E15': { capacity: 5000, current: 1200, customer: 'GlobalChem Industries', product: 'Methanol', lastUpdated: daysAgo(8), measurements: { temperature: rand(85,95), level: rand(12,18), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } },
            'J10': { capacity: 12000, current: 9000, customer: 'Aviation Fuels Inc', product: 'Jet A-1', lastUpdated: daysAgo(1), measurements: { temperature: rand(60,70), level: rand(40,50), waterCut: rand(2,4), flowRate: 0, pressure: rand(1, 5) } }, 
            'J11': { capacity: 12000, current: 4000, customer: 'Aviation Fuels Inc', product: 'Jet A-1', lastUpdated: daysAgo(9), measurements: { temperature: rand(62,72), level: rand(15,25), waterCut: rand(2,4), flowRate: 0, pressure: rand(1, 5) } }
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
        masterTanks: { 
            'T50': { capacity: 10000, current: 5000, customer: 'Citywide Fuels', product: 'Diesel Max', lastUpdated: daysAgo(1), measurements: { temperature: rand(65,75), level: rand(25,35), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } }, 
            'T51': { capacity: 10000, current: 8000, customer: 'Citywide Fuels', product: 'Diesel Max', lastUpdated: daysAgo(2), measurements: { temperature: rand(66,76), level: rand(40,50), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } } 
        },
        masterCustomers: ['Citywide Fuels'],
        activeOpsDisplayFields: { orderNumber: true, licensePlate: true, product: true, tonnes: true },
    },
     RVE: {
        customerMatrix: [{ customer: 'Riverton Chemicals', product: 'Methanol', tanks: ['R1', 'R2'] }, { customer: 'Riverton Chemicals', product: 'Caustic Soda', tanks: ['R3'] }],
        infrastructureTankMapping: { 'L1': ['R1', 'R2', 'R3'], 'Rail 1': ['R1', 'R2', 'R3'] },
        infrastructureModalityMapping: { 'L1': 'vessel', 'Rail 1': 'rail' },
        assetHolds: {}, tankHolds: {},
        masterTanks: { 
            'R1': { capacity: 8000, current: 1000, customer: 'Riverton Chemicals', product: 'Methanol', lastUpdated: daysAgo(5), measurements: { temperature: rand(85,95), level: rand(8,12), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } }, 
            'R2': { capacity: 8000, current: 4000, customer: 'Riverton Chemicals', product: 'Methanol', lastUpdated: daysAgo(3), measurements: { temperature: rand(86,96), level: rand(25,35), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } }, 
            'R3': { capacity: 5000, current: 4500, customer: 'Riverton Chemicals', product: 'Caustic Soda', lastUpdated: daysAgo(12), measurements: { temperature: rand(95,105), level: rand(50,60), waterCut: rand(2,3), flowRate: 0, pressure: rand(1, 5) } } 
        },
        masterCustomers: ['Riverton Chemicals'],
        activeOpsDisplayFields: { orderNumber: true, product: true, tonnes: true },
    },
};

// FIX: Correctly shape the DEFAULT_SETTINGS object to match the AppSettings type
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
    vesselServices: VESSEL_SERVICES,
    modalityServices: MODALITY_SERVICES,
    productServices: PRODUCT_SERVICES,
    contracts: CONTRACT_RATES,
    PAL: TERMINAL_MASTER_DATA.PAL as TerminalSettings,
    CBY: TERMINAL_MASTER_DATA.CBY as TerminalSettings,
    RVE: TERMINAL_MASTER_DATA.RVE as TerminalSettings,
};


// ===================================================================================
//  EXPANDED MOCK OPERATIONS GENERATION
// ===================================================================================

const now = new Date();
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);
const subMinutes = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60000);
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3600 * 1000);
const subHours = (date: Date, hours: number) => new Date(date.getTime() - hours * 3600 * 1000);

/**
 * A helper to logically progress an array of SOF items to a target event.
 * @param sofArray The initial SOF array (all pending).
 * @param allEvents The full sequence of possible events.
 * @param targetEvent The event to progress up to.
 * @param baseTime The time of the first event.
 * @param user The user to log for the completed steps.
 * @param stepMinutes The number of minutes between each step.
 * @returns An object containing the updated SOF array and the timestamp of the last completed event.
 */
const progressSofArray = (
    sofArray: any[], 
    allEvents: string[], 
    targetEvent: string, 
    baseTime: Date, 
    user: string,
    stepMinutes: number = 5,
    logContext: string = ''
): { updatedSof: any[], lastTime: Date, activityLogs: any[] } => {
    const newSof = JSON.parse(JSON.stringify(sofArray));
    const targetIndex = allEvents.findIndex(e => e === targetEvent);
    let lastTime = baseTime;
    const activityLogs: any[] = [];

    if (targetIndex > -1) {
        for (let i = 0; i <= targetIndex; i++) {
            const eventName = allEvents[i];
            const eventIndexInSof = newSof.findIndex((s: any) => s.event === eventName);
            if (eventIndexInSof > -1) {
                lastTime = addMinutes(baseTime, i * stepMinutes);
                newSof[eventIndexInSof] = {
                    ...newSof[eventIndexInSof],
                    status: 'complete',
                    time: lastTime.toISOString(),
                    user: user
                };
                 activityLogs.push({
                    time: lastTime.toISOString(),
                    user: user,
                    action: 'SOF_UPDATE',
                    details: `${eventName} marked complete${logContext}.`
                });
            }
        }
    }
    return { updatedSof: newSof, lastTime, activityLogs };
};


export const createMockHolds = (terminal: string): any[] => {
    if (terminal !== 'PAL') {
        return [];
    }
    
    // UPDATED: Use the current time as the reference.
    const baseTime = new Date();
    // Rounds to the next hour or half-hour for consistent start times.
    baseTime.setMinutes(baseTime.getMinutes() > 30 ? 60 : 30, 0, 0);


    const holds: any[] = [
        {
            id: 'hold-maint-bay2', resource: 'Bay 2', terminal: 'PAL',
            startTime: addHours(baseTime, 1).toISOString(),
            endTime: addHours(baseTime, 3).toISOString(),
            reason: 'Preventative Maintenance', user: 'Maintenance Planner',
            status: 'approved', workOrderStatus: 'Acknowledged',
        },
        {
            id: 'hold-safety-bay4', resource: 'Bay 4', terminal: 'PAL',
            startTime: addHours(baseTime, 4).toISOString(),
            endTime: addHours(baseTime, 5).toISOString(),
            reason: 'Safety Drill', user: 'Ops Lead',
            status: 'approved',
        },
        {
            id: 'hold-pending-sidingA', resource: 'Siding A', terminal: 'PAL',
            startTime: addHours(baseTime, 2).toISOString(),
            endTime: addHours(baseTime, 6).toISOString(),
            reason: 'Corrective Maintenance', user: 'Operator 1',
            status: 'pending', workOrderStatus: 'Requested',
        }
    ];

    return holds;
};