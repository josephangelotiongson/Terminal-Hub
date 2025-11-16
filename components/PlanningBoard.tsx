
import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Hold, Modality, View, SOFItem, TerminalSettings, User, Transfer } from '../types';
import HoldModal from './HoldModal';
import PlanningList from './PlanningList'; // <-- Import new component
import InputModal from './InputModal';
import { formatInfraName, calculateOperationValue, formatCurrency, validateOperationPlan, getOperationDurationHours, getOperationColorClass, naturalSort, createDocklineToWharfMap, canCreateHold, canReschedule, getIcon, canCreateOperation, formatDateTime } from '../utils/helpers';
import PlanningKanban from './PlanningKanban';
import ElapsedTimeBadge from './ElapsedTimeBadge';
import NoShowModal from './NoShowModal';
import ToRescheduleModal from './ToRescheduleModal';

const HOUR_WIDTH_PX = 80;
const RESOURCE_COL_WIDTH_PX = 140;
const TIME_HEADER_HEIGHT_PX = 40;

const timeToPosition = (time: Date, viewDate: Date) => {
    const startOfDay = new Date(viewDate);
    startOfDay.setHours(0, 0, 0, 0);
    const diffMs = time.getTime() - startOfDay.getTime();
    return (diffMs / (60 * 60 * 1000)) * HOUR_WIDTH_PX;
};

const positionToTime = (posX: number, viewDate: Date) => {
    const startOfDay = new Date(viewDate);
    startOfDay.setHours(0, 0, 0, 0);
    const totalMs = (posX / HOUR_WIDTH_PX) * (60 * 60 * 1000);
    return new Date(startOfDay.getTime() + totalMs);
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
}

