
import { AppSettings, Modality, TerminalSettings, ContractRates, LineSegment, Lineup } from '../types';

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

export const VESSEL_SERVICES: string[] = [
    'Aquis Quarantine',
    'Customs arrival',
    'Marpol surveyor',
    'Multi-terminal vessel',
    'Ship stability/positioning',
    'Trucks during vessel'
].sort();

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
        "Aquis Quarantine": 750.00,
        "Customs arrival": 300.00,
        "Marpol surveyor": 800.00,
        "Multi-terminal vessel": 1500.00,
        "Ship stability/positioning": 1000.00,
        "Trucks during vessel": 75.00,

        "Change of products": 200.00, 
        "Different batches": 100.00,
        "Emptying tanks": 450.00, 
        "Heating tanks": 500.00,
        "Line Purge Volume Log": 300.00,
        "Slopping requirements": 400.00,
        "Stop dips on tanks": 50.00,
        "Tanks priority": 150.00,
        "Vessel tank inerting": 650.00,
        "Water dilution": 200.00,

        "Driver Assist Loading": 40.00,
        "Nitrogen Purge": 120.00,
        "Specialized Hose Required": 90.00,
        "Weight Ticket Required": 25.00,

        "In-line Blending": 600.00,
        "Railcar Heating": 350.00,
        "Shunting Required": 500.00,
        "Multi-car loading": 450.00,

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

// --- NEW Mock Data for Lineups ---
// Segregated headers to prevent product contamination
const PAL_INTERMEDIATES = [
    'Main Header North', 'Main Header South', 'Main Header Central', 
    'Truck Header North', 'Truck Header South', 'Truck Header Central',
    'Rail Manifold'
];

const createSegment = (source: string, target: string, name?: string): LineSegment => ({
    id: `seg-${source.replace(/\s+/g,'')}-${target.replace(/\s+/g,'')}`,
    name: name || `${source} -> ${target}`,
    sourceId: source,
    targetId: target,
    lengthMeters: rand(50, 500, 0),
    volumeBarrels: rand(10, 100, 0),
    diameterInches: 12,
    status: 'active'
});

const PAL_SEGMENTS: LineSegment[] = [
    // --- WHARF CONNECTIONS (Inbound to Terminal) ---
    // Wharf 1 (Clean/White Oils) -> Main Header North
    createSegment('Wharf 1', 'Main Header North', 'W1 Intake'),
    // Wharf 2 (Black/Chemicals) -> Main Header South
    createSegment('Wharf 2', 'Main Header South', 'W2 Intake'),
    // Wharf 3 (Specialty) -> Main Header Central
    createSegment('Wharf 3', 'Main Header Central', 'W3 Intake'),

    // --- HEADER TO TANKS (Fill Lines - Right Side of Tank) ---
    // North (Clean) -> Fuel Farm A & B & Aviation
    createSegment('Main Header North', 'A01'),
    createSegment('Main Header North', 'A02'),
    createSegment('Main Header North', 'B45'),
    createSegment('Main Header North', 'B46'),
    createSegment('Main Header North', 'B47'),
    createSegment('Main Header North', 'J10'),
    createSegment('Main Header North', 'J11'),

    // South (Dirty/Chem) -> Block C & D
    createSegment('Main Header South', 'D05'),
    createSegment('Main Header South', 'C13'),
    createSegment('Main Header South', 'C38'),

    // Central (Specialty) -> Block E
    createSegment('Main Header Central', 'E14'),
    createSegment('Main Header Central', 'E15'),
    // Central Cross-over to A01 (Flexibility)
    createSegment('Main Header Central', 'A01'), 

    // --- TANK TO TRUCK HEADERS (Suction Lines - Left Side of Tank) ---
    // Fuel Farm A/B/J -> Truck Header North
    createSegment('A01', 'Truck Header North'),
    createSegment('A02', 'Truck Header North'),
    createSegment('B45', 'Truck Header North'),
    createSegment('B46', 'Truck Header North'),
    createSegment('B47', 'Truck Header North'),
    createSegment('J10', 'Truck Header North'),
    createSegment('J11', 'Truck Header North'),

    // Block C/D -> Truck Header South
    createSegment('D05', 'Truck Header South'),
    createSegment('C13', 'Truck Header South'),
    createSegment('C38', 'Truck Header South'),

    // Block E -> Truck Header Central
    createSegment('E14', 'Truck Header Central'),
    createSegment('E15', 'Truck Header Central'),

    // --- TRUCK HEADER TO BAYS (Distribution) ---
    // North Header -> Bays 1-4 (Clean Bays)
    createSegment('Truck Header North', 'Bay 1'),
    createSegment('Truck Header North', 'Bay 2'),
    createSegment('Truck Header North', 'Bay 3'),
    createSegment('Truck Header North', 'Bay 4'),
    
    // South Header -> Bays 5-8 (Dirty/Chem Bays)
    createSegment('Truck Header South', 'Bay 5'),
    createSegment('Truck Header South', 'Bay 6'),
    createSegment('Truck Header South', 'Bay 7'),
    createSegment('Truck Header South', 'Bay 8'),

    // Central Header -> Bays 9-10 (Specialty)
    createSegment('Truck Header Central', 'Bay 9'),
    createSegment('Truck Header Central', 'Bay 10'),

    // --- RAIL CONNECTIONS ---
    // Inbound from Rail
    createSegment('Siding A', 'Rail Manifold'),
    createSegment('Siding B', 'Rail Manifold'),
    createSegment('Rail Manifold', 'Main Header North'), // Feed into system

    // Outbound to Rail (from Headers)
    createSegment('Truck Header South', 'Rail Manifold'), // Load from tanks via header
    createSegment('Rail Manifold', 'Siding A'),
    createSegment('Rail Manifold', 'Siding B'),
];

