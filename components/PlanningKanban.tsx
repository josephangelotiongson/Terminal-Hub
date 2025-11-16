
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality } from '../types';
import { calculateOperationValue, formatCurrency, validateOperationPlan, getOperationBorderColorClass, formatInfraName } from '../utils/helpers';
import ElapsedTimeBadge from './ElapsedTimeBadge';

const KANBAN_STAGES = [
    'Scheduled',
    'Arrived',
    'Approved',
    'Product Transfer',
    'Completing / Finals',
    'Completed'
];

const PRE_ARRIVAL_SERVICES_CHECKLIST = ['Aquis Quarantine', 'Customs arrival', 'Marpol surveyor', 'Ship stability/positioning'];
const GENERAL_PRE_ARRIVAL_CHECKS = ['Customer Confirmation', 'Documents Received'];

const getIcon = (modality: Modality) => {
    switch (modality) {
        case 'vessel': return 'fa-ship';
        case 'truck': return 'fa-truck';
        case 'rail': return 'fa-train';
        default: return 'fa-question-circle';
    }
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const baseClass = "px-2 py-0.5 text-xs font-semibold rounded-full";
    switch (status) {
        case 'complete': return <span className={`${baseClass} bg-green-100 text-green-800`}>Complete</span>;
        case 'confirmed': return <span className={`${baseClass} bg-blue-100 text-blue-800`}>Confirmed</span>;
        case 'pending': return <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>Pending</span>;
        default: return <span className={`${baseClass} bg-slate-100 text-slate-800`}>{status}</span>;
    }
};

