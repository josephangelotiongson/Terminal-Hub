

import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Hold, Modality, View, SOFItem, TerminalSettings } from '../types';
import HoldModal from './HoldModal';
import PlanningList from './PlanningList'; // <-- Import new component
import InputModal from './InputModal';
import { formatInfraName, calculateOperationValue, formatCurrency, validateOperationPlan, getOperationDurationHours, getOperationColorClass, naturalSort, createDocklineToWharfMap, canCreateHold, canReschedule, getIcon, canCreateOperation } from '../utils/helpers';
import PlanningKanban from './PlanningKanban';
import ElapsedTimeBadge from './ElapsedTimeBadge';

const HOUR_HEIGHT_PX = 40;
const COLUMN_WIDTH_PX = 160;
const TIMELINE_WIDTH_REM = 5; // w-20
const TIMELINE_WIDTH_PX = 80; // 5rem * 16px

const timeToPosition = (time: Date, viewDate: Date) => {
    const startOfDay = new Date(viewDate);
    startOfDay.setHours(0, 0, 0, 0);
    const diffMs = time.getTime() - startOfDay.getTime();
    return (diffMs / (60 * 60 * 1000)) * HOUR_HEIGHT_PX;
};

const positionToTime = (posY: number, viewDate: Date) => {
    const startOfDay = new Date(viewDate);
    startOfDay.setHours(0, 0, 0, 0);
    const totalMs = (posY / HOUR_HEIGHT_PX) * (60 * 60 * 1000);
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
    top: number;
    height: number;
    left: number;
    width: number;
    title: string;
    validation: { isValid: boolean; issues: string[] };
    switchView: (view: View, opId?: string | null) => void;
    zIndex?: number;
    isReadOnly?: boolean;
}

