
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality, Hold } from '../types';
import { calculateOperationValue, formatCurrency, getOperationBorderColorClass, canDispatchTrucks, canApproveGate, canReschedule } from '../utils/helpers';
import TruckRejectionModal from './TruckRejectionModal';
import RequeuePriorityModal from './RequeuePriorityModal';
import ElapsedTimeBadge from './ElapsedTimeBadge';

interface StatCardProps {
    icon: string;
    value: string;
    label: string;
    colorClass: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, colorClass }) => (
    <div className={`card p-4 flex items-start gap-4 ${colorClass}`}>
        <div className="bg-white/30 p-3 rounded-lg">
            <i className={`fas ${icon} text-2xl`}></i>
        </div>
        <div>
            <p className="text-3xl font-bold">{value}</p>
            <p className="text-sm font-medium opacity-90">{label}</p>
        </div>
    </div>
);

const Dashboard: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <p>Loading...</p>;

    const { operations, selectedTerminal, switchView, callOffTruck, openRescheduleModal, acceptTruckArrival, holds, currentUser, simulatedTime, openAcceptNoShowModal } = context;
    
    const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
    const [rejectionTarget, setRejectionTarget] = useState<Operation | null>(null);
    const [rejectionPriority, setRejectionPriority] = useState<'high' | 'normal'>('normal');
    const [priorityModalState, setPriorityModalState] = useState<{isOpen: boolean, op: Operation | null, source: 'reject' | 'delay' | null}>({isOpen: false, op: null, source: null});

    const canDispatch = canDispatchTrucks(currentUser);
    const canApprove = canApproveGate(currentUser);

    const {
        stats,
        attentionOps,
        currentlyActiveOps,
        comingUpNextOps,
    } = useMemo(() => {
        const terminalOps = operations.filter(op => op.terminal === selectedTerminal);

        const now = simulatedTime;
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const todayOps = terminalOps.filter(op => {
            const opTime = new Date(op.eta);
            return opTime >= startOfDay && opTime < endOfDay;
        });
        
        const completedToday = terminalOps.filter(op => {
            const completedTime = op.completedTime ? new Date(op.completedTime) : null;
            return op.status === 'completed' && completedTime && completedTime >= startOfDay && completedTime < endOfDay;
        });

        const attentionOpsList: { op: Operation, reason: string, details: string, action?: 'call_off' | 'reschedule' | 'gate_approval' | 'reschedule_priority' | 'accept_or_reschedule' }[] = [];
        const activeOpsList: Operation[] = [];
        
        terminalOps.forEach(op => {
            // Priority 1: High-priority reschedules or no-shows that have become high priority
            if (['Reschedule Required', 'No Show'].includes(op.currentStatus) && op.requeueDetails?.priority === 'high') {
                attentionOpsList.push({ op, reason: 'High-Priority Reschedule', details: op.requeueDetails.reason, action: 'reschedule_priority' });
                return; // continue to next op
            }

            // Priority 2: Standard reschedules or no-shows
            if (['Reschedule Required', 'No Show'].includes(op.currentStatus)) {
                attentionOpsList.push({ op, reason: op.currentStatus, details: op.requeueDetails?.reason || 'Overdue', action: 'accept_or_reschedule' });
                return;
            }

            if (op.status === 'active') {
                let needsAttention = false;
                if (op.modality === 'truck') {
                    if (op.truckStatus === 'Registered') {
                        attentionOpsList.push({ op, reason: 'Arrival: Awaiting Approval', details: 'Please accept or reject this truck.', action: 'gate_approval' });
                        needsAttention = true;
                    } else if (op.delay?.active) {
                        attentionOpsList.push({ op, reason: 'Delayed', details: op.delay.reason || 'No reason provided', action: 'reschedule' });
                        needsAttention = true;
                    } else if (op.truckStatus === 'Waiting') {
                        const etaTime = new Date(op.eta).getTime();
                        const minutesWaiting = (now.getTime() - etaTime) / 60000;
                        if (minutesWaiting > 15) {
                            attentionOpsList.push({ op, reason: 'Waiting for Bay', details: `For ${Math.round(minutesWaiting)} mins`, action: 'call_off' });
                            needsAttention = true;
                        }
                    }
                }
                if (!needsAttention) {
                    activeOpsList.push(op);
                }
            }
        });

        // Stats Calculation
        const dailyStats = {
            vesselsHandled: new Set([...todayOps, ...completedToday].filter(o => o.modality === 'vessel').map(o => o.transportId)).size,
            trucksProcessed: new Set([...todayOps, ...completedToday].filter(o => o.modality === 'truck').map(o => o.id)).size,
            totalThroughput: completedToday.reduce((sum, op) => {
                return sum + op.transferPlan.reduce((s, tp) => s + tp.transfers.reduce((t, tr) => t + (tr.transferredTonnes || 0), 0), 0);
            }, 0),
        };

        const sortedActive = activeOpsList.sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()).slice(0, 5);
        const sortedPlanned = terminalOps.filter(op => op.status === 'planned' && !['Reschedule Required', 'No Show'].includes(op.currentStatus)).sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()).slice(0, 5);

        return {
            stats: dailyStats,
            attentionOps: attentionOpsList,
            currentlyActiveOps: sortedActive,
            comingUpNextOps: sortedPlanned,
        };

    }, [operations, selectedTerminal, simulatedTime]);
    
    const getIcon = (modality: string) => {
        switch (modality) {
            case 'vessel': return 'fa-ship';
            case 'truck': return 'fa-truck';
            case 'rail': return 'fa-train';
            default: return 'fa-question-circle';
        }
    };
    
    return (
        <div>
            <RequeuePriorityModal
                isOpen={priorityModalState.isOpen}
                onClose={() => setPriorityModalState({isOpen: false, op: null, source: null})}
                onSelect={(priority) => {
                    const { op, source } = priorityModalState;
                    setPriorityModalState({isOpen: false, op: null, source: null});
                    if (op && source === 'reject') {
                        setRejectionTarget(op);
                        setRejectionPriority(priority);
                        setRejectionModalOpen(true);
                    } else if (op && source === 'delay') {
                        openRescheduleModal(op.id, undefined, 'dashboard-delay', priority);
                    }
                }}
            />
            <TruckRejectionModal
                isOpen={rejectionModalOpen}
                onClose={() => setRejectionModalOpen(false)}
                operation={rejectionTarget}
                priority={rejectionPriority}
            />
            
            <div className="p-3 sm:p-6 space-y-8">
                {/* Daily Summary */}
                <div>
                    <h3 className="text-xl font-semibold text-text-primary mb-4">Daily Summary</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <StatCard icon="fa-ship" value={String(stats.vesselsHandled)} label="Vessels Handled" colorClass="bg-blue-500 text-white" />
                        <StatCard icon="fa-truck" value={String(stats.trucksProcessed)} label="Trucks Processed" colorClass="bg-green-500 text-white" />
                        <StatCard icon="fa-weight-hanging" value={`${stats.totalThroughput.toLocaleString(undefined, {maximumFractionDigits: 0})} T`} label="Throughput Today" colorClass="bg-slate-500 text-white" />
                    </div>
                </div>

                {/* Needs Attention */}
                {attentionOps.length > 0 && (
                    <div>
                        <h3 className="text-xl font-semibold text-yellow-600 mb-4 flex items-center">
                            <i className="fas fa-exclamation-circle mr-3"></i>Needs Attention
                        </h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                            {attentionOps.map(({ op, reason, details, action }) => {
                                const isPumping = op.modality === 'truck' && ['Loading', 'Pumping'].includes(op.truckStatus || '');
                                const canUserReschedule = canReschedule(currentUser, op);
                                return (
                                <div 
                                    key={op.id} 
                                    onClick={() => switchView('operation-details', op.id)}
                                    className={`card p-3 flex justify-between items-center gap-4 cursor-pointer hover:shadow-md transition-all ${
                                        action === 'reschedule_priority' ? 'bg-red-50 border-red-300' 
                                        : action === 'accept_or_reschedule' ? 'bg-orange-50 border-orange-300'
                                        : 'bg-yellow-50 border-yellow-300'}`}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <i className={`fas ${getIcon(op.modality)} ${
                                            action === 'reschedule_priority' ? 'text-red-600'
                                            : action === 'accept_or_reschedule' ? 'text-orange-600'
                                            : 'text-yellow-600'} text-xl w-6 text-center`}></i>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-base text-text-primary truncate">{op.transportId}</h4>
                                            <p className={`text-sm font-medium ${
                                                action === 'reschedule_priority' ? 'text-red-700'
                                                : action === 'accept_or_reschedule' ? 'text-orange-700'
                                                : 'text-yellow-700'} truncate`} title={`${reason}: ${details}`}>
                                                {reason}: <span className="font-normal">{details}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end items-center gap-2 flex-shrink-0">
                                        {action === 'gate_approval' && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); setPriorityModalState({isOpen: true, op, source: 'reject'}); }} className="btn-danger !py-2 !px-4 text-sm" disabled={!canApprove} title={!canApprove ? "Permission Denied" : ""}>Reject</button>
                                                <button onClick={(e) => { e.stopPropagation(); acceptTruckArrival(op.id); }} className="btn-primary !bg-green-600 hover:!bg-green-700 !border-green-600 !py-2 !px-4 text-sm" disabled={!canApprove} title={!canApprove ? "Permission Denied" : ""}>Accept</button>
                                            </>
                                        )}
                                        {action === 'accept_or_reschedule' && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); openRescheduleModal(op.id); }} className="btn-secondary !py-2 !px-4 text-sm" disabled={!canUserReschedule} title={!canUserReschedule ? "Permission Denied" : "Reschedule"}>Reschedule</button>
                                                <button onClick={(e) => { e.stopPropagation(); openAcceptNoShowModal(op.id); }} className="btn-primary !bg-green-600 hover:!bg-green-700 !border-green-600 !py-2 !px-4 text-sm" disabled={!canApprove} title={!canApprove ? "Permission Denied" : ""}>Accept Arrival</button>
                                            </>
                                        )}
                                        {action === 'reschedule' && <button 
                                            onClick={(e) => { e.stopPropagation(); setPriorityModalState({isOpen: true, op, source: 'delay'}); }} 
                                            className="btn-primary !bg-orange-500 !border-orange-500 hover:!bg-orange-600 !py-2 !px-4 text-sm" 
                                            disabled={!canUserReschedule || isPumping} 
                                            title={!canUserReschedule ? "Permission Denied" : isPumping ? "Cannot reschedule while pumping is in progress" : "Reschedule"}
                                        >Reschedule</button>}
                                        {action === 'reschedule_priority' && <button onClick={(e) => { e.stopPropagation(); openRescheduleModal(op.id, undefined, undefined, 'high'); }} className="btn-primary !bg-red-500 !border-red-500 hover:!bg-red-600 !py-2 !px-4 text-sm animate-pulse" disabled={!canUserReschedule} title={!canUserReschedule ? "Permission Denied" : "Reschedule"}>Reschedule</button>}
                                        {action === 'call_off' && <button onClick={(e) => { e.stopPropagation(); callOffTruck(op.id); }} className="btn-primary !bg-yellow-500 !border-yellow-500 hover:!bg-yellow-600 !py-2 !px-4 text-sm" disabled={!canDispatch} title={!canDispatch ? "Permission Denied" : "Direct Truck to Bay"}>Direct to Bay</button>}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                )}
                
                {/* Shift Handover */}
                <div>
                     <h3 className="text-xl font-semibold text-text-primary mb-4">Shift Handover</h3>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card p-4">
                            <h4 className="font-semibold text-lg mb-3">Currently Active ({currentlyActiveOps.length})</h4>
                            <div className="space-y-2">
                                {currentlyActiveOps.map(op => (
                                    <div key={op.id} onClick={() => switchView('operation-details', op.id)} className={`p-2 rounded-md flex items-center gap-3 cursor-pointer hover:bg-slate-100 border-l-4 ${getOperationBorderColorClass(op)}`}>
                                        <i className={`fas ${getIcon(op.modality)} text-text-secondary w-5 text-center`}></i>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <p className="font-bold text-sm truncate">{op.transportId}</p>
                                                <ElapsedTimeBadge startTime={op.eta} />
                                            </div>
                                            <p className="text-xs text-text-tertiary truncate">{op.transferPlan[0]?.transfers[0]?.product} | {op.currentStatus}</p>
                                        </div>
                                    </div>
                                ))}
                                {currentlyActiveOps.length === 0 && <p className="text-sm text-center text-text-secondary italic py-4">No operations are currently active.</p>}
                            </div>
                             <button onClick={() => switchView('active-operations-list')} className="btn-secondary w-full mt-4 text-sm">View All Active</button>
                        </div>
                        <div className="card p-4">
                            <h4 className="font-semibold text-lg mb-3">Coming Up Next ({comingUpNextOps.length})</h4>
                            <div className="space-y-2">
                                {comingUpNextOps.map(op => (
                                    <div key={op.id} onClick={() => switchView('operation-details', op.id)} className={`p-2 rounded-md flex items-center gap-3 cursor-pointer hover:bg-slate-100 border-l-4 ${getOperationBorderColorClass(op)}`}>
                                        <i className={`fas ${getIcon(op.modality)} text-text-secondary w-5 text-center`}></i>
                                        <div className="flex-grow min-w-0">
                                            <p className="font-bold text-sm truncate">{op.transportId}</p>
                                            <p className="text-xs text-text-tertiary truncate">ETA: {new Date(op.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {op.transferPlan[0]?.transfers[0]?.product}</p>
                                        </div>
                                    </div>
                                ))}
                                {comingUpNextOps.length === 0 && <p className="text-sm text-center text-text-secondary italic py-4">No new operations planned.</p>}
                            </div>
                            <button onClick={() => switchView('planning')} className="btn-secondary w-full mt-4 text-sm">Go to Planning Board</button>
                        </div>
                     </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
