import { AppSettings, Modality, TerminalSettings, ContractRates, CalibrationPoint } from '../types';

export const MASTER_PRODUCTS: string[] = [
    'Petro-Fuel 95', 'Diesel Max', 'Agri-Oil Prime', 'Bio-Fuel E85', 'Indu-Chem X7',
    'Hexa-Solvent 200', 'N-Butanol X', 'Poly-Mondur 45', 'Glyco-Coolant B', 'Formic Solution 85'
];

export const PRODUCT_GROUPS: { [product: string]: string } = {
    'Petro-Fuel 95': 'Hydrocarbon',
    'Diesel Max': 'Hydrocarbon',
    'Agri-Oil Prime': 'Edible Oil',
    'Bio-Fuel E85': 'Biofuel',
    'Indu-Chem X7': 'Caustic',
    'Hexa-Solvent 200': 'Chemical',
    'N-Butanol X': 'Chemical',
    'Poly-Mondur 45': 'Chemical',
    'Glyco-Coolant B': 'Chemical',
    'Formic Solution 85': 'Chemical'
};

export const SPECIAL_SERVICES: { [key in Modality]: string[] } = {
    vessel: [
        'Aquis Quarantine',
        'Change of products',
        'Customs arrival',
        'Detailed Sample Logging',
        'Different batches',
        'Emptying tanks',
        'Heating tanks',
        'Line Purge Volume Log',
        'Marpol surveyor',
        'Multi-terminal vessel',
        'Ship stability/positioning',
        'Slopping requirements',
        'Stop dips on tanks',
        'Tanks priority',
        'Trucks during vessel',
        'Vessel tank inerting',
        'Water dilution'
    ].sort(),
    truck: ['Trucks during vessel', 'Stop dips on tanks', 'Different batches', 'Nitrogen Purge'],
    rail: ['Slopping requirements', 'Water dilution', 'Tank priority', 'In-line Blending']
};

export const CONTRACT_RATES: ContractRates = {
    serviceRates: {
        "Heating tanks": 500.00,
        "Detailed Sample Logging": 250.00,
        "Ship stability/positioning": 1000.00,
        "Multi-terminal vessel": 1500.00,
        "Line Purge Volume Log": 300.00,
        "Trucks during vessel": 75.00,
        "Stop dips on tanks": 50.00,
        "Different batches": 100.00,
        "Slopping requirements": 400.00,
        "Water dilution": 200.00,
        "Tank priority": 150.00,
        "Nitrogen Purge": 120.00,
        "In-line Blending": 600.00
    },
    customerRates: {
        'Apex Refining': {
            'Petro-Fuel 95': { ratePerTonne: 5.50 },
            'Diesel Max': { ratePerTonne: 5.75 }
        },
        'Terra Verde Agriculture': {
            'Agri-Oil Prime': { ratePerTonne: 8.20 },
            'Bio-Fuel E85': { ratePerTonne: 7.90 }
        },
        'GlobalChem Industries': {
            'Indu-Chem X7': { ratePerTonne: 12.50 },
            'Petro-Fuel 95': { ratePerTonne: 5.65 }
        },
        'Coastal Energy Supply': {
            'Diesel Max': { ratePerTonne: 5.85 },
            'Agri-Oil Prime': { ratePerTonne: 8.30 }
        },
        'Vantage Polymers': {
            'Hexa-Solvent 200': { ratePerTonne: 15.00 }
        },
        'Veridian Synthetics': {
            'N-Butanol X': { ratePerTonne: 14.50 }
        },
        'Solara Chemicals': {
            'Poly-Mondur 45': { ratePerTonne: 18.00 }
        },
        'Quantum Nitriles': {
            'Glyco-Coolant B': { ratePerTonne: 11.75 }
        },
        'Axiom Materials': {
            'Formic Solution 85': { ratePerTonne: 13.25 }
        }
    }
};

/**
 * Generates a slightly non-linear strapping table for a tank.
 * @param capacity The total capacity of the tank in tonnes.
 * @param maxDip The maximum dip reading corresponding to the capacity.
 * @param points The number of data points to generate.
 * @returns An array of CalibrationPoint objects.
 */
const generateStrappingTable = (capacity: number, maxDip: number, points: number = 20): CalibrationPoint[] => {
    const table: CalibrationPoint[] = [{ dip: 0, volume: 0 }];
    const nonLinearityFactor = 1.02; // A slight curve to simulate real tank shapes

    for (let i = 1; i <= points; i++) {
        const ratio = i / points;
        const dip = Math.round(ratio * maxDip);
        // Apply a power to the ratio to create a slight curve
        const volume = Math.round(Math.pow(ratio, nonLinearityFactor) * capacity);
        
        if (dip > 0 && volume > 0) {
            table.push({ dip, volume });
        }
    }
    
    // Ensure the last point is exactly the max capacity
    if (table[table.length - 1].dip !== maxDip || table[table.length - 1].volume !== capacity) {
         table[table.length - 1] = { dip: maxDip, volume: capacity };
    }

    return table;
};