// Card component
const KanbanCard: React.FC<{ op: Operation; hasIssues: boolean; issues: string[]; stage: string }> = ({ op, hasIssues, issues, stage }) => {
    // FIX: Replaced `updateVesselServiceStatus` with `updateOperationServiceStatus` as it does not exist on the context type.
    const { switchView, settings, currentUser, currentTerminalSettings, holds, updatePreArrivalCheck, updateOperationServiceStatus } = useContext(AppContext)!;
    const isCommercials = currentUser.role === 'Commercials';
    const borderColorClass = getOperationBorderColorClass(op);
    const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
    const { totalValue } = isCommercials ? calculateOperationValue(op, settings) : { totalValue: 0 };

    const isScheduledTruck = stage === 'Scheduled' && op.modality === 'truck';
    const [isExpanded, setIsExpanded] = useState(false);
    
    const infrastructureText = useMemo(() => {
        if (op.transferPlan && op.transferPlan.length > 0) {
            const infraIds = op.transferPlan.map(tp => tp.infrastructureId).filter(Boolean);
            if (infraIds.length > 0) {
                return infraIds.map(formatInfraName).join(', ');
            }
        }
        return 'Unassigned';
    }, [op.transferPlan]);

    const waitTimeStart = useMemo(() => {
        const findLatestSofEventTime = (eventName: string): string | null => {
            const transfer = op.transferPlan?.[0]?.transfers?.[0];
            if (!transfer?.sof) return null;

            const events = transfer.sof
                .filter(s => s.status === 'complete' && s.time && s.event.includes(eventName))
                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            return events.length > 0 ? events[0].time : null;
        };

        if (op.truckStatus === 'Waiting') {
            return findLatestSofEventTime('Ready / Approved');
        }

        if (op.truckStatus === 'Registered') {
            return findLatestSofEventTime('Arrived');
        }

        return null;
    }, [op]);

    const { allChecks, progress, validation } = useMemo(() => {
        if (!isScheduledTruck) return { allChecks: [], progress: 0, validation: { isValid: true, issues: [] } };

        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        const validationResult = validateOperationPlan(op, currentTerminalSettings, settings, activeHolds);

        const preArrivalServices = (op.specialRequirements || []).filter(s => PRE_ARRIVAL_SERVICES_CHECKLIST.includes(s.name));
        
        // The original checks are now considered redundant for the Kanban view.
        // Plan validation is shown by an icon, and other checks are handled on the details screen.
        // This will now only show vessel-specific pre-arrival services if any are configured for a truck, which is unlikely and intended.
        const checks = [
            ...preArrivalServices.map(service => ({
                name: service.name, status: service.data?.status || 'pending', type: 'service'
            }))
        ];

        const completedChecks = checks.filter(c => c.status === 'complete' || c.status === 'confirmed').length;
        const progressPercentage = checks.length > 0 ? (completedChecks / checks.length) * 100 : 100;

        return { allChecks: checks, progress: progressPercentage, validation: validationResult };

    }, [op, isScheduledTruck, currentTerminalSettings, settings, holds]);

    const cardHeader = (
        <div className="flex justify-between items-start">
            <h4 className="font-bold text-base text-brand-dark truncate">{op.transportId}</h4>
            <div className="flex items-center gap-2 flex-shrink-0">
                 {isCommercials && (
                    <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                        {formatCurrency(totalValue)}
                    </span>
                )}
                {hasIssues ? <i className="fas fa-exclamation-triangle text-yellow-500 animate-pulse"></i> : (waitTimeStart && <ElapsedTimeBadge startTime={waitTimeStart} />)}
            </div>
        </div>
    );
    
    const cardDetails = (
        <div className="grid grid-cols-[110px,1fr] gap-x-3 text-xs mt-1">
            {/* Left Column: Plate or Infra & SOF Status */}
            <div className="flex flex-col gap-1">
                {op.modality === 'truck' && op.licensePlate ? (
                    <div className="inline-block bg-slate-800 text-white font-mono font-bold tracking-wider px-2 py-1 text-center" title={op.licensePlate}>
                        {op.licensePlate}
                    </div>
                ) : (
                    <div className="inline-block bg-slate-800 text-white font-mono font-bold tracking-wider px-2 py-1 text-center" title={infrastructureText}>
                        <i className={`fas ${getIcon(op.modality)} mr-2 opacity-70`}></i>
                        {infrastructureText}
                    </div>
                )}
                 {stage !== 'Scheduled' && stage !== 'Completed' && op.currentStatus && (
                    <p className="truncate font-semibold text-slate-700 mt-1 text-center text-[0.65rem]" title={`Status: ${op.currentStatus}`}>
                        <i className="fas fa-tasks w-4 text-center mr-1 text-slate-400"></i>
                        {op.currentStatus}
                    </p>
                )}
            </div>

            {/* Right Column: Other details */}
            <div className="flex flex-col justify-center gap-0.5 text-slate-600">
                <p className="truncate" title={firstTransfer?.product || 'No Product'}>
                    <i className="fas fa-box w-4 text-center mr-1 text-slate-400"></i>
                    {firstTransfer?.product || 'No Product'}
                </p>
                <p className="truncate" title={firstTransfer?.customer || 'No Customer'}>
                    <i className="fas fa-user-tie w-4 text-center mr-1 text-slate-400"></i>
                    {firstTransfer?.customer || 'No Customer'}
                </p>
                {op.modality === 'truck' && op.driverName && (
                    <p className="truncate" title={op.driverName}>
                        <i className="fas fa-id-card w-4 text-center mr-1 text-slate-400"></i>
                        {op.driverName}
                    </p>
                )}
                 <p>
                    <i className="far fa-clock w-4 text-center mr-1 text-slate-400"></i>
                    ETA: {new Date(op.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );


    if (isScheduledTruck) {
        return (
            <div className={`card !p-0 bg-white border-l-4 ${borderColorClass}`}>
                <div 
                    className="p-2 cursor-pointer hover:bg-slate-50/50"
                    onClick={() => switchView('operation-details', op.id)}
                >
                    {cardHeader}
                    {cardDetails}
                </div>
                {allChecks.length > 0 && (
                    <>
                        {/* Progress Bar and Expander */}
                        <div className="px-2 pb-2 flex items-center gap-2">
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" title={`Pre-arrival checklist: ${progress.toFixed(0)}% complete`}>
                                <div className="h-full bg-brand-primary rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                            <button 
                                className="flex-shrink-0 text-text-tertiary hover:text-text-primary"
                                onClick={() => setIsExpanded(!isExpanded)}
                                title={isExpanded ? 'Collapse checklist' : 'Expand checklist'}
                            >
                                <i className={`fas fa-chevron-down text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                            </button>
                        </div>
        
                        {isExpanded && (
                            <div className="p-2 border-t bg-slate-50">
                                <div className="space-y-1">
                                    {allChecks.map(check => (
                                        <div key={check.name} className="p-1.5 bg-white rounded grid grid-cols-[1fr,auto] items-center gap-2 text-xs">
                                            <p className="font-semibold">{check.name}</p>
                                            <div className="flex items-center gap-2">
                                                <StatusBadge status={check.status} />
                                                {check.type === 'general' && (
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                        checked={check.status === 'complete'}
                                                        onChange={(e) => updatePreArrivalCheck(op.id, check.name, e.target.checked ? 'complete' : 'pending')}
                                                    />
                                                )}
                                                {check.type === 'service' && (
                                                     <select
                                                        value={check.status}
                                                        onChange={e => updateOperationServiceStatus(op.id, check.name, e.target.value as any)}
                                                        className="!py-0 !px-1 text-xs !h-6"
                                                        onClick={e => e.stopPropagation()} // Prevent card click
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="confirmed">Confirmed</option>
                                                        <option value="complete">Complete</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }


    return (
        <div
            onClick={() => switchView('operation-details', op.id)}
            className={`card !p-2 bg-white cursor-pointer hover:shadow-lg border-l-4 ${borderColorClass} flex flex-col gap-1`}
            title={hasIssues ? `Issues:\n- ${issues.join('\n- ')}` : ''}
        >
            {cardHeader}
            {cardDetails}
        </div>
    );
};

// Main Kanban component
const PlanningKanban: React.FC<{ operations: Operation[] }> = ({ operations }) => {
    const { settings, currentTerminalSettings, holds, workspaceFilter } = useContext(AppContext)!;
    const [collapsedSwimlanes, setCollapsedSwimlanes] = useState(new Set<string>());

    const toggleSwimlane = (infraId: string) => {
        setCollapsedSwimlanes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(infraId)) {
                newSet.delete(infraId);
            } else {
                newSet.add(infraId);
            }
            return newSet;
        });
    };

    const swimlanes = useMemo(() => {
        const opsByInfra: Record<string, Operation[]> = {};
        const filteredByModality = operations.filter(op => {
            if (workspaceFilter === 'all') return true;
            return op.modality === workspaceFilter;
        });

        filteredByModality.forEach(op => {
            const infraId = op.transferPlan?.[0]?.infrastructureId || 'Unassigned';
            if (!opsByInfra[infraId]) {
                opsByInfra[infraId] = [];
            }
            opsByInfra[infraId].push(op);
        });

        const structuredSwimlanes = Object.entries(opsByInfra).map(([infraId, infraOps]) => {
            const columns: { [key: string]: { op: Operation; hasIssues: boolean; issues: string[] }[] } = {};
            KANBAN_STAGES.forEach(stage => { columns[stage] = []; });

            const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');

            const completingStates = ['Completing', 'Awaiting Departure', 'Weighing', 'Sealing', 'Paperwork', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Pumping Stopped'];
            const loadingStates = ['On Bay', 'Loading', 'Pumping'];
            const approvedStates = ['Waiting', 'Waiting for Bay', 'Directed to Bay'];
            const arrivedStates = ['Registered', 'Awaiting Approval', 'Alongside', 'Surveying', 'Preparations', 'Arrived', 'On Siding'];


            infraOps.forEach(op => {
                const validation = validateOperationPlan(op, currentTerminalSettings, settings, activeHolds);
                const data = { op, hasIssues: !validation.isValid, issues: validation.issues };

                if (op.currentStatus === 'Reschedule Required' || op.currentStatus === 'No Show' || (data.hasIssues && op.status === 'planned' && op.modality !== 'truck')) {
                    return;
                }

                let stage = 'Scheduled';
                if (op.status === 'completed' || op.currentStatus === 'Departed') {
                    stage = 'Completed';
                } else if (op.status === 'active') {
                    const currentOpStatus = op.currentStatus || '';
                    const currentTruckStatus = op.truckStatus || '';

                    if (completingStates.includes(currentOpStatus) || completingStates.includes(currentTruckStatus)) {
                        stage = 'Completing / Finals';
                    } else if (loadingStates.includes(currentOpStatus) || loadingStates.includes(currentTruckStatus)) {
                        stage = 'Product Transfer';
                    } else if (approvedStates.includes(currentOpStatus) || approvedStates.includes(currentTruckStatus)) {
                        stage = 'Approved';
                    } else if (arrivedStates.includes(currentOpStatus) || arrivedStates.includes(currentTruckStatus)) {
                        stage = 'Arrived';
                    }
                }
                
                if (columns[stage]) {
                    columns[stage].push(data);
                }
            });
            
            Object.keys(columns).forEach(stage => {
                columns[stage].sort((a, b) => new Date(a.op.eta).getTime() - new Date(b.op.eta).getTime());
            });

            return { infraId, columns, totalOps: infraOps.length };
        });

        structuredSwimlanes.sort((a, b) => {
            if (a.infraId === 'Unassigned') return -1;
            if (b.infraId === 'Unassigned') return 1;
            return a.infraId.localeCompare(b.infraId, undefined, { numeric: true });
        });

        return structuredSwimlanes;
    }, [operations, holds, currentTerminalSettings, settings, workspaceFilter]);

    return (
        <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
            {swimlanes.map(({ infraId, columns, totalOps }, index) => {
                const isCollapsed = collapsedSwimlanes.has(infraId);
                const colorClass = 'bg-slate-800 text-white border-slate-700';

                return (
                    <div key={infraId} className="flex flex-col">
                        <div 
                            className={`flex justify-between items-center p-3 cursor-pointer transition-all ${colorClass} ${isCollapsed ? '' : 'rounded-t-lg'}`}
                            onClick={() => toggleSwimlane(infraId)}
                        >
                            <h3 className="font-bold text-lg">{formatInfraName(infraId)} ({totalOps})</h3>
                            <button className="hover:opacity-75">
                                <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
                            </button>
                        </div>

                        {!isCollapsed && (
                            <div className="flex gap-4 p-3 overflow-x-auto bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg">
                                {KANBAN_STAGES.map(stage => (
                                    <div key={stage} className="w-80 flex-shrink-0 flex flex-col">
                                        <h3 className="font-semibold text-text-primary px-1 mb-3">{stage} ({columns[stage]?.length || 0})</h3>
                                        <div className="space-y-3 overflow-y-auto flex-grow pr-1 min-h-[100px]">
                                            {(columns[stage] || []).map(({ op, hasIssues, issues }) => (
                                                <KanbanCard key={op.id} op={op} hasIssues={hasIssues} issues={issues} stage={stage} />
                                            ))}
                                            {(columns[stage]?.length || 0) === 0 && (
                                                <div className="text-center py-8 text-sm text-text-secondary italic">
                                                    No orders in this stage.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default PlanningKanban;
