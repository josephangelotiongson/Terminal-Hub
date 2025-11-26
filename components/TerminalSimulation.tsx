import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Hold } from '../types';
import { formatInfraName, naturalSort, createDocklineToWharfMap, getOperationColorClass, getIcon } from '../utils/helpers';
import HoldModal from './HoldModal';

interface SimNode {
    id: string;
    type: 'wharf' | 'tank' | 'bay' | 'rail' | 'gate' | 'parking' | 'intermediate' | 'anchorage' | 'voyage';
    x: number;
    y: number;
    width?: number;
    height?: number;
    label: string;
    activeOps: Operation[];
    fillLevel?: number;
    activeHold?: Hold;
    upcomingHold?: Hold;
    group?: string;
}

interface SimLink {
    id: string;
    from: string;
    to: string;
    isActive: boolean;
    flowDirection: 'forward' | 'reverse';
    product?: string;
    opId?: string;
    potentialOpIds: string[]; // IDs of operations (including planned) that use this link
}

interface SimGroup {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    compatibility?: string;
}

interface TerminalSimulationProps {
    onNodeClick?: (nodeId: string, type: string) => void;
}

// --- ROUTING CONSTANTS (Adjusted for 2x Size) ---
const ZONES = {
    BAYS: 0,        
    TRUCK_HEADER: 1,
    TANK_COL_1: 2,  
    TANK_COL_2: 3,  
    MAIN_HEADER: 4, 
    WHARF: 5        
};

// Zones shifted right to account for wider columns
const getZone = (x: number) => {
    if (x < 700) return ZONES.BAYS; 
    if (x < 1500) return ZONES.TRUCK_HEADER; 
    if (x < 3000) return ZONES.TANK_COL_1; 
    if (x < 4600) return ZONES.TANK_COL_2; 
    if (x < 5000) return ZONES.MAIN_HEADER; 
    return ZONES.WHARF; 
};

// Horizontal Highways (Safe Y coordinates - Gaps between tank groups)
// Adjusted for larger groups (Height 800 + Gap 300, Start Y 200)
// Row 0: 200-1000. Row 1: 1300-2100. Row 2: 2400-3200
const Y_CHANNELS = [100, 1150, 2250, 3350]; 

const SimOpCard: React.FC<{ op: Operation, onClick: (e: React.MouseEvent) => void, style?: React.CSSProperties }> = ({ op, onClick, style }) => {
    const colorClass = getOperationColorClass(op);
    const isVessel = op.modality === 'vessel';
    const isIncoming = op.status === 'planned';
    
    // Determine displayed product (first one)
    const firstProduct = op.transferPlan?.[0]?.transfers?.[0]?.product || 'Multiple/Unknown';
    const displayId = isVessel ? op.transportId : op.licensePlate;
    
    const isLime = colorClass.includes('status-approved');
    const textColor = isLime ? 'text-slate-900' : 'text-white';
    const subTextColor = isLime ? 'text-slate-700' : 'text-white/90';
    const iconBg = isLime ? 'bg-black/10' : 'bg-black/20';
    const iconColor = isLime ? 'text-slate-800' : 'text-white/90';
    
    return (
        <div 
            onClick={onClick}
            className={`
                ${colorClass}
                ${isIncoming ? 'border-4 border-dashed border-slate-400 opacity-90' : 'border-2 border-white/20 shadow-2xl'}
                p-4 rounded-xl cursor-pointer 
                flex items-center gap-5
                w-[450px] h-[160px]
                transition-transform hover:scale-105 hover:z-50
                overflow-hidden relative
            `}
            style={style}
            title={`${op.transportId}\nStatus: ${op.currentStatus}\nProduct: ${firstProduct}`}
        >
            {/* Gloss effect */}
            <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
            
            <div className={`${iconBg} rounded-xl p-3 w-24 h-24 flex-shrink-0 flex items-center justify-center shadow-inner`}>
                <i className={`fas ${getIcon(op.modality)} ${iconColor} text-6xl`}></i>
            </div>
            <div className="flex flex-col leading-tight min-w-0 flex-grow gap-1">
                <span className={`font-bold truncate ${textColor} drop-shadow-sm text-4xl`}>{displayId}</span>
                <span className={`truncate text-xl ${subTextColor} font-bold uppercase tracking-wide`}>{op.currentStatus}</span>
                {isVessel && <span className={`truncate text-lg ${isLime ? 'text-slate-700' : 'text-white/80'} italic`}>{firstProduct}</span>}
            </div>
            {isIncoming && (
                <div className="absolute top-0 right-0 bg-yellow-300 text-yellow-900 text-sm font-bold px-3 py-1 rounded-bl border-l border-b border-yellow-400 shadow-sm">
                    INCOMING
                </div>
            )}
        </div>
    );
};

