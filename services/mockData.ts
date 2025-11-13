
import { AppSettings, Modality, TerminalSettings, ContractRates, Operation, ActivityLogItem, SOFItem, Hold, RequeueDetails } from '../types';
import { SOF_EVENTS_MODALITY, VESSEL_COMMODITY_EVENTS, VESSEL_COMMON_EVENTS, MOCK_CURRENT_TIME, LINE_CLEANING_EVENTS } from '../constants';
// FIX: Corrected typo in imported function name from deriveTruckStatusFromSof to deriveStatusFromSof.
import { deriveStatusFromSof, validateOperationPlan, calculateAndSetCycleTime } from '../utils/helpers';
import { TERMINAL_MASTER_DATA, MODALITY_SERVICES, PRODUCT_SERVICES, DEFAULT_SETTINGS } from './masterData';

// ===================================================================================
//  CONSISTENT MOCK OPERATIONS GENERATION
// ===================================================================================

/**
 * NOTE TO MAINTAINER & AI:
 * All time-based calculations are derived relative to a fixed constant `MOCK_CURRENT_TIME`.
 * This ensures that every time the app is loaded, the current day appears as a busy, active day,
 * with the state of the terminal being predictable. This is a core requirement.
 * The truck data is now systematically generated to ensure a saturated, non-overlapping schedule.
 *
 * PLEASE DO NOT:
 * - Revert this to a dynamic `new Date()` reference.
 */

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);
const subMinutes = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60000);
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3600 * 1000);
const subHours = (date: Date, hours: number) => new Date(date.getTime() - hours * 3600 * 1000);

