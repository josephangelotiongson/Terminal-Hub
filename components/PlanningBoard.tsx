






import React, { useContext, useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Hold, Modality, View, SOFItem, TerminalSettings, User, Transfer } from '../types';
import HoldModal from './HoldModal';
import PlanningList from './PlanningList'; // <-- Import new component
import InputModal from './InputModal';
import { formatInfraName, calculateOperationValue, formatCurrency, validateOperationPlan, getOperationDurationHours, getOperationColorClass, naturalSort, createDocklineToWharfMap, canCreateHold, canReschedule, getIcon, canCreateOperation, formatDateTime, calculateActualDuration, getEarliestSofTimestamp, getVesselTransferColorClass, getVesselTransferStatus } from '../utils/helpers';
import PlanningKanban from './PlanningKanban';
import ElapsedTimeBadge from './ElapsedTimeBadge';
import NoShowModal from './NoShowModal';
import ToRescheduleModal from './ToRescheduleModal';
import PlanningCalendar from './PlanningCalendar';

const HOUR_WIDTH_PX = 96;
const RESOURCE_COL_WIDTH_PX = 140;
const TIME_HEADER_HEIGHT_PX = 40;
const SUB_ROW_HEIGHT_PX = 70; // Increased to 70 to fit extra details
const DAYS_BUFFER = 3; // Yesterday, Today, Tomorrow

const timeToPosition = (time: Date, gridStartDate: Date) => {
    const startOfGrid = new Date(gridStartDate);
    startOfGrid.setHours(0, 0, 0, 0);
    const diffMs = time.getTime() - startOfGrid.getTime();
    return (diffMs / (60 * 60 * 1000)) * HOUR_WIDTH_PX;
};

const positionToTime = (posX: number, gridStartDate: Date) => {
    const startOfGrid = new Date(gridStartDate);
    startOfGrid.setHours(0, 0, 0, 0);
    const totalMs = (posX / HOUR_WIDTH_PX) * (60 * 60 * 1000);
    return new Date(startOfGrid.getTime() + totalMs);
};

const legendItems = [
    { label: 'Planned / Scheduled', colorClass: 'status-planned' },
    { label: 'Arrived', colorClass: 'status-arrived' },
    { label: 'Approved', colorClass: 'status-approved' },
    { label: 'Product Transfer', colorClass: 'status-loading' },
    { label: 'Completing / Finals', colorClass: 'status-completing' },
    { label: 'Completed / Departed', colorClass: 'status-departed' },
    { label: 'Issue / Reschedule', colorClass: 'status-rejected' },
];

interface MemoizedGridItemProps {
    op: Operation;
    transfer?: Transfer; // Optional for vessel transfers
    top: number;
    height: number;
    left: number;
    width: number;
    title: string;
    validation: { isValid: boolean; issues: string[] };
    onCardClick: (opId: string) => void;
    zIndex?: number;
    isReadOnly?: boolean;
    isSchedulerMode: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, op: Operation) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    isDragging: boolean;
    truckDisplay: 'customer' | 'plate';
    currentUser: User;
    currentTime: Date;
    activeStartTime?: number; // New prop for actual start time
}

