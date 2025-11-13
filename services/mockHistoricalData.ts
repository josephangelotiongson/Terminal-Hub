
import { Operation, VesselCommonTimestamps, CommodityTimestamps, ActivityLogItem, SOFItem } from '../types';
import { VESSEL_COMMON_EVENTS, VESSEL_COMMODITY_EVENTS, MOCK_CURRENT_TIME } from '../constants';

// Helper to create a date in the past
const daysAgo = (days: number): Date => {
    const date = new Date(MOCK_CURRENT_TIME);
    date.setDate(date.getDate() - days);
    return date;
};

// Deterministic seeded random for historical data generation
const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const COMMON_EVENT_TO_TIMESTAMP_KEY: Record<string, keyof VesselCommonTimestamps> = {
    'START PREPARATIONS / CREW ONSITE': 'startPreparations',
    'CREW ARRIVE TO WHARF': 'crewArriveToWharf',
    'VESSEL ALONGSIDE': 'vesselAlongside',
    'VESSEL ALLFAST': 'vesselAllfast',
    'GANGWAY DOWN': 'gangwayDown',
    'SURVEYOR ONBOARD': 'surveyorOnboard',
    'SURVEYOR CHECKS COMPLETED': 'surveyorChecksCompleted',
    'LAST HOSE DISCONNECTED': 'lastHoseDisconnected',
    'CLEAN UP COMPLETION': 'cleanUpCompletion',
    'CREW COMPLETED / SITE SECURE': 'crewCompletedSiteSecure',
};

const COMMODITY_EVENT_TO_TIMESTAMP_KEY: Record<string, keyof CommodityTimestamps> = {
    'HOSE CONNECTED': 'hoseConnected',
    'HOSE LEAK CHECK / PRESSURE CHECK': 'hoseLeakCheck',
    'START PUMPING': 'startPumping',
    'LIQUID AT WHARF': 'liquidAtWharf',
    'LIQUID AT TERMINAL': 'liquidAtTerminal',
    'SLOPS SAMPLE PASSED / PRODUCT INTO TANK': 'slopsSamplePassed',
    'STOP PUMPING': 'stopPumping',
    'HOSES BLOWN': 'hosesBlown',
    'HOSES DISCONNECTED': 'hosesDisconnected',
    'PIG AWAY': 'pigAway',
    'PIG RECEIVED / COMMODITY COMPLETED': 'pigReceived',
};

// Helper to create only common vessel timestamps
const createVesselTimestamps = (startTime: Date, durationHours: number, seed: number): { common: VesselCommonTimestamps, lastCommonEventTime: Date, completedTime: Date } => {
    const completedTime = new Date(startTime.getTime() + durationHours * 3600 * 1000);
    // Allocate a portion of the total time to common events (e.g., 40% of total time for setup/teardown)
    const commonEventsDurationMs = (durationHours * 3600 * 1000) * 0.4;
    const stepDurationMs = commonEventsDurationMs / (VESSEL_COMMON_EVENTS.length > 0 ? VESSEL_COMMON_EVENTS.length : 1);

    let currentTime = startTime.getTime();
    const common: Partial<VesselCommonTimestamps> = {};

    VESSEL_COMMON_EVENTS.forEach((event, index) => {
        const key = COMMON_EVENT_TO_TIMESTAMP_KEY[event];
        if (key) {
            const randomStep = stepDurationMs * (0.8 + seededRandom(seed + index) * 0.4); 
            currentTime += randomStep;
            common[key] = new Date(currentTime).toISOString();
        }
    });

    // Ensure last event aligns closer to actual completion time for realism
    const lastEventKey = COMMON_EVENT_TO_TIMESTAMP_KEY[VESSEL_COMMON_EVENTS[VESSEL_COMMON_EVENTS.length - 1]];
    if (lastEventKey) {
        common[lastEventKey] = completedTime.toISOString();
    }


    return { common: common as VesselCommonTimestamps, lastCommonEventTime: new Date(currentTime), completedTime };
};

