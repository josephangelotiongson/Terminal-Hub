
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality } from '../types';
import { validateOperationPlan, canApproveGate } from '../utils/helpers';

const PRE_ARRIVAL_SERVICES_CHECKLIST = ['Aquis Quarantine', 'Customs arrival', 'Marpol surveyor', 'Ship stability/positioning'];
const GENERAL_PRE_ARRIVAL_CHECKS = ['Customer Confirmation', 'Documents Received'];

const getIcon = (modality: Modality) => {
    if (modality === 'truck') return 'fa-truck';
    if (modality === 'rail') return 'fa-train';
    return 'fa-ship';
};

const ChecklistRow: React.FC<{ op: Operation }> = ({ op }) => {
    const { switchView, settings, currentTerminalSettings, holds, updatePreArrivalCheck, updateVesselServiceStatus, acceptTruckArrival, currentUser } = useContext(AppContext)!;
    const [isExpanded, setIsExpanded] = useState(false);

    const canApprove = canApproveGate(currentUser);
    const isRegisteredTruck = op.modality === 'truck' && op.truckStatus === 'Registered';

    const validation = useMemo(() => {
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        return validateOperationPlan(op, currentTerminalSettings, settings, activeHolds);
    }, [op, currentTerminalSettings, settings, holds]);

    const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];

    const { allChecks, progress } = useMemo(() => {
        const preArrivalServices = (op.specialRequirements || []).filter(s => PRE_ARRIVAL_SERVICES_CHECKLIST.includes(s.name));
    
        const baseChecks = [
            { name: 'Plan Validated', status: validation.isValid ? 'complete' : 'pending', type: 'system' },
            ...GENERAL_PRE_ARRIVAL_CHECKS.map(name => ({
                name,
                status: op.preArrivalChecks?.[name]?.status || 'pending',
                type: 'general'
            })),
            ...preArrivalServices.map(service => ({
                name: service.name,
                status: service.data?.status || 'pending',
                type: 'service'
            }))
        ];

        const finalChecks = op.modality === 'truck'
            ? baseChecks.filter(check => !['Plan Validated', 'Customer Confirmation', 'Documents Received'].includes(check.name))
            : baseChecks;
        
        const completedChecks = finalChecks.filter(c => c.status === 'complete' || c.status === 'confirmed').length;
        const progressPercentage = finalChecks.length > 0 ? (completedChecks / finalChecks.length) * 100 : 100;
        
        return { allChecks: finalChecks, progress: progressPercentage };
    }, [op, validation.isValid]);

    const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
        const baseClass = "px-2 py-0.5 text-xs font-semibold rounded-full";
        switch (status) {
            case 'complete': return <span className={`${baseClass} bg-green-100 text-green-800`}>Complete</span>;
            case 'confirmed': return <span className={`${baseClass} bg-blue-100 text-blue-800`}>Confirmed</span>;
            case 'pending': return <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>Pending</span>;
            default: return <span className={`${baseClass} bg-slate-100 text-slate-800`}>{status}</span>;
        }
    };

    return (
        <div className="card !p-0">
            <div 
                className="flex items-center p-3 cursor-pointer hover:bg-slate-50"
                onClick={() => switchView(isRegisteredTruck ? 'operation-details' : 'operation-plan', op.id)}
            >
                <div className="flex items-center gap-4 flex-grow min-w-0">
                    <i className={`fas ${getIcon(op.modality)} text-brand-dark text-xl w-6 text-center`}></i>
                    <div className="min-w-0">
                        {op.modality === 'truck' && op.licensePlate ? (
                            <>
                                <p className="font-mono font-black text-2xl tracking-wider text-brand-dark truncate" title={op.licensePlate}>
                                    {op.licensePlate}
                                </p>
                                <p className="text-xs text-text-secondary truncate">{op.transportId} | ETA: {new Date(op.eta).toLocaleString()}</p>
                            </>
                        ) : (
                            <>
                                <p className="font-bold text-base text-brand-dark truncate">{op.transportId}</p>
                                <p className="text-xs text-text-tertiary truncate">ETA: {new Date(op.eta).toLocaleString()}</p>
                            </>
                        )}
                    </div>
                </div>
                <div className="hidden sm:block w-1/4 px-4 min-w-0">
                     <p className="font-semibold text-sm truncate">{firstTransfer?.customer}</p>
                     <p className="text-xs text-text-tertiary truncate">{firstTransfer?.product}</p>
                </div>
                 {isRegisteredTruck ? (
                     <div className="w-48 px-4 hidden md:flex items-center justify-end">
                        <button
                            onClick={(e) => { e.stopPropagation(); acceptTruckArrival(op.id); }}
                            className="btn-primary !py-2 !px-4 text-sm"
                            disabled={!canApprove}
                            title={!canApprove ? "Permission Denied" : "Accept Truck Arrival"}
                        >
                            Accept Arrival
                        </button>
                    </div>
                ) : (
                    <div className="w-48 px-4 hidden md:flex items-center gap-2">
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-primary rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-xs font-semibold text-text-secondary w-10 text-right">{progress.toFixed(0)}%</span>
                    </div>
                )}
                {allChecks.length > 0 && !isRegisteredTruck && (
                    <div
                        className="flex-shrink-0 px-2 cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        <i className={`fas fa-chevron-down text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                    </div>
                )}
            </div>

            {isExpanded && allChecks.length > 0 && !isRegisteredTruck && (
                <div className="p-4 border-t bg-slate-50">
                    <div className="space-y-2">
                        {allChecks.map(check => (
                            <div key={check.name} className="p-2 bg-white rounded-md grid grid-cols-[1fr,120px,150px] items-center gap-4">
                                <p className="font-semibold text-sm">{check.name}</p>
                                <StatusBadge status={check.status} />
                                <div className="text-right">
                                    {check.type === 'system' && (
                                        !validation.isValid && <span title={validation.issues.join('\n')} className="text-red-500 font-bold text-sm">ISSUES</span>
                                    )}
                                    {check.type === 'general' && (
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                            checked={check.status === 'complete'}
                                            onChange={(e) => updatePreArrivalCheck(op.id, check.name, e.target.checked ? 'complete' : 'pending')}
                                        />
                                    )}
                                    {check.type === 'service' && (
                                        <select
                                            value={check.status}
                                            onChange={e => updateVesselServiceStatus(op.id, check.name, e.target.value as any)}
                                            className="!py-1 !px-2 text-xs"
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
        </div>
    );
};

interface PlanningListProps {
    operations: Operation[];
}

const PlanningList: React.FC<PlanningListProps> = ({ operations }) => {
    const { workspaceFilter, workspaceSearchTerm } = useContext(AppContext)!;

    const plannedOps = useMemo(() => {
        return operations
            .filter(op => {
                const isPlannedAndWaiting = op.status === 'planned' && !['Reschedule Required', 'No Show'].includes(op.currentStatus);
                const isRegisteredTruck = op.modality === 'truck' && op.truckStatus === 'Registered';

                if (!isPlannedAndWaiting && !isRegisteredTruck) return false;
                
                if (workspaceFilter !== 'all' && op.modality !== workspaceFilter) return false;

                if (!workspaceSearchTerm) return true;
                const term = workspaceSearchTerm.toLowerCase();
                return (
                    op.transportId?.toLowerCase().includes(term) ||
                    op.orderNumber?.toLowerCase().includes(term) ||
                    op.licensePlate?.toLowerCase().includes(term) ||
                    (op.transferPlan || []).some(tp =>
                        (tp.transfers || []).some(t =>
                            t.product?.toLowerCase().includes(term) ||
                            t.customer?.toLowerCase().includes(term)
                        )
                    )
                );
            })
            .sort((a, b) => {
                const aIsRegistered = a.modality === 'truck' && a.truckStatus === 'Registered';
                const bIsRegistered = b.modality === 'truck' && b.truckStatus === 'Registered';
                if (aIsRegistered && !bIsRegistered) return -1;
                if (!aIsRegistered && bIsRegistered) return 1;
                return new Date(a.eta).getTime() - new Date(b.eta).getTime();
            });

    }, [operations, workspaceFilter, workspaceSearchTerm]);

    return (
        <div className="space-y-3">
             <h3 className="font-bold text-lg text-text-secondary px-4 mb-2">Upcoming Arrivals & Gate Queue ({plannedOps.length})</h3>
            {plannedOps.length > 0 ? (
                plannedOps.map(op => <ChecklistRow key={op.id} op={op} />)
            ) : (
                <div className="card text-center py-8 text-text-secondary">
                    <p>No planned operations awaiting arrival match the current filter.</p>
                </div>
            )}
        </div>
    );
};

export default PlanningList;
