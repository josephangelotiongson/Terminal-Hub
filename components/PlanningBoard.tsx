import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Hold, Modality, View } from '../types';
import ModalityFilter from './ModalityFilter';
import PlanningList from './PlanningList';
import HoldModal from './HoldModal';
import InputModal from './InputModal';
import { formatInfraName, calculateOperationValue, formatCurrency, validateOperationPlan, getOperationDurationHours } from '../utils/helpers';

const HOUR_HEIGHT_PX = 40;
const COLUMN_WIDTH_PX = 160;
const TIMELINE_WIDTH_REM = 5; // w-20

const getIcon = (modality: Modality) => {
    switch (modality) {
        case 'vessel': return 'fa-ship';
        case 'truck': return 'fa-truck';
        case 'rail': return 'fa-train';
        default: return 'fa-question-circle';
    }
};

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

const getGridItemColorClass = (op: Operation): string => {
    // Priority 1: Completed / Cancelled
    if (op.status === 'completed') return 'status-departed'; // Grey
    if (op.status === 'cancelled') return 'status-rejected'; // Red

    // Priority 2: Issues that require attention
    if (op.delay?.active || op.currentStatus === 'Reschedule Required' || op.truckStatus === 'Rejected') {
        return 'status-rejected'; // Red
    }

    // Priority 3: Active operations
    if (op.status === 'active') {
        return 'status-loading'; // Green
    }

    // Priority 4: Default planned state
    if (op.status === 'planned') {
        return 'status-planned'; // Yellow
    }
    
    // Fallback
    return 'status-departed'; // Default to grey if status is unknown
};

const legendItems = [
    { label: 'Planned / Scheduled', colorClass: 'status-planned' },
    { label: 'Active / Loading', colorClass: 'status-loading' },
    { label: 'Completed / Departed', colorClass: 'status-departed' },
    { label: 'Issue / Reschedule', colorClass: 'status-rejected' },
];