const MemoizedGridItem = React.memo((props: MemoizedGridItemProps) => {
    const { op, transfer, top, height, left, width, title, validation, onCardClick, zIndex, isReadOnly, isSchedulerMode, onDragStart, onDragEnd, isDragging, truckDisplay, currentUser } = props;
    
    const hasIssues = !validation.isValid;
    const needsReschedule = op.currentStatus === 'Reschedule Required' || op.currentStatus === 'No Show' || op.currentStatus === 'Reschedule Requested';
    const hasConflictOrIssue = needsReschedule || hasIssues;

    const colorClass = (hasIssues && (op.status === 'planned' || op.status === 'active'))
        ? 'status-rejected'
        : getOperationColorClass(op);

    const showRescheduleIndicator = needsReschedule || (hasIssues && op.status === 'planned');
    const isUrgentReschedule = op.currentStatus === 'No Show' || (op.requeueDetails?.priority === 'high');

    const waitTimeStart = useMemo(() => {
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
    }, [op]);
    
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
    
    return (
        <div 
            title={title} 
            draggable={isDraggable}
            onDragStart={isDraggable ? (e) => onDragStart(e, op) : undefined}
            onDragEnd={isDraggable ? onDragEnd : undefined}
            className={`planning-grid-item ${colorClass} !p-1 flex items-center ${isReadOnly ? '!cursor-default' : ''} ${isDraggable ? 'cursor-grab' : ''} ${isDragging ? 'opacity-30' : ''}`} 
            style={{ top, height, left, width: width, zIndex }} 
            onClick={handleClick}
        >
            <div className="flex items-center gap-1.5 overflow-hidden w-full">
                <i className={`fas ${getIcon(op.modality)} flex-shrink-0`}></i>
                <span className="truncate flex-grow">{cardLabel}</span>
                {waitTimeStart && (
                    <ElapsedTimeBadge startTime={waitTimeStart} className="!text-white !bg-black/40" />
                )}
                {hasConflictOrIssue && op.currentStatus !== 'No Show' && (
                    <div className="text-white text-sm" title={`Plan has issues or conflicts. Click to view.`}>
                        <i className="fas fa-exclamation-triangle animate-pulse"></i>
                    </div>
                )}
                 {op.currentStatus === 'No Show' && (
                    <div className="text-white text-[0.6rem] font-bold bg-red-800/80 px-1 rounded-sm">NO SHOW</div>
                )}
                {showRescheduleIndicator && (
                    <div title="This operation requires rescheduling" className={`px-1 rounded-sm ${isUrgentReschedule ? 'animate-pulse bg-white/20' : ''}`}>
                        <span className="text-xs font-bold"><i className="fas fa-calendar-alt"></i></span>
                    </div>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    const prevOp = prevProps.op;
    const nextOp = nextProps.op;

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
    INFRA_ROW_HEIGHT_PX: number;
    SUB_ROW_HEIGHT_PX: number;
    currentUser: User;
}

const PlanningGrid: React.FC<PlanningGridProps> = ({ displayColumns, laidOutOps, laidOutApprovedHolds, laidOutPendingHolds, laidOutCompletedHolds, laidOutManpower, viewDate, onCardClick, onGridClick, onHoldItemClick, headerTop, isReadOnly, isSchedulerMode, draggingOp, confirmPlacement: contextConfirmPlacement, onDragStart, onDragEnd, truckDisplay, INFRA_ROW_HEIGHT_PX, SUB_ROW_HEIGHT_PX, currentUser }) => {
    const { simulatedTime, placementOpId, getOperationById, currentTerminalSettings, cancelPlacementMode } = useContext(AppContext)!;
    const gridMainRef = useRef<HTMLDivElement>(null);
    const mainContentRef = useRef<HTMLDivElement>(null);
    const topScrollbarRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<{ startX: number; currentX: number; rowIndex: number } | null>(null);
    const firstLoad = useRef(true);

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
        };
        
        top.addEventListener('scroll', handleTopScroll);
        main.addEventListener('scroll', handleMainScroll);

        return () => {
            top.removeEventListener('scroll', handleTopScroll);
            main.removeEventListener('scroll', handleMainScroll);
        };
    }, []);

    const handleGhostMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!opToPlaceInfo || !gridMainRef.current || isReadOnly) return;
        
        const { op, durationHours } = opToPlaceInfo;
        const rect = gridMainRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;

        const rowIndex = Math.floor(y / INFRA_ROW_HEIGHT_PX);
        if (rowIndex < 0 || rowIndex >= displayColumns.length) {
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
        
        const subRowIndex = Math.floor((y % INFRA_ROW_HEIGHT_PX) / SUB_ROW_HEIGHT_PX);

        setGhostPosition({
            top: (rowIndex * INFRA_ROW_HEIGHT_PX) + (subRowIndex * SUB_ROW_HEIGHT_PX),
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
        
        const rowIndex = Math.floor(y / INFRA_ROW_HEIGHT_PX);
        const resource = displayColumns[rowIndex];
        
        const snappedX = Math.round(x / (HOUR_WIDTH_PX / 4)) * (HOUR_WIDTH_PX / 4);
        const newTime = positionToTime(snappedX, viewDate);
        
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
        
        const rowIndex = Math.floor(y / INFRA_ROW_HEIGHT_PX);
        const resource = displayColumns[rowIndex];
        
        const snappedX = Math.round(x / (HOUR_WIDTH_PX / 4)) * (HOUR_WIDTH_PX / 4);
        const newTime = positionToTime(snappedX, viewDate);

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
            setCurrentTimePos(timeToPosition(simulatedTime, viewDate));
        } else {
            setCurrentTimePos(null);
        }
    }, [viewDate, isViewingMockToday, simulatedTime]);
    
    useEffect(() => {
        if (isViewingMockToday && currentTimePos && mainContentRef.current && firstLoad.current) {
            mainContentRef.current.scrollLeft = currentTimePos - mainContentRef.current.clientWidth / 3;
            firstLoad.current = false;
        }
    }, [isViewingMockToday, currentTimePos]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly || (!canCreateOperation(currentUser) && !canCreateHold(currentUser))) return;
        if (placementOpId || isSchedulerMode || (e.target as HTMLElement).closest('.planning-grid-item, .planning-grid-hold, .planning-grid-pending-hold')) return;
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const rowIndex = Math.floor(y / INFRA_ROW_HEIGHT_PX);

        if (rowIndex >= 0 && rowIndex < displayColumns.length) {
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
                startTime = positionToTime(startX, viewDate);
                endTime = positionToTime(endX, viewDate);
            } else {
                startTime = positionToTime(selection.startX, viewDate);
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

    const totalGridHeight = displayColumns.length * INFRA_ROW_HEIGHT_PX;
    const totalGridWidth = 24 * HOUR_WIDTH_PX;

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
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} style={{ width: HOUR_WIDTH_PX }} className="text-center font-semibold text-xs py-2 border-r">{String(i).padStart(2, '0')}:00</div>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex" style={{ height: totalGridHeight }}>
                        {/* Resource Column (Infrastructure) */}
                        <div style={{ width: RESOURCE_COL_WIDTH_PX }} className="flex-shrink-0 sticky left-0 z-30 bg-slate-50">
                            {displayColumns.map((infraId) => (
                                <div key={infraId} style={{ height: INFRA_ROW_HEIGHT_PX }} className="p-2 border-r border-b font-bold text-sm flex items-center justify-center text-center">
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
                            {/* Grid Lines */}
                            {displayColumns.map((_, i) => <div key={`hline-${i}`} className="absolute left-0 w-full h-px bg-slate-300" style={{ top: (i + 1) * INFRA_ROW_HEIGHT_PX, zIndex: 1 }}></div>)}
                            {Array.from({ length: 24 }).map((_, i) => <div key={`vline-${i}`} className="absolute top-0 bottom-0 w-px bg-slate-200" style={{ left: (i + 1) * HOUR_WIDTH_PX, zIndex: 1 }}></div>)}
                            
                            {/* Content */}
                            {laidOutManpower.map(item => <MemoizedManpowerItem key={item.key} {...item} />)}
                            {laidOutOps.map(({ op, transfer, layout, title, validation }) => (
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
                                    top: selection.rowIndex * INFRA_ROW_HEIGHT_PX, 
                                    height: INFRA_ROW_HEIGHT_PX 
                                }} />
                            )}

                            {/* Ghost for drag/placement */}
                            {opToPlaceInfo && !isReadOnly && ghostPosition?.visible && (
                                <div 
                                    title={ghostPosition.isValid ? `Place ${opToPlaceInfo.op.transportId}` : ghostPosition.validationMessage}
                                    className={`planning-grid-item status-planned border-2 border-dashed pointer-events-none flex items-center
                                        ${ghostPosition.isValid ? 'opacity-70 border-brand-primary' : '!bg-red-500/70 !border-red-700'}
                                    `}
                                    style={{
                                        position: 'absolute', top: ghostPosition.top, left: ghostPosition.left,
                                        height: ghostPosition.height, width: ghostPosition.width, zIndex: 99
                                    }}
                                >
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <i className={`fas ${getIcon(opToPlaceInfo.op.modality)}`}></i>
                                        <span className="truncate">{opToPlaceInfo.op.transportId}</span>
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

                {/* Services */}
                <div className="card p-3 bg-slate-50">
                    <h4 className="font-semibold text-sm mb-2">Services</h4>
                    <p className="text-xs">{ (firstTransfer?.specialServices || []).length > 0 ? (firstTransfer?.specialServices || []).map(s => s.name).join(', ') : 'No special services.' }</p>
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
    if (!context) return null;

    const { 
        operations, holds, selectedTerminal, uiState, setPlanningViewMode, 
        saveHoldAndRequeueConflicts, switchView, currentTerminalSettings, openRescheduleModal, 
        currentUser, cancelHold, approveOutage, rejectOutage, requeueOperation, openNewOpModal, 
        visibleInfrastructure, simulatedTime, settings, placementOpId, cancelPlacementMode, 
        confirmPlacement, isSchedulerMode, setIsSchedulerMode, workspaceFilter, 
        planningCustomerFilter, setPlanningCustomerFilter, getOperationById, isDesktopSidebarCollapsed,
        openAcceptNoShowModal
    } = context;
    
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

    const [isLegendCollapsed, setIsLegendCollapsed] = useState(true);
    const [isNoShowCollapsed, setIsNoShowCollapsed] = useState(true);
    const [isToRescheduleCollapsed, setIsToRescheduleCollapsed] = useState(true);
    const [lanesPerInfra, setLanesPerInfra] = useState<number>(2);
    
    const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false);
    const customerFilterRef = useRef<HTMLDivElement>(null);

    const [sidebarOpId, setSidebarOpId] = useState<string | null>(null);
    const sidebarOp = useMemo(() => sidebarOpId ? getOperationById(sidebarOpId) : null, [sidebarOpId, getOperationById]);

    const SUB_ROW_HEIGHT_PX = 35;
    const INFRA_ROW_HEIGHT_PX = SUB_ROW_HEIGHT_PX * lanesPerInfra;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, op: Operation) => {
        e.dataTransfer.setData('opId', op.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingOp({ id: op.id, durationHours: getOperationDurationHours(op) });
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        setDraggingOp(null);
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
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [holdContextMenu, customerFilterRef]);
    
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

    const { scheduledOps, dateApprovedHolds, datePendingHolds, dateCompletedHolds } = useMemo(() => {
        const startOfDay = new Date(viewDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(viewDate); endOfDay.setHours(23, 59, 59, 999);
        const terminalOps = operations.filter(op => op.terminal === selectedTerminal);

        const dateOps = terminalOps.filter(op => {
            const opEta = new Date(op.eta).getTime();
            const opDurationMs = getOperationDurationHours(op) * 3600 * 1000;
            const opEnd = opEta + opDurationMs;
            const startOfDayMs = startOfDay.getTime();
            const endOfDayMs = endOfDay.getTime();
            const overlapsViewDate = Math.max(opEta, startOfDayMs) < Math.min(opEnd, endOfDayMs);
            const completedOnThisDay = op.status === 'completed' && op.completedTime && new Date(op.completedTime) >= startOfDay && new Date(op.completedTime) <= endOfDay;
            const cancelledOnThisDay = op.status === 'cancelled' && op.cancellationDetails?.time && new Date(op.cancellationDetails.time) >= startOfDay && new Date(op.cancellationDetails.time) <= endOfDay;
            return overlapsViewDate || completedOnThisDay || cancelledOnThisDay;
        });

        const filteredOps = dateOps
            .filter(op => {
                if (workspaceFilter === 'all') return true;
                return op.modality === workspaceFilter;
            })
            .filter(op => {
                if (planningCustomerFilter.includes('All')) {
                    return true;
                }
                return op.transferPlan.some(line =>
                    line.transfers.some(transfer =>
                        transfer.customer && planningCustomerFilter.includes(transfer.customer)
                    )
                );
            });
        
        const holdsOnDate = holds.filter(h => new Date(h.startTime) < endOfDay && new Date(h.endTime) > startOfDay);

        return {
            scheduledOps: filteredOps,
            dateApprovedHolds: holdsOnDate.filter(h => h.status === 'approved' && !['Completed', 'Closed'].includes(h.workOrderStatus || '')),
            datePendingHolds: holdsOnDate.filter(h => h.status === 'pending' && h.workOrderStatus !== 'Closed'),
            dateCompletedHolds: holdsOnDate.filter(h => h.status === 'approved' && h.workOrderStatus === 'Completed'),
        };
    }, [operations, holds, selectedTerminal, viewDate, planningCustomerFilter, workspaceFilter]);
    
    const laidOutOps = useMemo(() => {
        const opsWithTimes = scheduledOps.map(op => ({
            op,
            start: new Date(op.eta).getTime(),
            end: new Date(op.eta).getTime() + getOperationDurationHours(op) * 3600 * 1000,
        })).sort((a, b) => a.start - b.start);
    
        const activeHolds = [...dateApprovedHolds, ...dateCompletedHolds].filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        const finalLayout: any[] = [];
    
        const opsByInfra: Record<string, typeof opsWithTimes> = {};
        opsWithTimes.forEach(item => {
            (item.op.transferPlan || []).forEach(tp => {
                if (visibleInfrastructure.includes(tp.infrastructureId)) {
                    if (!opsByInfra[tp.infrastructureId]) opsByInfra[tp.infrastructureId] = [];
                    opsByInfra[tp.infrastructureId].push(item);
                }
            });
        });
    
        visibleInfrastructure.forEach((infraId, infraIndex) => {
            const opsForInfra = opsByInfra[infraId] || [];
            if (opsForInfra.length === 0) return;
            
            const lanes = Array(lanesPerInfra).fill(0); // End times for each sub-row
    
            opsForInfra.forEach(item => {
                let subRowIndex = -1;
                for (let i = 0; i < lanes.length; i++) {
                    if (item.start >= lanes[i]) {
                        subRowIndex = i;
                        break;
                    }
                }
                if (subRowIndex === -1) subRowIndex = lanes.length - 1; // Overlap on the last lane if needed
                lanes[subRowIndex] = item.end;
                
                const top = (infraIndex * INFRA_ROW_HEIGHT_PX) + (subRowIndex * SUB_ROW_HEIGHT_PX) + 1;
                const height = SUB_ROW_HEIGHT_PX - 2;
                const zIndex = 20 + subRowIndex;
    
                if (item.op.modality === 'vessel') {
                    const PUMP_RATE_TPH = 1000;
                    const CLEANING_HOURS = 1;
                    let currentTimeForLine = new Date(item.op.eta).getTime();
    
                    item.op.transferPlan.forEach(line => {
                        if (line.infrastructureId !== infraId) return;
    
                        line.transfers.forEach(transfer => {
                            if (transfer.preTransferCleaningSof) {
                                currentTimeForLine += CLEANING_HOURS * 3600 * 1000;
                            }
    
                            const durationHours = (transfer.tonnes || 0) / PUMP_RATE_TPH;
                            const transferStartTime = new Date(currentTimeForLine);
                            const transferEndTime = new Date(currentTimeForLine + durationHours * 3600 * 1000);
    
                            const left = timeToPosition(transferStartTime, viewDate);
                            const width = (durationHours * HOUR_WIDTH_PX);
                            
                            const validation = validateOperationPlan(item.op, currentTerminalSettings, settings, activeHolds);
    
                            finalLayout.push({
                                op: item.op,
                                transfer: transfer,
                                layout: { top, height, left, width, zIndex },
                                title: `${item.op.transportId} - ${transfer.product}\nCustomer: ${transfer.customer}\nTonnes: ${transfer.tonnes}`,
                                validation,
                            });
    
                            currentTimeForLine = transferEndTime.getTime();
                        });
                    });
                } else { // Truck or Rail
                    const left = timeToPosition(new Date(item.start), viewDate);
                    let width = timeToPosition(new Date(item.end), viewDate) - left;
                    if (width < 2) width = 2;
    
                    const { totalValue } = isCommercials ? calculateOperationValue(item.op, settings) : { totalValue: 0 };
                    const validation = (item.op.status === 'planned' || item.op.status === 'active') ? validateOperationPlan(item.op, currentTerminalSettings, settings, activeHolds) : { isValid: true, issues: [] };
                    const firstTransfer = item.op.transferPlan?.[0]?.transfers?.[0];
                    const cardLabel = item.op.modality === 'truck' ? (truckDisplay === 'plate' ? item.op.licensePlate : firstTransfer?.customer || 'N/A') : item.op.transportId;
            
                    finalLayout.push({
                        op: item.op,
                        layout: { top, height, left, width, zIndex },
                        title: `${cardLabel}\nETA: ${new Date(item.op.eta).toLocaleTimeString()}${isCommercials ? `\nValue: ${formatCurrency(totalValue)}` : ''}${!validation.isValid ? `\n\nISSUES:\n- ${validation.issues.join('\n- ')}` : ''}`,
                        validation,
                    });
                }
            });
        });
        return finalLayout;
    }, [scheduledOps, visibleInfrastructure, viewDate, settings, isCommercials, dateApprovedHolds, dateCompletedHolds, currentTerminalSettings, truckDisplay, INFRA_ROW_HEIGHT_PX, SUB_ROW_HEIGHT_PX, lanesPerInfra]);

    const manpowerScheduleOverlay = useMemo(() => {
        if (!operatorUsers || !shiftTimes) return [];

        const schedule: { operatorName: string; resource: string; startTime: string; endTime: string }[] = [];
        const todayStr = viewDate.toISOString().split('T')[0];

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
        return schedule;
    }, [operatorUsers, shiftTimes, viewDate]);

    const laidOutManpower = useMemo(() => {
        if (!manpowerScheduleOverlay) return [];
        
        return manpowerScheduleOverlay.map((item, index) => {
            const infraIndex = visibleInfrastructure.findIndex(c => c === item.resource);
            if (infraIndex === -1) return null;
            
            const top = (infraIndex * INFRA_ROW_HEIGHT_PX) + ((lanesPerInfra - 1) * SUB_ROW_HEIGHT_PX); // Use last sub-row
            const height = SUB_ROW_HEIGHT_PX;
    
            const start = new Date(item.startTime);
            const end = new Date(item.endTime);
    
            const startOfDay = new Date(viewDate); startOfDay.setHours(0,0,0,0);
            const endOfDay = new Date(viewDate); endOfDay.setHours(23,59,59,999);
            
            const clampedStart = new Date(Math.max(start.getTime(), startOfDay.getTime()));
            const clampedEnd = new Date(Math.min(end.getTime(), endOfDay.getTime()));
    
            const left = timeToPosition(clampedStart, viewDate);
            let width = timeToPosition(clampedEnd, viewDate) - left;
            
            if (width <= 0) return null;
    
            return { key: `manpower-${index}`, operatorName: item.operatorName, top, height, left, width };
        }).filter(Boolean);
    }, [manpowerScheduleOverlay, visibleInfrastructure, viewDate, INFRA_ROW_HEIGHT_PX, SUB_ROW_HEIGHT_PX, lanesPerInfra]);

    const createHoldLayout = (holds: Hold[]) => {
        return holds.map(hold => {
            const infraIndex = visibleInfrastructure.findIndex(c => c === hold.resource);
            if (infraIndex === -1) return null;
            
            const holdTop = infraIndex * INFRA_ROW_HEIGHT_PX;
            const holdHeight = INFRA_ROW_HEIGHT_PX;

            const start = new Date(hold.startTime);
            const end = new Date(hold.endTime);
            const left = timeToPosition(start, viewDate);
            let width = timeToPosition(end, viewDate) - left;
            if (width <= 0) width = 2;

            return { hold, layout: { top: holdTop, height: holdHeight, left, width } };
        }).filter(Boolean);
    };

    const laidOutApprovedHolds = useMemo(() => createHoldLayout(dateApprovedHolds), [dateApprovedHolds, visibleInfrastructure, viewDate, INFRA_ROW_HEIGHT_PX]);
    const laidOutPendingHolds = useMemo(() => createHoldLayout(datePendingHolds), [datePendingHolds, visibleInfrastructure, viewDate, INFRA_ROW_HEIGHT_PX]);
    const laidOutCompletedHolds = useMemo(() => createHoldLayout(dateCompletedHolds), [dateCompletedHolds, visibleInfrastructure, viewDate, INFRA_ROW_HEIGHT_PX]);
    
    const rescheduleOps = useMemo(() => {
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');

        const opsForReschedule = operations.filter(op => {
            if (op.terminal !== selectedTerminal) return false;

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
    }, [operations, holds, selectedTerminal, currentTerminalSettings, settings]);

    const noShowOps = useMemo(() => {
        return operations.filter(op => 
            op.terminal === selectedTerminal &&
            op.currentStatus === 'No Show'
        ).sort((a,b) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
    }, [operations, selectedTerminal]);


    const filteredForKanban = useMemo(() => {
        if (visibleInfrastructure.length === Object.keys(currentTerminalSettings.infrastructureModalityMapping || {}).length) {
            return scheduledOps;
        }
        return scheduledOps.filter(op =>
            op.transferPlan.some(tp => visibleInfrastructure.includes(tp.infrastructureId))
        );
    }, [scheduledOps, visibleInfrastructure, currentTerminalSettings]);

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
    
    const masterCustomers = useMemo(() => (currentTerminalSettings.masterCustomers || []).sort(), [currentTerminalSettings.masterCustomers]);
    
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
        setIsNoShowCollapsed(true);
    };

    const handleReschedule = (op: Operation) => {
        openRescheduleModal(op.id, new Date(op.eta));
        setIsNoShowCollapsed(true);
        setIsToRescheduleCollapsed(true);
    };

    const shouldShowReschedule = rescheduleOps.length > 0;
    const shouldShowNoShows = noShowOps.length > 0;
    const shouldShowLegend = uiState.planningViewMode === 'grid' || uiState.planningViewMode === 'kanban';
    const shouldShowBottomBar = shouldShowLegend || shouldShowReschedule || shouldShowNoShows;

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
                <div ref={controlBarRef} className={`sticky top-0 z-40 bg-background-card border-b border-border-primary ${isReadOnly ? '!pointer-events-auto' : ''}`}>
                    {placementOpId && !isReadOnly && (
                        <div className="bg-indigo-600 text-white p-2 text-center font-semibold text-sm flex justify-between items-center">
                            <span>Click on the grid to place the operation. Press ESC to cancel.</span>
                            <button onClick={cancelPlacementMode} className="btn-icon !text-white !p-1"><i className="fas fa-times"></i></button>
                        </div>
                    )}
                    <div className="p-4">
                        <div className="flex flex-wrap items-center gap-y-2">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-lg font-semibold text-text-secondary whitespace-nowrap">{viewDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    <button onClick={() => setViewDate(d => new Date(d.setDate(d.getDate() - 1)))} className="btn-icon"><i className="fas fa-chevron-left"></i></button>
                                    <button onClick={() => setViewDate(simulatedTime)} className="btn-secondary !py-1 !px-3 text-sm">Today</button>
                                    <button onClick={() => setViewDate(d => new Date(d.setDate(d.getDate() + 1)))} className="btn-icon"><i className="fas fa-chevron-right"></i></button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 gap-y-2 ml-auto">
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
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-text-secondary whitespace-nowrap">Lanes per Asset</label>
                                        <div className="planning-board-view-toggle !p-0">
                                            {[2, 3, 4].map(num => (
                                                <button 
                                                    key={num}
                                                    onClick={() => setLanesPerInfra(num)} 
                                                    className={`view-toggle-btn !px-3 ${lanesPerInfra === num ? 'active' : ''}`}
                                                    title={`${num} lanes`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                                        <button
                                            onClick={() => setIsSchedulerMode(prev => !prev)}
                                            className={`btn-secondary !py-2 !px-3 ${isSchedulerMode ? '!bg-indigo-600 !text-white !border-indigo-600' : ''}`}
                                            title="Toggle Scheduler Mode (Drag & Drop)"
                                        >
                                            <i className="fas fa-hand-paper"></i>
                                        </button>
                                    </>
                                )}
                                <div className="planning-board-view-toggle">
                                    <button onClick={() => setPlanningViewMode('kanban')} className={`view-toggle-btn ${uiState.planningViewMode === 'kanban' ? 'active' : ''}`}><i className="fas fa-columns"></i></button>
                                    <button onClick={() => setPlanningViewMode('list')} className={`view-toggle-btn ${uiState.planningViewMode === 'list' ? 'active' : ''}`}><i className="fas fa-list"></i></button>
                                    <button onClick={() => setPlanningViewMode('grid')} className={`view-toggle-btn ${uiState.planningViewMode === 'grid' ? 'active' : ''}`}><i className="fas fa-th"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`flex-grow ${isReadOnly ? '!pointer-events-auto' : ''}`}>
                    {uiState.planningViewMode === 'grid' ? (
                        <PlanningGrid 
                            displayColumns={visibleInfrastructure}
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
                            INFRA_ROW_HEIGHT_PX={INFRA_ROW_HEIGHT_PX}
                            SUB_ROW_HEIGHT_PX={SUB_ROW_HEIGHT_PX}
                            currentUser={currentUser}
                        />
                    ) : uiState.planningViewMode === 'kanban' ? (
                        <PlanningKanban operations={filteredForKanban} />
                    ) : <PlanningList operations={scheduledOps} />}
                </div>
                
                {shouldShowBottomBar && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 p-2 sm:p-4 pointer-events-none lg:left-auto" style={{ left: isDesktopSidebarCollapsed ? '80px' : '288px' }}>
                        <div className="max-w-screen-2xl w-full mx-auto flex items-stretch gap-4">
                            {shouldShowLegend && (
                                <div className="pointer-events-auto flex-1 min-w-0">
                                    <div className="card shadow-lg bg-background-card/80 backdrop-blur-sm h-full flex flex-col">
                                        <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setIsLegendCollapsed(p => !p)}>
                                            <h4 className="font-semibold">Legend</h4>
                                            <button className="text-text-secondary"><i className={`fas transition-transform duration-300 ${isLegendCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i></button>
                                        </div>
                                        {!isLegendCollapsed && (
                                            <div className="p-3 border-t">
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
                                    </div>
                                </div>
                            )}

                            {shouldShowNoShows && !isReadOnly && (
                                <div className="pointer-events-auto flex-1 min-w-0">
                                    <div className="card shadow-xl bg-red-50 border border-red-200 h-full flex flex-col">
                                        <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-red-100" onClick={() => setIsNoShowCollapsed(p => !p)}>
                                            <h3 className="text-base font-semibold text-red-600"><i className="fas fa-calendar-times mr-2"></i>No Shows ({noShowOps.length})</h3>
                                            <button className="text-red-600 hover:text-red-800"><i className={`fas transition-transform duration-300 ${isNoShowCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i></button>
                                        </div>
                                        {!isNoShowCollapsed && (
                                            <div className="p-3 border-t border-red-200 flex-grow max-h-[25vh] overflow-y-auto space-y-2">
                                                {noShowOps.map(op => (
                                                    <div key={op.id} className="p-3 bg-white border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap"><p className="font-bold text-red-800">{op.transportId} ({op.licensePlate})</p><ElapsedTimeBadge startTime={op.requeueDetails?.time || op.eta} /></div>
                                                            <p className="text-xs text-red-700">Scheduled ETA: {formatDateTime(op.eta)}</p>
                                                            <p className="text-xs text-red-700">Product: {op.transferPlan[0]?.transfers[0]?.product}</p>
                                                        </div>
                                                        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 items-stretch">
                                                            <button onClick={() => handleProcessArrival(op.id)} className="btn-secondary !text-xs !py-1.5 !px-3">Process Arrival</button>
                                                            <button onClick={() => handleReschedule(op)} className="btn-primary !text-xs !py-1.5 !px-3">Reschedule</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {shouldShowReschedule && !isReadOnly && (
                                <div className="pointer-events-auto flex-1 min-w-0">
                                    <div className="card shadow-xl bg-yellow-50 border border-yellow-200 h-full flex flex-col">
                                        <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-yellow-100" onClick={() => setIsToRescheduleCollapsed(p => !p)}>
                                            <h3 className="text-base font-semibold text-yellow-800"><i className="fas fa-exclamation-triangle mr-2"></i>To Reschedule ({rescheduleOps.length})</h3>
                                            <button className="text-yellow-800 hover:text-yellow-900"><i className={`fas transition-transform duration-300 ${isToRescheduleCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i></button>
                                        </div>
                                        {!isToRescheduleCollapsed && (
                                            <div className="p-3 border-t border-yellow-200 flex-grow max-h-[25vh] overflow-y-auto space-y-2">
                                                {rescheduleOps.map(op => {
                                                    const { reason, isHigh } = getReasonAndPriority(op);
                                                    const wasAtTerminal = op.modality === 'truck' && op.transferPlan?.[0]?.transfers?.[0]?.sof?.some(s => s.event === 'Arrived' && s.status === 'complete');
                                                    return (
                                                        <div key={op.id} className="p-3 bg-white border border-yellow-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap"><p className="font-bold text-yellow-800">{op.transportId} ({op.licensePlate})</p>{isHigh && (<span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 animate-pulse">HIGH PRIORITY</span>)}{wasAtTerminal && op.requeueDetails?.time && (<ElapsedTimeBadge startTime={op.requeueDetails.time} />)}</div>
                                                                <p className="text-xs text-yellow-700">Reason: {reason}</p>
                                                                <p className="text-xs text-yellow-700">Product: {op.transferPlan[0]?.transfers[0]?.product}</p>
                                                            </div>
                                                            <div className="flex-shrink-0"><button onClick={() => handleReschedule(op)} className="btn-primary !text-xs !py-1.5 !px-3 w-full sm:w-auto">Reschedule</button></div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PlanningBoard;
