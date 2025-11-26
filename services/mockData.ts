
import { AppSettings, Modality, TerminalSettings, ContractRates, Operation, ActivityLogItem, SOFItem, Hold, RequeueDetails } from '../types';
import { SOF_EVENTS_MODALITY, VESSEL_COMMODITY_EVENTS, VESSEL_COMMON_EVENTS, MOCK_CURRENT_TIME, LINE_CLEANING_EVENTS } from '../constants';
import { deriveStatusFromSof, validateOperationPlan, calculateAndSetCycleTime } from '../utils/helpers';
import { TERMINAL_MASTER_DATA, MODALITY_SERVICES, PRODUCT_SERVICES, DEFAULT_SETTINGS } from './masterData';

// ===================================================================================
//  CONSISTENT MOCK OPERATIONS GENERATION
// ===================================================================================

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);
const subMinutes = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60000);
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3600 * 1000);
const subHours = (date: Date, hours: number) => new Date(date.getTime() - hours * 3600 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const TRUCK_EVENT_DETAILS: Record<string, string> = {
    'Arrived': 'Truck arrived at terminal gate.',
    'Ready / Approved': 'Paperwork verified. Safety check passed. Truck waiting for bay.',
    'Directed to Bay': 'Driver instructed to proceed to bay.',
    'On Bay': 'Truck positioned on bay. Grounding connected.',
    'Pumping Started': 'Hoses connected. Pump activated.',
    'Pumping Stopped': 'Target volume transferred. Pump stopped.',
    'Post-Load Weighing': 'Truck verified on weighbridge. Weights recorded.',
    'Seal Applied': 'Security seals applied to all compartments.',
    'BOL Printed': 'Bill of Lading generated and handed to driver.',
    'Departed': 'Truck checked out at gate. Departed terminal.'
};

// Locally defined SOF lists to ensure they are always present during generation
const LOCAL_TRUCK_SOF = ['Arrived', 'Ready / Approved', 'Directed to Bay', 'On Bay', 'Pumping Started', 'Pumping Stopped', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Departed'];
const LOCAL_RAIL_SOF = ['Arrived at Terminal', 'On Siding', 'Hose Connect', 'Checks OK', 'Pumping Started', 'Pumping Stopped', 'Hose Disconnect', 'Paperwork Done', 'Departed'];

/**
 * Progresses an array of SOF items sequentially up to a target event.
 * Uses custom delays to simulate realistic durations (e.g. 60 mins for pumping).
 */
const progressSofArray = (
    sofArray: SOFItem[], 
    allEvents: string[], 
    targetEvent: string, 
    baseTime: Date, 
    user: string,
    defaultStepMinutes: number = 10,
    logContext: string = '',
    customDelays: Record<string, number> = {}
): { updatedSof: SOFItem[], lastTime: Date, activityLogs: ActivityLogItem[] } => {
    const newSof = JSON.parse(JSON.stringify(sofArray));
    const targetIndex = allEvents.findIndex(e => e.includes(targetEvent)); // Allow partial match for robustness
    let currentTime = baseTime.getTime();
    const activityLogs: ActivityLogItem[] = [];

    if (targetIndex > -1) {
        for (let i = 0; i <= targetIndex; i++) {
            const eventName = allEvents[i];
            
            // Find the item in the SOF array (handle potential Rework prefixes if needed in future, currently standard)
            const eventIndexInSof = newSof.findIndex((s: SOFItem) => s.event === eventName);
            
            if (eventIndexInSof > -1) {
                // Determine how much time to add BEFORE this event happens relative to the previous one
                // For the first event, we add 0 (it happens AT baseTime) unless a delay is forced.
                let delay = i === 0 ? 0 : defaultStepMinutes;
                
                // Check for custom delays.
                // NOTE: A custom delay for 'Pumping Stopped' means "Time elapsed SINCE the previous step (Pumping Started)".
                // This allows us to inject the transfer duration.
                const cleanEventName = eventName.replace(/^(Rework #\d+: )/, '');
                if (customDelays[cleanEventName] !== undefined) {
                    delay = customDelays[cleanEventName];
                }

                currentTime += delay * 60000;
                const timeString = new Date(currentTime).toISOString();

                newSof[eventIndexInSof] = {
                    ...newSof[eventIndexInSof],
                    status: 'complete',
                    time: timeString,
                    user: user
                };

                const details = TRUCK_EVENT_DETAILS[cleanEventName] 
                    ? `${TRUCK_EVENT_DETAILS[cleanEventName]}${logContext}`
                    : `${eventName} marked complete${logContext}.`;

                activityLogs.push({
                    time: timeString,
                    user: user,
                    action: 'SOF_UPDATE',
                    details: details
                });
            }
        }
    }
    return { updatedSof: newSof, lastTime: new Date(currentTime), activityLogs };
};

export const createMockHolds = (terminal: string): Hold[] => {
    if (terminal !== 'PAL') {
        return [];
    }
    
    const baseTime = new Date(MOCK_CURRENT_TIME);
    baseTime.setMinutes(baseTime.getMinutes() > 30 ? 60 : 30, 0, 0);

    const holds: Hold[] = [
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

// Hardcoded lists for realistic, consistent data
const TRUCK_COMPANIES = ['BulkTrans', 'Coastal Carriers', 'Riverton Haul', 'CrossCountry', 'Apex Logistics', 'PetroHaul', 'Citywide Fuels', 'TerraTrans', 'ChemMove', 'FastLane Freight', 'LiquidLines', 'Tanker Express'];
const DRIVER_NAMES = ['John Smith', 'Maria Garcia', 'David Chen', 'Fatima Al-Jamil', 'James Kirk', 'Michael Burnham', 'Sarah Connor', 'Ellen Ripley', 'Chrisjen Avasarala', 'Bobbie Draper', 'Ken Adams', 'Isabelle Rossi', 'Liam O\'Connell', 'Anya Sharma', 'Deckard Shaw', 'Han Lue', 'Gisele Yashar', 'Dominic Toretto', 'Brian O\'Conner', 'Letty Ortiz', 'Roman Pearce', 'Tej Parker', 'Mia Toretto', 'Luke Hobbs', 'Elena Neves', 'Anakin Skywalker', 'Leia Organa', 'Han Solo', 'Ben Kenobi', 'Rey Palpatine'];


// NEW: Fully hardcoded truck schedule to guarantee no overlaps
const getHardcodedTruckOps = (): any[] => {
    // Helper to make code cleaner
    // State maps to targetSofEvent. Duration 1 means 60 minutes of PUMPING time.
    // Spacing is increased to ~2.5h to account for 1h pump + 40m pre-ops + 40m post-ops.
    
    // SAFETY RULES APPLIED:
    // Bay 1 (Clean): Petro-Fuel 95 (B45/B46), ULP 98 (A01).
    // Bay 2 (Bio/Agri): Bio-Fuel E85 (A02), Agri-Oil (B47). NO HYDROCARBONS.
    // Bay 3 (Aviation): Jet A-1 (J10/J11) ONLY.
    // Bay 4 (Gas/Jet): ULP 98 (A01), Jet A-1 (J11).
    // Bay 5-8 (Distillates & Heavy): Diesel Max (C13/C38), Crude Oil (D05).
    // Bay 9-10 (Chemicals): Methanol (E15), Indu-Chem (E14).

    const ops = [
        // --- Bay 1: Gasoline ---
        { bay: 'Bay 1', eta: subHours(MOCK_CURRENT_TIME, 6), duration: 1, state: 'Departed', 
          plan: { customer: 'Apex Refining', product: 'Petro-Fuel 95', from: 'B45' } },
        { bay: 'Bay 1', eta: subHours(MOCK_CURRENT_TIME, 3.5), duration: 1, state: 'Departed',
          plan: { customer: 'Apex Refining', product: 'ULP 98', from: 'A01' } },
        { bay: 'Bay 1', eta: subHours(MOCK_CURRENT_TIME, 1.2), duration: 1, state: 'Pumping Started',
          plan: { customer: 'Apex Refining', product: 'Petro-Fuel 95', from: 'B46' } }, 
        { bay: 'Bay 1', eta: addHours(MOCK_CURRENT_TIME, 1.5), duration: 1, state: 'Planned',
          plan: { customer: 'BulkTrans', product: 'ULP 98', from: 'A01' } }, // Sourcing from A01
        { bay: 'Bay 1', eta: addHours(MOCK_CURRENT_TIME, 3.5), duration: 1, state: 'Planned',
          plan: { customer: 'Apex Refining', product: 'Petro-Fuel 95', from: 'B45' } },

        // --- Bay 2: Biofuels/Agri (No Hydrocarbons to avoid contamination) ---
        { bay: 'Bay 2', eta: subHours(MOCK_CURRENT_TIME, 5), duration: 1, state: 'Departed',
          plan: { customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', from: 'A02' } },
        { bay: 'Bay 2', eta: subHours(MOCK_CURRENT_TIME, 2.2), duration: 1, state: 'Pumping Stopped',
          plan: { customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', from: 'B47' } }, // Agri-Oil is compatible-ish in dedicated bay
        { bay: 'Bay 2', eta: addMinutes(MOCK_CURRENT_TIME, 10), duration: 1, state: 'Arrived',
          plan: { customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', from: 'A02' } }, 
        { bay: 'Bay 2', eta: addHours(MOCK_CURRENT_TIME, 3.2), duration: 1, state: 'Planned',
          plan: { customer: 'National Rail Freight', product: 'Bio-Fuel E85', from: 'A02' } }, // Matched to Tank A02 product

        // --- Bay 3: Aviation (Strictly Jet A-1) ---
        { bay: 'Bay 3', eta: subHours(MOCK_CURRENT_TIME, 4.5), duration: 1, state: 'Departed',
          plan: { customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: 'J10' } },
        { bay: 'Bay 3', eta: subHours(MOCK_CURRENT_TIME, 0.8), duration: 1, state: 'On Bay',
          plan: { customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: 'J11' } }, 
        { bay: 'Bay 3', eta: addHours(MOCK_CURRENT_TIME, 2), duration: 1, state: 'Planned',
          plan: { customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: 'J10' } },
        
        // --- Bay 4: Gas/Jet (Mixed Clean) ---
        { bay: 'Bay 4', eta: subHours(MOCK_CURRENT_TIME, 3), duration: 1, state: 'Departed',
          plan: { customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: 'J11' } },
        { bay: 'Bay 4', eta: addHours(MOCK_CURRENT_TIME, 5.5), duration: 1, state: 'Planned', // Scheduled after hold
          plan: { customer: 'Apex Refining', product: 'ULP 98', from: 'A01' } }, 

        // --- Bay 5-8: Distillates & Heavy (Diesel, Crude) ---
        { bay: 'Bay 5', eta: subMinutes(MOCK_CURRENT_TIME, 20), duration: 1, state: 'Arrived',
          plan: { customer: 'Coastal Energy Supply', product: 'Diesel Max', from: 'C13' } },
        { bay: 'Bay 5', eta: addHours(MOCK_CURRENT_TIME, 2), duration: 1, state: 'Planned',
          plan: { customer: 'Coastal Energy Supply', product: 'Diesel Max', from: 'C13' } }, // Switched Crude to Diesel for consistency
        
        { bay: 'Bay 6', eta: addMinutes(MOCK_CURRENT_TIME, 30), duration: 1, state: 'Planned',
          plan: { customer: 'Apex Refining', product: 'Diesel Max', from: 'C38' } },
        { bay: 'Bay 6', eta: addHours(MOCK_CURRENT_TIME, 2.5), duration: 1, state: 'Planned',
          plan: { customer: 'Coastal Energy Supply', product: 'Crude Oil', from: 'D05' } }, // Crude allowed on Bay 6

        { bay: 'Bay 7', eta: subHours(MOCK_CURRENT_TIME, 2), duration: 1, state: 'Departed',
          plan: { customer: 'Apex Refining', product: 'Diesel Max', from: 'C13' } },
        { bay: 'Bay 7', eta: addHours(MOCK_CURRENT_TIME, 0.5), duration: 1, state: 'Planned',
          plan: { customer: 'Coastal Energy Supply', product: 'Diesel Max', from: 'C13' } },
        
        { bay: 'Bay 8', eta: addHours(MOCK_CURRENT_TIME, 1), duration: 1, state: 'Planned',
          plan: { customer: 'Apex Refining', product: 'Diesel Max', from: 'C13' } },
        
        // --- Bay 9-10: Chemicals ---
        { bay: 'Bay 9', eta: addHours(MOCK_CURRENT_TIME, 2), duration: 1, state: 'Planned',
          plan: { customer: 'GlobalChem Industries', product: 'Indu-Chem X7', from: 'E14' } },
        { bay: 'Bay 10', eta: subHours(MOCK_CURRENT_TIME, 1.5), duration: 1, state: 'On Bay',
          plan: { customer: 'GlobalChem Industries', product: 'Methanol', from: 'E15' } },
        
        // --- NEW TRUCKS FOR RESCHEDULE PANEL ---
        { bay: 'Bay 5', eta: addHours(MOCK_CURRENT_TIME, 4.5), duration: 1, state: 'Planned', special: 'high-priority-reschedule',
          plan: { customer: 'Coastal Energy Supply', product: 'Diesel Max', from: 'C13' } },
        { bay: 'Bay 7', eta: subMinutes(MOCK_CURRENT_TIME, 45), duration: 1, state: 'Planned', special: 'no-show',
          plan: { customer: 'Apex Refining', product: 'Diesel Max', from: 'C38' } }, 
    ];
    
    return ops.map((op, i) => {
        const company = TRUCK_COMPANIES[i % TRUCK_COMPANIES.length];
        const companyAbbr = company.replace(/[^A-Z]/g, '').slice(0, 3);

        return {
            id: `hd-truck-${op.bay.replace(' ','')}-${i}${op.special ? `-${op.special}`:''}`,
            orderNumber: `TRK-${3000 + i}`,
            eta: op.eta.toISOString(),
            durationHours: op.duration,
            transportId: company,
            licensePlate: `${companyAbbr}-${1000 + i}`,
            driverName: DRIVER_NAMES[i % DRIVER_NAMES.length],
            plan: op.plan,
            infra: op.bay,
            targetSofEvent: op.state,
            special: op.special
        };
    });
};


export const createMockOperations = (): Operation[] => {
    let operations: Operation[] = [];
    const emptyTruckSof: SOFItem[] = LOCAL_TRUCK_SOF.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 }));
    
    // --- VESSEL OPERATIONS (3 Hardcoded Vessels, ALL ACTIVE) ---

    // Vessel 1: "MV Alpha" - Active, Wharf 1 (Pumping)
    const vessel1_eta = subHours(MOCK_CURRENT_TIME, 5);
    let vessel1: Operation = {
        id: 'op-vessel-1', terminal: 'PAL', modality: 'vessel', status: 'planned', transportId: 'MV Alpha', eta: vessel1_eta.toISOString(), durationHours: 12, queuePriority: vessel1_eta.getTime(),
        currentStatus: 'Scheduled', delay: { active: false }, orderNumber: 'ORD-54321', 
        activityHistory: [{ time: subHours(vessel1_eta, 1).toISOString(), user: 'Planner', action: 'CREATE', details: 'New vessel operation plan created.' }],
        documents: [],
        sof: VESSEL_COMMON_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
        transferPlan: [
            { infrastructureId: 'L12', transfers: [{ id: 'op-vessel-1-L12-0', customer: 'Apex Refining', product: 'Petro-Fuel 95', from: '2S', to: 'B45', tonnes: 8500, transferredTonnes: 0, slopsTransferredTonnes: 50, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [] }] },
            { infrastructureId: 'L13', transfers: [{ id: 'op-vessel-1-L13-0', customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', from: '4P', to: 'A02', tonnes: 6000, transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [] }] },
        ],
        specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    const { updatedSof: commonSof1, lastTime: lastCommonTime1, activityLogs: commonLogs1 } = progressSofArray(vessel1.sof!, VESSEL_COMMON_EVENTS, 'GANGWAY DOWN', new Date(vessel1.eta), 'Ops Lead', 20);
    vessel1.sof = commonSof1; vessel1.activityHistory.push(...commonLogs1);
    const firstVesselTransfer1 = vessel1.transferPlan[0].transfers[0];
    const { updatedSof: commoditySof1, lastTime: pumpStartTime1, activityLogs: commodityLogs1 } = progressSofArray(firstVesselTransfer1.sof!, VESSEL_COMMODITY_EVENTS, 'START PUMPING', lastCommonTime1, 'Operator 1', 10, ` for ${firstVesselTransfer1.product}`);
    firstVesselTransfer1.sof = commoditySof1; vessel1.activityHistory.push(...commodityLogs1);
    const vesselInitialTransferred1 = Math.min(firstVesselTransfer1.tonnes, ( (MOCK_CURRENT_TIME.getTime() - pumpStartTime1.getTime()) / 3600000) * 1200 );
    firstVesselTransfer1.transferredTonnes = vesselInitialTransferred1;
    const vessel1_new_statuses = deriveStatusFromSof(vessel1, true);
    if(vessel1_new_statuses) vessel1 = {...vessel1, ...vessel1_new_statuses};

    // Vessel 2: "MV Titan" - Active, Wharf 2 (Pumping)
    // Reduced volumes to prevent overfill
    const vessel2_eta = subHours(MOCK_CURRENT_TIME, 4);
    let vessel2: Operation = {
        id: 'op-vessel-2', terminal: 'PAL', modality: 'vessel', status: 'planned', transportId: 'MV Titan', eta: vessel2_eta.toISOString(), durationHours: 18, queuePriority: vessel2_eta.getTime(),
        currentStatus: 'Scheduled', delay: { active: false }, orderNumber: 'ORD-54322',
        activityHistory: [{ time: subHours(vessel2_eta, 2).toISOString(), user: 'Planner', action: 'CREATE', details: 'New vessel operation plan created.' }],
        documents: [],
        sof: VESSEL_COMMON_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
        transferPlan: [
            { infrastructureId: 'L14', transfers: [
                { id: 'op-vessel-2-L14-0', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '1P', to: 'J10', tonnes: 2000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L14-2', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '3P', to: 'J11', tonnes: 2000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }
            ]},
            { infrastructureId: 'L23', transfers: [
                { id: 'op-vessel-2-L23-0', customer: 'Coastal Energy Supply', product: 'Diesel Max', from: '1S', to: 'C13', tonnes: 2000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L23-1', customer: 'National Rail Freight', product: 'Diesel Max', from: '2S', to: 'C38', tonnes: 8000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L23-2', customer: 'Coastal Energy Supply', product: 'Crude Oil', from: '3S', to: 'D05', tonnes: 5000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }
            ]},
            { infrastructureId: 'L24', transfers: [
                { id: 'op-vessel-2-L24-0', customer: 'Apex Refining', product: 'Diesel Max', from: '4S', to: 'C38', tonnes: 5000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }
            ]},
            { infrastructureId: 'L25', transfers: [
                { id: 'op-vessel-2-L25-0', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '4P', to: 'J10', tonnes: 500, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L25-1', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '5P', to: 'J11', tonnes: 1000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L25-2', customer: 'Coastal Energy Supply', product: 'Crude Oil', from: '5S', to: 'D05', tonnes: 2000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }
            ]},
        ],
        specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    const { updatedSof: commonSof2, lastTime: lastCommonTime2, activityLogs: commonLogs2 } = progressSofArray(vessel2.sof!, VESSEL_COMMON_EVENTS, 'SURVEYOR ONBOARD', new Date(vessel2.eta), 'Ops Lead', 15);
    vessel2.sof = commonSof2; vessel2.activityHistory.push(...commonLogs2);
    const firstCompatibleTransfer = vessel2.transferPlan[1].transfers[0];
    const { updatedSof: commoditySof2, lastTime: pumpStartTime2, activityLogs: commodityLogs2 } = progressSofArray(firstCompatibleTransfer.sof!, VESSEL_COMMODITY_EVENTS, 'START PUMPING', lastCommonTime2, 'Operator 2', 8, ` for ${firstCompatibleTransfer.product}`);
    firstCompatibleTransfer.sof = commoditySof2; vessel2.activityHistory.push(...commodityLogs2);
    const vesselInitialTransferred2 = Math.min(firstCompatibleTransfer.tonnes, ( (MOCK_CURRENT_TIME.getTime() - pumpStartTime2.getTime()) / 3600000) * 1100 );
    firstCompatibleTransfer.transferredTonnes = vesselInitialTransferred2;
    const vessel2_new_statuses = deriveStatusFromSof(vessel2, true);
    if(vessel2_new_statuses) vessel2 = {...vessel2, ...vessel2_new_statuses};


    // Vessel 3: "Maritime Grace" - Active, Wharf 3 (Waiting for Surveyor)
    const vessel3_eta = subHours(MOCK_CURRENT_TIME, 2);
    let vessel3: Operation = {
        id: 'op-vessel-3', terminal: 'PAL', modality: 'vessel', status: 'planned', transportId: 'Maritime Grace', eta: vessel3_eta.toISOString(), durationHours: 16, queuePriority: vessel3_eta.getTime(),
        currentStatus: 'Scheduled', delay: { active: false }, orderNumber: 'ORD-54323',
        activityHistory: [{ time: subHours(vessel3_eta, 4).toISOString(), user: 'Planner', action: 'CREATE', details: 'New vessel operation plan created.' }],
        documents: [],
        sof: VESSEL_COMMON_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
        transferPlan: [
            { infrastructureId: 'L34', transfers: [
                { id: 'op-vessel-3-L34-0', customer: 'GlobalChem Industries', product: 'Methanol', from: '3P', to: 'E15', tonnes: 2000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }, // Reduced for safety
            ]},
            { infrastructureId: 'L31', transfers: [
                { id: 'op-vessel-3-L31-0', customer: 'Apex Refining', product: 'ULP 98', from: '2S', to: 'A01', tonnes: 6000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }, // Safe fill limit adj
            ]},
        ],
        specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    const { updatedSof: commonSof3, activityLogs: commonLogs3 } = progressSofArray(vessel3.sof!, VESSEL_COMMON_EVENTS, 'VESSEL ALONGSIDE', new Date(vessel3.eta), 'Ops Lead', 25);
    vessel3.sof = commonSof3; vessel3.activityHistory.push(...commonLogs3);
    const vessel3_new_statuses = deriveStatusFromSof(vessel3, true);
    if(vessel3_new_statuses) vessel3 = {...vessel3, ...vessel3_new_statuses};

    operations.push(vessel1, vessel2, vessel3);

    // --- NEW VESSEL 4: Cosco Galaxy - Hardcoded Extensive Plan (Optimized for Safety) ---
    const vessel4_eta = addDays(MOCK_CURRENT_TIME, 7);
    let vessel4: Operation = {
        id: 'op-vessel-4',
        terminal: 'PAL',
        modality: 'vessel',
        status: 'planned',
        transportId: 'Cosco Galaxy',
        eta: vessel4_eta.toISOString(),
        durationHours: 36, // Extensive plan
        queuePriority: vessel4_eta.getTime(),
        currentStatus: 'Scheduled',
        delay: { active: false },
        orderNumber: 'ORD-54324',
        activityHistory: [{ time: subHours(MOCK_CURRENT_TIME, 24).toISOString(), user: 'Planner', action: 'CREATE', details: 'New vessel operation plan created.' }],
        documents: [],
        sof: VESSEL_COMMON_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
        transferPlan: [
            {
                infrastructureId: 'L12',
                transfers: [
                    {
                        id: 'op-v4-L12-1', customer: 'Apex Refining', product: 'Petro-Fuel 95', from: '1S', to: 'B46', tonnes: 8000,
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: []
                    },
                    {
                        id: 'op-v4-L12-2', customer: 'Apex Refining', product: 'Diesel Max', from: '2S', to: 'C38', tonnes: 4000, // Changed to Diesel Max into C38 to avoid A01 overfill
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [],
                        preTransferCleaningSof: LINE_CLEANING_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 }))
                    },
                    {
                        id: 'op-v4-L12-3', customer: 'BulkTrans', product: 'Diesel Max', from: '3S', to: 'C13', tonnes: 4000,
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [],
                        preTransferCleaningSof: LINE_CLEANING_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 }))
                    }
                ]
            },
            {
                infrastructureId: 'L13',
                transfers: [
                    {
                        id: 'op-v4-L13-1', customer: 'Terra Verde Agriculture', product: 'Bio-Fuel E85', from: '1P', to: 'A02', tonnes: 5500,
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: []
                    },
                    {
                        id: 'op-v4-L13-2', customer: 'National Rail Freight', product: 'Ethanol', from: '2P', to: 'A02', tonnes: 3000,
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: []
                    }
                ]
            },
            {
                infrastructureId: 'L23',
                transfers: [
                    {
                        id: 'op-v4-L23-1', customer: 'Coastal Energy Supply', product: 'Crude Oil', from: '3S', to: 'D05', tonnes: 5000, // Reduced to 5000 to avoid D05 overfill
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: []
                    },
                    {
                        id: 'op-v4-L23-2', customer: 'Coastal Energy Supply', product: 'Diesel Max', from: '4S', to: 'C38', tonnes: 5000,
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [],
                        preTransferCleaningSof: LINE_CLEANING_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 }))
                    }
                ]
            },
            {
                infrastructureId: 'L24',
                transfers: [
                    {
                        id: 'op-v4-L24-1', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '5P', to: 'J10', tonnes: 7000,
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: []
                    },
                    {
                        id: 'op-v4-L24-2', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '6P', to: 'J11', tonnes: 3000,
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: []
                    }
                ]
            },
            {
                infrastructureId: 'L31',
                transfers: [
                    {
                        id: 'op-v4-L31-1', customer: 'GlobalChem Industries', product: 'Methanol', from: '7S', to: 'E15', tonnes: 1500, // Reduced to 1500 to avoid E15 overfill
                        transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [],
                        sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: []
                    }
                ]
            }
        ],
        specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    operations.push(vessel4);

    // --- NEW VESSEL 5: Anchorage (NOR Tendered) ---
    const vessel5_eta = addHours(MOCK_CURRENT_TIME, 4);
    let vessel5: Operation = {
        id: 'op-vessel-5', terminal: 'PAL', modality: 'vessel', status: 'planned', transportId: 'Stolt Courage', eta: vessel5_eta.toISOString(), durationHours: 14, queuePriority: vessel5_eta.getTime(),
        currentStatus: 'NOR Tendered', delay: { active: false }, orderNumber: 'ORD-54325',
        activityHistory: [{ time: subHours(MOCK_CURRENT_TIME, 6).toISOString(), user: 'Planner', action: 'CREATE', details: 'New vessel operation plan created.' }, { time: subHours(MOCK_CURRENT_TIME, 1).toISOString(), user: 'Master', action: 'STATUS_UPDATE', details: 'Notice of Readiness Tendered.' }],
        documents: [],
        sof: VESSEL_COMMON_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
        transferPlan: [
            { infrastructureId: 'L34', transfers: [{ id: 'op-vessel-5-L34-0', customer: 'GlobalChem Industries', product: 'Indu-Chem X7', from: '2P', to: 'E14', tonnes: 3500, transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [] }] } // CHANGED TO L34 to reach E14
        ],
        specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    operations.push(vessel5);


    // --- RAIL OPERATION ---
    let railOp: Operation = {
        id: 'op-rail-1', terminal: 'PAL', modality: 'rail', status: 'planned', transportId: 'NRF 7891', eta: subHours(MOCK_CURRENT_TIME, 2).toISOString(), durationHours: 3, queuePriority: subHours(MOCK_CURRENT_TIME, 2).getTime(),
        currentStatus: 'Scheduled', orderNumber: 'RAIL-556',
        activityHistory: [{ time: subHours(MOCK_CURRENT_TIME, 3).toISOString(), user: 'Planner', action: 'CREATE', details: 'New rail operation plan created.' }],
        transferPlan: [{ infrastructureId: 'Siding B', transfers: [{ id: 'op-rail-1-Siding B-0', customer: 'National Rail Freight', product: 'Diesel Max', from: 'C38', to: 'NRF 7891', tonnes: 1500, transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Tank to Rail', specialServices: [], sof: LOCAL_RAIL_SOF.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [] }] }],
        delay: { active: false }, specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    const railTransfer = railOp.transferPlan[0].transfers[0];
    const { updatedSof: railSof, activityLogs: railLogs, lastTime: railPumpStartTime } = progressSofArray(railTransfer.sof!, LOCAL_RAIL_SOF, 'Pumping Started', new Date(railOp.eta), 'Operator 1', 15, ` for ${railTransfer.product}`);
    railTransfer.sof = railSof; railOp.activityHistory.push(...railLogs);
    const railInitialTransferred = Math.min(railTransfer.tonnes, ( (MOCK_CURRENT_TIME.getTime() - railPumpStartTime.getTime()) / 3600000) * 300);
    railTransfer.transferredTonnes = railInitialTransferred;
    const rail_new_statuses = deriveStatusFromSof(railOp, true);
    if(rail_new_statuses) railOp = {...railOp, ...rail_new_statuses};
    operations.push(railOp);
    
    // --- NEW SATURATED TRUCK OPERATIONS ---
    const truckOps = getHardcodedTruckOps();

    const preloadedTrucks = truckOps.map((baseOp, i) => {
        const plan = baseOp.plan;
        
        let op: Operation = {
            id: baseOp.id,
            orderNumber: baseOp.orderNumber,
            eta: baseOp.eta,
            transportId: baseOp.transportId,
            licensePlate: baseOp.licensePlate,
            driverName: baseOp.driverName,
            terminal: 'PAL',
            modality: 'truck',
            durationHours: baseOp.durationHours,
            queuePriority: new Date(baseOp.eta).getTime(),
            delay: { active: false },
            arrivalChecklist: {
                tiresOk: 'pending',
                leaksOk: 'pending',
                hosesOk: 'pending',
                safetySealsOk: 'pending',
                bolReceived: 'pending',
                coaReceived: 'pending',
                driverLicenseOk: 'pending',
            },
            transferPlan: [{
                infrastructureId: baseOp.infra,
                transfers: [{
                    id: `transfer-${baseOp.id}`,
                    customer: plan.customer,
                    product: plan.product,
                    from: plan.from,
                    to: baseOp.transportId,
                    tonnes: 25 + (i % 5),
                    direction: 'Tank to Truck',
                    specialServices: [],
                    sof: JSON.parse(JSON.stringify(emptyTruckSof)),
                    transferredTonnes: 0,
                    slopsTransferredTonnes: 0,
                    transferLog: []
                }]
            }],
            activityHistory: [{ time: subMinutes(new Date(baseOp.eta), 20).toISOString(), user: 'Planner', action: 'CREATE', details: 'New truck op created.' }],
            status: 'planned',
            currentStatus: 'Scheduled',
            truckStatus: 'Planned'
        } as any;
        
        const etaDate = new Date(op.eta);
        const targetSofEvent = baseOp.targetSofEvent;

        if (targetSofEvent && targetSofEvent !== 'Planned') {
            const transfer = op.transferPlan[0].transfers[0];
            
            // Define simulated delays for this truck to ensure it matches the target timeline perfectly
            // Specifically inserting the pumping duration into the gap
            const pumpDurationMins = (baseOp.durationHours * 60) || 60;
            const customDelays = {
                'Pumping Stopped': pumpDurationMins, // Use full duration for the pump gap
            };

            // Generate sequential timestamps and logs
            const { updatedSof, activityLogs, lastTime } = progressSofArray(
                transfer.sof!, 
                LOCAL_TRUCK_SOF, 
                targetSofEvent, 
                etaDate, 
                i % 2 === 0 ? 'Operator 1' : 'Dispatch',
                10, // Default step 10 mins for non-pumping steps
                '',
                customDelays
            );
            
            transfer.sof = updatedSof;
            op.activityHistory.push(...activityLogs);

            // Auto-complete checklist for realism if arrived
            if (targetSofEvent !== 'Arrived' && targetSofEvent !== 'Planned') {
                op.arrivalChecklist = {
                    tiresOk: 'complete', leaksOk: 'complete', hosesOk: 'complete', safetySealsOk: 'complete',
                    bolReceived: 'complete', coaReceived: 'complete', driverLicenseOk: 'complete'
                };
            }

            // Handle volume calculations based on state
            if (targetSofEvent === 'Pumping Started') {
                // Determine how long since pumping started
                const pumpStart = updatedSof.find((s: any) => s.event.includes('Pumping Started'))?.time;
                if (pumpStart) {
                    const durationHours = (MOCK_CURRENT_TIME.getTime() - new Date(pumpStart).getTime()) / 3600000;
                    let transferred = durationHours * 100; // Assume Rate: 100 T/hr
                    if (transferred >= transfer.tonnes) transferred = transfer.tonnes * 0.99; // Don't auto-complete volume if visually active
                    transfer.transferredTonnes = transferred;
                }
            } else if (['Pumping Stopped', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Departed'].includes(targetSofEvent)) {
                transfer.transferredTonnes = transfer.tonnes;
                transfer.loadedWeight = transfer.tonnes * (1 + (Math.random() * 0.02 - 0.01)); // Small variance
            } else {
                transfer.transferredTonnes = 0;
            }
            
            if (targetSofEvent === 'Departed') {
                op.completedTime = lastTime.toISOString();
                op = calculateAndSetCycleTime(op);
            }
        }
        
        if (baseOp.special === 'high-priority-reschedule') {
            op.currentStatus = 'Reschedule Required';
            op.truckStatus = 'Rejected';
            op.requeueDetails = {
                reason: 'Documentation Issue',
                user: 'Dispatch',
                time: subMinutes(MOCK_CURRENT_TIME, 15).toISOString(),
                details: { notes: 'BOL does not match order.' },
                priority: 'high'
            };
            op.status = 'planned';
        } else if (baseOp.special === 'no-show') {
            const flagTime = MOCK_CURRENT_TIME.toISOString();
            op.currentStatus = 'No Show';
            op.requeueDetails = {
                reason: 'No Show',
                user: 'System',
                time: flagTime,
                details: {},
                priority: 'normal'
            };
            op.status = 'planned';
            const newLog: ActivityLogItem = { time: flagTime, user: 'System', action: 'REQUEUE', details: `Automatically flagged as No Show. Reason: Truck did not arrive within 30 minutes of ETA.` };
            op.activityHistory.push(newLog);
        } else {
            const derivedStatus = deriveStatusFromSof(op, true);
            if (derivedStatus) {
                op = { ...op, ...derivedStatus };
            }
        }
        
        return op;
    });

    operations.push(...preloadedTrucks);

    // --- DRAWDOWN OPERATIONS (To free up tank capacity for Cosco Galaxy) ---
    // Helper to generate planned drawdowns
    const generateDrawdowns = (baseId: string, tank: string, product: string, modality: 'truck' | 'rail', infra: string, count: number, tonnesPerOp: number, startDayOffset: number) => {
        const ops: Operation[] = [];
        const baseTime = new Date(MOCK_CURRENT_TIME);
        const customer = 'Apex Refining'; // Simplified customer for drawdowns

        for (let i = 0; i < count; i++) {
            const opId = `${baseId}-${i}`;
            // Spread over time
            const timeOffset = (startDayOffset * 24 * 60) + (i * (24 * 60 / (count/5))); // Spread roughly over 5 days
            const eta = addMinutes(baseTime, timeOffset);
            
            const op: Operation = {
                id: opId,
                terminal: 'PAL',
                modality: modality,
                status: 'planned',
                transportId: modality === 'rail' ? `RAIL-${100+i}` : `TRK-${500+i}`,
                eta: eta.toISOString(),
                durationHours: modality === 'rail' ? 3 : 1,
                queuePriority: eta.getTime(),
                currentStatus: 'Scheduled',
                truckStatus: 'Planned',
                activityHistory: [{ time: MOCK_CURRENT_TIME.toISOString(), user: 'System', action: 'CREATE', details: 'Auto-generated drawdown.' }],
                transferPlan: [{
                    infrastructureId: infra,
                    transfers: [{
                        id: `t-${opId}`,
                        customer,
                        product,
                        from: tank,
                        to: modality === 'rail' ? `RAIL-${100+i}` : 'Generic Truck',
                        tonnes: tonnesPerOp,
                        direction: `Tank to ${modality.charAt(0).toUpperCase() + modality.slice(1)}`,
                        specialServices: [],
                        sof: modality === 'rail' ? 
                            LOCAL_RAIL_SOF.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })) : 
                            JSON.parse(JSON.stringify(emptyTruckSof)),
                        transferredTonnes: 0,
                        slopsTransferredTonnes: 0,
                        transferLog: []
                    }]
                }],
                documents: [], specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [], sampleLog: [], pressureCheckLog: [], handOvers: [], hoseLog: [], observationLog: [], delay: {active:false}
            };
            ops.push(op);
        }
        return ops;
    };

    const drawdowns = [
        // B46 Rail Drawdown (~7500T)
        ...generateDrawdowns('dd-b46', 'B46', 'Petro-Fuel 95', 'rail', 'Siding A', 5, 1500, 1),
        // C13 Truck Drawdown (~1000T)
        ...generateDrawdowns('dd-c13', 'C13', 'Diesel Max', 'truck', 'Bay 5', 25, 40, 1),
        // J10 Truck Drawdown (Jet A-1 ~4000T)
        ...generateDrawdowns('dd-j10', 'J10', 'Jet A-1', 'truck', 'Bay 3', 80, 50, 1),
        // A02 Truck Drawdown (~2000T)
        ...generateDrawdowns('dd-a02', 'A02', 'Bio-Fuel E85', 'truck', 'Bay 2', 40, 50, 1)
    ];

    operations.push(...drawdowns);

    // Final cleanup to ensure all ops have required fields
    operations = operations.map((op, i) => ({
        ...op,
        id: op.id || `op-fallback-${i}`,
        delay: op.delay || { active: false },
        activityHistory: op.activityHistory || [],
        documents: op.documents || [],
        lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [],
        specialRequirements: op.specialRequirements || [],
        handOvers: op.handOvers || [],
        hoseLog: op.hoseLog || [],
        observationLog: op.observationLog || [],
        dipSheetData: op.dipSheetData || [],
        queuePriority: op.queuePriority || 0,
        sampleLog: op.sampleLog || [],
        pressureCheckLog: op.pressureCheckLog || [],
    }));

    return operations;
};