const PlanningGrid: React.FC<{
    operations: Operation[];
    approvedHolds: Hold[];
    pendingHolds: Hold[];
    completedHolds: Hold[];
    infrastructure: string[];
    viewDate: Date;
    switchView: (view: View, opId?: string | null) => void;
    onHoldClick: (hold: Hold | Partial<Hold>) => void;
    onHoldItemClick: (e: React.MouseEvent, hold: Hold) => void;
    showBottomBar: boolean;
}> = ({ operations, approvedHolds, pendingHolds, completedHolds, infrastructure, viewDate, switchView, onHoldClick, onHoldItemClick, showBottomBar }) => {
    const { settings, currentUser, currentTerminalSettings, openRescheduleModal, requeueOperation } = useContext(AppContext)!;
    const isCommercials = currentUser.role === 'Commercials';
    const scrollRef = useRef<HTMLDivElement>(null);
    const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);
    const [selection, setSelection] = useState<{ startY: number; currentY: number; colIndex: number } | null>(null);
    const today = new Date();
    const isToday = viewDate.toDateString() === today.toDateString();
    
    useEffect(() => {
        const updateCurrentTime = () => {
            if (isToday) setCurrentTimePos(timeToPosition(new Date(), viewDate));
            else setCurrentTimePos(null);
        };
        updateCurrentTime();
        const interval = setInterval(updateCurrentTime, 60000);
        return () => clearInterval(interval);
    }, [viewDate, isToday]);

    useEffect(() => {
        if (isToday && currentTimePos && scrollRef.current) {
            scrollRef.current.scrollTop = currentTimePos - scrollRef.current.offsetHeight / 2;
        }
    }, [isToday, currentTimePos]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.planning-grid-item, .planning-grid-hold, .planning-grid-pending-hold')) return;
        if (scrollRef.current) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top; // Corrected: removed '+ scrollRef.current.scrollTop'
            const colIndex = Math.floor(x / COLUMN_WIDTH_PX);
            if (colIndex >= 0 && colIndex < infrastructure.length) {
                setSelection({ startY: y, currentY: y, colIndex });
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (selection && scrollRef.current) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = e.clientY - rect.top; // Corrected: removed '+ scrollRef.current.scrollTop'
            setSelection({ ...selection, currentY: y });
        }
    };

    const handleMouseUp = () => {
        if (selection) {
            const startY = Math.min(selection.startY, selection.currentY);
            const endY = Math.max(selection.startY, selection.currentY);
            let startTime, endTime;
            const resource = infrastructure[selection.colIndex];
            
            if (endY - startY > 10) { 
                startTime = positionToTime(startY, viewDate);
                endTime = positionToTime(endY, viewDate);
            } else {
                startTime = positionToTime(selection.startY, viewDate);
                endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
            }
            
            onHoldClick({ startTime: startTime.toISOString(), endTime: endTime.toISOString(), resource });
            setSelection(null);
        }
    };

    const renderHold = (hold: Hold, className: string, titlePrefix: string) => {
        const colIndex = infrastructure.findIndex(infra => hold.resource === infra);
        if (colIndex === -1) return null;
        const start = new Date(hold.startTime);
        const end = new Date(hold.endTime);
        const top = timeToPosition(start, viewDate);
        let height = timeToPosition(end, viewDate) - top;
        if (height <= 0) height = 2;
        const left = colIndex * COLUMN_WIDTH_PX;
        return (
            <div 
                key={hold.id} 
                title={`${titlePrefix}: ${hold.reason}`} 
                className={className}
                style={{ top, height, left, width: COLUMN_WIDTH_PX }} 
                onClick={(e) => onHoldItemClick(e, hold)}
            >
                <div className="truncate">
                    <i className="fas fa-ban mr-1 sm:mr-2"></i>{hold.reason} {hold.tank && `(${hold.tank})`}
                </div>
            </div>
        );
    };

    return (
        <div className="card p-0 overflow-hidden planning-grid-container">
            <div className="planning-grid-header">
                <div className="planning-grid-header-spacer"></div>
                <div className="planning-grid-header-items">
                    {infrastructure.map(infra => (
                        <div key={infra} className="planning-grid-header-item">{formatInfraName(infra)}</div>
                    ))}
                </div>
            </div>
            <div className="planning-grid-scroll-area" ref={scrollRef}>
                <div className="planning-grid-content-wrapper" style={{ width: infrastructure.length * COLUMN_WIDTH_PX }}>
                    <div className="planning-grid-timeline">
                        {Array.from({ length: 24 }).map((_, i) => (
                            <div key={i} style={{ height: HOUR_HEIGHT_PX }} className="flex items-center justify-center text-center text-xs text-text-tertiary border-r border-b">
                               {String(i).padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>
                    <div className={`planning-grid-main ${showBottomBar ? 'pb-48' : ''}`} style={{ height: HOUR_HEIGHT_PX * 24 }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                        {Array.from({ length: 24 }).map((_, i) => <div key={`hline-${i}`} className="absolute left-0 w-full h-px bg-slate-200" style={{ top: i * HOUR_HEIGHT_PX }}></div>)}
                        {infrastructure.map((_, i) => <div key={`vline-${i}`} className="absolute top-0 bottom-0 border-l border-slate-200" style={{ left: i * COLUMN_WIDTH_PX }}></div>)}

                        {operations.map(op => {
                            const colIndex = infrastructure.findIndex(infra => op.transferPlan.some(tp => tp.infrastructureId === infra));
                            if (colIndex === -1) return null;
                            const start = new Date(op.eta);
                            const height = getOperationDurationHours(op) * HOUR_HEIGHT_PX;
                            const top = timeToPosition(start, viewDate);
                            const left = colIndex * COLUMN_WIDTH_PX;

                            const activeHolds = [...approvedHolds, ...completedHolds].filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
                            const validation = (op.status === 'planned' || op.status === 'active')
                                ? validateOperationPlan(op, currentTerminalSettings, settings, activeHolds)
                                : { isValid: true, issues: [] };
                            const hasIssues = !validation.isValid;

                            const { totalValue } = isCommercials ? calculateOperationValue(op, settings) : { totalValue: 0 };
                            const title = `${op.transportId}\nETA: ${start.toLocaleTimeString()}${isCommercials ? `\nValue: ${formatCurrency(totalValue)}` : ''}${hasIssues ? `\n\nISSUES:\n- ${validation.issues.join('\n- ')}` : ''}`;

                            const hasConflictOrIssue = op.currentStatus === 'Reschedule Required' || hasIssues;

                            return (
                                <div 
                                    key={op.id} 
                                    title={title} 
                                    className={`planning-grid-item ${getGridItemColorClass(op)} ${hasConflictOrIssue ? 'conflicted-op' : ''}`} 
                                    style={{ top, height, left, width: COLUMN_WIDTH_PX - 8, margin: '0 4px' }} 
                                    onClick={() => switchView('operation-details', op.id)}
                                >
                                    {hasConflictOrIssue && (
                                        <div className="absolute top-1 right-1 text-white text-base" title={`Plan has issues or conflicts. Click to view.`}>
                                            <i className="fas fa-exclamation-triangle animate-pulse"></i>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <i className={`fas ${getIcon(op.modality)}`}></i>
                                        <span className="truncate">{op.transportId}</span>
                                    </div>
                                     {hasIssues && op.status === 'planned' && (
                                        <div className="absolute bottom-1 right-1">
                                            <button 
                                                title="Reschedule this operation"
                                                className="btn-primary !py-0.5 !px-1.5 !text-xs !bg-orange-500 hover:!bg-orange-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    requeueOperation(op.id, validation.issues[0]);
                                                    openRescheduleModal(op.id, viewDate);
                                                }}
                                            >
                                                Reschedule
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {approvedHolds.map(hold => renderHold(hold, "planning-grid-hold", "HOLD"))}
                        {pendingHolds.map(hold => renderHold(hold, "planning-grid-pending-hold", "PENDING OUTAGE"))}
                        {completedHolds.map(hold => renderHold(hold, "planning-grid-pending-hold", "COMPLETED - PENDING APPROVAL"))}
                        
                        {isToday && currentTimePos !== null && (
                             <div className="current-time-indicator" style={{ top: currentTimePos, left: `-${TIMELINE_WIDTH_REM}rem`, width: `calc(100% + ${TIMELINE_WIDTH_REM}rem)` }}></div>
                        )}
                        {selection && (
                            <div className="selection-box" style={{ top: Math.min(selection.startY, selection.currentY), height: Math.abs(selection.currentY - selection.startY), left: selection.colIndex * COLUMN_WIDTH_PX, width: COLUMN_WIDTH_PX }} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PlanningBoard: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { operations, holds, selectedTerminal, uiState, setUiState, workspaceFilter, setWorkspaceFilter, saveHoldAndRequeueConflicts, switchView, currentTerminalSettings, openRescheduleModal, currentUser, cancelHold, approveOutage, rejectOutage, requeueOperation } = context;
    
    const [holdModalOpen, setHoldModalOpen] = useState(false);
    const [holdInitialData, setHoldInitialData] = useState<Partial<Hold>>({});
    const [viewDate, setViewDate] = useState(new Date());
    const [holdContextMenu, setHoldContextMenu] = useState<{ visible: boolean; x: number; y: number; hold: Hold } | null>(null);
    const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);

    const headerRef = useRef<HTMLDivElement>(null);
    
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
        e.preventDefault();
        e.stopPropagation();
        setHoldContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            hold: hold,
        });
    };

    const handleConfirmCancel = (reason: string) => {
        if (cancellingHoldId) {
            cancelHold(cancellingHoldId, reason);
            setCancellingHoldId(null);
        }
    };

    const { allInfrastructure, scheduledOps, dateApprovedHolds, datePendingHolds, dateCompletedHolds } = useMemo(() => {
        const infraMap = currentTerminalSettings.infrastructureModalityMapping || {};
        const allInfra = Object.keys(infraMap).sort();
        
        const startOfDay = new Date(viewDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(viewDate); endOfDay.setHours(23, 59, 59, 999);
        
        const terminalOps = operations.filter(op => op.terminal === selectedTerminal);

        const dateOps = terminalOps.filter(op => {
             // Exclude ops that are pending reschedule from the main grid view
            if (op.currentStatus === 'Reschedule Required') {
                return false;
            }

             // For completed/cancelled, check if the eventTime falls within the day.
            if (op.status === 'completed' || op.status === 'cancelled') {
                const finalTime = new Date(op.completedTime || op.cancellationDetails?.time || 0).getTime();
                return finalTime >= startOfDay.getTime() && finalTime <= endOfDay.getTime();
            }

            // For planned/active, check if their duration overlaps with the day.
            const eta = new Date(op.eta);
            const durationMs = getOperationDurationHours(op) * 3600 * 1000;
            const endTime = eta.getTime() + durationMs;
            return endTime > startOfDay.getTime() && eta.getTime() < endOfDay.getTime();
        });
        
        const holdsOnDate = holds.filter(h => new Date(h.startTime) < endOfDay && new Date(h.endTime) > startOfDay);

        return {
            allInfrastructure: allInfra,
            scheduledOps: dateOps,
            dateApprovedHolds: holdsOnDate.filter(h => h.status === 'approved' && !['Completed', 'Closed'].includes(h.workOrderStatus || '')),
            datePendingHolds: holdsOnDate.filter(h => h.status === 'pending' && h.workOrderStatus !== 'Closed'),
            dateCompletedHolds: holdsOnDate.filter(h => h.status === 'approved' && h.workOrderStatus === 'Completed'),
        };
    }, [operations, holds, selectedTerminal, viewDate, currentTerminalSettings]);

    const rescheduleOps = useMemo(() => {
        return operations.filter(op => op.terminal === selectedTerminal && op.currentStatus === 'Reschedule Required');
    }, [operations, selectedTerminal]);

    const filteredInfrastructure = useMemo(() => {
        const modalityFiltered = workspaceFilter === 'all'
            ? allInfrastructure
            : allInfrastructure.filter(infra => currentTerminalSettings.infrastructureModalityMapping[infra] === workspaceFilter);
        return modalityFiltered;
    }, [allInfrastructure, workspaceFilter, currentTerminalSettings]);

    const openHoldModal = (initialData: Partial<Hold> = {}) => {
        setHoldInitialData({ resource: '', terminal: selectedTerminal, ...initialData });
        setHoldModalOpen(true);
    };

    const shouldShowReschedule = rescheduleOps.length > 0;
    const shouldShowGridLegend = uiState.planningViewMode === 'grid';
    const shouldShowBottomBar = shouldShowGridLegend || shouldShowReschedule;


    const holdButtonText = currentUser.role === 'Maintenance Planner' ? 'Request Outage' : 'Place Hold';

    return (
        <>
            <HoldModal isOpen={holdModalOpen} onClose={() => setHoldModalOpen(false)} onSave={saveHoldAndRequeueConflicts} initialData={holdInitialData} />
            <InputModal
                isOpen={!!cancellingHoldId}
                onClose={() => setCancellingHoldId(null)}
                onSave={handleConfirmCancel}
                title="Cancel Hold"
                label="Reason for Cancellation (Required)"
                initialValue="Entered in error"
            />
            {holdContextMenu?.visible && (
                <div
                    style={{ top: holdContextMenu.y, left: holdContextMenu.x }}
                    className="hold-context-menu absolute z-50 bg-white rounded-md shadow-lg border p-1 flex flex-col w-48"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => {
                            openHoldModal(holdContextMenu.hold);
                            setHoldContextMenu(null);
                        }}
                        className="text-left w-full px-3 py-2 text-sm text-text-primary hover:bg-slate-100 rounded"
                    >
                        <i className="fas fa-pen mr-2 w-4"></i>Edit Hold
                    </button>
                    {(currentUser.role === 'Operations Lead' || currentUser.name === holdContextMenu.hold.user) && (holdContextMenu.hold.status !== 'cancelled' && holdContextMenu.hold.status !== 'rejected') && (
                        <button
                            onClick={() => {
                                setCancellingHoldId(holdContextMenu.hold.id!);
                                setHoldContextMenu(null);
                            }}
                            className="text-left w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                            <i className="fas fa-ban mr-2 w-4"></i>Cancel Hold
                        </button>
                    )}
                    {currentUser.role === 'Operations Lead' && holdContextMenu.hold.status === 'pending' && (
                        <>
                            <div className="border-t my-1"></div>
                            <button
                                onClick={() => {
                                    approveOutage(holdContextMenu.hold.id!);
                                    setHoldContextMenu(null);
                                }}
                                className="text-left w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded"
                            >
                                <i className="fas fa-check mr-2 w-4"></i>Approve
                            </button>
                            <button
                                onClick={() => {
                                    rejectOutage(holdContextMenu.hold.id!);
                                    setHoldContextMenu(null);
                                }}
                                className="text-left w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                            >
                                <i className="fas fa-times mr-2 w-4"></i>Reject
                            </button>
                        </>
                    )}
                </div>
            )}
            <div className="relative">
                <div ref={headerRef} className="sticky top-0 z-10 bg-background-card p-4 border-b border-border-primary">
                    <div className="flex flex-wrap items-center gap-y-2">
                        {/* Left-aligned controls */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-lg font-semibold text-text-secondary whitespace-nowrap">{viewDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <button onClick={() => setViewDate(d => new Date(d.setDate(d.getDate() - 1)))} className="btn-icon"><i className="fas fa-chevron-left"></i></button>
                                <button onClick={() => setViewDate(new Date())} className="btn-secondary !py-1 !px-3 text-sm">Today</button>
                                <button onClick={() => setViewDate(d => new Date(d.setDate(d.getDate() + 1)))} className="btn-icon"><i className="fas fa-chevron-right"></i></button>
                            </div>
                        </div>

                        {/* Right-aligned controls */}
                        <div className="flex flex-wrap items-center gap-2 gap-y-2 ml-auto">
                            <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} />
                            <button onClick={() => openHoldModal()} className="btn-secondary whitespace-nowrap"><i className="fas fa-ban mr-2"></i>{holdButtonText}</button>
                             <div className="planning-board-view-toggle">
                                <button onClick={() => setUiState(s => ({ ...s, planningViewMode: 'list' }))} className={`view-toggle-btn ${uiState.planningViewMode === 'list' ? 'active' : ''}`}><i className="fas fa-list"></i></button>
                                <button onClick={() => setUiState(s => ({ ...s, planningViewMode: 'grid' }))} className={`view-toggle-btn ${uiState.planningViewMode === 'grid' ? 'active' : ''}`}><i className="fas fa-th"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    {uiState.planningViewMode === 'list' ? <PlanningList /> : (
                        <PlanningGrid 
                            operations={scheduledOps} 
                            approvedHolds={dateApprovedHolds} 
                            pendingHolds={datePendingHolds} 
                            completedHolds={dateCompletedHolds} 
                            infrastructure={filteredInfrastructure} 
                            viewDate={viewDate} 
                            switchView={switchView} 
                            onHoldClick={openHoldModal} 
                            onHoldItemClick={handleHoldItemClick}
                            showBottomBar={shouldShowBottomBar}
                        />
                    )}
                </div>
                
                {shouldShowBottomBar && (
                    <div className="fixed bottom-0 left-0 right-0 z-20 p-2 sm:p-4 bg-background-card/80 backdrop-blur-sm border-t border-border-primary">
                        <div className="max-w-screen-2xl mx-auto flex justify-between items-end gap-6">
                            {shouldShowGridLegend && (
                                <div className="card p-3 hidden sm:block">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        {legendItems.map(item => (
                                            <div key={item.label} className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded-sm ${item.colorClass}`}></div>
                                                <span className="text-sm text-text-secondary whitespace-nowrap">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {shouldShowReschedule && (
                                <div className="ml-auto w-full max-w-md card shadow-xl p-3 bg-red-50 border border-red-200">
                                    <h3 className="text-base font-semibold text-red-600 mb-2">
                                        <i className="fas fa-exclamation-triangle mr-2"></i>
                                        To Reschedule ({rescheduleOps.length})
                                    </h3>
                                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                                        {rescheduleOps.map(op => (
                                            <div 
                                                key={op.id} 
                                                className="p-2 rounded-lg flex items-center gap-3 cursor-pointer border border-red-200 bg-white hover:bg-red-100" 
                                                onClick={() => openRescheduleModal(op.id, viewDate)}
                                            >
                                                <i className="fas fa-truck text-red-500 text-lg"></i>
                                                <div>
                                                    <p className="font-bold text-sm text-red-800">{op.transportId}</p>
                                                    <p className="text-xs text-red-700">{op.requeueDetails?.reason}</p>
                                                </div>
                                            </div>
                                        ))}
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