const MemoizedGridItem = React.memo((props: MemoizedGridItemProps) => {
    const { op, transfer, top, height, left, width, title, validation, onCardClick, zIndex, isReadOnly, isSchedulerMode, onDragStart, onDragEnd, isDragging, truckDisplay, currentUser, currentTime, activeStartTime } = props;
    
    const hasIssues = !validation.isValid;
    const needsReschedule = op.currentStatus === 'Reschedule Required' || op.currentStatus === 'No Show' || op.currentStatus === 'Reschedule Requested';
    
    // Determine pumping state
    const isTruckPumping = op.modality === 'truck' && ['Loading', 'Pumping'].includes(op.truckStatus || '');
    const isTruckOnBay = op.modality === 'truck' && op.truckStatus === 'On Bay';
    
    // Check if THIS specific vessel transfer is pumping
    const isVesselPumping = op.modality === 'vessel' && transfer && (() => {
        const sof = transfer.sof || [];
        const hasStarted = sof.some(s => s.event.includes('START PUMPING') && s.status === 'complete');
        const hasStopped = sof.some(s => s.event.includes('STOP PUMPING') && s.status === 'complete');
        return hasStarted && !hasStopped;
    })();
    
    let colorClass = '';
    let progressPercentage = 0;

    const isLightBackground = isTruckPumping || isTruckOnBay || isVesselPumping;

    if (isLightBackground) {
        // Custom styling logic for pumping/active transfers: White with Green Border
        colorClass = 'bg-white border-2 border-green-600 !overflow-visible'; 
        
        if (isTruckPumping || isVesselPumping) {
            // Time-based progress calculation
            const startTime = activeStartTime || new Date(op.eta).getTime();
            
            let durationMs = 0;
            if (isTruckPumping) {
                durationMs = (op.durationHours || 1) * 3600 * 1000;
            } else if (isVesselPumping && transfer) {
                const PUMP_RATE_TPH = 1000;
                const durationHours = (transfer.tonnes || 0) / PUMP_RATE_TPH;
                durationMs = durationHours * 3600 * 1000;
            }

            const elapsedMs = currentTime.getTime() - startTime;
            
            // Calculate percentage based on time elapsed vs planned duration
            if (durationMs > 0) {
                progressPercentage = (elapsedMs / durationMs) * 100;
            }
            progressPercentage = Math.max(0, progressPercentage);
        }
    } else {
        if (hasIssues && (op.status === 'planned' || op.status === 'active')) {
            colorClass = 'status-rejected';
        } else {
            // Use specific transfer color for vessels if available
            if (op.modality === 'vessel' && transfer) {
                colorClass = getVesselTransferColorClass(transfer);
            } else {
                colorClass = getOperationColorClass(op);
            }
        }
    }

    const showRescheduleIndicator = needsReschedule || (hasIssues && op.status === 'planned');
    const isUrgentReschedule = op.currentStatus === 'No Show' || (op.requeueDetails?.priority === 'high');

    // Calculate time since arrival at bay (different from wait time)
    const atBayStart = useMemo(() => {
        if (op.modality !== 'truck') return null;
        
        // If status implies physically at bay
        const AT_BAY_STATUSES = ['On Bay', 'Loading', 'Pumping', 'Pumping Stopped', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Completing'];
        if (AT_BAY_STATUSES.includes(op.truckStatus || '') || AT_BAY_STATUSES.includes(op.currentStatus)) {
             const transfer = op.transferPlan?.[0]?.transfers?.[0];
             // Look for 'On Bay' event
             const onBayEvent = (transfer?.sof || []).find(s => s.event.includes('On Bay') && s.status === 'complete');
             return onBayEvent ? onBayEvent.time : null;
        }
        return null;
    }, [op]);

    // Calculate wait time (before bay)
    const waitTimeStart = useMemo(() => {
        // If we are already at the bay, we show the At Bay time instead
        if (atBayStart) return null;

        const findLatestSofEvent = (eventName: string): SOFItem | null => {
            const allSof = [
                ...(op.sof || []),
                ...op.transferPlan.flatMap(tp => tp.transfers.flatMap(t => t.sof || []))
            ];
            const events = allSof
                .filter(s => s.status === 'complete' && s.time && s.event.includes(eventName))
                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            return events.length > 0 ? events[0] : null;
        };
        
        if (op.truckStatus === 'Waiting') {
            const readyEvent = findLatestSofEvent('Ready / Approved');
            return readyEvent ? readyEvent.time : null;
        }

        if (op.truckStatus === 'Registered') {
            const arrivedEvent = findLatestSofEvent('Arrived');
            return arrivedEvent ? arrivedEvent.time : null;
        }

        return null;
    }, [op, atBayStart]);
    
    const handleClick = () => {
        if (!isReadOnly) {
            onCardClick(op.id);
        }
    };

    const isDraggable = !isReadOnly && isSchedulerMode && canReschedule(currentUser) && op.status === 'planned';
    
    const getCardLabel = () => {
        if (transfer) {
            return transfer.product;
        }
        if (op.modality === 'truck') {
            const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
            return truckDisplay === 'plate' ? op.licensePlate : firstTransfer?.customer || 'N/A';
        }
        return op.transportId;
    };
    const cardLabel = getCardLabel();
    
    const statusText = useMemo(() => {
        if (op.modality === 'vessel' && transfer) {
            return getVesselTransferStatus(transfer);
        }
        return op.currentStatus;
    }, [op, transfer]);

    // Calculate text color based on background
    const textColorClass = isLightBackground ? 'text-gray-900' : 'text-white';
    
    return (
        <div 
            title={title} 
            draggable={isDraggable}
            onDragStart={isDraggable ? (e) => onDragStart(e, op) : undefined}
            onDragEnd={isDraggable ? onDragEnd : undefined}
            className={`planning-grid-item ${colorClass} !p-1.5 flex flex-col justify-center ${isReadOnly ? '!cursor-default' : ''} ${isDraggable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-30' : ''}`} 
            style={{ top, height, left, width: width, zIndex }} 
            onClick={handleClick}
        >
            {/* Horizontal Progress Bar for Pumping Ops */}
            {(isTruckPumping || isVesselPumping) && (
                <div 
                    className="absolute top-0 left-0 h-full bg-green-400/50 transition-all duration-1000 ease-linear pointer-events-none"
                    style={{ 
                        width: `${progressPercentage}%`, 
                        zIndex: 0,
                        borderRight: progressPercentage > 100 ? '2px solid #dc2626' : 'none' // Red indicator if over time
                    }}
                ></div>
            )}

            {/* Content Wrapper (z-index to sit above progress bar) */}
            <div className={`relative z-10 w-full ${textColorClass} flex flex-col h-full justify-between py-0.5`}>
                {/* Line 1: Name/License Plate */}
                <div className="flex items-center w-full leading-tight">
                    <span className="truncate font-bold text-sm">{cardLabel}</span>
                </div>

                {/* Vessel Specific Details */}
                {transfer && op.modality === 'vessel' && (
                    <div className="flex items-center w-full leading-tight text-[10px] opacity-90 gap-1 overflow-hidden my-0.5">
                        <span className="truncate font-semibold max-w-[50%]" title={transfer.customer}>{transfer.customer}</span>
                        <span className="opacity-70">•</span>
                        <span className="truncate font-mono" title={`${transfer.from} -> ${transfer.to}`}>
                            {transfer.from}&rarr;{transfer.to}
                        </span>
                    </div>
                )}

                {/* Line 2: Icon, Status */}
                <div className="flex items-center w-full text-[11px] opacity-90 gap-1 leading-tight">
                    <i className={`fas ${getIcon(op.modality)} flex-shrink-0 w-3 text-center`}></i>
                    <span className="truncate">
                        {statusText} 
                    </span>
                </div>

                {/* Line 3: Others (Elapsed, Alerts, etc.) */}
                <div className="flex items-center w-full gap-1 mt-0.5 h-4">
                    {waitTimeStart && (
                        <ElapsedTimeBadge startTime={waitTimeStart} className="!text-white !bg-black/40 !text-[10px] !px-1 !py-0" />
                    )}
                    {atBayStart && (
                         <ElapsedTimeBadge 
                            startTime={atBayStart} 
                            className={`!text-[10px] !px-1 !py-0 font-mono ${isLightBackground ? '!bg-green-700 !text-white' : '!bg-white/30 !text-white'}`} 
                            prefix="At Bay: "
                        />
                    )}
                    <div className="ml-auto flex items-center gap-1">
                        {hasIssues && (
                            <div className={`${isLightBackground ? 'text-red-600' : 'text-white'} text-xs`} title={`Plan has issues: ${validation.issues.join(', ')}`}>
                                <i className="fas fa-exclamation-triangle animate-pulse"></i>
                            </div>
                        )}
                        {op.currentStatus === 'No Show' && (
                            <div className="text-white text-[0.6rem] font-bold bg-red-800/80 px-1 rounded-sm">NO SHOW</div>
                        )}
                        {showRescheduleIndicator && (
                            <div title="This operation requires rescheduling" className={`px-1 rounded-sm ${isUrgentReschedule ? 'animate-pulse bg-white/20' : ''}`}>
                                <span className="text-[10px] font-bold"><i className="fas fa-calendar-alt"></i></span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    const prevOp = prevProps.op;
    const nextOp = nextProps.op;

    // Check if truck or vessel transfer is active to allow updates for elapsed time display and progress bar
    const isActiveTruck = nextOp.modality === 'truck' && nextOp.status === 'active';
    const isVesselActive = nextOp.modality === 'vessel' && nextProps.activeStartTime !== undefined;

    if (isActiveTruck || isVesselActive) {
        // Force re-render on time change to update progress/elapsed
        if (prevProps.currentTime !== nextProps.currentTime) return false;
    }

    const relevantPropsChanged = 
        prevOp.eta !== nextOp.eta ||
        prevOp.durationHours !== nextOp.durationHours ||
        prevOp.currentStatus !== nextOp.currentStatus ||
        prevOp.status !== nextOp.status ||
        prevOp.truckStatus !== nextOp.truckStatus ||
        (prevOp.requeueDetails?.reason !== nextProps.op.requeueDetails?.reason) ||
        (prevOp.requeueDetails?.priority !== nextProps.op.requeueDetails?.priority) ||
        JSON.stringify(prevProps.transfer) !== JSON.stringify(nextProps.transfer) ||
        prevProps.top !== nextProps.top ||
        prevProps.left !== nextProps.left ||
        prevProps.width !== nextProps.width ||
        prevProps.height !== nextProps.height ||
        prevProps.zIndex !== nextProps.zIndex ||
        prevProps.isReadOnly !== nextProps.isReadOnly ||
        prevProps.isSchedulerMode !== nextProps.isSchedulerMode ||
        prevProps.isDragging !== nextProps.isDragging ||
        prevProps.truckDisplay !== nextProps.truckDisplay ||
        prevProps.activeStartTime !== nextProps.activeStartTime ||
        JSON.stringify(prevOp.transferPlan) !== JSON.stringify(nextProps.op.transferPlan);
        
    return !relevantPropsChanged;
});

const MemoizedManpowerItem = React.memo<{
    operatorName: string;
    top: number;
    height: number;
    left: number;
    width: number;
}>(({ operatorName, top, height, left, width }) => {
    return (
        <div 
            className="manpower-schedule-item"
            style={{ top, height, left, width: width - 2, margin: '0 1px' }}
            title={`Operator: ${operatorName}`}
        >
            <span className="truncate">
                <i className="fas fa-hard-hat mr-1 opacity-70"></i>
                {operatorName}
            </span>
        </div>
    );
});


interface PlanningGridProps {
    displayColumns: string[];
    laidOutOps: any[];
    laidOutApprovedHolds: any[];
    laidOutPendingHolds: any[];
    laidOutCompletedHolds: any[];
    laidOutManpower: any[];
    viewDate: Date;
    onCardClick: (opId: string) => void;
    onGridClick: (hold: Hold | Partial<Hold>) => void;
    onHoldItemClick: (e: React.MouseEvent, hold: Hold) => void;
    headerTop: number;
    isReadOnly?: boolean;
    isSchedulerMode: boolean;
    draggingOp: { id: string; durationHours: number } | null;
    confirmPlacement: (opId: string, newEta: string, newResource: string) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, op: Operation) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    truckDisplay: 'customer' | 'plate';
    currentUser: User;
    totalGridHeight: number;
    infraRowLayouts: Record<string, { top: number; height: number; numLanes: number }>;
    currentTime: Date;
    gridStartDate: Date;
    onShiftDate: (days: number) => void;
}

const PlanningGrid: React.FC<PlanningGridProps> = (props) => {
    const { 
        displayColumns, laidOutOps, laidOutApprovedHolds, laidOutPendingHolds, laidOutCompletedHolds, laidOutManpower, 
        viewDate, onCardClick, onGridClick, onHoldItemClick, headerTop, isReadOnly, isSchedulerMode, 
        draggingOp, confirmPlacement: contextConfirmPlacement, onDragStart, onDragEnd, truckDisplay, 
        currentUser, totalGridHeight, infraRowLayouts, currentTime, gridStartDate, onShiftDate
    } = props;

    const { simulatedTime, placementOpId, getOperationById, currentTerminalSettings, cancelPlacementMode } = useContext(AppContext)!;
    const gridMainRef = useRef<HTMLDivElement>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);
    const topScrollbarRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<{ startX: number; currentX: number; rowIndex: number } | null>(null);
    const firstLoad = useRef(true);
    const isPendingScrollAdjustment = useRef(false);

    const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);
    const isViewingMockToday = viewDate.toDateString() === simulatedTime.toDateString();

    const [ghostPosition, setGhostPosition] = useState<{ top: number, left: number, height: number, width: number, visible: boolean, isValid: boolean, validationMessage: string } | null>(null);
    
    const opToPlaceInfo = useMemo(() => {
        if (placementOpId) {
            const op = getOperationById(placementOpId);
            if (!op) return null;
            return { op, durationHours: getOperationDurationHours(op) };
        }
        if (draggingOp) {
            const op = getOperationById(draggingOp.id);
            if (!op) return null; // Should not happen
            return { op, durationHours: draggingOp.durationHours };
        }
        return null;
    }, [placementOpId, draggingOp, getOperationById]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && placementOpId) {
                cancelPlacementMode();
                setGhostPosition(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [placementOpId, cancelPlacementMode]);
    
    useEffect(() => {
        const main = mainContentRef.current;
        const top = topScrollbarRef.current;
        if (!main || !top) return;

        let mainScrolling = false;
        let topScrolling = false;

        const handleTopScroll = () => {
            if (!mainScrolling) {
                topScrolling = true;
                main.scrollLeft = top.scrollLeft;
            }
            mainScrolling = false;
        };

        const handleMainScroll = () => {
            if (!topScrolling) {
                mainScrolling = true;
                top.scrollLeft = main.scrollLeft;
            }
            topScrolling = false;
            
            // Infinite Scroll Logic
            const scrollX = main.scrollLeft;
            const dayWidth = 24 * HOUR_WIDTH_PX;
            
            // Threshold to trigger infinite scroll (when user scrolls into previous/next day's zone)
            // Zone 0: Yesterday (0px - 24h), Zone 1: Today (24h - 48h), Zone 2: Tomorrow (48h - 72h)
            // Default view starts at 24h (Today 00:00)
            
            // Scroll Left (Yesterday)
            if (scrollX < dayWidth * 0.2) { // Near left edge of yesterday
                onShiftDate(-1);
                isPendingScrollAdjustment.current = true;
            } 
            // Scroll Right (Tomorrow)
            else if (scrollX > dayWidth * 1.8) { // Near right edge of today/start of tomorrow
                onShiftDate(1);
                isPendingScrollAdjustment.current = true;
            }
        };
        
        top.addEventListener('scroll', handleTopScroll);
        main.addEventListener('scroll', handleMainScroll);

        return () => {
            top.removeEventListener('scroll', handleTopScroll);
            main.removeEventListener('scroll', handleMainScroll);
        };
    }, [onShiftDate]);

    // Use LayoutEffect to adjust scroll position instantly after render when date shifts
    useLayoutEffect(() => {
        if (isPendingScrollAdjustment.current && mainContentRef.current && topScrollbarRef.current) {
            const dayWidth = 24 * HOUR_WIDTH_PX;
            // Reset scroll to "center" day (Today)
            // We use a slight offset to prevent immediate re-triggering if user is scrolling fast
            // but theoretically centering on 'Today' (24h start) is consistent.
            const targetScroll = dayWidth; 
            
            // We might want to preserve relative offset, but simpler is to reset to the 'current day' start
            // if we shifted a full day.
            // Actually, if I scrolled 24h to the right, I am now at Tomorrow 00:00.
            // After shift, Tomorrow becomes Today. So 'Today 00:00' is at 24h index.
            // So resetting to 24h + (original_offset % 24h) might be smoother?
            // For now, just resetting to center (24h) works for "endless" feeling if we snap.
            // But simpler:
            // If I scroll to 48h (start of tomorrow), I shift view. New view has Today at 24h.
            // So I should set scroll to (currentScroll - 24h) if moved right, or (currentScroll + 24h) if moved left.
            
            const currentScroll = mainContentRef.current.scrollLeft;
            
            // Crude check: if we are far left, we shifted backward, so add 24h.
            if (currentScroll < dayWidth) {
                mainContentRef.current.scrollLeft = currentScroll + dayWidth;
            } else {
                mainContentRef.current.scrollLeft = currentScroll - dayWidth;
            }
            
            // Sync top scrollbar
            topScrollbarRef.current.scrollLeft = mainContentRef.current.scrollLeft;
            
            isPendingScrollAdjustment.current = false;
        }
    }, [viewDate]); // Trigger after viewDate updates

    const handleGhostMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!opToPlaceInfo || !gridMainRef.current || isReadOnly) return;
        
        const { op, durationHours } = opToPlaceInfo;
        const rect = gridMainRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;

        let rowIndex = -1;
        let subRowIndex = 0;
        let rowLayout;
        for (let i = 0; i < displayColumns.length; i++) {
            rowLayout = infraRowLayouts[displayColumns[i]];
            if (y >= rowLayout.top && y < rowLayout.top + rowLayout.height) {
                rowIndex = i;
                subRowIndex = Math.floor((y - rowLayout.top) / SUB_ROW_HEIGHT_PX);
                break;
            }
        }
        
        if (rowIndex === -1) {
            if (ghostPosition?.visible) setGhostPosition(p => p ? { ...p, visible: false } : null);
            return;
        }

        const resource = displayColumns[rowIndex];
        const transfer = op.transferPlan[0]?.transfers[0];
        const requiredTank = transfer ? (transfer.direction.includes('Tank to') ? transfer.from : transfer.to) : null;
        
        let isValid = true;
        let validationMessage = '';

        if (requiredTank && transfer) {
            const connectedTanks = currentTerminalSettings.infrastructureTankMapping?.[resource] || [];
            if (!connectedTanks.includes(requiredTank)) {
                isValid = false;
                validationMessage = `Invalid: Bay ${formatInfraName(resource)} is not connected to Tank ${requiredTank} for ${transfer.product}.`;
            }
        }
        
        const snappedX = Math.round(x / (HOUR_WIDTH_PX / 4)) * (HOUR_WIDTH_PX / 4); // Snap to 15 mins
        
        setGhostPosition({
            top: rowLayout!.top + (subRowIndex * SUB_ROW_HEIGHT_PX) + 1,
            left: snappedX,
            height: SUB_ROW_HEIGHT_PX - 2,
            width: durationHours * HOUR_WIDTH_PX,
            visible: true,
            isValid,
            validationMessage
        });
    };

    const handleGridMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly || !placementOpId || !gridMainRef.current || !ghostPosition?.isValid) {
            if (ghostPosition && !ghostPosition.isValid) {
                alert(ghostPosition.validationMessage);
            }
            return;
        }

        const rect = gridMainRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        
        let rowIndex = -1;
        for (let i = 0; i < displayColumns.length; i++) {
            const rowLayout = infraRowLayouts[displayColumns[i]];
            if (y >= rowLayout.top && y < rowLayout.top + rowLayout.height) {
                rowIndex = i;
                break;
            }
        }
        if (rowIndex === -1) return;
        const resource = displayColumns[rowIndex];
        
        const snappedX = Math.round(x / (HOUR_WIDTH_PX / 4)) * (HOUR_WIDTH_PX / 4);
        const newTime = positionToTime(snappedX, gridStartDate);
        
        contextConfirmPlacement(placementOpId, newTime.toISOString(), resource);
        setGhostPosition(null);
    };
    
    const handleGridMouseLeave = () => {
        if (placementOpId) {
            setGhostPosition(p => p ? { ...p, visible: false } : null);
        }
    };
    
    // DRAG HANDLERS
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isSchedulerMode || !draggingOp) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        handleGhostMove(e as any);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isSchedulerMode || !draggingOp || !ghostPosition?.isValid) {
            if (ghostPosition && !ghostPosition.isValid) {
                alert(ghostPosition.validationMessage);
            }
            setGhostPosition(null);
            return;
        }
        e.preventDefault();
        const opId = e.dataTransfer.getData('opId');
        if (opId !== draggingOp.id) return;

        const rect = gridMainRef.current!.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        
        let rowIndex = -1;
        for (let i = 0; i < displayColumns.length; i++) {
            const rowLayout = infraRowLayouts[displayColumns[i]];
            if (y >= rowLayout.top && y < rowLayout.top + rowLayout.height) {
                rowIndex = i;
                break;
            }
        }
        if (rowIndex === -1) return;
        const resource = displayColumns[rowIndex];
        
        const snappedX = Math.round(x / (HOUR_WIDTH_PX / 4)) * (HOUR_WIDTH_PX / 4);
        const newTime = positionToTime(snappedX, gridStartDate);

        contextConfirmPlacement(opId, newTime.toISOString(), resource);
        setGhostPosition(null);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        if (!gridMainRef.current?.contains(e.relatedTarget as Node)) {
             setGhostPosition(p => p ? { ...p, visible: false } : null);
        }
    };

    useEffect(() => {
        if (isViewingMockToday) {
            setCurrentTimePos(timeToPosition(simulatedTime, gridStartDate));
        } else {
            setCurrentTimePos(null);
        }
    }, [viewDate, isViewingMockToday, simulatedTime, gridStartDate]);
    
    // Initial scroll position - Center on "Today" (Day Index 1)
    useEffect(() => {
        if (mainContentRef.current && firstLoad.current) {
            // Scroll to start of "Today" (24 hours * width) - some padding
            // Actually, center on current time if today, or just start of day
            let initialScroll = 24 * HOUR_WIDTH_PX;
            if (isViewingMockToday && currentTimePos) {
                // If today, try to center current time
                // But ensure we stay within the 'Today' band initially?
                // Let's just scroll to current time
                initialScroll = currentTimePos - mainContentRef.current.clientWidth / 3;
            }
            mainContentRef.current.scrollLeft = initialScroll;
            firstLoad.current = false;
        }
    }, [isViewingMockToday, currentTimePos]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly || (!canCreateOperation(currentUser) && !canCreateHold(currentUser))) return;
        if (placementOpId || isSchedulerMode || (e.target as HTMLElement).closest('.planning-grid-item, .planning-grid-hold, .planning-grid-pending-hold')) return;
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;

        let rowIndex = -1;
        for (let i = 0; i < displayColumns.length; i++) {
            const rowLayout = infraRowLayouts[displayColumns[i]];
            if (y >= rowLayout.top && y < rowLayout.top + rowLayout.height) {
                rowIndex = i;
                break;
            }
        }
        
        if (rowIndex !== -1) {
            setSelection({ startX: x, currentX: x, rowIndex });
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        if (selection) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            setSelection({ ...selection, currentX: x });
        }
    };

    const handleMouseUpForSelection = () => {
        if (isReadOnly) return;
        if (selection) {
            const startX = Math.min(selection.startX, selection.currentX);
            const endX = Math.max(selection.startX, selection.currentX);
            let startTime, endTime;
            const resource = displayColumns[selection.rowIndex];
            
            if (endX - startX > 10) { 
                startTime = positionToTime(startX, gridStartDate);
                endTime = positionToTime(endX, gridStartDate);
            } else {
                startTime = positionToTime(selection.startX, gridStartDate);
                endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
            }
            
            onGridClick({ startTime: startTime.toISOString(), endTime: endTime.toISOString(), resource });
            setSelection(null);
        }
    };

    const renderHold = (holdLayout: any, className: string, titlePrefix: string) => (
        <div 
            key={holdLayout.hold.id} 
            title={`${titlePrefix}: ${holdLayout.hold.reason}`} 
            className={`${className} ${isReadOnly ? '!cursor-default' : ''}`}
            style={holdLayout.layout} 
            onClick={(e) => !isReadOnly && onHoldItemClick(e, holdLayout.hold)}
        >
            <div className="truncate">
                <i className="fas fa-ban mr-1 sm:mr-2"></i>{holdLayout.hold.reason} {holdLayout.hold.tank && `(${holdLayout.hold.tank})`}
            </div>
        </div>
    );

    const totalGridWidth = (24 * DAYS_BUFFER) * HOUR_WIDTH_PX;

    return (
        <div className="flex flex-col" style={{ height: `calc(100% - ${headerTop}px)` }}>
             <div ref={topScrollbarRef} className="overflow-x-auto overflow-y-hidden top-scrollbar" style={{ height: '16px' }}>
                <div style={{ width: totalGridWidth + RESOURCE_COL_WIDTH_PX, height: '1px' }}></div>
            </div>
            <div 
                ref={mainContentRef} 
                className="relative overflow-auto border border-border-primary bg-white hide-scrollbar flex-grow"
            >
                <div className="relative" style={{ width: totalGridWidth + RESOURCE_COL_WIDTH_PX, height: totalGridHeight + TIME_HEADER_HEIGHT_PX }}>
                    
                    {/* Header Row (Time) */}
                    <div style={{ height: TIME_HEADER_HEIGHT_PX, width: totalGridWidth + RESOURCE_COL_WIDTH_PX }} className="flex sticky top-0 z-30">
                        <div style={{ width: RESOURCE_COL_WIDTH_PX }} className="flex-shrink-0 sticky left-0 z-10 bg-slate-100 border-r border-b"></div> {/* Top-left corner */}
                        <div className="flex bg-slate-100 border-b">
                            {Array.from({ length: 24 * DAYS_BUFFER }).map((_, i) => {
                                const isDayStart = i % 24 === 0;
                                const hour = i % 24;
                                const dayIndex = Math.floor(i / 24);
                                const dayDate = new Date(gridStartDate);
                                dayDate.setDate(dayDate.getDate() + dayIndex);
                                
                                return (
                                    <div key={i} style={{ width: HOUR_WIDTH_PX }} className={`text-center font-semibold text-xs py-2 border-r ${isDayStart ? 'border-l-2 border-l-slate-400 bg-slate-200' : ''}`}>
                                        {isDayStart ? (
                                            <span className="text-brand-primary font-bold">{dayDate.toLocaleDateString([], {weekday: 'short', month: 'numeric', day: 'numeric'})}</span>
                                        ) : (
                                            `${String(hour).padStart(2, '0')}:00`
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex" style={{ height: totalGridHeight }}>
                        {/* Resource Column (Infrastructure) */}
                        <div style={{ width: RESOURCE_COL_WIDTH_PX }} className="flex-shrink-0 sticky left-0 z-30">
                            {displayColumns.map((infraId, i) => (
                                <div key={infraId} style={{ height: infraRowLayouts[infraId]?.height || SUB_ROW_HEIGHT_PX }} className={`p-2 border-r border-b-2 border-slate-300 font-bold text-sm flex items-center justify-center text-center ${i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                                    {formatInfraName(infraId)}
                                </div>
                            ))}
                        </div>

                        {/* Main Grid */}
                        <div 
                            ref={gridMainRef} 
                            className={`relative ${placementOpId && !isReadOnly ? 'cursor-crosshair' : ''} ${draggingOp && isSchedulerMode && !isReadOnly ? 'cursor-grabbing' : ''} large-mode`}
                            style={{ width: totalGridWidth, height: totalGridHeight }}
                            onMouseDown={!isReadOnly ? handleMouseDown : undefined} 
                            onMouseMove={placementOpId && !isReadOnly ? handleGhostMove : (!isReadOnly ? handleMouseMove : undefined)} 
                            onMouseUp={placementOpId && !isReadOnly ? handleGridMouseUp : (!isReadOnly ? handleMouseUpForSelection : undefined)}
                            onMouseLeave={handleGridMouseLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragLeave={handleDragLeave}
                        >
                            {/* Banded Rows */}
                            {displayColumns.map((infraId, i) => {
                                const rowLayout = infraRowLayouts[infraId];
                                if (i % 2 === 1) { // 0-indexed, so it applies to the 2nd, 4th, etc. rows
                                    return (
                                        <div 
                                            key={`bg-${infraId}`}
                                            className="absolute left-0 w-full bg-slate-50" 
                                            style={{ top: rowLayout.top, height: rowLayout.height, zIndex: 0 }}
                                        ></div>
                                    );
                                }
                                return null;
                            })}
                            
                            {/* Grid Lines */}
                            {displayColumns.map((infraId, i) => {
                                const rowLayout = infraRowLayouts[infraId];
                                const lineTop = rowLayout.top + rowLayout.height;
                                return <div key={`hline-${i}`} className="absolute left-0 w-full h-0.5 bg-slate-300" style={{ top: lineTop, zIndex: 1 }}></div>;
                            })}
                            {Array.from({ length: 24 * DAYS_BUFFER }).map((_, i) => {
                                const isDayStart = i % 24 === 0;
                                return (
                                    <div key={`vline-${i}`} className={`absolute top-0 bottom-0 ${isDayStart ? 'w-0.5 bg-slate-400' : 'w-px bg-slate-200'}`} style={{ left: (i) * HOUR_WIDTH_PX, zIndex: 1 }}></div>
                                )
                            })}
                            
                            {/* Content */}
                            {laidOutManpower.map(item => <MemoizedManpowerItem key={item.key} {...item} />)}
                            {laidOutOps.map(({ op, transfer, layout, title, validation, activeStartTime }) => (
                                <MemoizedGridItem
                                    key={op.id + (transfer ? '-' + transfer.id : '')} 
                                    op={op} 
                                    transfer={transfer} 
                                    {...layout} 
                                    title={title} 
                                    validation={validation} 
                                    onCardClick={onCardClick}
                                    isReadOnly={isReadOnly} 
                                    isSchedulerMode={isSchedulerMode} 
                                    onDragStart={onDragStart} 
                                    onDragEnd={onDragEnd}
                                    isDragging={draggingOp?.id === op.id} 
                                    truckDisplay={truckDisplay}
                                    currentUser={currentUser}
                                    currentTime={currentTime}
                                    activeStartTime={activeStartTime}
                                />
                            ))}
                            {laidOutApprovedHolds.map(hold => renderHold(hold, "planning-grid-hold", "HOLD"))}
                            {laidOutPendingHolds.map(hold => renderHold(hold, "planning-grid-pending-hold", "PENDING OUTAGE"))}
                            {laidOutCompletedHolds.map(hold => renderHold(hold, "planning-grid-completed-hold", "COMPLETED"))}
                            
                            {/* Selection Box */}
                            {selection && !isReadOnly && (
                                <div className="selection-box" style={{ 
                                    left: Math.min(selection.startX, selection.currentX), 
                                    width: Math.abs(selection.currentX - selection.startX), 
                                    top: infraRowLayouts[displayColumns[selection.rowIndex]].top, 
                                    height: infraRowLayouts[displayColumns[selection.rowIndex]].height,
                                }} />
                            )}

                            {/* Ghost for drag/placement */}
                            {opToPlaceInfo && !isReadOnly && ghostPosition?.visible && (
                                <div 
                                    title={ghostPosition.isValid ? `Place ${opToPlaceInfo.op.transportId}` : ghostPosition.validationMessage}
                                    className={`planning-grid-item status-planned border-2 border-dashed pointer-events-none flex flex-col justify-center !p-1.5
                                        ${ghostPosition.isValid ? 'opacity-70 border-brand-primary' : '!bg-red-500/70 !border-red-700'}
                                    `}
                                    style={{
                                        position: 'absolute', top: ghostPosition.top, left: ghostPosition.left,
                                        height: ghostPosition.height, width: ghostPosition.width, zIndex: 99
                                    }}
                                >
                                    {/* First line */}
                                    <div className="flex items-center w-full">
                                        <span className="truncate font-bold text-sm">{opToPlaceInfo.op.transportId}</span>
                                    </div>
                                    {/* Second line */}
                                    <div className="flex items-center gap-1.5 w-full text-xs mt-0.5 opacity-90">
                                        <i className={`fas ${getIcon(opToPlaceInfo.op.modality)} text-sm flex-shrink-0 w-4 text-center`}></i>
                                        <span className="truncate">Placing...</span>
                                    </div>
                                    
                                    {!ghostPosition.isValid && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <i className="fas fa-ban text-white text-3xl"></i>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Current Time Indicator */}
                            {isViewingMockToday && currentTimePos !== null && (
                                 <div className="current-time-indicator !h-full !w-0.5 !top-0" style={{ left: currentTimePos }}></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

type ShiftTimes = { [key in 'Day' | 'Swing' | 'Night']: { start: string, end: string } };
interface PlanningBoardProps {
    isReadOnly?: boolean;
    operatorUsers?: User[];
    shiftTimes?: ShiftTimes;
}

const PlanningSidebar: React.FC<{ op: Operation; onClose: () => void }> = ({ op, onClose }) => {
    const { switchView } = useContext(AppContext)!;
    
    const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
    const sof = firstTransfer?.sof || [];
    const completedSteps = sof.filter(s => s.status === 'complete').length;
    const totalSteps = sof.length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    
    return (
        <div className="flex flex-col h-full">
             {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
                <div>
                    <h3 className="font-bold text-lg text-brand-dark">{op.transportId}</h3>
                    <p className="text-sm text-text-secondary">{op.licensePlate}</p>
                </div>
                <button onClick={onClose} className="btn-icon"><i className="fas fa-times"></i></button>
            </div>
            
            {/* Content */}
            <div className="p-4 flex-grow overflow-y-auto space-y-4">
                {/* Truck Details */}
                <div className="card p-3 bg-slate-50">
                    <h4 className="font-semibold text-sm mb-2">Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-text-secondary">Driver:</span><span className="font-medium text-right truncate" title={op.driverName}>{op.driverName || 'N/A'}</span>
                        <span className="text-text-secondary">Customer:</span><span className="font-medium text-right truncate" title={firstTransfer?.customer}>{firstTransfer?.customer || 'N/A'}</span>
                        <span className="text-text-secondary">Product:</span><span className="font-medium text-right truncate" title={firstTransfer?.product}>{firstTransfer?.product || 'N/A'}</span>
                        <span className="text-text-secondary">Tonnes:</span><span className="font-medium text-right">{firstTransfer?.tonnes || 'N/A'}</span>
                    </div>
                </div>

                {/* SOF Summary */}
                <div className="card p-3 bg-slate-50">
                    <h4 className="font-semibold text-sm mb-2">SOF Summary</h4>
                    <p className="text-xs mb-1">Status: <span className="font-bold">{op.currentStatus}</span></p>
                    <div className="w-full bg-slate-200 h-2 rounded-full">
                        <div className="bg-brand-primary h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-xs text-right mt-1">{completedSteps} of {totalSteps} steps complete</p>
                </div>
                
                {/* Documents */}
                <div className="card p-3 bg-slate-50">
                    <h4 className="font-semibold text-sm mb-2">Documents</h4>
                    <p className="text-xs">{ (op.documents || []).length > 0 ? `${(op.documents || []).length} document(s) attached.` : 'No documents attached.'}</p>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-slate-50 flex-shrink-0">
                <button 
                    onClick={() => { onClose(); switchView('operation-details', op.id); }} 
                    className="btn-primary w-full"
                >
                    Go to Full SOF / Details
                </button>
            </div>
        </div>
    );
};

const PlanningBoard: React.FC<PlanningBoardProps> = ({ isReadOnly = false, operatorUsers, shiftTimes }) => {
    const context = useContext(AppContext);
    
    // Safe defaults for context values to ensure hooks can run unconditionally
    const operations = context?.operations || [];
    const holds = context?.holds || [];
    const selectedTerminal = context?.selectedTerminal || '';
    const uiState = context?.uiState || { planningViewMode: 'grid' };
    const setPlanningViewMode = context?.setPlanningViewMode || (() => {});
    const saveHoldAndRequeueConflicts = context?.saveHoldAndRequeueConflicts || (() => {});
    const switchView = context?.switchView || (() => {});
    const currentTerminalSettings = context?.currentTerminalSettings || { infrastructureModalityMapping: {} };
    const openRescheduleModal = context?.openRescheduleModal || (() => {});
    const currentUser = context?.currentUser || { role: 'Operator', name: 'Unknown' };
    const cancelHold = context?.cancelHold || (() => {});
    const approveOutage = context?.approveOutage || (() => {});
    const rejectOutage = context?.rejectOutage || (() => {});
    const requeueOperation = context?.requeueOperation || (() => {});
    const openNewOpModal = context?.openNewOpModal || (() => {});
    const visibleInfrastructure = context?.visibleInfrastructure || [];
    const simulatedTime = context?.simulatedTime || new Date();
    const settings = context?.settings || {};
    const placementOpId = context?.placementOpId || null;
    const cancelPlacementMode = context?.cancelPlacementMode || (() => {});
    const confirmPlacement = context?.confirmPlacement || (() => {});
    const isSchedulerMode = context?.isSchedulerMode || false;
    const setIsSchedulerMode = context?.setIsSchedulerMode || (() => {});
    const workspaceFilter = context?.workspaceFilter || 'all';
    const workspaceSearchTerm = context?.workspaceSearchTerm || '';
    const planningCustomerFilter = context?.planningCustomerFilter || ['All'];
    const setPlanningCustomerFilter = context?.setPlanningCustomerFilter || (() => {});
    const getOperationById = context?.getOperationById || (() => undefined);
    const isDesktopSidebarCollapsed = context?.isDesktopSidebarCollapsed || false;
    const openAcceptNoShowModal = context?.openAcceptNoShowModal || (() => {});

    // HOOKS MUST RUN UNCONDITIONALLY
    const [holdModalOpen, setHoldModalOpen] = useState(false);
    const [holdInitialData, setHoldInitialData] = useState<Partial<Hold>>({});
    const [viewDate, setViewDate] = useState(simulatedTime);
    const [holdContextMenu, setHoldContextMenu] = useState<{ visible: boolean; x: number; y: number; hold: Hold } | null>(null);
    const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);
    const [draggingOp, setDraggingOp] = useState<{ id: string; durationHours: number } | null>(null);
    const [truckDisplay, setTruckDisplay] = useState<'customer' | 'plate'>('plate');
    
    const controlBarRef = useRef<HTMLDivElement>(null);
    const [headerTop, setHeaderTop] = useState(0);
    const isCommercials = currentUser.role === 'Commercials';

    const [isBottomBarExpanded, setIsBottomBarExpanded] = useState(false);
    
    const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false);
    const customerFilterRef = useRef<HTMLDivElement>(null);

    const [planningVesselFilter, setPlanningVesselFilter] = useState<string[]>(['All']);
    const [isVesselFilterOpen, setIsVesselFilterOpen] = useState(false);
    const vesselFilterRef = useRef<HTMLDivElement>(null);

    const [sidebarOpId, setSidebarOpId] = useState<string | null>(null);
    const sidebarOp = useMemo(() => sidebarOpId ? getOperationById(sidebarOpId) : null, [sidebarOpId, getOperationById]);

    // Determine grid start date (viewDate - 1 day) for buffer
    const gridStartDate = useMemo(() => {
        const d = new Date(viewDate);
        d.setDate(d.getDate() - 1); // Start 1 day before
        return d;
    }, [viewDate]);

    const handleShiftDate = (days: number) => {
        setViewDate(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() + days);
            return next;
        });
    };

    useEffect(() => {
        const updateHeaderTop = () => {
            if (controlBarRef.current) {
                setHeaderTop(controlBarRef.current.offsetHeight);
            }
        };
        updateHeaderTop();
        window.addEventListener('resize', updateHeaderTop);
        return () => window.removeEventListener('resize', updateHeaderTop);
    }, [placementOpId]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (holdContextMenu?.visible && !(e.target as HTMLElement).closest('.hold-context-menu')) {
                setHoldContextMenu(null);
            }
            if (customerFilterRef.current && !customerFilterRef.current.contains(e.target as Node)) {
                setIsCustomerFilterOpen(false);
            }
            if (vesselFilterRef.current && !vesselFilterRef.current.contains(e.target as Node)) {
                setIsVesselFilterOpen(false);
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [holdContextMenu, customerFilterRef, vesselFilterRef]);

    const vesselNames = useMemo(() => {
        const names = new Set(operations.filter(o => o.modality === 'vessel').map(o => o.transportId));
        return Array.from(names).sort();
    }, [operations]);

    const handleVesselFilterChange = (vesselName: string) => {
        setPlanningVesselFilter(prev => {
            if (vesselName === 'All') return prev.includes('All') ? [] : ['All'];
            let newSel = prev.includes('All') ? [] : [...prev];
            if (newSel.includes(vesselName)) newSel = newSel.filter(n => n !== vesselName);
            else newSel.push(vesselName);
            if (newSel.length === vesselNames.length) return ['All'];
            return newSel;
        });
    };

    const { scheduledOps, dateApprovedHolds, datePendingHolds, dateCompletedHolds } = useMemo(() => {
        // For infinite scrolling buffer, captureops from gridStartDate to gridStartDate + 3 days
        const startOfWindow = new Date(gridStartDate); startOfWindow.setHours(0, 0, 0, 0);
        const endOfWindow = new Date(gridStartDate); endOfWindow.setDate(endOfWindow.getDate() + DAYS_BUFFER); endOfWindow.setHours(23, 59, 59, 999);
        
        const terminalOps = operations.filter(op => op.terminal === selectedTerminal);

        const dateOps = terminalOps.filter(op => {
            const opEta = new Date(op.eta).getTime();
            const opDurationMs = getOperationDurationHours(op) * 3600 * 1000;
            const opEnd = opEta + opDurationMs;
            const startWindowMs = startOfWindow.getTime();
            const endWindowMs = endOfWindow.getTime();
            
            // Check overlap
            const overlapsWindow = Math.max(opEta, startWindowMs) < Math.min(opEnd, endWindowMs);
            
            const completedInWindow = op.status === 'completed' && op.completedTime && new Date(op.completedTime) >= startOfWindow && new Date(op.completedTime) <= endOfWindow;
            const cancelledInWindow = op.status === 'cancelled' && op.cancellationDetails?.time && new Date(op.cancellationDetails.time) >= startOfWindow && new Date(op.cancellationDetails.time) <= endOfWindow;
            
            return overlapsWindow || completedInWindow || cancelledInWindow;
        });

        const filteredOps = dateOps
            .filter(op => {
                if (workspaceFilter === 'all') return true;
                return op.modality === workspaceFilter;
            })
            .filter(op => {
                if (workspaceFilter === 'vessel' && !planningVesselFilter.includes('All')) {
                    return planningVesselFilter.includes(op.transportId);
                }
                return true;
            })
            .filter(op => {
                // Global Search Filter (e.g. for Vessels)
                if (!workspaceSearchTerm) return true;
                const term = workspaceSearchTerm.toLowerCase();
                if (op.transportId.toLowerCase().includes(term)) return true;
                if (op.orderNumber?.toLowerCase().includes(term)) return true;
                return op.transferPlan.some(line => 
                    line.transfers.some(t => 
                        t.product.toLowerCase().includes(term) || 
                        t.customer.toLowerCase().includes(term)
                    )
                );
            })
            .filter(op => {
                // Customer Filter
                if (planningCustomerFilter.includes('All')) {
                    return true;
                }
                return op.transferPlan.some(line =>
                    line.transfers.some(transfer =>
                        transfer.customer && planningCustomerFilter.includes(transfer.customer)
                    )
                );
            });
        
        const holdsOnDate = holds.filter(h => new Date(h.startTime) < endOfWindow && new Date(h.endTime) > startOfWindow);

        return {
            scheduledOps: filteredOps,
            dateApprovedHolds: holdsOnDate.filter(h => h.status === 'approved' && !['Completed', 'Closed'].includes(h.workOrderStatus || '')),
            datePendingHolds: holdsOnDate.filter(h => h.status === 'pending' && h.workOrderStatus !== 'Closed'),
            dateCompletedHolds: holdsOnDate.filter(h => h.status === 'approved' && h.workOrderStatus === 'Completed'),
        };
    }, [operations, holds, selectedTerminal, gridStartDate, planningCustomerFilter, workspaceFilter, workspaceSearchTerm, planningVesselFilter]);
    
    const activeAssets = useMemo(() => {
        const assets = new Set<string>();
        scheduledOps.forEach(op => {
            op.transferPlan.forEach(tp => {
                if (tp.infrastructureId) assets.add(tp.infrastructureId);
            });
        });
        [...dateApprovedHolds, ...datePendingHolds, ...dateCompletedHolds].forEach(h => {
            if (h.resource) assets.add(h.resource);
        });
        return assets;
    }, [scheduledOps, dateApprovedHolds, datePendingHolds, dateCompletedHolds]);

    const filteredDisplayColumns = useMemo(() => {
        // Auto-hide empty assets unless in Scheduler/Placement mode
        if (!isSchedulerMode && !placementOpId) {
            return visibleInfrastructure.filter(id => activeAssets.has(id));
        }
        return visibleInfrastructure;
    }, [visibleInfrastructure, activeAssets, isSchedulerMode, placementOpId]);

    const { laidOutOps, totalGridHeight, infraRowLayouts } = useMemo(() => {
        const opsWithTimes = scheduledOps.map(op => ({
            op,
            start: new Date(op.eta).getTime(),
        })).sort((a, b) => a.start - b.start);
    
        const opsByInfra: Record<string, typeof opsWithTimes> = {};
        opsWithTimes.forEach(item => {
            (item.op.transferPlan || []).forEach(tp => {
                if (filteredDisplayColumns.includes(tp.infrastructureId)) {
                    if (!opsByInfra[tp.infrastructureId]) opsByInfra[tp.infrastructureId] = [];
                    opsByInfra[tp.infrastructureId].push(item);
                }
            });
        });
    
        const activeHolds = [...dateApprovedHolds, ...dateCompletedHolds].filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        
        const finalLayout: any[] = [];
        const finalInfraRowLayouts: Record<string, { top: number; height: number; numLanes: number }> = {};
        let currentGridTop = 0;
    
        filteredDisplayColumns.forEach(infraId => {
            const opsForInfra = opsByInfra[infraId] || [];
            const rowTop = currentGridTop;
            // Track lanes. We use a simplified greedy packing algorithm for lanes.
            // lanes[i] stores the end time of the last item placed in lane i.
            const lanes = [0]; 
    
            opsForInfra.forEach(item => {
                // --- DURATION CALCULATION ---
                let plannedDuration = getOperationDurationHours(item.op);
                let visualDuration = plannedDuration;
                let itemStart = new Date(item.op.eta).getTime();
                let actualStart = undefined; // For accurate progress calculation

                // STRICT PUMPING WINDOW FOR ACTIVE & COMPLETED TRUCK TRANSFERS
                if (item.op.modality === 'truck') {
                     const transfer = item.op.transferPlan?.[0]?.transfers?.[0];
                     const sof = transfer?.sof || [];
                     
                     const pumpStartEvent = sof.find(s => s.event.includes('Pumping Started') && s.status === 'complete');
                     const pumpStopEvent = sof.find(s => s.event.includes('Pumping Stopped') && s.status === 'complete');

                     if (pumpStartEvent) {
                         const pStart = new Date(pumpStartEvent.time).getTime();
                         itemStart = pStart;
                         actualStart = pStart;
                         
                         if (pumpStopEvent) {
                             // COMPLETED: Show actual duration
                             const pEnd = new Date(pumpStopEvent.time).getTime();
                             visualDuration = (pEnd - pStart) / (3600 * 1000);
                             if (visualDuration < 0.25) visualDuration = 0.25;
                         } 
                         // If ACTIVE, visualDuration stays as plannedDuration (fixed box),
                         // but the progress bar will overflow if needed.
                     }
                }

                // Vessel Dynamic Duration Calculation
                if (item.op.modality === 'vessel') {
                    const line = item.op.transferPlan.find(l => l.infrastructureId === infraId);
                    if (line && line.transfers.length > 0) {
                        const transfers = line.transfers;
                        
                        // 1. Anchor start time to the first actual pumping event if it exists
                        const firstPumpStart = transfers[0].sof?.find(s => s.event.includes('START PUMPING') && s.status === 'complete');
                        if (firstPumpStart) {
                            itemStart = new Date(firstPumpStart.time).getTime();
                            actualStart = itemStart;
                        }

                        // 2. Calculate dynamic total duration based on actual progress
                        let totalDurationMs = 0;
                        const PUMP_RATE_TPH = 1000;
                        const CLEANING_HOURS = 1;
                        
                        transfers.forEach(t => {
                            if (t.preTransferCleaningSof) totalDurationMs += CLEANING_HOURS * 3600 * 1000;
                            
                            let tDurationMs = (t.tonnes / PUMP_RATE_TPH) * 3600 * 1000;
                            
                            const tSof = t.sof || [];
                            const pStart = tSof.find(s => s.event.includes('START PUMPING') && s.status === 'complete');
                            const pStop = tSof.find(s => s.event.includes('STOP PUMPING') && s.status === 'complete');
                            
                            if (pStart && !pStop) {
                                // Active: extend if elapsed time exceeds planned
                                const startT = new Date(pStart.time).getTime();
                                const elapsed = simulatedTime.getTime() - startT;
                                if (elapsed > tDurationMs) tDurationMs = elapsed;
                            } else if (pStart && pStop) {
                                // Completed: use actual duration
                                tDurationMs = new Date(pStop.time).getTime() - new Date(pStart.time).getTime();
                            }
                            
                            totalDurationMs += tDurationMs;
                        });
                        
                        visualDuration = totalDurationMs / 3600000;
                        // Ensure at least minimal width
                        if (visualDuration < 1) visualDuration = 1;
                    }
                }

                // Determine lane reservation end time (to prevent overlap)
                let laneReservationEnd = itemStart + visualDuration * 3600 * 1000;
                
                // For active items (both truck and vessel), ensure we reserve at least until NOW to prevent overlap
                const isItemActive = (item.op.modality === 'truck' && ['Loading', 'Pumping'].includes(item.op.truckStatus || '')) || 
                                     (item.op.modality === 'vessel' && item.op.status === 'active'); 

                if (isItemActive) {
                     const nowTime = simulatedTime.getTime();
                     // If currently running, it occupies space at least until now
                     if (laneReservationEnd < nowTime) laneReservationEnd = nowTime;
                }
    
                // --- LANE PLACEMENT LOGIC ---
                let subRowIndex = -1;
                for (let i = 0; i < lanes.length; i++) {
                    if (itemStart >= lanes[i]) {
                        lanes[i] = laneReservationEnd; // Reserve based on actual occupancy
                        subRowIndex = i;
                        break;
                    }
                }
                if (subRowIndex === -1) {
                    subRowIndex = lanes.length;
                    lanes.push(laneReservationEnd);
                }
    
                // --- VESSEL TRANSFER LAYOUT ---
                if (item.op.modality === 'vessel') {
                    const PUMP_RATE_TPH = 1000;
                    const CLEANING_HOURS = 1;
                    
                    // Initialize with the potentially adjusted itemStart
                    let currentTimeForLine = itemStart;
    
                    item.op.transferPlan.forEach(line => {
                        if (line.infrastructureId !== infraId) return;
    
                        line.transfers.forEach(transfer => {
                            if (transfer.preTransferCleaningSof) {
                                currentTimeForLine += CLEANING_HOURS * 3600 * 1000;
                            }
                            
                            const sof = transfer.sof || [];
                            const pumpStartEvent = sof.find(s => s.event.includes('START PUMPING') && s.status === 'complete');
                            const pumpStopEvent = sof.find(s => s.event.includes('STOP PUMPING') && s.status === 'complete');
                            
                            // If this specific transfer has started, snap the visual start time to its actual start
                            // This ensures gaps or overlaps between transfers are visualized accurately
                            if (pumpStartEvent) {
                                currentTimeForLine = new Date(pumpStartEvent.time).getTime();
                            }
                            
                            let transferDurationHours = (transfer.tonnes || 0) / PUMP_RATE_TPH;
                            let activeStartTime: number | undefined = undefined;

                            if (pumpStartEvent && !pumpStopEvent) {
                                const startTime = new Date(pumpStartEvent.time).getTime();
                                activeStartTime = startTime;
                                const now = simulatedTime.getTime();
                                const elapsedHours = (now - startTime) / (3600 * 1000);
                                // If elapsed is longer than planned, extend the card
                                if (elapsedHours > transferDurationHours) {
                                    transferDurationHours = elapsedHours;
                                }
                            } else if (pumpStartEvent && pumpStopEvent) {
                                // If completed, use actual duration for spacing
                                const durationMs = new Date(pumpStopEvent.time).getTime() - new Date(pumpStartEvent.time).getTime();
                                transferDurationHours = durationMs / 3600000;
                            }
    
                            const transferStartTime = new Date(currentTimeForLine);
    
                            const top = rowTop + (subRowIndex * SUB_ROW_HEIGHT_PX) + 1;
                            const height = SUB_ROW_HEIGHT_PX - 2;
                            const left = timeToPosition(transferStartTime, gridStartDate); // Pass gridStartDate
                            const width = (transferDurationHours * HOUR_WIDTH_PX);
                            const validation = validateOperationPlan(item.op, currentTerminalSettings, settings, activeHolds);
    
                            finalLayout.push({
                                op: item.op,
                                transfer: transfer,
                                layout: { top, height, left, width, zIndex: 20 + subRowIndex },
                                title: `${item.op.transportId} - ${transfer.product}\nCustomer: ${transfer.customer}\nTonnes: ${transfer.tonnes}`,
                                validation,
                                activeStartTime
                            });
    
                            currentTimeForLine += transferDurationHours * 3600 * 1000;
                        });
                    });
                } else { // --- TRUCK/RAIL LAYOUT ---
                    const top = rowTop + (subRowIndex * SUB_ROW_HEIGHT_PX) + 1;
                    const height = SUB_ROW_HEIGHT_PX - 2;
                    const left = timeToPosition(new Date(itemStart), gridStartDate); // Pass gridStartDate
                    
                    // Use visualDuration for the width (fixed for active trucks, actual for completed)
                    let width = (visualDuration * HOUR_WIDTH_PX);
                    if (width < 2) width = 2;
    
                    const { totalValue } = isCommercials ? calculateOperationValue(item.op, settings) : { totalValue: 0 };
                    const validation = (item.op.status === 'planned' || item.op.status === 'active') ? validateOperationPlan(item.op, currentTerminalSettings, settings, activeHolds) : { isValid: true, issues: [] };
                    const firstTransfer = item.op.transferPlan?.[0]?.transfers?.[0];
                    const cardLabel = item.op.modality === 'truck' ? (truckDisplay === 'plate' ? item.op.licensePlate : firstTransfer?.customer || 'N/A') : item.op.transportId;
    
                    finalLayout.push({
                        op: item.op,
                        layout: { top, height, left, width, zIndex: 20 + subRowIndex },
                        title: `${cardLabel}\nETA: ${new Date(item.op.eta).toLocaleTimeString()}${isCommercials ? `\nValue: ${formatCurrency(totalValue)}` : ''}${!validation.isValid ? `\n\nISSUES:\n- ${validation.issues.join('\n- ')}` : ''}`,
                        validation,
                        activeStartTime: actualStart
                    });
                }
            });
    
            const numLanes = Math.max(2, lanes.length); // Reduced minimum to 2
            const rowHeight = numLanes * SUB_ROW_HEIGHT_PX;
            finalInfraRowLayouts[infraId] = { top: rowTop, height: rowHeight, numLanes };
            currentGridTop += rowHeight;
        });
    
        return { laidOutOps: finalLayout, totalGridHeight: currentGridTop, infraRowLayouts: finalInfraRowLayouts };
    }, [scheduledOps, filteredDisplayColumns, viewDate, settings, isCommercials, dateApprovedHolds, dateCompletedHolds, currentTerminalSettings, truckDisplay, simulatedTime, gridStartDate]);


    const manpowerScheduleOverlay = useMemo(() => {
        if (!operatorUsers || !shiftTimes) return [];

        const schedule: { operatorName: string; resource: string; startTime: string; endTime: string }[] = [];
        // Manpower overlay needs to span the 3 days window
        for(let i = 0; i < DAYS_BUFFER; i++) {
            const currentDay = new Date(gridStartDate);
            currentDay.setDate(currentDay.getDate() + i);
            const todayStr = currentDay.toISOString().split('T')[0];

            for (const op of operatorUsers) {
                if (op.shift && op.shift !== 'Off' && op.assignedAreas && op.assignedAreas.length > 0) {
                    const times = shiftTimes[op.shift];
                    if (!times) continue;

                    const startDateTime = new Date(`${todayStr}T${times.start}:00`);
                    const endDateTime = new Date(`${todayStr}T${times.end}:00`);
                    
                    if (endDateTime < startDateTime) {
                        endDateTime.setDate(endDateTime.getDate() + 1);
                    }

                    for (const area of op.assignedAreas) {
                        schedule.push({
                            operatorName: op.name,
                            resource: area,
                            startTime: startDateTime.toISOString(),
                            endTime: endDateTime.toISOString(),
                        });
                    }
                }
            }
        }
        return schedule;
    }, [operatorUsers, shiftTimes, gridStartDate]);

    const laidOutManpower = useMemo(() => {
        if (!manpowerScheduleOverlay) return [];
        
        return manpowerScheduleOverlay.map((item, index) => {
            const infraIndex = filteredDisplayColumns.findIndex(c => c === item.resource);
            if (infraIndex === -1) return null;
            
            const rowLayout = infraRowLayouts[item.resource];
            if (!rowLayout) return null;
            
            const top = rowLayout.top + ((rowLayout.numLanes - 1) * SUB_ROW_HEIGHT_PX); // Use last sub-row
            const height = SUB_ROW_HEIGHT_PX;
    
            const start = new Date(item.startTime);
            const end = new Date(item.endTime);
    
            const left = timeToPosition(start, gridStartDate);
            let width = timeToPosition(end, gridStartDate) - left;
            
            if (width <= 0) return null;
    
            return { key: `manpower-${index}`, operatorName: item.operatorName, top, height, left, width };
        }).filter(Boolean);
    }, [manpowerScheduleOverlay, filteredDisplayColumns, gridStartDate, infraRowLayouts]);

    const createHoldLayout = (holds: Hold[]) => {
        return holds.map(hold => {
            const rowLayout = infraRowLayouts[hold.resource];
            if (!rowLayout) return null;
            
            const holdTop = rowLayout.top;
            const holdHeight = rowLayout.height;

            const start = new Date(hold.startTime);
            const end = new Date(hold.endTime);
            const left = timeToPosition(start, gridStartDate);
            let width = timeToPosition(end, gridStartDate) - left;
            if (width <= 0) width = 2;

            return { hold, layout: { top: holdTop, height: holdHeight, left, width } };
        }).filter(Boolean);
    };

    const laidOutApprovedHolds = useMemo(() => createHoldLayout(dateApprovedHolds), [dateApprovedHolds, infraRowLayouts, gridStartDate]);
    const laidOutPendingHolds = useMemo(() => createHoldLayout(datePendingHolds), [datePendingHolds, infraRowLayouts, gridStartDate]);
    const laidOutCompletedHolds = useMemo(() => createHoldLayout(dateCompletedHolds), [dateCompletedHolds, infraRowLayouts, gridStartDate]);
    
    const rescheduleOps = useMemo(() => {
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');

        const opsForReschedule = operations.filter(op => {
            if (op.terminal !== selectedTerminal) return false;
            // Apply Vessel Filter to reschedule list if active
            if (workspaceFilter === 'vessel' && !planningVesselFilter.includes('All') && !planningVesselFilter.includes(op.transportId)) return false;

            if (op.currentStatus === 'No Show') return false;

            if (['Reschedule Required', 'Reschedule Requested'].includes(op.currentStatus)) {
                return true;
            }

            if (op.status === 'planned') {
                const validation = validateOperationPlan(op, currentTerminalSettings, settings, activeHolds);
                const hasHoldConflict = validation.issues.some(issue => issue.toLowerCase().includes('conflict') && issue.toLowerCase().includes('hold'));
                if (hasHoldConflict) {
                    return true;
                }
            }
            
            return false;
        });

        const uniqueOps = Array.from(new Map(opsForReschedule.map(op => [op.id, op])).values());
        
        uniqueOps.sort((a: Operation, b: Operation) => {
            const isHighPriority = (op: Operation) => {
                if (op.requeueDetails?.priority === 'high') return true;
                
                const validation = validateOperationPlan(op, currentTerminalSettings, settings, activeHolds);
                return validation.issues.some(issue => issue.toLowerCase().includes('conflict') && issue.toLowerCase().includes('hold'));
            };

            const aIsHigh = isHighPriority(a);
            const bIsHigh = isHighPriority(b);

            if (aIsHigh && !bIsHigh) return -1;
            if (!aIsHigh && bIsHigh) return 1;
            
            return new Date(a.eta).getTime() - new Date(b.eta).getTime();
        });

        return uniqueOps;
    }, [operations, holds, selectedTerminal, currentTerminalSettings, settings, workspaceFilter, planningVesselFilter]);

    const noShowOps = useMemo(() => {
        return operations.filter(op => 
            op.terminal === selectedTerminal &&
            op.currentStatus === 'No Show'
        ).sort((a,b) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
    }, [operations, selectedTerminal]);


    const filteredForKanban = useMemo(() => {
        if (filteredDisplayColumns.length === Object.keys(currentTerminalSettings.infrastructureModalityMapping || {}).length) {
            return scheduledOps;
        }
        return scheduledOps.filter(op =>
            op.transferPlan.some(tp => filteredDisplayColumns.includes(tp.infrastructureId))
        );
    }, [scheduledOps, filteredDisplayColumns, currentTerminalSettings]);

    const masterCustomers = useMemo(() => (currentTerminalSettings.masterCustomers || []).sort(), [currentTerminalSettings.masterCustomers]);

    // GUARD CLAUSE: STRICTLY AFTER ALL HOOKS
    if (!context) return null;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, op: Operation) => {
        e.dataTransfer.setData('opId', op.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingOp({ id: op.id, durationHours: getOperationDurationHours(op) });
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        setDraggingOp(null);
    };

    const handleHoldItemClick = (e: React.MouseEvent, hold: Hold) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.stopPropagation();
        setHoldContextMenu({ visible: true, x: e.clientX, y: e.clientY, hold: hold });
    };

    const handleConfirmCancel = (reason: string) => {
        if (cancellingHoldId) {
            cancelHold(cancellingHoldId, reason);
            setCancellingHoldId(null);
        }
    };

    const openHoldModal = (initialData: Partial<Hold> = {}) => {
        setHoldInitialData({ resource: '', terminal: selectedTerminal, ...initialData });
        setHoldModalOpen(true);
    };

    const handleGridClick = (initialHoldData: Partial<Hold>) => {
        if (isReadOnly) return;
        if (canCreateOperation(currentUser)) {
            const modality = initialHoldData.resource ? currentTerminalSettings.infrastructureModalityMapping[initialHoldData.resource] : undefined;
            const initialOpData: Partial<Operation> = { eta: initialHoldData.startTime, modality };
            if ((modality === 'truck' || modality === 'rail') && initialHoldData.resource) {
                initialOpData.transferPlan = [{ infrastructureId: initialHoldData.resource, transfers: [] }];
            }
            openNewOpModal(initialOpData);
        } else if (canCreateHold(currentUser)) {
            openHoldModal(initialHoldData);
        }
    };

    const getReasonAndPriority = (op: Operation) => {
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        const validation = validateOperationPlan(op, currentTerminalSettings, settings, activeHolds);
        const conflictIssue = validation.issues.find(issue => issue.toLowerCase().includes('conflict') && issue.toLowerCase().includes('hold'));

        let reason = op.requeueDetails?.reason || 'Plan Invalid';
        let isHigh = op.requeueDetails?.priority === 'high';

        if (op.requeueDetails?.isRequest) {
            reason = `REQUEST: ${reason}`;
        }

        if (op.currentStatus === 'No Show') {
            reason = 'NO SHOW';
            isHigh = true;
        }

        if (conflictIssue) {
            const holdReasonMatch = conflictIssue.match(/hold for "([^"]+)"/);
            reason = holdReasonMatch ? `Hold Conflict: ${holdReasonMatch[1]}` : 'Hold Conflict';
            isHigh = true;
        }

        return { reason, isHigh };
    };
    
    const handleCustomerFilterChange = (customerName: string) => {
        setPlanningCustomerFilter(prev => {
            if (customerName === 'All') {
                return prev.includes('All') ? [] : ['All'];
            }
    
            let currentSelection = prev.includes('All') ? [] : prev;
            let newSelection = new Set(currentSelection);
    
            if (newSelection.has(customerName)) {
                newSelection.delete(customerName);
            } else {
                newSelection.add(customerName);
            }
            
            const finalSelection = Array.from(newSelection);
    
            if (masterCustomers.length > 0 && finalSelection.length === masterCustomers.length) {
                return ['All'];
            }
            
            return finalSelection.sort();
        });
    };

    const handleProcessArrival = (opId: string) => {
        openAcceptNoShowModal(opId);
        setIsBottomBarExpanded(false);
    };

    const handleReschedule = (op: Operation) => {
        openRescheduleModal(op.id, new Date(op.eta));
        setIsBottomBarExpanded(false);
    };

    const shouldShowReschedule = rescheduleOps.length > 0;
    const shouldShowNoShows = noShowOps.length > 0;
    const shouldShowLegend = uiState.planningViewMode === 'grid' || uiState.planningViewMode === 'kanban';
    const shouldShowBottomBar = shouldShowLegend || shouldShowReschedule || shouldShowNoShows;

    const numSections = [shouldShowLegend, shouldShowNoShows && !isReadOnly, shouldShowReschedule && !isReadOnly].filter(Boolean).length;


    return (
        <>
            <HoldModal isOpen={holdModalOpen} onClose={() => setHoldModalOpen(false)} onSave={saveHoldAndRequeueConflicts} initialData={holdInitialData} />
            <InputModal isOpen={!!cancellingHoldId} onClose={() => setCancellingHoldId(null)} onSave={handleConfirmCancel} title="Cancel Hold" label="Reason for Cancellation (Required)" initialValue="Entered in error" />
            
            {holdContextMenu?.visible && (
                <div style={{ top: holdContextMenu.y, left: holdContextMenu.x }} className="hold-context-menu absolute z-50 bg-white shadow-lg border p-1 flex flex-col w-48" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { openHoldModal(holdContextMenu.hold); setHoldContextMenu(null); }} className="text-left w-full px-3 py-2 text-sm text-text-primary hover:bg-slate-100"><i className="fas fa-pen mr-2 w-4"></i>Edit Hold</button>
                    {(currentUser.role === 'Operations Lead' || currentUser.name === holdContextMenu.hold.user) && (holdContextMenu.hold.status !== 'cancelled' && holdContextMenu.hold.status !== 'rejected') && (
                        <button onClick={() => { setCancellingHoldId(holdContextMenu.hold.id!); setHoldContextMenu(null); }} className="text-left w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"><i className="fas fa-ban mr-2 w-4"></i>Cancel Hold</button>
                    )}
                    {currentUser.role === 'Operations Lead' && holdContextMenu.hold.status === 'pending' && (
                        <><div className="border-t my-1"></div><button onClick={() => { approveOutage(holdContextMenu.hold.id!); setHoldContextMenu(null); }} className="text-left w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50"><i className="fas fa-check mr-2 w-4"></i>Approve</button><button onClick={() => { rejectOutage(holdContextMenu.hold.id!); setHoldContextMenu(null); }} className="text-left w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"><i className="fas fa-times mr-2 w-4"></i>Reject</button></>
                    )}
                </div>
            )}

            {sidebarOpId && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[80]" 
                    onClick={() => setSidebarOpId(null)}
                ></div>
            )}
            <div 
                className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-[90] transition-transform duration-300 ease-in-out ${sidebarOpId ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ width: '25%', minWidth: '350px', maxWidth: '450px' }}
            >
                {sidebarOp && <PlanningSidebar op={sidebarOp} onClose={() => setSidebarOpId(null)} />}
            </div>

            <div className={`relative h-full flex flex-col ${isReadOnly ? 'pointer-events-none' : ''}`}>
                <div ref={controlBarRef} className={`sticky top-0 z-40 bg-white border-b border-border-primary ${isReadOnly ? '!pointer-events-auto' : ''}`}>
                    {placementOpId && !isReadOnly && (
                        <div className="bg-indigo-600 text-white p-2 text-center font-semibold text-sm flex justify-between items-center">
                            <span>Click on the grid to place the operation. Press ESC to cancel.</span>
                            <button onClick={cancelPlacementMode} className="btn-icon !text-white !p-1"><i className="fas fa-times"></i></button>
                        </div>
                    )}
                    <div className="p-4">
                        <div className="flex flex-wrap items-center gap-y-2">
                            {uiState.planningViewMode !== 'calendar' && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className="text-lg font-semibold text-text-secondary whitespace-nowrap">{viewDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        <button onClick={() => handleShiftDate(-1)} className="btn-icon"><i className="fas fa-chevron-left"></i></button>
                                        <button onClick={() => setViewDate(simulatedTime)} className="btn-secondary !py-1 !px-3 text-sm">Today</button>
                                        <button onClick={() => handleShiftDate(1)} className="btn-icon"><i className="fas fa-chevron-right"></i></button>
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2 gap-y-2 ml-auto">
                                {uiState.planningViewMode === 'grid' && (
                                    <button
                                        onClick={() => setIsSchedulerMode(prev => !prev)}
                                        className={`btn-secondary !py-2 !px-3 ${isSchedulerMode ? '!bg-indigo-600 !text-white !border-indigo-600' : ''}`}
                                        title="Toggle Scheduler Mode (Drag & Drop)"
                                    >
                                        <i className="fas fa-hand-paper"></i>
                                    </button>
                                )}
                                {(workspaceFilter === 'vessel' || workspaceFilter === 'all') && (
                                    <div ref={vesselFilterRef} className="relative">
                                        <button onClick={() => setIsVesselFilterOpen(prev => !prev)} className="btn-secondary !py-2">
                                            <i className="fas fa-ship mr-2"></i>
                                            Vessels ({planningVesselFilter.includes('All') ? 'All' : planningVesselFilter.length})
                                        </button>
                                        {isVesselFilterOpen && (
                                            <div className="absolute top-full right-0 mt-2 w-60 bg-white border rounded-lg shadow-xl z-30 p-3">
                                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                                    <label className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer font-semibold">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                            checked={planningVesselFilter.includes('All')}
                                                            onChange={() => handleVesselFilterChange('All')}
                                                        />
                                                        <span>All Vessels</span>
                                                    </label>
                                                    <hr/>
                                                    {vesselNames.map(name => (
                                                        <label key={name} className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                                checked={planningVesselFilter.includes('All') || planningVesselFilter.includes(name)}
                                                                onChange={() => handleVesselFilterChange(name)}
                                                            />
                                                            <span className="text-sm">{name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div ref={customerFilterRef} className="relative">
                                    <button onClick={() => setIsCustomerFilterOpen(prev => !prev)} className="btn-secondary !py-2">
                                        <i className="fas fa-user-friends mr-2"></i>
                                        Customers ({planningCustomerFilter.includes('All') ? 'All' : planningCustomerFilter.length})
                                    </button>
                                    {isCustomerFilterOpen && (
                                        <div className="absolute top-full right-0 mt-2 w-60 bg-white border rounded-lg shadow-xl z-30 p-3">
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                <label className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer font-semibold">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                        checked={planningCustomerFilter.includes('All')}
                                                        onChange={() => handleCustomerFilterChange('All')}
                                                    />
                                                    <span>All Customers</span>
                                                </label>
                                                <hr/>
                                                {masterCustomers.map(name => (
                                                    <label key={name} className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                            checked={planningCustomerFilter.includes('All') || planningCustomerFilter.includes(name)}
                                                            onChange={() => handleCustomerFilterChange(name)}
                                                        />
                                                        <span className="text-sm">{name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {uiState.planningViewMode === 'grid' && (
                                    <>
                                        <div className="planning-board-view-toggle">
                                            <button onClick={() => setTruckDisplay('customer')} className={`view-toggle-btn ${truckDisplay === 'customer' ? 'active' : ''}`} title="Show Customer Name">
                                                <i className="fas fa-user-tie"></i>
                                            </button>
                                            <button onClick={() => setTruckDisplay('plate')} className={`view-toggle-btn ${truckDisplay === 'plate' ? 'active' : ''}`} title="Show Plate Number">
                                                <i className="fas fa-hashtag"></i>
                                            </button>
                                        </div>
                                    </>
                                )}
                                <div className="planning-board-view-toggle">
                                    <button onClick={() => setPlanningViewMode('list')} className={`view-toggle-btn ${uiState.planningViewMode === 'list' ? 'active' : ''}`}><i className="fas fa-list"></i></button>
                                    <button onClick={() => setPlanningViewMode('kanban')} className={`view-toggle-btn ${uiState.planningViewMode === 'kanban' ? 'active' : ''}`}><i className="fas fa-columns"></i></button>
                                    <button onClick={() => setPlanningViewMode('grid')} className={`view-toggle-btn ${uiState.planningViewMode === 'grid' ? 'active' : ''}`}><i className="fas fa-th"></i></button>
                                    <button onClick={() => setPlanningViewMode('calendar')} className={`view-toggle-btn ${uiState.planningViewMode === 'calendar' ? 'active' : ''}`}><i className="fas fa-calendar-alt"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`flex-grow ${isReadOnly ? '!pointer-events-auto' : ''}`}>
                    {uiState.planningViewMode === 'grid' ? (
                        <PlanningGrid 
                            displayColumns={filteredDisplayColumns}
                            laidOutOps={laidOutOps}
                            laidOutApprovedHolds={laidOutApprovedHolds as any[]}
                            laidOutPendingHolds={laidOutPendingHolds as any[]}
                            laidOutCompletedHolds={laidOutCompletedHolds as any[]}
                            laidOutManpower={laidOutManpower}
                            viewDate={viewDate} 
                            onCardClick={setSidebarOpId} 
                            onGridClick={handleGridClick} 
                            onHoldItemClick={handleHoldItemClick}
                            headerTop={headerTop}
                            isReadOnly={isReadOnly}
                            isSchedulerMode={isSchedulerMode}
                            draggingOp={draggingOp}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            confirmPlacement={confirmPlacement}
                            truckDisplay={truckDisplay}
                            currentUser={currentUser}
                            totalGridHeight={totalGridHeight}
                            infraRowLayouts={infraRowLayouts}
                            currentTime={simulatedTime}
                            gridStartDate={gridStartDate}
                            onShiftDate={handleShiftDate}
                        />
                    ) : uiState.planningViewMode === 'kanban' ? (
                        <PlanningKanban operations={filteredForKanban} />
                    ) : uiState.planningViewMode === 'calendar' ? (
                        <PlanningCalendar onCardClick={setSidebarOpId} />
                    ) : <PlanningList operations={scheduledOps} />}
                </div>
                
                {shouldShowBottomBar && uiState.planningViewMode !== 'calendar' && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 p-2 sm:p-4 pointer-events-none lg:left-auto" style={{ left: isDesktopSidebarCollapsed ? '80px' : '288px' }}>
                        <div className="pointer-events-auto card shadow-2xl bg-background-card/80 backdrop-blur-sm flex flex-col max-w-screen-2xl mx-auto">
                            <div
                                className="p-3 flex items-center cursor-pointer hover:bg-slate-50"
                                style={{ gridTemplateColumns: `repeat(${numSections}, 1fr)`}}
                            >
                                <div className="flex-1 min-w-0 font-semibold text-sm">
                                    {shouldShowLegend && "Legend"}
                                </div>
                                <div className="flex-1 min-w-0 font-semibold text-sm text-red-600">
                                    {shouldShowNoShows && !isReadOnly && `No Shows (${noShowOps.length})`}
                                </div>
                                <div className="flex-1 min-w-0 font-semibold text-sm text-yellow-800">
                                     {shouldShowReschedule && !isReadOnly && `To Reschedule (${rescheduleOps.length})`}
                                </div>
                                <button className="text-text-secondary ml-4"  onClick={() => setIsBottomBarExpanded(p => !p)}>
                                    <i className={`fas transition-transform duration-300 ${isBottomBarExpanded ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
                                </button>
                            </div>
                            
                            <div className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${isBottomBarExpanded ? 'max-h-40' : 'max-h-0'}`}>
                                <div className="flex border-t" style={{ height: '140px' }}>
                                    {shouldShowLegend && (
                                        <div className="flex-1 p-3 min-w-0">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 legend-container large-mode">
                                                {legendItems.map(item => (
                                                    <div key={item.label} className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 ${item.colorClass}`}></div>
                                                        <span className="text-sm text-text-secondary whitespace-nowrap">{item.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {shouldShowNoShows && !isReadOnly && (
                                        <div className="flex-1 p-3 min-w-0 border-l overflow-y-auto space-y-2">
                                            {noShowOps.map(op => (
                                                <div key={op.id} className="p-2 bg-white border border-red-200 rounded-lg flex items-center justify-between gap-2">
                                                    <div>
                                                        <p className="font-bold text-red-800 text-xs truncate">{op.transportId} ({op.licensePlate})</p>
                                                        <p className="text-xs text-red-700 truncate">{op.transferPlan[0]?.transfers[0]?.product}</p>
                                                    </div>
                                                    <div className="flex-shrink-0 flex gap-1">
                                                        <button onClick={() => handleProcessArrival(op.id)} className="btn-secondary !text-xs !py-1 !px-2">Process</button>
                                                        <button onClick={() => handleReschedule(op)} className="btn-primary !text-xs !py-1 !px-2">Move</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                     {shouldShowReschedule && !isReadOnly && (
                                        <div className="flex-1 p-3 min-w-0 border-l overflow-y-auto space-y-2">
                                            {rescheduleOps.map(op => {
                                                const { reason, isHigh } = getReasonAndPriority(op);
                                                return (
                                                    <div key={op.id} className="p-2 bg-white border border-yellow-200 rounded-lg flex items-center justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold text-yellow-800 text-xs truncate">{op.transportId} ({op.licensePlate})</p>
                                                                {isHigh && (<span className="text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">!</span>)}
                                                            </div>
                                                            <p className="text-xs text-yellow-700 truncate" title={reason}>{reason}</p>
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            <button onClick={() => handleReschedule(op)} className="btn-primary !text-xs !py-1 !px-2">Reschedule</button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PlanningBoard;