const TerminalSimulation: React.FC<TerminalSimulationProps> = ({ onNodeClick }) => {
    const context = useContext(AppContext);
    
    // Safe defaults
    const tanks = context?.tanks || {};
    const operations = context?.operations || [];
    const currentTerminalSettings = context?.currentTerminalSettings || { mapLayout: {}, masterTanks: {} };
    const switchView = context?.switchView || (() => {});
    const currentUser = context?.currentUser || { role: 'Operator' };
    const saveTerminalMapLayout = context?.saveTerminalMapLayout || (() => {});
    const holds = context?.holds || [];
    const simulatedTime = context?.simulatedTime || new Date();
    const saveHoldAndRequeueConflicts = context?.saveHoldAndRequeueConflicts || (() => {});
    const scadaData = context?.scadaData || {};

    
    const [viewState, setViewState] = useState({ x: 50, y: 50, k: 0.20 }); // Zoom out more by default for larger map
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [localNodePositions, setLocalNodePositions] = useState<{ [id: string]: { x: number; y: number } }>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isConfigMode, setIsConfigMode] = useState(false);
    const [selectedHold, setSelectedHold] = useState<Hold | null>(null);
    const [hoveredOpId, setHoveredOpId] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ x: number, y: number, content: any } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const isEngineering = currentUser.role === 'Engineering';

    useEffect(() => {
        if (currentTerminalSettings.mapLayout) {
            setLocalNodePositions(currentTerminalSettings.mapLayout);
        }
    }, [currentTerminalSettings.mapLayout]);

    const getHoldStatus = (resourceId: string) => {
        const resourceHolds = holds.filter(h => h.resource === resourceId && h.status === 'approved' && h.workOrderStatus !== 'Closed');
        const active = resourceHolds.find(h => new Date(h.startTime) <= simulatedTime && new Date(h.endTime) >= simulatedTime);
        const upcoming = resourceHolds.find(h => new Date(h.startTime) > simulatedTime);
        return { active, upcoming };
    };

    const handleResetLayout = () => {
        if (window.confirm("Reset layout to default? This will clear all custom positioning.")) {
            setLocalNodePositions({});
            saveTerminalMapLayout({});
            setHasUnsavedChanges(false);
            setIsConfigMode(false);
        }
    };

    // --- 1. Layout Calculation (Expanded for 2x Size) ---
    const { nodes, groups } = useMemo(() => {
        const nodeList: SimNode[] = [];
        const groupList: SimGroup[] = [];
        
        // Spread out columns significantly
        const COLS = {
            TRUCK_BAY: 100,
            GATE: 100,
            PARKING: 100,
            TRUCK_HEADER: 1000,
            TANKS_START: 1600,   
            MAIN_HEADER: 4600,  
            WHARF: 5400,
            ANCHORAGE: 6400, // New Far Right Zone
        };

        const getNodePosition = (id: string, defaultX: number, defaultY: number) => {
            if (localNodePositions[id]) return localNodePositions[id];
            return { x: defaultX, y: defaultY };
        };

        // --- TANKS (Center Block) ---
        const tankIds = Object.keys(tanks || {}).sort(naturalSort);
        const tanksByGroup: Record<string, string[]> = {};
        tankIds.forEach(tankId => {
            const groupName = tanks[tankId].group || 'Unassigned';
            if (!tanksByGroup[groupName]) tanksByGroup[groupName] = [];
            tanksByGroup[groupName].push(tankId);
        });

        const sortedGroupNames = Object.keys(tanksByGroup).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            return a.localeCompare(b);
        });

        // Larger Group Dimensions
        const GROUP_WIDTH = 1000; 
        const GROUP_HEIGHT = 800; 
        const GAP_X = 400; 
        const GAP_Y = 300;  
        const GROUPS_PER_ROW = 2;
        const START_Y = 200;

        sortedGroupNames.forEach((groupName, groupIndex) => {
            const groupTanks = tanksByGroup[groupName];
            const col = groupIndex % GROUPS_PER_ROW;
            const row = Math.floor(groupIndex / GROUPS_PER_ROW);
            
            const groupAbsX = COLS.TANKS_START + (col * (GROUP_WIDTH + GAP_X));
            const groupAbsY = START_Y + (row * (GROUP_HEIGHT + GAP_Y));

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            // Spacing for tanks inside the group
            const tankSpacingX = 380; 
            const tankSpacingY = 300;
            const tanksPerRow = 2;

            groupTanks.forEach((tankId, tIndex) => {
                const tCol = tIndex % tanksPerRow;
                const tRow = Math.floor(tIndex / tanksPerRow);
                
                const offsetX = (GROUP_WIDTH - (tanksPerRow * tankSpacingX)) / 2 + (tankSpacingX / 2) - 80;
                const offsetY = 160; // Header space increased

                const defaultX = groupAbsX + offsetX + (tCol * tankSpacingX);
                const defaultY = groupAbsY + offsetY + (tRow * tankSpacingY);
                
                const pos = getNodePosition(tankId, defaultX, defaultY);
                // Increased Tank Size
                const tankW = 160; 
                const tankH = 200;

                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + tankW);
                maxY = Math.max(maxY, pos.y + tankH);

                const tankData = tanks[tankId];
                const fill = tankData.capacity > 0 ? tankData.current / tankData.capacity : 0;
                const { active: activeHold, upcoming: upcomingHold } = getHoldStatus(tankId);

                nodeList.push({
                    id: tankId, type: 'tank', x: pos.x, y: pos.y,
                    label: tankId, fillLevel: fill, activeOps: [],
                    activeHold, upcomingHold, group: groupName,
                    width: tankW, height: tankH
                });
            });

            if (groupTanks.length > 0) {
                const compatibilitySet = new Set<string>();
                groupTanks.forEach(tId => { if (tanks[tId].productCompatibilityGroup) compatibilitySet.add(tanks[tId].productCompatibilityGroup!); });
                const compatibilityLabel = Array.from(compatibilitySet).sort().join(' / ');
                
                const P = 60;
                groupList.push({
                    id: `group-${groupName}`, label: groupName,
                    x: minX - P, y: minY - P - 80,
                    width: (maxX - minX) + (P * 2),
                    height: (maxY - minY) + (P * 2) + 80,
                    compatibility: compatibilityLabel
                });
            }
        });

        // --- WHARF (Right Side) ---
        const wharfMap = createDocklineToWharfMap(currentTerminalSettings);
        const uniqueWharfs = Array.from(new Set(Object.values(wharfMap))).sort();
        if (uniqueWharfs.length === 0) uniqueWharfs.push('Wharf 1');
        
        uniqueWharfs.forEach((wharf, index) => {
            // More vertical spacing for wharfs
            const pos = getNodePosition(wharf, COLS.WHARF, 350 + (index * 1000));
            const { active, upcoming } = getHoldStatus(wharf);
            nodeList.push({ 
                id: wharf, type: 'wharf', x: pos.x, y: pos.y, 
                label: wharf, activeOps: [], activeHold: active, upcomingHold: upcoming, 
                width: 200, height: 200 
            });
        });

        // --- INTERMEDIATES (Main Headers & Truck Headers) ---
        if (currentTerminalSettings.masterIntermediates) {
            currentTerminalSettings.masterIntermediates.forEach((intermediate, i) => {
                let defaultX = COLS.MAIN_HEADER;
                let defaultY = 300 + (i * 200); 

                if (intermediate.includes('Truck Header')) {
                    defaultX = COLS.TRUCK_HEADER;
                    if (intermediate.includes('North')) defaultY = 400;
                    else if (intermediate.includes('South')) defaultY = 2600;
                    else if (intermediate.includes('Central')) defaultY = 1500;
                } else if (intermediate.includes('Main Header')) {
                     defaultX = COLS.MAIN_HEADER;
                     if (intermediate.includes('North')) defaultY = 400;
                     else if (intermediate.includes('South')) defaultY = 2600;
                     else if (intermediate.includes('Central')) defaultY = 1500;
                } else if (intermediate.includes('Rail')) {
                    defaultX = COLS.WHARF; // Rail header near rail sidings
                    defaultY = 3200;
                }

                const pos = getNodePosition(intermediate, defaultX, defaultY);
                const { active, upcoming } = getHoldStatus(intermediate);
                nodeList.push({ 
                    id: intermediate, type: 'intermediate', x: pos.x, y: pos.y, 
                    label: intermediate, activeOps: [], width: 100, height: 100,
                    activeHold: active, upcomingHold: upcoming
                });
            });
        }

        // --- TRUCK BAYS (Left Side) ---
        const truckIds = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {}).filter(id => currentTerminalSettings.infrastructureModalityMapping[id] === 'truck').sort(naturalSort);
        truckIds.forEach((bayId, index) => {
            const colOffset = index > 9 ? 350 : 0;
            const rowIdx = index > 9 ? index - 10 : index;
            // Increased spacing between bays
            const pos = getNodePosition(bayId, COLS.TRUCK_BAY + colOffset, 200 + (rowIdx * 250));
            const { active, upcoming } = getHoldStatus(bayId);
            nodeList.push({ 
                id: bayId, type: 'bay', x: pos.x, y: pos.y, 
                label: formatInfraName(bayId), activeOps: [], activeHold: active, upcomingHold: upcoming, 
                width: 150, height: 150 
            });
        });

        // --- RAIL SIDINGS (Right Side - Below Wharf) ---
        const railIds = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {}).filter(id => currentTerminalSettings.infrastructureModalityMapping[id] === 'rail').sort(naturalSort);
        railIds.forEach((railId, index) => {
            const pos = getNodePosition(railId, COLS.WHARF, 3400 + (index * 350)); 
            const { active, upcoming } = getHoldStatus(railId);
            nodeList.push({ 
                id: railId, type: 'rail', x: pos.x, y: pos.y, 
                label: formatInfraName(railId), activeOps: [], activeHold: active, upcomingHold: upcoming, 
                width: 160, height: 160 
            });
        });

        // --- LOGISTICS (Gate/Parking) ---
        const gatePos = getNodePosition('Gate', 200, 4200);
        nodeList.push({ id: 'Gate', type: 'gate', x: gatePos.x, y: gatePos.y, width: 800, height: 800, label: 'Main Gate', activeOps: [] });
        
        const parkingPos = getNodePosition('Parking', 1200, 4200);
        nodeList.push({ id: 'Parking', type: 'parking', x: parkingPos.x, y: parkingPos.y, width: 800, height: 800, label: 'Parking', activeOps: [] });

        // --- VESSELS IN VOYAGE / ANCHORAGE (Far Right) ---
        const anchoragePos = getNodePosition('Anchorage', COLS.ANCHORAGE, 200);
        nodeList.push({ id: 'Anchorage', type: 'anchorage', x: anchoragePos.x, y: anchoragePos.y, width: 800, height: 1000, label: 'Anchorage (NOR Tendered)', activeOps: [] });

        const voyagePos = getNodePosition('Voyage', COLS.ANCHORAGE, 1500);
        nodeList.push({ id: 'Voyage', type: 'voyage', x: voyagePos.x, y: voyagePos.y, width: 800, height: 1000, label: 'In Voyage / Approaching', activeOps: [] });

        return { nodes: nodeList, groups: groupList };
    }, [tanks, currentTerminalSettings, localNodePositions, holds, simulatedTime]);


    // --- 2. Link Generation ---
    const links: SimLink[] = useMemo(() => {
        const generatedLinks: SimLink[] = [];
        const wharfMap = createDocklineToWharfMap(currentTerminalSettings);
        const segments = currentTerminalSettings.lineSegments || [];
        const lineups = currentTerminalSettings.lineups || [];
        
        const relevantOps = operations.filter(op => 
            op.status === 'active' || 
            (op.modality === 'vessel' && op.status === 'planned' && op.transferPlan[0]?.infrastructureId)
        );

        if (segments.length > 0) {
            segments.forEach(seg => {
                let source = seg.sourceId;
                let target = seg.targetId;
                if (source.startsWith('L') && wharfMap[source]) source = wharfMap[source];
                if (target.startsWith('L') && wharfMap[target]) target = wharfMap[target];
                
                if (nodes.some(n => n.id === source) && nodes.some(n => n.id === target)) {
                    generatedLinks.push({ id: seg.id, from: source, to: target, isActive: false, flowDirection: 'forward', potentialOpIds: [] });
                }
            });
        }

        relevantOps.forEach(op => {
            op.transferPlan.forEach(line => {
                line.transfers.forEach(transfer => {
                    let isPumping = false;
                    if (op.status === 'active') {
                        const sof = transfer.sof || [];
                        const startPump = op.modality === 'vessel' ? 'START PUMPING' : 'Pumping Started';
                        const stopPump = op.modality === 'vessel' ? 'STOP PUMPING' : 'Pumping Stopped';
                        isPumping = sof.some(s => s.event.includes(startPump) && s.status === 'complete') &&
                                    !sof.some(s => s.event.includes(stopPump) && s.status === 'complete');
                    }

                    let source = line.infrastructureId;
                    let dest = transfer.to;

                    if (op.modality === 'vessel') {
                        source = wharfMap[line.infrastructureId] || 'Wharf 1';
                        dest = transfer.direction.includes(' to Tank') ? transfer.to : transfer.from;
                        if (transfer.direction.includes('Tank to')) [source, dest] = [dest, source];
                    } else if (op.modality === 'truck' || op.modality === 'rail') {
                        if (transfer.direction.includes('Tank to')) {
                            source = transfer.from;
                            dest = line.infrastructureId;
                        } else {
                            source = line.infrastructureId;
                            dest = transfer.to;
                        }
                    }

                    const lineup = lineups.find(l => 
                        (l.sourceId === source && l.destinationId === dest) ||
                        (l.sourceId === dest && l.destinationId === source)
                    );

                    if (lineup && lineup.segmentIds) {
                        lineup.segmentIds.forEach(segId => {
                            const link = generatedLinks.find(l => l.id === segId);
                            if (link) {
                                link.potentialOpIds.push(op.id);
                                if (isPumping) {
                                    link.isActive = true;
                                    link.opId = op.id;
                                    link.product = transfer.product;
                                    link.flowDirection = lineup.sourceId === source ? 'forward' : 'reverse';
                                }
                            }
                        });
                    }
                });
            });
        });

        return generatedLinks;
    }, [nodes, operations, currentTerminalSettings]);


    // --- 3. Node Populating ---
    const nodesWithOps = useMemo(() => {
        const nodesCopy = JSON.parse(JSON.stringify(nodes)) as SimNode[];
        const wharfMap = createDocklineToWharfMap(currentTerminalSettings);

        // Include all ops for population, then filter for placement
        const relevantOps = operations.filter(op => 
            op.status === 'active' || 
            op.status === 'planned' // Include planned for Voyage/Anchorage
        );

        const connCounts: Record<string, number> = {};
        links.forEach(l => {
            connCounts[l.from] = (connCounts[l.from] || 0) + 1;
            connCounts[l.to] = (connCounts[l.to] || 0) + 1;
        });

        nodesCopy.forEach(n => {
            if (n.type === 'intermediate') {
                const c = connCounts[n.id] || 0;
                const s = Math.max(100, 80 + c * 10); // Larger intermediate nodes
                n.width = s; n.height = s;
            }
        });

        relevantOps.forEach(op => {
            let nodeId: string | null = null;
            if (op.modality === 'truck') {
                if (op.status === 'active') {
                    if (['Registered','Awaiting Approval','Awaiting Gate Approval'].includes(op.truckStatus || '')) nodeId = 'Gate';
                    else if (['Waiting','Waiting for Bay'].includes(op.truckStatus || '')) nodeId = 'Parking';
                    else if (op.transferPlan[0]?.infrastructureId) nodeId = op.transferPlan[0].infrastructureId;
                }
            } else if (op.modality === 'vessel') {
                if (op.status === 'active') {
                    const infra = op.transferPlan[0]?.infrastructureId;
                    nodeId = wharfMap[infra] || infra;
                } else if (op.status === 'planned') {
                    // Routing logic for incoming vessels
                    if (op.currentStatus === 'NOR Tendered') {
                        nodeId = 'Anchorage';
                    } else {
                        nodeId = 'Voyage';
                    }
                }
            } else if (op.modality === 'rail') {
                if (op.status === 'active') {
                    nodeId = op.transferPlan[0]?.infrastructureId;
                }
            }

            if (nodeId) {
                const n = nodesCopy.find(x => x.id === nodeId);
                if (n) n.activeOps.push(op);
            }
        });
        
        nodesCopy.forEach(n => {
            n.activeOps.sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (a.status !== 'active' && b.status === 'active') return 1;
                return new Date(a.eta).getTime() - new Date(b.eta).getTime();
            });
        });

        return nodesCopy;
    }, [nodes, links, operations, currentTerminalSettings]);


    // --- 4. Routing (Adjusted for Scale) ---
    const linksWithPaths = useMemo(() => {
        const getNearestYHighway = (y1: number, y2: number) => {
            const midY = (y1 + y2) / 2;
            return Y_CHANNELS.reduce((prev, curr) => Math.abs(curr - midY) < Math.abs(prev - midY) ? curr : prev);
        };

        const yChannelBuckets: Record<number, { linkId: string, sortKey: number }[]> = {};

        const calculateRoute = (link: SimLink) => {
            const src = nodesWithOps.find(n => n.id === link.from);
            const dst = nodesWithOps.find(n => n.id === link.to);
            if (!src || !dst) return null;

            const startZone = getZone(src.x);
            const endZone = getZone(dst.x);
            const zoneDiff = Math.abs(endZone - startZone);

            const startPt = { x: src.x + (src.width! / 2), y: src.y + (src.height! / 2) };
            const endPt = { x: dst.x + (dst.width! / 2), y: dst.y + (dst.height! / 2) };

            const isComplex = zoneDiff > 1 || src.type === 'tank' || dst.type === 'tank';

            if (!isComplex) {
                const xChannel = (startPt.x + endPt.x) / 2;
                return { 
                    type: 'simple', 
                    linkId: link.id, 
                    startPt, endPt, 
                    xChannel,
                    sortKey: (startPt.y + endPt.y) / 2 
                };
            } else {
                const yChannel = getNearestYHighway(startPt.y, endPt.y);
                
                const dropOffset = 100; // Larger drop offset
                const isMovingRight = dst.x > src.x;
                const drop1X = isMovingRight ? src.x + src.width! + dropOffset : src.x - dropOffset;
                const drop2X = isMovingRight ? dst.x - dropOffset : dst.x + dst.width! + dropOffset;

                return { 
                    type: 'complex', 
                    linkId: link.id, 
                    startPt, endPt,
                    drop1X, drop2X,
                    yChannel,
                    sortKey: Math.abs(startPt.x - endPt.x) 
                };
            }
        };

        const rawRoutes = links.map(calculateRoute).filter(Boolean) as any[];

        rawRoutes.forEach(route => {
            if (route.type === 'complex') {
                if (!yChannelBuckets[route.yChannel]) yChannelBuckets[route.yChannel] = [];
                yChannelBuckets[route.yChannel].push({ linkId: route.linkId, sortKey: route.sortKey });
            }
        });

        Object.values(yChannelBuckets).forEach(b => b.sort((a, b) => a.sortKey - b.sortKey));

        return links.map(link => {
            const route = rawRoutes.find(r => r.linkId === link.id);
            if (!route) return null;

            const LANE_WIDTH = 30; // Wider lanes
            const r = 40; // Larger corner radius
            let d = '';

            if (route.type === 'simple') {
                const cx = route.xChannel;
                const sx = route.startPt.x;
                const sy = route.startPt.y;
                const ex = route.endPt.x;
                const ey = route.endPt.y;

                const exitDir = cx > sx ? 1 : -1;
                const entryDir = ex > cx ? 1 : -1;
                
                d = `M ${sx} ${sy} L ${cx - r*exitDir} ${sy} Q ${cx} ${sy} ${cx} ${sy + r*(ey>sy?1:-1)} L ${cx} ${ey - r*(ey>sy?1:-1)} Q ${cx} ${ey} ${cx + r*entryDir} ${ey} L ${ex} ${ey}`;

            } else {
                const yOffset = (yChannelBuckets[route.yChannel] || []).findIndex(i => i.linkId === link.id) * LANE_WIDTH;
                const bucketSize = (yChannelBuckets[route.yChannel] || []).length;
                const centeredYOffset = yOffset - ((bucketSize - 1) * LANE_WIDTH / 2);

                const cy = route.yChannel + centeredYOffset;
                const sx = route.startPt.x, sy = route.startPt.y;
                const ex = route.endPt.x, ey = route.endPt.y;
                const drop1X = route.drop1X;
                const drop2X = route.drop2X;

                const dir1 = drop1X > sx ? 1 : -1;
                const dir2 = cy > sy ? 1 : -1;
                const dir3 = drop2X > drop1X ? 1 : -1;
                const dir4 = ey > cy ? 1 : -1;
                const dir5 = ex > drop2X ? 1 : -1;

                d = `M ${sx} ${sy} `;
                d += `L ${drop1X - r*dir1} ${sy} Q ${drop1X} ${sy} ${drop1X} ${sy + r*dir2} `;
                d += `L ${drop1X} ${cy - r*dir2} Q ${drop1X} ${cy} ${drop1X + r*dir3} ${cy} `;
                d += `L ${drop2X - r*dir3} ${cy} Q ${drop2X} ${cy} ${drop2X} ${cy + r*dir4} `;
                d += `L ${drop2X} ${ey - r*dir4} Q ${drop2X} ${ey} ${drop2X + r*dir5} ${ey} `;
                d += `L ${ex} ${ey}`;
            }

            return { ...link, d };
        });
    }, [links, nodesWithOps]);


    // --- Interaction Handlers ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const s = 0.05;
            const newK = e.deltaY < 0 ? Math.min(4, viewState.k + s) : Math.max(0.1, viewState.k - s);
            setViewState(p => ({ ...p, k: newK }));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'pan-surface') {
            setIsPanning(true);
            setLastMousePosition({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - lastMousePosition.x;
            const dy = e.clientY - lastMousePosition.y;
            setViewState(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            setLastMousePosition({ x: e.clientX, y: e.clientY });
        } else if (draggingNodeId) {
            const dx = (e.clientX - lastMousePosition.x) / viewState.k;
            const dy = (e.clientY - lastMousePosition.y) / viewState.k;
            setLocalNodePositions(prev => {
                const curr = prev[draggingNodeId] || nodes.find(n => n.id === draggingNodeId) || {x:0,y:0};
                return { ...prev, [draggingNodeId]: { x: curr.x + dx, y: curr.y + dy } };
            });
            setHasUnsavedChanges(true);
            setLastMousePosition({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => { setIsPanning(false); setDraggingNodeId(null); };

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isPanning, draggingNodeId, lastMousePosition]);

    if (!context) return null;

    // --- Render ---
    return (
        <div className="flex flex-col h-full bg-slate-50 text-slate-900 overflow-hidden relative" ref={containerRef}>
            {selectedHold && <HoldModal isOpen={!!selectedHold} onClose={() => setSelectedHold(null)} onSave={saveHoldAndRequeueConflicts} initialData={selectedHold} />}
            
            <div className="p-4 border-b border-border-primary flex justify-between items-center bg-white z-20 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-brand-dark flex items-center gap-2">
                        <i className={`fas fa-project-diagram ${isConfigMode ? 'text-yellow-600' : 'text-brand-primary'}`}></i>
                        {isConfigMode ? 'Configuration Mode' : 'Live Terminal Overview'}
                    </h2>
                    <p className="text-xs text-slate-500">
                        {isConfigMode ? "Drag assets to rearrange. Save to persist." : "Large Format Layout. Right-to-Left Flow: Wharf -> Tanks -> Bays."}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleResetLayout} className="btn-secondary !py-1 !px-3 !text-xs !bg-white !text-slate-600 hover:!bg-slate-100 border border-slate-300" title="Auto-Arrange / Reset"><i className="fas fa-magic mr-2"></i>Reset Layout</button>
                    {isEngineering && <button onClick={() => setIsConfigMode(!isConfigMode)} className={`btn-secondary !py-1 !px-3 !text-xs ${isConfigMode ? '!bg-yellow-100 !text-yellow-800 border-yellow-300' : ''}`}>{isConfigMode ? 'Exit Config' : 'Configure Layout'}</button>}
                    {hasUnsavedChanges && <button onClick={() => { saveTerminalMapLayout(localNodePositions); setHasUnsavedChanges(false); setIsConfigMode(false); }} className="btn-primary !py-1 !px-3 !text-xs animate-pulse"><i className="fas fa-save mr-2"></i>Save</button>}
                </div>
            </div>

            <div className={`flex-grow relative overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`} onMouseDown={handleMouseDown} onWheel={handleWheel}>
                <svg id="pan-surface" width="100%" height="100%" className="absolute inset-0">
                    <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <marker id="arrow-fwd" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L9,3 z" fill="#16a34a" />
                        </marker>
                         <marker id="arrow-rev" markerWidth="12" markerHeight="12" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M9,0 L9,6 L0,3 z" fill="#16a34a" />
                        </marker>
                        <marker id="arrow-fwd-active" markerWidth="12" markerHeight="12" refX="10" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L0,6 L9,3 z" fill="#ca8a04" />
                        </marker>
                         <marker id="arrow-rev-active" markerWidth="12" markerHeight="12" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M9,0 L9,6 L0,3 z" fill="#ca8a04" />
                        </marker>
                    </defs>

                    <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.k})`}>
                        {/* Groups */}
                        {groups.map(g => (
                            <g key={g.id} transform={`translate(${g.x}, ${g.y})`}>
                                <rect width={g.width} height={g.height} rx="24" fill="rgba(226, 232, 240, 0.2)" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="12,8" />
                                <text x="30" y="60" fill="#64748b" fontSize="48" fontWeight="bold" className="uppercase tracking-wider">{g.label}</text>
                                <text x="30" y="105" fill="#94a3b8" fontSize="36" fontWeight="normal">({g.compatibility})</text>
                            </g>
                        ))}

                        {/* Links */}
                        {linksWithPaths.map(link => {
                            if(!link) return null;
                            
                            const isPotential = hoveredOpId && link.potentialOpIds.includes(hoveredOpId);
                            const isFlowFocus = hoveredOpId ? (link.opId === hoveredOpId || isPotential) : true;
                            
                            const dim = !isFlowFocus;
                            
                            let color = "#94a3b8"; 
                            if (isPotential && !link.isActive) color = "#d97706"; 
                            else if (link.isActive && !isConfigMode) color = isFlowFocus && hoveredOpId ? "#d97706" : "#16a34a"; 
                            
                            // Increased line width
                            const width = (link.isActive || isPotential) && isFlowFocus && !isConfigMode ? 8 : 4;
                            const opacity = dim ? 0.1 : ((link.isActive || isPotential) ? 1 : 0.4);
                            
                            return (
                                <g key={link.id} 
                                   onMouseEnter={handleLinkHover} 
                                   onMouseMove={(e) => {
                                       if(tooltip) setTooltip(prev => prev ? ({...prev, x: e.clientX, y: e.clientY}) : null);
                                       else handleLinkHover(e);
                                   }}
                                   onMouseLeave={() => { setHoveredOpId(null); setTooltip(null); }}
                                   opacity={opacity} 
                                   style={{transition: 'opacity 0.2s'}}
                                >
                                    <path d={link.d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeDasharray={!link.isActive && isPotential ? "10,10" : "none"} />
                                    
                                    {link.isActive && !isConfigMode && !dim && (
                                        <path d={link.d} fill="none" stroke={hoveredOpId ? "#fbbf24" : "#86efac"} strokeWidth="6" strokeDasharray="30,30" strokeLinejoin="round" className={link.flowDirection === 'forward' ? 'animate-flow-fwd' : 'animate-flow-rev'}
                                            markerEnd={link.flowDirection === 'forward' ? (hoveredOpId ? "url(#arrow-fwd-active)" : "url(#arrow-fwd)") : ""}
                                            markerStart={link.flowDirection === 'reverse' ? (hoveredOpId ? "url(#arrow-rev-active)" : "url(#arrow-rev)") : ""}
                                        />
                                    )}
                                    
                                    <path d={link.d} fill="none" stroke="transparent" strokeWidth="50" style={{pointerEvents: 'stroke'}} />
                                </g>
                            );

                            function handleLinkHover(e: React.MouseEvent) {
                                 setHoveredOpId(link.opId || null);
                                 if (link.isActive && link.opId) {
                                     const op = operations.find(o => o.id === link.opId);
                                     if (op) {
                                         let transfer = null;
                                         let infraId = '';
                                         for (const line of op.transferPlan) {
                                             const t = line.transfers.find(tr => tr.product === link.product);
                                             if (t) {
                                                 transfer = t;
                                                 infraId = line.infrastructureId;
                                                 break;
                                             }
                                         }
                                         if (!transfer && op.transferPlan.length > 0) {
                                             transfer = op.transferPlan[0].transfers[0];
                                             infraId = op.transferPlan[0].infrastructureId;
                                         }
                            
                                         if (transfer) {
                                             const flow = scadaData[infraId]?.flowRate;
                                             setTooltip({
                                                 x: e.clientX,
                                                 y: e.clientY,
                                                 content: {
                                                     product: transfer.product,
                                                     customer: transfer.customer,
                                                     transportId: op.transportId,
                                                     flowRate: flow !== undefined ? flow.toFixed(0) : 'N/A',
                                                     source: transfer.from,
                                                     dest: transfer.to
                                                 }
                                             });
                                         }
                                     }
                                 }
                            }
                        })}

                        {/* Nodes */}
                        {nodesWithOps.map(node => {
                            const hasActive = node.activeOps.length > 0;
                            const isHighlighted = hoveredOpId ? node.activeOps.some(o => o.id === hoveredOpId) : true;
                            const dim = hoveredOpId && !isHighlighted;
                            
                            const handleNodeClick = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                if(isConfigMode) return;
                                
                                if (onNodeClick) {
                                    onNodeClick(node.id, node.type);
                                    return;
                                }
                                
                                if(node.activeOps.length && node.type !== 'gate' && node.type !== 'parking' && node.type !== 'anchorage' && node.type !== 'voyage') switchView('operation-details', node.activeOps[0].id);
                                else if(node.type === 'tank') switchView('tank-status-details', null, null, null, undefined, node.id);
                            };

                            let nodeStroke = isHighlighted && hasActive ? "#ca8a04" : "#94a3b8";
                            if (node.activeHold) nodeStroke = "#ef4444";
                            else if (node.upcomingHold) nodeStroke = "#f59e0b";
                            
                            const nodeFill = "#ffffff";
                            const labelFill = "#475569";
                            const strokeWidth = isHighlighted && hasActive ? 6 : 3;

                            return (
                                <g 
                                    key={node.id} 
                                    transform={`translate(${node.x}, ${node.y})`}
                                    opacity={dim ? 0.3 : 1}
                                    style={{ transition: 'opacity 0.2s', cursor: isConfigMode ? 'move' : (onNodeClick ? 'pointer' : (hasActive ? 'pointer' : 'default')) }}
                                    onMouseDown={(e) => { if(isConfigMode) { e.stopPropagation(); setDraggingNodeId(node.id); setLastMousePosition({x:e.clientX, y:e.clientY}); } }}
                                    onClick={handleNodeClick}
                                    onMouseEnter={() => setHoveredOpId(node.activeOps[0]?.id || null)}
                                    onMouseLeave={() => setHoveredOpId(null)}
                                >
                                    {/* Tank (Larger Text) */}
                                    {node.type === 'tank' && (
                                        <g>
                                            <rect width={node.width} height={node.height} rx="10" fill={nodeFill} stroke={nodeStroke} strokeWidth={strokeWidth} />
                                            {!isConfigMode && (
                                                <rect 
                                                    y={(node.height! * (1 - (node.fillLevel || 0)))} 
                                                    width={node.width} 
                                                    height={node.height! * (node.fillLevel || 0)} 
                                                    rx="8" 
                                                    fill={node.fillLevel! > 0.9 ? "#ef4444" : "#3b82f6"} 
                                                    opacity="0.6" 
                                                />
                                            )}
                                            <text x={node.width!/2} y={node.height!/2 + 20} textAnchor="middle" fill="#1e293b" fontSize="72" fontWeight="bold" style={{textShadow: '0px 0px 6px white'}}>{(node.fillLevel! * 100).toFixed(0)}%</text>
                                            <text x={node.width!/2} y={node.height! + 65} textAnchor="middle" fill={labelFill} fontSize="64" fontWeight="600">{node.label}</text>
                                        </g>
                                    )}

                                    {/* Bay/Wharf/Rail (Larger Text & Icons) */}
                                    {['bay', 'wharf', 'rail'].includes(node.type) && (
                                        <g>
                                            <circle r="60" cx={node.width!/2} cy={node.height!/2} fill="#f8fafc" stroke={nodeStroke} strokeWidth={strokeWidth} />
                                            <foreignObject x="0" y="0" width={node.width} height={node.height}>
                                                <div className={`w-full h-full flex items-center justify-center text-8xl ${hasActive ? 'text-green-600' : 'text-slate-400'}`}>
                                                    <i className={`fas ${node.type === 'wharf' ? 'fa-ship' : node.type === 'rail' ? 'fa-train' : 'fa-truck'}`}></i>
                                                </div>
                                            </foreignObject>
                                            <text x={node.width!/2} y={node.height! + 80} textAnchor="middle" fill={labelFill} fontSize="64" fontWeight="600">{node.label}</text>
                                            
                                            {/* Op Overlay on Nodes (Larger Cards) */}
                                            {node.activeOps.length > 0 && (
                                                (() => {
                                                    const CARD_W = 450;
                                                    const CARD_H = 160;
                                                    const GAP = 50;
                                                    let ox = node.width! + GAP;
                                                    
                                                    // Calculate stack height for centering vertically relative to node center
                                                    const stackHeight = (Math.min(node.activeOps.length, 2) * CARD_H) + ((Math.min(node.activeOps.length, 2) - 1) * 10); 
                                                    let oy = (node.height! / 2) - (stackHeight / 2);

                                                    if (node.type === 'bay') {
                                                        // Place card to the left
                                                        ox = -(CARD_W + GAP);
                                                    }
                                                    
                                                    return (
                                                        <foreignObject x={ox} y={oy} width={CARD_W} height={stackHeight + 20} style={{overflow: 'visible'}}>
                                                            <div className="flex flex-col gap-3">
                                                                {node.activeOps.slice(0, 2).map(op => (
                                                                    <SimOpCard 
                                                                        key={op.id}
                                                                        op={op} 
                                                                        onClick={(e) => { e.stopPropagation(); switchView('operation-details', op.id); }}
                                                                        style={{ boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </foreignObject>
                                                    );
                                                })()
                                            )}
                                        </g>
                                    )}

                                    {/* Manifolds (Larger Text) */}
                                    {node.type === 'intermediate' && (
                                        <g>
                                            <rect x={0} y={0} width={node.width} height={node.height} rx="10" transform={`rotate(45, ${node.width!/2}, ${node.height!/2})`} fill="#e2e8f0" stroke={nodeStroke} strokeWidth={strokeWidth} />
                                            <text x={node.width!/2} y={node.height! + 80} textAnchor="middle" fill={labelFill} fontSize="48">{node.label}</text>
                                        </g>
                                    )}

                                     {/* Gate/Parking/Anchorage/Voyage (Larger Text) */}
                                     {['gate', 'parking', 'anchorage', 'voyage'].includes(node.type) && (
                                        <g>
                                            <rect width={node.width} height={node.height} rx="16" fill="rgba(248, 250, 252, 0.9)" stroke="#cbd5e1" strokeDasharray="10,10" strokeWidth="2" />
                                            <text x={30} y={80} textAnchor="start" fill="#334155" fontSize="96" fontWeight="bold">{node.label} ({node.activeOps.length})</text>
                                            
                                            <foreignObject x="20" y="100" width={node.width! - 40} height={node.height! - 120}>
                                                <div className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-wrap content-start gap-4 custom-scrollbar pt-4">
                                                    {node.activeOps.map((op, i) => (
                                                        <SimOpCard 
                                                            key={op.id}
                                                            op={op}
                                                            onClick={(e) => { e.stopPropagation(); switchView('operation-details', op.id); }}
                                                        />
                                                    ))}
                                                    {node.activeOps.length === 0 && (
                                                        <div className="text-slate-400 text-2xl italic w-full text-center mt-12">Empty</div>
                                                    )}
                                                </div>
                                            </foreignObject>
                                        </g>
                                    )}

                                    {/* Hold Indicators (Scaled) */}
                                    {!isConfigMode && (
                                        <>
                                            {/* Active Hold */}
                                            {node.activeHold && (
                                                <g transform={`translate(${node.width!}, 0)`} onClick={(e) => { e.stopPropagation(); setSelectedHold(node.activeHold!); }} style={{cursor: 'pointer'}}>
                                                    <circle r="80" fill="#ef4444" stroke="white" strokeWidth="6" />
                                                    <foreignObject x="-80" y="-80" width="160" height="160">
                                                        <div className="w-full h-full flex items-center justify-center text-white text-8xl" title={`Active Outage:\n${node.activeHold.reason}\nUntil: ${new Date(node.activeHold.endTime).toLocaleString()}`}>
                                                            <i className="fas fa-wrench"></i>
                                                        </div>
                                                    </foreignObject>
                                                </g>
                                            )}
                                            
                                            {/* Upcoming Hold - Shift left if active exists */}
                                            {node.upcomingHold && (
                                                <g transform={`translate(${node.width! - (node.activeHold ? 180 : 0)}, 0)`} onClick={(e) => { e.stopPropagation(); setSelectedHold(node.upcomingHold!); }} style={{cursor: 'pointer'}}>
                                                    <circle r="80" fill="#f59e0b" stroke="white" strokeWidth="6" />
                                                    <foreignObject x="-80" y="-80" width="160" height="160">
                                                        <div className="w-full h-full flex items-center justify-center text-white text-8xl" title={`Upcoming Outage:\n${node.upcomingHold.reason}\nStart: ${new Date(node.upcomingHold.startTime).toLocaleString()}`}>
                                                            <i className="fas fa-clock"></i>
                                                        </div>
                                                    </foreignObject>
                                                </g>
                                            )}
                                        </>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                </svg>

                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md text-slate-600 text-sm px-5 py-3 rounded-full border border-slate-200 shadow-lg flex gap-6 pointer-events-none">
                    <span><i className="fas fa-mouse mr-2"></i> Scroll to Zoom / Drag to Pan</span>
                    <span><i className="fas fa-hand-pointer mr-2"></i> Hover to Trace Flow</span>
                    {isConfigMode && <span className="text-yellow-600 font-bold"><i className="fas fa-arrows-alt mr-2"></i> Drag Nodes to Move</span>}
                </div>
            </div>
            
            {tooltip && (
                <div 
                    style={{ top: tooltip.y + 20, left: tooltip.x + 20 }} 
                    className="fixed z-50 bg-white/95 text-slate-900 p-4 rounded-lg border border-slate-200 shadow-xl pointer-events-none backdrop-blur-sm min-w-[240px]"
                >
                    <div className="flex justify-between items-start mb-3 border-b border-slate-200 pb-2">
                        <span className="font-bold text-brand-primary text-base">{tooltip.content.product}</span>
                        {tooltip.content.flowRate !== 'N/A' && (
                             <span className="text-sm font-mono font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                                {tooltip.content.flowRate} T/hr
                            </span>
                        )}
                    </div>
                    <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Customer:</span>
                            <span className="font-medium text-right">{tooltip.content.customer}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-slate-500">Vessel/Truck:</span>
                            <span className="font-medium text-right">{tooltip.content.transportId}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-slate-500">Lineup:</span>
                            <span className="font-medium text-right text-slate-700">{tooltip.content.source} &rarr; {tooltip.content.dest}</span>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes flow-forward { from { stroke-dashoffset: 60; } to { stroke-dashoffset: 0; } } 
                @keyframes flow-reverse { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 60; } } 
                .animate-flow-fwd { animation: flow-forward 1s linear infinite; } 
                .animate-flow-rev { animation: flow-reverse 1s linear infinite; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
            `}</style>
        </div>
    );
};

export default TerminalSimulation;