const MemoizedGridItem = React.memo((props: MemoizedGridItemProps) => {
    const { op, top, height, left, width, title, validation, switchView, zIndex, isReadOnly } = props;
    
    const hasIssues = !validation.isValid;
    const needsReschedule = op.currentStatus === 'Reschedule Required' || op.currentStatus === 'No Show';
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
            switchView('operation-details', op.id);
        }
    };
    
    return (
        <div 
            title={title} 
            className={`planning-grid-item ${colorClass} !p-1.5 flex flex-col justify-between ${isReadOnly ? '!cursor-default' : ''}`} 
            style={{ top, height, left, width: width - 8, margin: '0 4px', zIndex }} 
            onClick={handleClick}
        >
            <div className="flex justify-between items-start w-full gap-2">
                <div className="flex items-start gap-1.5 overflow-hidden">
                    <i className={`fas ${op.modality === 'vessel' ? 'fa-ship' : op.modality === 'truck' ? 'fa-truck' : 'fa-train'} pt-1 flex-shrink-0`}></i>
                    <span className="truncate">{op.transportId}</span>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {waitTimeStart && (
                        <ElapsedTimeBadge startTime={waitTimeStart} className="!text-white !bg-black/40" />
                    )}
                    {hasConflictOrIssue && op.currentStatus !== 'No Show' && (
                        <div className="text-white text-base" title={`Plan has issues or conflicts. Click to view.`}>
                            <i className="fas fa-exclamation-triangle animate-pulse"></i>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-end w-full">
                <div>
                    {op.currentStatus === 'No Show' && (
                        <div className="text-white text-[0.6rem] font-bold bg-red-800/80 px-1">NO SHOW</div>
                    )}
                </div>
                <div>
                    {showRescheduleIndicator && (
                        <div
                            title="This operation requires rescheduling"
                            className="px-1 py-0.5"
                        >
                            <span className={`text-xs font-bold ${isUrgentReschedule ? 'animate-pulse' : ''}`}>
                                <i className="fas fa-calendar-alt mr-1"></i>
                                Reschedule
                            </span>
                        </div>
                    )}
                </div>
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
        prevProps.top !== nextProps.top ||
        prevProps.left !== nextProps.left ||
        prevProps.width !== nextProps.width ||
        prevProps.height !== nextProps.height ||
        prevProps.zIndex !== nextProps.zIndex ||
        prevProps.isReadOnly !== nextProps.isReadOnly ||
        JSON.stringify(prevOp.transferPlan.map(tp => tp.infrastructureId)) !== JSON.stringify(nextProps.op.transferPlan.map(tp => tp.infrastructureId));
        
    return !relevantPropsChanged;
});


interface PlanningGridProps {
    displayColumns: string[];
    laidOutOps: any[];
    laidOutApprovedHolds: any[];
    laidOutPendingHolds: any[];
    laidOutCompletedHolds: any[];
    viewDate: Date;
    switchView: (view: View, opId?: string | null) => void;
    onGridClick: (hold: Hold | Partial<Hold>) => void;
    onHoldItemClick: (e: React.MouseEvent, hold: Hold) => void;
    headerTop: number;
    isReadOnly?: boolean;
}

const PlanningGrid: React.FC<PlanningGridProps> = ({ displayColumns, laidOutOps, laidOutApprovedHolds, laidOutPendingHolds, laidOutCompletedHolds, viewDate, switchView, onGridClick, onHoldItemClick, headerTop, isReadOnly }) => {
    const { currentUser, simulatedTime, placementOpId, confirmPlacement, cancelPlacementMode, getOperationById, currentTerminalSettings } = useContext(AppContext)!;
    const gridMainRef = useRef<HTMLDivElement>(null);
    const headerContainerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<{ startY: number; currentY: number; colIndex: number } | null>(null);
    const firstLoad = useRef(true);

    const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);
    const isViewingMockToday = viewDate.toDateString() === simulatedTime.toDateString();

    const placementOp = useMemo(() => placementOpId ? getOperationById(placementOpId) : null, [placementOpId, getOperationById]);
    const [ghostPosition, setGhostPosition] = useState<{ top: number, left: number, height: number, width: number, visible: boolean, isValid: boolean, validationMessage: string } | null>(null);

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

    const handlePlacementMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!placementOp || !gridMainRef.current || isReadOnly) return;
        
        const rect = gridMainRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;

        const colIndex = Math.floor(x / COLUMN_WIDTH_PX);
        if (colIndex < 0 || colIndex >= displayColumns.length) {
            if (ghostPosition?.visible) setGhostPosition(p => p ? { ...p, visible: false } : null);
            return;
        }

        const resource = displayColumns[colIndex];
        const transfer = placementOp.transferPlan[0]?.transfers[0];
        const requiredTank = transfer?.direction.includes('Tank to') ? transfer.from : transfer.to;
        
        let isValid = true;
        let validationMessage = '';

        if (requiredTank && transfer) {
            const connectedTanks = currentTerminalSettings.infrastructureTankMapping?.[resource] || [];
            if (!connectedTanks.includes(requiredTank)) {
                isValid = false;
                validationMessage = `Invalid: Bay ${formatInfraName(resource)} is not connected to Tank ${requiredTank} for ${transfer.product}.`;
            }
        }
        
        const snappedY = Math.round(y / (HOUR_HEIGHT_PX / 4)) * (HOUR_HEIGHT_PX / 4); // Snap to 15 mins

        setGhostPosition({
            top: snappedY,
            left: colIndex * COLUMN_WIDTH_PX + 4, // +4 for margin
            height: getOperationDurationHours(placementOp) * HOUR_HEIGHT_PX,
            width: COLUMN_WIDTH_PX - 8,
            visible: true,
            isValid,
            validationMessage
        });
    };

    const handlePlacementMouseLeave = () => {
        if (ghostPosition) setGhostPosition(p => p ? { ...p, visible: false } : null);
    };

    const handlePlacementClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly || !placementOp || !gridMainRef.current || !ghostPosition?.isValid) {
            if (ghostPosition && !ghostPosition.isValid) {
                alert(ghostPosition.validationMessage);
            }
            return;
        }

        const rect = gridMainRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        
        const colIndex = Math.floor(x / COLUMN_WIDTH_PX);
        const resource = displayColumns[colIndex];
        
        const snappedY = Math.round(y / (HOUR_HEIGHT_PX / 4)) * (HOUR_HEIGHT_PX / 4);
        const newTime = positionToTime(snappedY, viewDate);
        
        confirmPlacement(newTime.toISOString(), resource);
        setGhostPosition(null);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerContainerRef.current) {
            headerContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
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
        if (isViewingMockToday && currentTimePos && gridMainRef.current?.parentElement?.parentElement && firstLoad.current) {
            const mainContent = gridMainRef.current.closest('.main-content');
            if (mainContent) {
                mainContent.scrollTop = currentTimePos - mainContent.clientHeight / 3;
                firstLoad.current = false;
            }
        }
    }, [isViewingMockToday, currentTimePos]);


    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly || (!canCreateOperation(currentUser) && !canCreateHold(currentUser))) return;
        if (placementOpId || (e.target as HTMLElement).closest('.planning-grid-item, .planning-grid-hold, .planning-grid-pending-hold')) return;
        
        const mainContent = (e.currentTarget as HTMLElement).closest('.main-content');
        if (mainContent) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left;
            const colIndex = Math.floor(x / COLUMN_WIDTH_PX);

            if (displayColumns[colIndex]?.startsWith('Wharf')) {
                alert("Please schedule outages on specific infrastructure via the Outage Planning page.");
                return;
            }

            if (colIndex >= 0 && colIndex < displayColumns.length) {
                setSelection({ startY: y, currentY: y, colIndex });
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        if (selection) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = e.clientY - rect.top;
            setSelection({ ...selection, currentY: y });
        }
    };

    const handleMouseUp = () => {
        if (isReadOnly) return;
        if (selection) {
            const startY = Math.min(selection.startY, selection.currentY);
            const endY = Math.max(selection.startY, selection.currentY);
            let startTime, endTime;
            const resource = displayColumns[selection.colIndex];
            
            if (endY - startY > 10) { 
                startTime = positionToTime(startY, viewDate);
                endTime = positionToTime(endY, viewDate);
            } else {
                startTime = positionToTime(selection.startY, viewDate);
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

    const totalGridWidth = displayColumns.length * COLUMN_WIDTH_PX;
    const totalContainerWidth = totalGridWidth + TIMELINE_WIDTH_PX;

    return (
        <div className="card p-0 planning-grid-container">
            <div 
                ref={headerContainerRef}
                className="sticky z-10 overflow-x-hidden bg-slate-50 border-b border-border-primary" 
                style={{ top: `${headerTop}px` }}
            >
                <div style={{ width: totalContainerWidth, display: 'flex' }}>
                    <div className="planning-grid-header-spacer sticky left-0 z-20 bg-slate-50 border-r border-border-primary"></div>
                    <div className="planning-grid-header-items">
                        {displayColumns.map(columnName => (
                            <div key={columnName} className="planning-grid-header-item">{formatInfraName(columnName)}</div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div 
                ref={scrollContainerRef}
                className="overflow-x-auto"
                onScroll={handleScroll}
            >
                <div className="planning-grid-scroll-area">
                    <div className="planning-grid-content-wrapper" style={{ width: totalContainerWidth, display: 'flex' }}>
                        <div className="planning-grid-timeline sticky left-0 z-5 bg-slate-50 border-r border-border-primary">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} style={{ height: HOUR_HEIGHT_PX }} className="flex items-center justify-center text-center text-xs text-text-tertiary border-b border-slate-200">
                                   {String(i).padStart(2, '0')}:00
                                </div>
                            ))}
                        </div>
                        <div 
                            ref={gridMainRef} 
                            className={`planning-grid-main relative ${placementOpId && !isReadOnly ? 'cursor-crosshair' : ''}`}
                            style={{ height: HOUR_HEIGHT_PX * 24, width: totalGridWidth }} 
                            onMouseDown={!isReadOnly ? handleMouseDown : undefined} 
                            onMouseMove={placementOpId && !isReadOnly ? handlePlacementMouseMove : (!isReadOnly ? handleMouseMove : undefined)} 
                            onMouseUp={placementOpId && !isReadOnly ? handlePlacementClick : (!isReadOnly ? handleMouseUp : undefined)} 
                            onMouseLeave={placementOpId && !isReadOnly ? handlePlacementMouseLeave : (!isReadOnly ? handleMouseUp : undefined)}
                        >
                            {Array.from({ length: 24 }).map((_, i) => <div key={`hline-${i}`} className="absolute left-0 w-full h-px bg-slate-200" style={{ top: i * HOUR_HEIGHT_PX }}></div>)}
                            {displayColumns.map((_, i) => <div key={`vline-${i}`} className="absolute top-0 bottom-0 border-l border-slate-200" style={{ left: i * COLUMN_WIDTH_PX }}></div>)}

                            {laidOutOps.map(({ op, layout, title, validation }) => (
                                <MemoizedGridItem
                                    key={op.id}
                                    op={op}
                                    {...layout}
                                    title={title}
                                    validation={validation}
                                    switchView={switchView}
                                    isReadOnly={isReadOnly}
                                />
                            ))}
                            
                            {laidOutApprovedHolds.map(hold => renderHold(hold, "planning-grid-hold", "HOLD"))}
                            {laidOutPendingHolds.map(hold => renderHold(hold, "planning-grid-pending-hold", "PENDING OUTAGE"))}
                            {laidOutCompletedHolds.map(hold => renderHold(hold, "planning-grid-completed-hold", "COMPLETED"))}
                            
                            {isViewingMockToday && currentTimePos !== null && (
                                 <div className="current-time-indicator" style={{ top: currentTimePos, left: `-${TIMELINE_WIDTH_REM}rem`, width: `calc(100% + ${TIMELINE_WIDTH_REM}rem)` }}></div>
                            )}
                            {selection && !isReadOnly && (
                                <div className="selection-box" style={{ top: Math.min(selection.startY, selection.currentY), height: Math.abs(selection.currentY - selection.startY), left: selection.colIndex * COLUMN_WIDTH_PX, width: COLUMN_WIDTH_PX }} />
                            )}
                             {placementOpId && !isReadOnly && ghostPosition?.visible && (
                                <div 
                                    title={ghostPosition.isValid ? `Place ${placementOp!.transportId}` : ghostPosition.validationMessage}
                                    className={`planning-grid-item status-planned border-2 border-dashed pointer-events-none
                                        ${ghostPosition.isValid ? 'opacity-70 border-brand-primary' : '!bg-red-500/70 !border-red-700'}
                                    `}
                                    style={{
                                        position: 'absolute',
                                        top: ghostPosition.top,
                                        left: ghostPosition.left,
                                        height: ghostPosition.height,
                                        width: ghostPosition.width,
                                        zIndex: 99
                                    }}
                                >
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <i className={`fas ${getIcon(placementOp!.modality)}`}></i>
                                        <span className="truncate">{placementOp!.transportId}</span>
                                    </div>
                                    {!ghostPosition.isValid && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <i className="fas fa-ban text-white text-3xl"></i>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PlanningBoard: React.FC<{ isReadOnly?: boolean }> = ({ isReadOnly = false }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { operations, holds, selectedTerminal, uiState, setUiState, workspaceFilter, saveHoldAndRequeueConflicts, switchView, currentTerminalSettings, openRescheduleModal, currentUser, cancelHold, approveOutage, rejectOutage, requeueOperation, openNewOpModal, visibleInfrastructure, simulatedTime, settings, placementOpId, cancelPlacementMode } = context;
    
    const [holdModalOpen, setHoldModalOpen] = useState(false);
    const [holdInitialData, setHoldInitialData] = useState<Partial<Hold>>({});
    const [viewDate, setViewDate] = useState(simulatedTime);
    const [holdContextMenu, setHoldContextMenu] = useState<{ visible: boolean; x: number; y: number; hold: Hold } | null>(null);
    const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);
    const [isReschedulePanelCollapsed, setIsReschedulePanelCollapsed] = useState(false);
    
    const controlBarRef = useRef<HTMLDivElement>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const [headerTop, setHeaderTop] = useState(0);
    const isCommercials = currentUser.role === 'Commercials';

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
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [holdContextMenu]);
    
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
        
        const holdsOnDate = holds.filter(h => new Date(h.startTime) < endOfDay && new Date(h.endTime) > startOfDay);

        return {
            scheduledOps: dateOps,
            dateApprovedHolds: holdsOnDate.filter(h => h.status === 'approved' && !['Completed', 'Closed'].includes(h.workOrderStatus || '')),
            datePendingHolds: holdsOnDate.filter(h => h.status === 'pending' && h.workOrderStatus !== 'Closed'),
            dateCompletedHolds: holdsOnDate.filter(h => h.status === 'approved' && h.workOrderStatus === 'Completed'),
        };
    }, [operations, holds, selectedTerminal, viewDate]);

    const { displayColumns, infraToColumnMap } = useMemo(() => {
        const wharfMap = createDocklineToWharfMap(currentTerminalSettings);
        const infraToColumn = new Map<string, string>();
        const columns = new Set<string>();
        const otherInfra: string[] = [];
    
        visibleInfrastructure.forEach(infraId => {
            const wharf = wharfMap[infraId];
            if (wharf) {
                columns.add(wharf);
                infraToColumn.set(infraId, wharf);
            }
        });
    
        visibleInfrastructure.forEach(infraId => {
            if (!wharfMap[infraId]) {
                otherInfra.push(infraId);
                infraToColumn.set(infraId, infraId);
            }
        });
    
        const sortedWharfs = Array.from(columns).sort();
        const sortedOther = otherInfra.sort(naturalSort);
        
        const finalColumns = [...sortedWharfs, ...sortedOther];
    
        return { displayColumns: finalColumns, infraToColumnMap: infraToColumn };
    }, [visibleInfrastructure, currentTerminalSettings]);

    const laidOutOps = useMemo(() => {
        const opsWithColumns = scheduledOps.map(op => {
            const infraId = op.transferPlan.find(tp => infraToColumnMap.has(tp.infrastructureId))?.infrastructureId;
            const column = infraId ? infraToColumnMap.get(infraId) : null;
            return { op, column };
        }).filter(item => item.column != null);
    
        const opsByColumn: Record<string, { op: Operation }[]> = {};
        opsWithColumns.forEach(item => {
            if (!opsByColumn[item.column!]) opsByColumn[item.column!] = [];
            opsByColumn[item.column!].push({ op: item.op });
        });
    
        const finalLayout: any[] = [];
    
        Object.entries(opsByColumn).forEach(([column, ops]) => {
            const colIndex = displayColumns.indexOf(column);
            if (colIndex === -1) return;
    
            const sortedOps = ops.sort((a, b) => new Date(a.op.eta).getTime() - new Date(b.op.eta).getTime());
            const layoutInfo = sortedOps.map(item => ({
                ...item,
                start: new Date(item.op.eta).getTime(),
                end: new Date(item.op.eta).getTime() + getOperationDurationHours(item.op) * 3600 * 1000,
            }));
    
            for (let i = 0; i < layoutInfo.length; i++) {
                const currentOp = layoutInfo[i];
                const overlappingOps = layoutInfo.filter((otherOp, j) => {
                    return Math.max(currentOp.start, otherOp.start) < Math.min(currentOp.end, otherOp.end);
                });
    
                const numSubColumns = overlappingOps.length;
                const subColumn = overlappingOps.findIndex(op => op.op.id === currentOp.op.id);
    
                const cardWidthRatio = 0.80; // Set consistent width for all cards
                const width = COLUMN_WIDTH_PX * cardWidthRatio;
                let left = colIndex * COLUMN_WIDTH_PX;
                let zIndex = 10;

                if (numSubColumns > 1) {
                    const availableSpaceForOffset = COLUMN_WIDTH_PX - width;
                    const step = availableSpaceForOffset / (numSubColumns - 1 || 1);
                    const offset = subColumn * step;
                    
                    left += offset;
                    zIndex = 20 + subColumn;
                } else {
                    const horizontalMargin = (COLUMN_WIDTH_PX - width) / 2;
                    left += horizontalMargin;
                }

                const { totalValue } = isCommercials ? calculateOperationValue(currentOp.op, settings) : { totalValue: 0 };
                const activeHolds = [...dateApprovedHolds, ...dateCompletedHolds].filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
                const validation = (currentOp.op.status === 'planned' || currentOp.op.status === 'active') ? validateOperationPlan(currentOp.op, currentTerminalSettings, settings, activeHolds) : { isValid: true, issues: [] };
    
                finalLayout.push({
                    op: currentOp.op,
                    layout: {
                        top: timeToPosition(new Date(currentOp.op.eta), viewDate),
                        height: getOperationDurationHours(currentOp.op) * HOUR_HEIGHT_PX,
                        left: left,
                        width: width,
                        zIndex: zIndex
                    },
                    title: `${currentOp.op.transportId}\nETA: ${new Date(currentOp.op.eta).toLocaleTimeString()}${isCommercials ? `\nValue: ${formatCurrency(totalValue)}` : ''}${!validation.isValid ? `\n\nISSUES:\n- ${validation.issues.join('\n- ')}` : ''}`,
                    validation: validation,
                });
            }
        });
        return finalLayout;
    }, [scheduledOps, displayColumns, infraToColumnMap, viewDate, settings, isCommercials, dateApprovedHolds, dateCompletedHolds, currentTerminalSettings]);

    const createHoldLayout = (holds: Hold[]) => {
        return holds.map(hold => {
            const column = infraToColumnMap.get(hold.resource);
            if (!column) return null;
            const colIndex = displayColumns.findIndex(c => c === column);
            if (colIndex === -1) return null;

            const start = new Date(hold.startTime);
            const end = new Date(hold.endTime);
            const top = timeToPosition(start, viewDate);
            let height = timeToPosition(end, viewDate) - top;
            if (height <= 0) height = 2;
            const left = colIndex * COLUMN_WIDTH_PX;
            const width = COLUMN_WIDTH_PX;

            return { hold, layout: { top, height, left, width } };
        }).filter(Boolean);
    };

    const laidOutApprovedHolds = useMemo(() => createHoldLayout(dateApprovedHolds), [dateApprovedHolds, infraToColumnMap, displayColumns, viewDate]);
    const laidOutPendingHolds = useMemo(() => createHoldLayout(datePendingHolds), [datePendingHolds, infraToColumnMap, displayColumns, viewDate]);
    const laidOutCompletedHolds = useMemo(() => createHoldLayout(dateCompletedHolds), [dateCompletedHolds, infraToColumnMap, displayColumns, viewDate]);
    
    const rescheduleOps = useMemo(() => {
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');

        const opsForReschedule = operations.filter(op => {
            if (op.terminal !== selectedTerminal) return false;

            if (op.currentStatus === 'Reschedule Required' || op.currentStatus === 'No Show') {
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
                if (op.currentStatus === 'No Show') return true;
                
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

    const shouldShowReschedule = rescheduleOps.length > 0;
    const shouldShowLegend = uiState.planningViewMode === 'grid' || uiState.planningViewMode === 'kanban';
    const shouldShowBottomBar = shouldShowLegend || shouldShowReschedule;

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
            <div className={`relative h-full flex flex-col ${isReadOnly ? 'pointer-events-none' : ''}`}>
                <div ref={controlBarRef} className={`sticky top-0 z-20 bg-background-card border-b border-border-primary ${isReadOnly ? '!pointer-events-auto' : ''}`}>
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
                                <div className="planning-board-view-toggle">
                                    <button onClick={() => setUiState(s => ({ ...s, planningViewMode: 'kanban' }))} className={`view-toggle-btn ${uiState.planningViewMode === 'kanban' ? 'active' : ''}`}><i className="fas fa-columns"></i></button>
                                    <button onClick={() => setUiState(s => ({ ...s, planningViewMode: 'list' }))} className={`view-toggle-btn ${uiState.planningViewMode === 'list' ? 'active' : ''}`}><i className="fas fa-list"></i></button>
                                    <button onClick={() => setUiState(s => ({ ...s, planningViewMode: 'grid' }))} className={`view-toggle-btn ${uiState.planningViewMode === 'grid' ? 'active' : ''}`}><i className="fas fa-th"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`flex-grow p-4 pb-64 ${isReadOnly ? '!pointer-events-auto' : ''}`} ref={gridContainerRef}>
                    {uiState.planningViewMode === 'grid' ? (
                        <PlanningGrid 
                            displayColumns={displayColumns}
                            laidOutOps={laidOutOps}
                            laidOutApprovedHolds={laidOutApprovedHolds as any[]}
                            laidOutPendingHolds={laidOutPendingHolds as any[]}
                            laidOutCompletedHolds={laidOutCompletedHolds as any[]}
                            viewDate={viewDate} 
                            switchView={switchView} 
                            onGridClick={handleGridClick} 
                            onHoldItemClick={handleHoldItemClick}
                            headerTop={headerTop}
                            isReadOnly={isReadOnly}
                        />
                    ) : uiState.planningViewMode === 'kanban' ? (
                        <PlanningKanban operations={filteredForKanban} />
                    ) : <PlanningList operations={scheduledOps} />}
                </div>
                
                {shouldShowBottomBar && !isReadOnly && (
                    <div className="fixed bottom-0 left-0 lg:left-72 right-0 z-20 p-2 sm:p-4 pointer-events-none">
                        <div className="max-w-screen-2xl mx-auto flex justify-between items-end gap-6">
                            <div className="pointer-events-auto">
                                {shouldShowLegend && (
                                    <div className="card p-3 hidden sm:block bg-background-card/80 backdrop-blur-sm">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
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

                            <div className="flex items-end gap-4 pointer-events-auto ml-auto">
                                {shouldShowReschedule && (
                                    <div className="w-full max-w-2xl card shadow-xl bg-red-50 border border-red-200 overflow-hidden">
                                        <div className="p-3 flex justify-between items-center cursor-pointer" onClick={() => setIsReschedulePanelCollapsed(prev => !prev)}>
                                            <h3 className="text-base font-semibold text-red-600"><i className="fas fa-exclamation-triangle mr-2"></i>To Reschedule ({rescheduleOps.length})</h3>
                                            <button className="text-red-600 hover:text-red-800"><i className={`fas transition-transform duration-300 ${isReschedulePanelCollapsed ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i></button>
                                        </div>
                                        {!isReschedulePanelCollapsed && (
                                            <div className="p-3 border-t border-red-200">
                                                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                                                    {rescheduleOps.map(op => {
                                                        const { reason, isHigh } = getReasonAndPriority(op);
                                                        const canUserReschedule = canReschedule(currentUser, op);
                                                        return (
                                                            <div key={op.id} className={`p-2 flex items-center gap-3 border border-red-200 bg-white ${canUserReschedule ? 'cursor-pointer hover:bg-red-100' : 'cursor-default'}`} onClick={canUserReschedule ? () => openRescheduleModal(op.id, viewDate) : undefined}>
                                                                <i className="fas fa-truck text-red-500 text-lg"></i>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-bold text-sm text-red-800">{op.transportId}</p>
                                                                        {isHigh && (<span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 animate-pulse">HIGH PRIORITY</span>)}
                                                                    </div>
                                                                    <p className="text-xs text-red-700">{reason}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PlanningBoard;