const progressSofArray = (
    sofArray: SOFItem[], 
    allEvents: string[], 
    targetEvent: string, 
    baseTime: Date, 
    user: string,
    stepMinutes: number = 5,
    logContext: string = ''
): { updatedSof: SOFItem[], lastTime: Date, activityLogs: ActivityLogItem[] } => {
    const newSof = JSON.parse(JSON.stringify(sofArray));
    const targetIndex = allEvents.findIndex(e => e === targetEvent);
    let lastTime = baseTime;
    const activityLogs: ActivityLogItem[] = [];

    if (targetIndex > -1) {
        for (let i = 0; i <= targetIndex; i++) {
            const eventName = allEvents[i];
            const eventIndexInSof = newSof.findIndex((s: SOFItem) => s.event === eventName);
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
    const palSettings = DEFAULT_SETTINGS.PAL;
    const { infrastructureTankMapping, customerMatrix } = palSettings;

    const bayToValidPlans: Record<string, { customer: string, product: string, from: string }[]> = {};
     const truckBays = Object.keys(palSettings.infrastructureModalityMapping || {})
        .filter(infra => palSettings.infrastructureModalityMapping![infra] === 'truck')
        .sort();
    
    truckBays.forEach(bay => {
        bayToValidPlans[bay] = [];
        const connectedTanks = infrastructureTankMapping![bay] || [];
        customerMatrix.forEach(mapping => {
            const validTanksForMapping = mapping.tanks.filter(tank => connectedTanks.includes(tank));
            validTanksForMapping.forEach(tank => {
                bayToValidPlans[bay].push({ customer: mapping.customer, product: mapping.product, from: tank });
            });
        });
    });

    const ops = [
        // Bay 1
        { bay: 'Bay 1', eta: subHours(MOCK_CURRENT_TIME, 4.5), duration: 1, state: 'Departed' },
        { bay: 'Bay 1', eta: subHours(MOCK_CURRENT_TIME, 3.25), duration: 0.75, state: 'Departed' },
        { bay: 'Bay 1', eta: subHours(MOCK_CURRENT_TIME, 2.25), duration: 1, state: 'Pumping Stopped' },
        { bay: 'Bay 1', eta: subHours(MOCK_CURRENT_TIME, 1), duration: 1, state: 'Pumping Started' },
        { bay: 'Bay 1', eta: addMinutes(MOCK_CURRENT_TIME, 15), duration: 0.75, state: 'Arrived' },
        { bay: 'Bay 1', eta: addHours(MOCK_CURRENT_TIME, 1.5), duration: 1, state: 'Planned' },
        { bay: 'Bay 1', eta: addHours(MOCK_CURRENT_TIME, 2.75), duration: 1.25, state: 'Planned' },
        { bay: 'Bay 1', eta: addHours(MOCK_CURRENT_TIME, 4.25), duration: 0.75, state: 'Planned' },

        // Bay 2 (Has hold from T+1h to T+3h)
        { bay: 'Bay 2', eta: subHours(MOCK_CURRENT_TIME, 3), duration: 1, state: 'Departed' },
        { bay: 'Bay 2', eta: subHours(MOCK_CURRENT_TIME, 1.75), duration: 1, state: 'Pumping Started' },
        { bay: 'Bay 2', eta: subMinutes(MOCK_CURRENT_TIME, 30), duration: 0.75, state: 'Arrived' },
        { bay: 'Bay 2', eta: addHours(MOCK_CURRENT_TIME, 3.25), duration: 1, state: 'Planned' }, // After hold
        { bay: 'Bay 2', eta: addHours(MOCK_CURRENT_TIME, 4.5), duration: 1, state: 'Planned' },

        // Bay 3
        { bay: 'Bay 3', eta: subHours(MOCK_CURRENT_TIME, 5), duration: 1.25, state: 'Departed' },
        { bay: 'Bay 3', eta: subHours(MOCK_CURRENT_TIME, 3.5), duration: 1, state: 'Pumping Stopped' },
        { bay: 'Bay 3', eta: subHours(MOCK_CURRENT_TIME, 2.25), duration: 1, state: 'On Bay' },
        { bay: 'Bay 3', eta: subMinutes(MOCK_CURRENT_TIME, 60), duration: 1, state: 'Ready / Approved' },
        { bay: 'Bay 3', eta: addMinutes(MOCK_CURRENT_TIME, 30), duration: 0.75, state: 'Planned' },
        { bay: 'Bay 3', eta: addHours(MOCK_CURRENT_TIME, 1.75), duration: 1, state: 'Planned' },
        { bay: 'Bay 3', eta: addHours(MOCK_CURRENT_TIME, 3), duration: 1, state: 'Planned' },
        
        // Bay 4 (Has hold from T+4h to T+5h)
        { bay: 'Bay 4', eta: subHours(MOCK_CURRENT_TIME, 2.5), duration: 1, state: 'Pumping Started' },
        { bay: 'Bay 4', eta: subHours(MOCK_CURRENT_TIME, 1.25), duration: 1, state: 'Directed to Bay' },
        { bay: 'Bay 4', eta: addMinutes(MOCK_CURRENT_TIME, 0), duration: 1, state: 'Planned' },
        { bay: 'Bay 4', eta: addHours(MOCK_CURRENT_TIME, 1.25), duration: 1, state: 'Planned' },
        { bay: 'Bay 4', eta: addHours(MOCK_CURRENT_TIME, 2.5), duration: 1, state: 'Planned' },
        { bay: 'Bay 4', eta: addHours(MOCK_CURRENT_TIME, 5.25), duration: 1, state: 'Planned' }, // After hold

        // ... and so on for other bays
        { bay: 'Bay 5', eta: subHours(MOCK_CURRENT_TIME, 0.5), duration: 1, state: 'Arrived' },
        { bay: 'Bay 6', eta: addMinutes(MOCK_CURRENT_TIME, 15), duration: 1, state: 'Planned' },
        { bay: 'Bay 7', eta: subMinutes(MOCK_CURRENT_TIME, 15), duration: 1, state: 'Ready / Approved' },
        { bay: 'Bay 8', eta: addHours(MOCK_CURRENT_TIME, 1), duration: 1, state: 'Planned' },
        { bay: 'Bay 9', eta: addHours(MOCK_CURRENT_TIME, 2), duration: 1, state: 'Planned' },
        { bay: 'Bay 10', eta: subHours(MOCK_CURRENT_TIME, 1.5), duration: 1, state: 'On Bay' },
        
        // NEW TRUCKS FOR RESCHEDULE PANEL
        { bay: 'Bay 5', eta: addHours(MOCK_CURRENT_TIME, 3), duration: 1, state: 'Planned', special: 'high-priority-reschedule' },
        { bay: 'Bay 6', eta: subMinutes(MOCK_CURRENT_TIME, 15), duration: 1, state: 'Planned' },
        { bay: 'Bay 7', eta: subMinutes(MOCK_CURRENT_TIME, 45), duration: 1, state: 'Planned', special: 'no-show' }, // Should be flagged as no-show
    ];
    
    let planIndex = 0;
    return ops.map((op, i) => {
        const validPlansForBay = bayToValidPlans[op.bay];
        if (!validPlansForBay || validPlansForBay.length === 0) return null;

        const plan = validPlansForBay[planIndex % validPlansForBay.length];
        planIndex++;

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
            plan: plan,
            infra: op.bay,
            targetSofEvent: op.state,
            special: op.special
        };
    }).filter(Boolean);
};


export const createMockOperations = (): Operation[] => {
    let operations: Operation[] = [];
    const emptyTruckSof: SOFItem[] = SOF_EVENTS_MODALITY['truck'].map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 }));
    
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

    // Vessel 2: "MV Titan" - Active, Wharf 2 (Pumping) - WITH 10 VALID TRANSFERS
    const vessel2_eta = subHours(MOCK_CURRENT_TIME, 4);
    let vessel2: Operation = {
        id: 'op-vessel-2', terminal: 'PAL', modality: 'vessel', status: 'planned', transportId: 'MV Titan', eta: vessel2_eta.toISOString(), durationHours: 18, queuePriority: vessel2_eta.getTime(),
        currentStatus: 'Scheduled', delay: { active: false }, orderNumber: 'ORD-54322',
        activityHistory: [{ time: subHours(vessel2_eta, 2).toISOString(), user: 'Planner', action: 'CREATE', details: 'New vessel operation plan created.' }],
        documents: [],
        sof: VESSEL_COMMON_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 })),
        transferPlan: [
            { infrastructureId: 'L14', transfers: [
                { id: 'op-vessel-2-L14-0', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '1P', to: 'J10', tonnes: 2000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [],
                  preTransferCleaningSof: LINE_CLEANING_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })) // Incompatible with Agri-Oil Prime
                },
                { id: 'op-vessel-2-L14-1', customer: 'Terra Verde Agriculture', product: 'Agri-Oil Prime', from: '2P', to: 'B47', tonnes: 4000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L14-2', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '3P', to: 'J11', tonnes: 5000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [],
                  preTransferCleaningSof: LINE_CLEANING_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })) // Incompatible with Agri-Oil Prime
                }
            ]},
            { infrastructureId: 'L23', transfers: [
                { id: 'op-vessel-2-L23-0', customer: 'Coastal Energy Supply', product: 'Diesel Max', from: '1S', to: 'C13', tonnes: 2500, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L23-1', customer: 'National Rail Freight', product: 'Diesel Max', from: '2S', to: 'C38', tonnes: 8000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L23-2', customer: 'Coastal Energy Supply', product: 'Crude Oil', from: '3S', to: 'D05', tonnes: 10000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }
            ]},
            { infrastructureId: 'L24', transfers: [
                { id: 'op-vessel-2-L24-0', customer: 'Apex Refining', product: 'Diesel Max', from: '4S', to: 'C38', tonnes: 5000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }
            ]},
            { infrastructureId: 'L25', transfers: [
                { id: 'op-vessel-2-L25-0', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '4P', to: 'J10', tonnes: 500, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L25-1', customer: 'Aviation Fuels Inc', product: 'Jet A-1', from: '5P', to: 'J11', tonnes: 2000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
                { id: 'op-vessel-2-L25-2', customer: 'Coastal Energy Supply', product: 'Crude Oil', from: '5S', to: 'D05', tonnes: 4000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] }
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
                { id: 'op-vessel-3-L34-0', customer: 'GlobalChem Industries', product: 'Methanol', from: '3P', to: 'E15', tonnes: 4000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
            ]},
            { infrastructureId: 'L31', transfers: [
                { id: 'op-vessel-3-L31-0', customer: 'Apex Refining', product: 'ULP 98', from: '2S', to: 'A01', tonnes: 10000, direction: 'Vessel to Tank', specialServices: [], sof: VESSEL_COMMODITY_EVENTS.map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferredTonnes: 0, slopsTransferredTonnes: 0, transferLog: [] },
            ]},
        ],
        specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    const { updatedSof: commonSof3, activityLogs: commonLogs3 } = progressSofArray(vessel3.sof!, VESSEL_COMMON_EVENTS, 'VESSEL ALONGSIDE', new Date(vessel3.eta), 'Ops Lead', 25);
    vessel3.sof = commonSof3; vessel3.activityHistory.push(...commonLogs3);
    const vessel3_new_statuses = deriveStatusFromSof(vessel3, true);
    if(vessel3_new_statuses) vessel3 = {...vessel3, ...vessel3_new_statuses};

    operations.push(vessel1, vessel2, vessel3);

    // --- RAIL OPERATION ---
    let railOp: Operation = {
        id: 'op-rail-1', terminal: 'PAL', modality: 'rail', status: 'planned', transportId: 'NRF 7891', eta: subHours(MOCK_CURRENT_TIME, 2).toISOString(), durationHours: 3, queuePriority: subHours(MOCK_CURRENT_TIME, 2).getTime(),
        currentStatus: 'Scheduled', orderNumber: 'RAIL-556',
        activityHistory: [{ time: subHours(MOCK_CURRENT_TIME, 3).toISOString(), user: 'Planner', action: 'CREATE', details: 'New rail operation plan created.' }],
        transferPlan: [{ infrastructureId: 'Siding B', transfers: [{ id: 'op-rail-1-Siding B-0', customer: 'National Rail Freight', product: 'Diesel Max', from: 'C38', to: 'NRF 7891', tonnes: 1500, transferredTonnes: 0, slopsTransferredTonnes: 0, direction: 'Tank to Rail', specialServices: [], sof: SOF_EVENTS_MODALITY['rail'].map(e => ({ event: e, status: 'pending', time: '', user: '', loop: 1 })), transferLog: [] }] }],
        delay: { active: false }, specialRequirements: [], lineWalks: [], samples: [], heatingLog: [], slopLog: [], dilutionLog: [], batchLog: [], dipSheetData: [],
    };
    const railTransfer = railOp.transferPlan[0].transfers[0];
    const { updatedSof: railSof, activityLogs: railLogs, lastTime: railPumpStartTime } = progressSofArray(railTransfer.sof!, SOF_EVENTS_MODALITY['rail'], 'Pumping Started', new Date(railOp.eta), 'Operator 1', 15, ` for ${railTransfer.product}`);
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
        } as any; // Cast to allow building up the object
        
        const etaDate = new Date(op.eta);
        const targetSofEvent = baseOp.targetSofEvent;

        if (targetSofEvent && targetSofEvent !== 'Planned') {
            const transfer = op.transferPlan[0].transfers[0];
            const { updatedSof, activityLogs, lastTime } = progressSofArray(transfer.sof!, SOF_EVENTS_MODALITY.truck, targetSofEvent, etaDate, i % 2 === 0 ? 'Operator 1' : 'Dispatch');
            transfer.sof = updatedSof;
            op.activityHistory.push(...activityLogs);

            // If arrived, complete the checklist for realism
            if (targetSofEvent !== 'Arrived' && targetSofEvent !== 'Planned') {
                op.arrivalChecklist = {
                    tiresOk: 'complete', leaksOk: 'complete', hosesOk: 'complete', safetySealsOk: 'complete',
                    bolReceived: 'complete', coaReceived: 'complete', driverLicenseOk: 'complete'
                };
            }

            if (targetSofEvent === 'Pumping Started') {
                const durationHours = (MOCK_CURRENT_TIME.getTime() - lastTime.getTime()) / 3600000;
                let transferred = durationHours * 100; // Rate: 100 T/hr
                
                if (transferred >= transfer.tonnes) transferred = transfer.tonnes * 0.99; // Don't auto-complete
                transfer.transferredTonnes = transferred;
            } else if (['Pumping Stopped', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Departed'].includes(targetSofEvent)) {
                transfer.transferredTonnes = transfer.tonnes;
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