// Generate Lineups for known connections to enable highlighting
const PAL_LINEUPS: Lineup[] = [];

const generateLineup = (source: string, target: string, segments: LineSegment[], name?: string) => {
    PAL_LINEUPS.push({
        id: `lineup-${source.replace(/\s+/g,'')}-${target.replace(/\s+/g,'')}`,
        name: name || `${source} -> ${target}`,
        sourceId: source,
        destinationId: target,
        segmentIds: segments.map(s => s.id),
        valid: true
    });
};

// --- AUTO-GENERATE LINEUPS BASED ON TOPOLOGY ---
// 1. Vessel Inbound: Wharf -> Main Header -> Tank
// 2. Truck Outbound: Tank -> Truck Header -> Bay

const TANK_GROUPS: Record<string, string[]> = {
    North: ['A01', 'A02', 'B45', 'B46', 'B47', 'J10', 'J11'],
    South: ['D05', 'C13', 'C38'],
    Central: ['E14', 'E15']
};

const BAY_GROUPS: Record<string, string[]> = {
    North: ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'],
    South: ['Bay 5', 'Bay 6', 'Bay 7', 'Bay 8'],
    Central: ['Bay 9', 'Bay 10']
};

// Generate Inbound (Vessel -> Tank)
TANK_GROUPS.North.forEach(tank => {
    const s1 = PAL_SEGMENTS.find(s => s.sourceId === 'Wharf 1' && s.targetId === 'Main Header North');
    const s2 = PAL_SEGMENTS.find(s => s.sourceId === 'Main Header North' && s.targetId === tank);
    if (s1 && s2) generateLineup('Wharf 1', tank, [s1, s2]);
});
TANK_GROUPS.South.forEach(tank => {
    const s1 = PAL_SEGMENTS.find(s => s.sourceId === 'Wharf 2' && s.targetId === 'Main Header South');
    const s2 = PAL_SEGMENTS.find(s => s.sourceId === 'Main Header South' && s.targetId === tank);
    if (s1 && s2) generateLineup('Wharf 2', tank, [s1, s2]);
});
TANK_GROUPS.Central.forEach(tank => {
    const s1 = PAL_SEGMENTS.find(s => s.sourceId === 'Wharf 3' && s.targetId === 'Main Header Central');
    const s2 = PAL_SEGMENTS.find(s => s.sourceId === 'Main Header Central' && s.targetId === tank);
    if (s1 && s2) generateLineup('Wharf 3', tank, [s1, s2]);
});