// Helper to create only commodity timestamps for a single transfer
const createCommodityTimestamps = (startTime: Date, durationHours: number, seed: number): { commodity: CommodityTimestamps, lastCommodityEventTime: Date } => {
    const stepDurationMs = (durationHours * 3600 * 1000) / (VESSEL_COMMODITY_EVENTS.length > 0 ? VESSEL_COMMODITY_EVENTS.length : 1);
    
    let currentTime = startTime.getTime();
    const commodity: Partial<CommodityTimestamps> = {};

    VESSEL_COMMODITY_EVENTS.forEach((event, index) => {
        const key = COMMODITY_EVENT_TO_TIMESTAMP_KEY[event];
        if (key) {
            const randomStep = stepDurationMs * (0.8 + seededRandom(seed + index) * 0.4);
            currentTime += randomStep;
            commodity[key] = new Date(currentTime).toISOString();
        }
    });

    return { commodity: commodity as CommodityTimestamps, lastCommodityEventTime: new Date(currentTime) };
};


export const createMockHistoricalOperations = (): Operation[] => {
    const historicalOps: Operation[] = [];
    
    const historicalVessels = [
        // FIX: Tonnes changed from 7500 to 4500. Tank E15 capacity is 5000.
        { name: "Stolt Strength", etaDaysAgo: 350, transfers: [{ customer: "GlobalChem Industries", product: "Methanol", tonnes: 4500, infra: "L12", from: "1C", to: "E15" }], financial: { labour: 18500, other: 550, invoicedDaysAfter: 5 }, notes: "Smooth operation." },
        { name: "Chemtrans Moon", etaDaysAgo: 342, transfers: [{ customer: "Coastal Energy Supply", product: "Crude Oil", tonnes: 45000, infra: "L23", from: "5P", to: "D05" }], financial: { labour: 88947, other: 2100, invoicedDaysAfter: 10 }, notes: "Minor delay due to weather." },
        { name: "Maritime Grace", etaDaysAgo: 330, transfers: [{ customer: "Apex Refining", product: "ULP 98", tonnes: 12000, infra: "L12", from: "3S", to: "A01" }], financial: { labour: 22500, other: 300, invoicedDaysAfter: 7 }, notes: "" },
        { name: "Navig8 Pride", etaDaysAgo: 320, transfers: [{ customer: "Terra Verde Agriculture", product: "Agri-Oil Prime", tonnes: 9500, infra: "L14", from: "2C", to: "B47" }], financial: { labour: 21000, other: 0, invoicedDaysAfter: 8 }, notes: "High viscosity, pumping rate slower." },
        { name: "Oceanic Liberty", etaDaysAgo: 311, transfers: [{ customer: "Aviation Fuels Inc", product: "Jet A-1", tonnes: 11000, infra: "L14", from: "4P", to: "J10" }], financial: { labour: 32000, other: 850, invoicedDaysAfter: 4 }, notes: "" },
        { name: "Golden Horizon", etaDaysAgo: 300, transfers: [{ customer: "Apex Refining", product: "Diesel Max", tonnes: 22000, infra: "L23", from: "1P", to: "C13" }], financial: { labour: 45000, other: 1200, invoicedDaysAfter: 12 }, notes: "Surveyor delay." },
        // FIX: Tonnes changed from 7000 to 4800. Tank E14 capacity is 5000.
        { name: "Stolt Inspiration", etaDaysAgo: 285, transfers: [{ customer: "GlobalChem Industries", product: "Indu-Chem X7", tonnes: 4800, infra: "L12", from: "5C", to: "E14" }], financial: { labour: 15000, other: 250, invoicedDaysAfter: 6 }, notes: "Requires special handling." },
        { name: "Bergen Star", etaDaysAgo: 270, transfers: [{ customer: "Apex Refining", product: "Petro-Fuel 95", tonnes: 18000, infra: "L12", from: "2S", to: "B46" }], financial: { labour: 38000, other: 400, invoicedDaysAfter: 9 }, notes: "" },
        { name: "Hafnia Future", etaDaysAgo: 255, transfers: [{ customer: "Terra Verde Agriculture", product: "Bio-Fuel E85", tonnes: 13000, infra: "L13", from: "3C", to: "A02" }], financial: { labour: 29000, other: 150, invoicedDaysAfter: 5 }, notes: "" },
        { name: "Maersk Progress", etaDaysAgo: 240, transfers: [{ customer: "Coastal Energy Supply", product: "Diesel Max", tonnes: 24000, infra: "L23", from: "4P", to: "C38" }], financial: { labour: 48000, other: 1800, invoicedDaysAfter: 11 }, notes: "" },
        { name: "Orient Innovation", etaDaysAgo: 220, transfers: [{ customer: "Apex Refining", product: "ULP 98", tonnes: 14000, infra: "L12", from: "1S", to: "A02" }], financial: { labour: 31000, other: 600, invoicedDaysAfter: 7 }, notes: "Quick turnaround." },
        { name: "Torm Strength", etaDaysAgo: 200, transfers: [{ customer: "Aviation Fuels Inc", product: "Jet A-1", tonnes: 10500, infra: "L14", from: "3P", to: "J11" }], financial: { labour: 30000, other: 750, invoicedDaysAfter: 5 }, notes: "" },
        { name: "Silver Iris", etaDaysAgo: 180, transfers: [{ customer: "GlobalChem Industries", product: "Methanol", tonnes: 4500, infra: "L12", from: "2C", to: "E15" }], financial: { labour: 17500, other: 450, invoicedDaysAfter: 8 }, notes: "" },
        { name: "Nordic Voyager", etaDaysAgo: 165, transfers: [{ customer: "Apex Refining", product: "Diesel Max", tonnes: 21500, infra: "L23", from: "5S", to: "C13" }], financial: { labour: 44000, other: 1100, invoicedDaysAfter: 10 }, notes: "Bunkering operation alongside." },
        { name: "Stolt Confidence", etaDaysAgo: 150, transfers: [{ customer: "Riverton Chemicals", product: "Caustic Soda", tonnes: 4900, infra: "L12", from: "4C", to: "E14" }], financial: { labour: 15500, other: 300, invoicedDaysAfter: 6 }, notes: "" },
        { name: "CMA CGM Symi", etaDaysAgo: 142, transfers: [{ customer: "Apex Refining", product: "Petro-Fuel 95", tonnes: 18000, infra: "L12", from: "1S", to: "B45" }], financial: { labour: 52000, other: 1800, invoicedDaysAfter: 15 }, notes: "" },
        { name: "Eagle Victoria", etaDaysAgo: 135, transfers: [{ customer: "Terra Verde Agriculture", product: "Agri-Oil Prime", tonnes: 9800, infra: "L14", from: "1C", to: "B47" }], financial: { labour: 21500, other: 100, invoicedDaysAfter: 9 }, notes: "" },
        { name: "BW Kyoto", etaDaysAgo: 120, transfers: [{ customer: "Coastal Energy Supply", product: "Crude Oil", tonnes: 48000, infra: "L23", from: "2P", to: "D05" }], financial: { labour: 92000, other: 2500, invoicedDaysAfter: 14 }, notes: "Extended pumping time." },
        { name: "Ardmore Seafarer", etaDaysAgo: 100, transfers: [{ customer: "Apex Refining", product: "Petro-Fuel 95", tonnes: 19000, infra: "L12", from: "3S", to: "B45" }], financial: { labour: 40000, other: 500, invoicedDaysAfter: 7 }, notes: "" },
        { name: "Ever Ace", etaDaysAgo: 90, transfers: [{ customer: "GlobalChem Industries", product: "Indu-Chem X7", tonnes: 4500, infra: "L12", from: "2C", to: "E14" }], financial: { labour: 14000, other: 200, invoicedDaysAfter: 8 }, notes: "Specialized handling required." },
        { name: "MV Titan", etaDaysAgo: 75, transfers: [
            { customer: "Apex Refining", product: "Petro-Fuel 95", tonnes: 5000, infra: "L12", from: "1S", to: "B45" },
            { customer: "Apex Refining", product: "ULP 98", tonnes: 3000, infra: "L12", from: "2S", to: "A01" },
            { customer: "Terra Verde Agriculture", product: "Agri-Oil Prime", tonnes: 2500, infra: "L13", from: "1P", to: "B47" },
            { customer: "GlobalChem Industries", product: "Methanol", tonnes: 1500, infra: "L13", from: "2P", to: "E15" },
            { customer: "Coastal Energy Supply", product: "Diesel Max", tonnes: 7000, infra: "L14", from: "3S", to: "C13" },
            { customer: "Aviation Fuels Inc", product: "Jet A-1", tonnes: 6000, infra: "L14", from: "4S", to: "J10" },
            { customer: "Apex Refining", product: "Diesel Max", tonnes: 4000, infra: "L23", from: "1P", to: "C38" },
            { customer: "GlobalChem Industries", product: "Indu-Chem X7", tonnes: 2000, infra: "L23", from: "2P", to: "E14" },
            { customer: "Riverton Chemicals", product: "Caustic Soda", tonnes: 1500, infra: "L12", from: "5S", to: "E14" },
            { customer: "Terra Verde Agriculture", product: "Bio-Fuel E85", tonnes: 5500, infra: "L13", from: "3P", to: "A02" },
        ], financial: { labour: 150000, other: 5000, invoicedDaysAfter: 20 }, notes: "Complex multi-product discharge." },
        { name: "FSL Singapore", etaDaysAgo: 80, transfers: [{ customer: "GlobalChem Industries", product: "Methanol", tonnes: 4800, infra: "L12", from: "5C", to: "E15" }], financial: { labour: 18000, other: 480, invoicedDaysAfter: 8 }, notes: "" },
        { name: "Maersk Pelican", etaDaysAgo: 60, transfers: [{ customer: "Aviation Fuels Inc", product: "Jet A-1", tonnes: 11500, infra: "L14", from: "2P", to: "J10" }], financial: { labour: 33000, other: 900, invoicedDaysAfter: 5 }, notes: "" },
        { name: "Stolt Yuri", etaDaysAgo: 45, transfers: [{ customer: "GlobalChem Industries", product: "Methanol", tonnes: 4800, infra: "L12", from: "4C", to: "E15" }], financial: { labour: 19500, other: 350, invoicedDaysAfter: 7 }, notes: "Incorrect paperwork, resolved." },
        { name: "Chemstar Iris", etaDaysAgo: 30, transfers: [{ customer: "Terra Verde Agriculture", product: "Agri-Oil Prime", tonnes: 9200, infra: "L14", from: "3C", to: "B47" }], financial: { labour: 20500, other: 120, invoicedDaysAfter: 9 }, notes: "" },
        { name: "Maritime Unity", etaDaysAgo: 15, transfers: [{ customer: "Apex Refining", product: "Diesel Max", tonnes: 23000, infra: "L23", from: "2S", to: "C38" }], financial: { labour: 46500, other: 1500, invoicedDaysAfter: 10 }, notes: "" },
    ];

    historicalVessels.forEach((v, index) => {
        const eta = daysAgo(v.etaDaysAgo);
        const totalTonnes = v.transfers.reduce((sum, t) => sum + t.tonnes, 0);
        const durationHours = 10 + (totalTonnes / 10000);
        const seed = index * 123; // Deterministic seed
        
        const { common: commonTimestamps, completedTime, lastCommonEventTime } = createVesselTimestamps(eta, durationHours, seed);
        const invoicedDate = new Date(completedTime);
        invoicedDate.setDate(invoicedDate.getDate() + v.financial.invoicedDaysAfter);

        const users = ['Ops Lead', 'Operator 1', 'Operator 2'];
        
        const commonSof = VESSEL_COMMON_EVENTS.map((event, i) => {
            const key = COMMON_EVENT_TO_TIMESTAMP_KEY[event];
            // Deterministic user selection
            const userIndex = Math.floor(seededRandom(seed + i) * users.length);
            return { event, status: 'complete', time: commonTimestamps[key] || '', user: users[userIndex], loop: 1 } as SOFItem;
        });
        
        const creationLogTime = new Date(eta.getTime() - 24 * 3600 * 1000).toISOString();
        const activityHistory: ActivityLogItem[] = [
            { time: creationLogTime, user: 'Terminal Planner', action: 'CREATE', details: `Historical operation plan created for ${v.name}.` },
            { time: eta.toISOString(), user: 'Ops Lead', action: 'STATUS_UPDATE', details: 'Operation has been activated.' },
            ...commonSof.map(s => ({ time: s.time, user: s.user, action: 'SOF_UPDATE', details: `${s.event} marked complete.`})),
        ];

        const transfersByInfra = v.transfers.reduce((acc, transfer) => {
            if (!acc[transfer.infra]) acc[transfer.infra] = [];
            acc[transfer.infra].push(transfer);
            return acc;
        }, {} as Record<string, typeof v.transfers>);

        const transferPlan = Object.entries(transfersByInfra).map(([infraId, transfers]) => {
            let lastCommodityTime = new Date(commonTimestamps.surveyorChecksCompleted || lastCommonEventTime);

            const processedTransfers = transfers.map((t, tIndex) => {
                const commodityDurationHours = t.tonnes / 2500; // rough estimate
                const transferSeed = seed + tIndex;
                const { commodity: commodityTimestamps, lastCommodityEventTime } = createCommodityTimestamps(lastCommodityTime, commodityDurationHours, transferSeed);
                
                const commoditySof = VESSEL_COMMODITY_EVENTS.map((event, i) => {
                    const key = COMMODITY_EVENT_TO_TIMESTAMP_KEY[event];
                    // Deterministic user
                    const userIndex = Math.floor(seededRandom(transferSeed + i) * users.length);
                    return { event, status: 'complete', time: commodityTimestamps[key] || '', user: users[userIndex], loop: 1 } as SOFItem;
                });
                
                const commodityActivityLogs = commoditySof.map(s => ({ time: s.time, user: s.user, action: 'SOF_UPDATE', details: `${s.event} marked complete for ${t.product}.` }));
                activityHistory.push(...commodityActivityLogs);
                lastCommodityTime = lastCommodityEventTime;

                const transferLog: ActivityLogItem[] = [
                    { time: creationLogTime, user: 'Terminal Planner', action: 'CREATE', details: 'Transfer plan created.' },
                    ...commodityActivityLogs.map(l => ({...l, details: l.details.replace(` for ${t.product}`, '')}))
                ];

                return {
                    id: `hist-vessel-${index + 1}-${infraId}-${tIndex}`,
                    customer: t.customer,
                    product: t.product,
                    from: t.from,
                    to: t.to,
                    tonnes: t.tonnes,
                    direction: 'Vessel to Tank',
                    specialServices: [],
                    // Deterministic small variance
                    transferredTonnes: t.tonnes * (1 + (seededRandom(transferSeed) - 0.5) * 0.002), 
                    slopsTransferredTonnes: 0,
                    sof: commoditySof,
                    commodityTimestamps,
                    productNote: tIndex === 0 ? v.notes : '', // Add note only to the first transfer of the vessel
                    transferLog,
                };
            });

            return {
                infrastructureId: infraId,
                transfers: processedTransfers,
            };
        });
        
        activityHistory.sort((a, b) => new Date(a.time).getTime() - new Date(a.time).getTime());
        activityHistory.push({ time: completedTime.toISOString(), user: 'System', action: 'STATUS_UPDATE', details: 'Operation completed.' });


        const op: Operation = {
            id: `hist-vessel-${index + 1}`,
            isHistorical: true,
            terminal: 'PAL',
            modality: 'vessel',
            status: 'completed',
            transportId: v.name,
            eta: eta.toISOString(),
            completedTime: completedTime.toISOString(),
            queuePriority: eta.getTime(),
            currentStatus: 'Completed',
            activityHistory,
            documents: [],
            transferPlan,
            sof: commonSof,
            vesselCommonTimestamps: commonTimestamps,
            labourRecovery: v.financial.labour,
            otherRecoveries: v.financial.other,
            dateInvoiced: invoicedDate.toISOString().split('T')[0],
            delay: { active: false },
            specialRequirements: [],
            lineWalks: [],
            samples: [],
            heatingLog: [],
            slopLog: [],
            dilutionLog: [],
            batchLog: [],
            dipSheetData: [],
        };

        historicalOps.push(op);
    });

    return historicalOps;
};