export const TERMINAL_MASTER_DATA: { [key: string]: Partial<TerminalSettings> } = {
    PAL: {
        customerMatrix: [
            { customer: 'Apex Refining', product: 'Petro-Fuel 95', tanks: ['B45', 'B46', 'A01'] }, { customer: 'Apex Refining', product: 'Diesel Max', tanks: ['C13', 'C38'] },
            { customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', tanks: ['B47'] }, { customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', tanks: ['A02'] },
            { customer: 'GlobalChem Industries', product: 'Indu-Chem X7', tanks: ['E14', 'E15'] }, { customer: 'GlobalChem Industries', product: 'Petro-Fuel 95', tanks: ['A01'] },
            { customer: 'Coastal Energy Supply', product: 'Diesel Max', tanks: ['C13'] }, { customer: 'Coastal Energy Supply', product: 'Agri-Oil Prime', tanks: ['B47'] },
            { customer: 'Vantage Polymers', product: 'Hexa-Solvent 200', tanks: ['E14', 'E15'] },
            { customer: 'Veridian Synthetics', product: 'N-Butanol X', tanks: ['E14'] },
            { customer: 'Solara Chemicals', product: 'Poly-Mondur 45', tanks: ['E15'] },
            { customer: 'Quantum Nitriles', product: 'Glyco-Coolant B', tanks: ['A01', 'A02'] },
            { customer: 'Axiom Materials', product: 'Formic Solution 85', tanks: ['B45', 'B46'] }
        ],
        docklines: { 'L12': { lastProduct: 'Petro-Fuel 95' }, 'L13': { lastProduct: 'Bio-Fuel E85' }, 'L14': { lastProduct: 'Agri-Oil Prime' }, 'L23': { lastProduct: 'Diesel Max' } },
        infrastructureTankMapping: {
            'L12': ['A01', 'B45', 'B46'], 'L13': ['A02', 'B47'], 'L14': ['B47'], 'L23': ['C13', 'C38'],
            'Bay 1': ['C13', 'C38', 'E14', 'E15'], 'Bay 2': ['C13', 'C38', 'B47'], 'Bay 3': ['A01', 'E14', 'E15'],
            'Siding A': ['B45', 'B46'], 'Siding B': ['C13', 'C38']
        },
        infrastructureModalityMapping: {
            'L12': 'vessel', 'L13': 'vessel', 'L14': 'vessel', 'L23': 'vessel',
            'Bay 1': 'truck', 'Bay 2': 'truck', 'Bay 3': 'truck',
            'Siding A': 'rail', 'Siding B': 'rail'
        },
        assetHolds: { 
            'L12': { active: false, reason: '', user: '', time: null },
            'Siding A': { active: false, reason: '', user: '', time: null },
            'Siding B': { active: false, reason: '', user: '', time: null }
        },
        tankHolds: { 'B47': { active: true, reason: 'Maintenance', user: 'SysAdmin', time: new Date().toISOString() } },
        masterTanks: {
            'A01': { capacity: 15000, current: 8000, calibrationData: generateStrappingTable(15000, 1500, 25) },
            'A02': { capacity: 15000, current: 2500, calibrationData: generateStrappingTable(15000, 1500, 25) },
            'B45': { capacity: 20000, current: 11000, calibrationData: generateStrappingTable(20000, 2000, 20) },
            'B46': { capacity: 20000, current: 18500, calibrationData: generateStrappingTable(20000, 2000, 20) },
            'B47': { capacity: 10000, current: 1000, calibrationData: generateStrappingTable(10000, 1000, 15) },
            'C13': { capacity: 25000, current: 22000, calibrationData: generateStrappingTable(25000, 2200, 30) },
            'C38': { capacity: 25000, current: 5000, calibrationData: generateStrappingTable(25000, 2200, 30) },
            'E14': { capacity: 5000, current: 1500, calibrationData: generateStrappingTable(5000, 500, 10) },
            'E15': { capacity: 5000, current: 1200, calibrationData: generateStrappingTable(5000, 500, 10) }
        },
        masterCustomers: ['Apex Refining', 'Terra Verde Agriculture', 'GlobalChem Industries', 'Coastal Energy Supply', 'Vantage Polymers', 'Veridian Synthetics', 'Solara Chemicals', 'Quantum Nitriles', 'Axiom Materials'],
        activeOpsDisplayFields: {
            orderNumber: true,
            licensePlate: true,
            product: true,
            tonnes: false,
        },
    },
    CBY: {
        customerMatrix: [],
        docklines: { 'S1': { lastProduct: 'Diesel Max' } },
        infrastructureTankMapping: {},
        infrastructureModalityMapping: { 'S1': 'vessel' },
        assetHolds: {},
        tankHolds: {},
        masterTanks: { 'T50': { capacity: 10000, current: 5000 } },
        masterCustomers: ['Citywide Fuels'],
        activeOpsDisplayFields: {
            orderNumber: true,
            licensePlate: true,
            product: true,
            tonnes: true,
        },
    },
};