// Generate Outbound (Tank -> Truck)
Object.keys(TANK_GROUPS).forEach(group => {
    const tanks = TANK_GROUPS[group];
    const bays = BAY_GROUPS[group];
    const header = `Truck Header ${group}`;
    
    tanks.forEach(tank => {
        bays.forEach(bay => {
            const s1 = PAL_SEGMENTS.find(s => s.sourceId === tank && s.targetId === header);
            const s2 = PAL_SEGMENTS.find(s => s.sourceId === header && s.targetId === bay);
            
            if (s1 && s2) {
                // Tank -> Bay (Loading)
                generateLineup(tank, bay, [s1, s2]);
            }
        });
    });
});


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
            'Bay 1': ['A01', 'A02', 'B45', 'B46'], 'Bay 2': ['A01', 'A02', 'B47'], 'Bay 3': ['B45', 'B46', 'J10'], 'Bay 4': ['J10', 'J11', 'A01'], // Clean Bays (North)
            'Bay 5': ['C13', 'C38', 'D05'], 'Bay 6': ['C13', 'C38', 'D05'], 'Bay 7': ['C13', 'C38'], 'Bay 8': ['C13'], // Dirty/Chem (South)
            'Bay 9': ['E14', 'E15'], 'Bay 10': ['E14', 'E15'], // Specialty (Central)
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
            'A01': { group: 'Fuel Farm A', productCompatibilityGroup: 'Hydrocarbon', capacity: 15000, current: 8000, customer: 'Apex Refining', product: 'ULP 98', lastUpdated: daysAgo(2), measurements: { temperature: rand(75,85), level: rand(30,40), waterCut: rand(5,7), flowRate: 0, pressure: rand(1, 5) } }, 
            'A02': { group: 'Fuel Farm A', productCompatibilityGroup: 'Biofuel', capacity: 15000, current: 2500, customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', lastUpdated: daysAgo(3), measurements: { temperature: rand(80,90), level: rand(10,15), waterCut: rand(4,6), flowRate: 0, pressure: rand(1, 5) } },
            'B45': { group: 'Fuel Farm B', productCompatibilityGroup: 'Hydrocarbon', capacity: 20000, current: 11000, customer: 'Apex Refining', product: 'Petro-Fuel 95', lastUpdated: daysAgo(1), measurements: { temperature: rand(72,82), level: rand(35,45), waterCut: rand(6,8), flowRate: 0, pressure: rand(1, 5) } }, 
            'B46': { group: 'Fuel Farm B', productCompatibilityGroup: 'Hydrocarbon', capacity: 20000, current: 4000, customer: 'Apex Refining', product: 'Petro-Fuel 95', lastUpdated: daysAgo(5), measurements: { temperature: rand(74,84), level: rand(55,65), waterCut: rand(5,7), flowRate: 0, pressure: rand(1, 5) } }, 
            'B47': { group: 'Fuel Farm B', productCompatibilityGroup: 'Edible Oil', capacity: 10000, current: 1000, customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', lastUpdated: daysAgo(4), measurements: { temperature: rand(90,100), level: rand(5,10), waterCut: rand(8,10), flowRate: 0, pressure: rand(1, 5) } },
            'C13': { group: 'Chemical Block C', productCompatibilityGroup: 'Hydrocarbon', capacity: 25000, current: 15000, customer: 'Coastal Energy Supply', product: 'Diesel Max', lastUpdated: daysAgo(2), measurements: { temperature: rand(65,75), level: rand(50,60), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } }, 
            'C38': { group: 'Chemical Block C', productCompatibilityGroup: 'Hydrocarbon', capacity: 25000, current: 5000, customer: 'National Rail Freight', product: 'Diesel Max', lastUpdated: daysAgo(6), measurements: { temperature: rand(68,78), level: rand(10,15), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } },
            'D05': { group: 'Heavy Oil D', productCompatibilityGroup: 'Hydrocarbon', capacity: 50000, current: 35000, customer: 'Coastal Energy Supply', product: 'Crude Oil', lastUpdated: daysAgo(10), measurements: { temperature: rand(110,120), level: rand(45,55), waterCut: rand(10,15), flowRate: 0, pressure: rand(1, 5) } },
            'E14': { group: 'Specialty Block E', productCompatibilityGroup: 'Caustic', capacity: 5000, current: 1500, customer: 'GlobalChem Industries', product: 'Indu-Chem X7', lastUpdated: daysAgo(7), measurements: { temperature: rand(88,98), level: rand(15,20), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } }, 
            'E15': { group: 'Specialty Block E', productCompatibilityGroup: 'Chemical', capacity: 5000, current: 1200, customer: 'GlobalChem Industries', product: 'Methanol', lastUpdated: daysAgo(8), measurements: { temperature: rand(85,95), level: rand(12,18), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } },
            'J10': { group: 'Aviation J', productCompatibilityGroup: 'Hydrocarbon', capacity: 12000, current: 2000, customer: 'Aviation Fuels Inc', product: 'Jet A-1', lastUpdated: daysAgo(1), measurements: { temperature: rand(60,70), level: rand(40,50), waterCut: rand(2,4), flowRate: 0, pressure: rand(1, 5) } }, 
            'J11': { group: 'Aviation J', productCompatibilityGroup: 'Hydrocarbon', capacity: 12000, current: 4000, customer: 'Aviation Fuels Inc', product: 'Jet A-1', lastUpdated: daysAgo(9), measurements: { temperature: rand(62,72), level: rand(15,25), waterCut: rand(2,4), flowRate: 0, pressure: rand(1, 5) } }
        },
        masterCustomers: ['Apex Refining', 'Terra Verde Agriculture', 'GlobalChem Industries', 'Coastal Energy Supply', 'Vantage Polymers', 'Veridian Synthetics', 'Solara Chemicals', 'Quantum Nitriles', 'Axiom Materials', 'Aviation Fuels Inc', 'National Rail Freight', 'BulkTrans', 'Riverton Chemicals'],
        activeOpsDisplayFields: { orderNumber: true, licensePlate: true, product: true, tonnes: false },
        masterIntermediates: PAL_INTERMEDIATES,
        lineSegments: PAL_SEGMENTS,
        lineups: PAL_LINEUPS,
    },
    CBY: {
        customerMatrix: [{ customer: 'Citywide Fuels', product: 'Diesel Max', tanks: ['T50', 'T51'] }],
        docklines: { 'S1': { lastProduct: 'Diesel Max' } },
        infrastructureTankMapping: { 'S1': ['T50', 'T51'], 'Bay 1': ['T50'], 'Bay 2': ['T51'] },
        infrastructureModalityMapping: { 'S1': 'vessel', 'Bay 1': 'truck', 'Bay 2': 'truck' },
        assetHolds: {}, tankHolds: {},
        masterTanks: { 
            'T50': { group: 'North Tank Farm', productCompatibilityGroup: 'Hydrocarbon', capacity: 10000, current: 5000, customer: 'Citywide Fuels', product: 'Diesel Max', lastUpdated: daysAgo(1), measurements: { temperature: rand(65,75), level: rand(25,35), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } }, 
            'T51': { group: 'North Tank Farm', productCompatibilityGroup: 'Hydrocarbon', capacity: 10000, current: 8000, customer: 'Citywide Fuels', product: 'Diesel Max', lastUpdated: daysAgo(2), measurements: { temperature: rand(66,76), level: rand(40,50), waterCut: rand(3,5), flowRate: 0, pressure: rand(1, 5) } } 
        },
        masterCustomers: ['Citywide Fuels'],
        activeOpsDisplayFields: { orderNumber: true, licensePlate: true, product: true, tonnes: true },
        lineSegments: [],
        lineups: [],
    },
     RVE: {
        customerMatrix: [{ customer: 'Riverton Chemicals', product: 'Methanol', tanks: ['R1', 'R2'] }, { customer: 'Riverton Chemicals', product: 'Caustic Soda', tanks: ['R3'] }],
        infrastructureTankMapping: { 'L1': ['R1', 'R2', 'R3'], 'Rail 1': ['R1', 'R2', 'R3'] },
        infrastructureModalityMapping: { 'L1': 'vessel', 'Rail 1': 'rail' },
        assetHolds: {}, tankHolds: {},
        masterTanks: { 
            'R1': { group: 'Riverton Main', productCompatibilityGroup: 'Chemical', capacity: 8000, current: 1000, customer: 'Riverton Chemicals', product: 'Methanol', lastUpdated: daysAgo(5), measurements: { temperature: rand(85,95), level: rand(8,12), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } }, 
            'R2': { group: 'Riverton Main', productCompatibilityGroup: 'Chemical', capacity: 8000, current: 4000, customer: 'Riverton Chemicals', product: 'Methanol', lastUpdated: daysAgo(3), measurements: { temperature: rand(86,96), level: rand(25,35), waterCut: rand(1,2), flowRate: 0, pressure: rand(1, 5) } }, 
            'R3': { group: 'Riverton Main', productCompatibilityGroup: 'Caustic', capacity: 5000, current: 4500, customer: 'Riverton Chemicals', product: 'Caustic Soda', lastUpdated: daysAgo(12), measurements: { temperature: rand(95,105), level: rand(50,60), waterCut: rand(2,3), flowRate: 0, pressure: rand(1, 5) } } 
        },
        masterCustomers: ['Riverton Chemicals'],
        activeOpsDisplayFields: { orderNumber: true, product: true, tonnes: true },
        lineSegments: [],
        lineups: [],
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
    vesselServices: VESSEL_SERVICES,
    modalityServices: MODALITY_SERVICES,
    productServices: PRODUCT_SERVICES,
    contracts: CONTRACT_RATES,
    PAL: TERMINAL_MASTER_DATA.PAL as TerminalSettings,
    CBY: TERMINAL_MASTER_DATA.CBY as TerminalSettings,
    RVE: TERMINAL_MASTER_DATA.RVE as TerminalSettings,
};
