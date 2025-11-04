import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality } from '../types';
import ModalityFilter from './ModalityFilter';
import WorkspaceSearch from './WorkspaceSearch';
import { calculateOperationProgress, calculateOperationValue, formatCurrency } from '../utils/helpers';
import TruckRejectionModal from './TruckRejectionModal';

interface AttentionReason {
    reason: string;
    details: string;
    action?: 'call_off' | 'reschedule' | 'gate_approval';
}

const Dashboard: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <p>Loading...</p>;

    const { operations, selectedTerminal, switchView, workspaceFilter, setWorkspaceFilter, workspaceSearchTerm, setWorkspaceSearchTerm, callOffTruck, openRescheduleModal, acceptTruckArrival, currentUser, settings } = context;
    const isCommercials = currentUser.role === 'Commercials';
    const [sortBy, setSortBy] = useState<'progress' | 'default'>('default');
    const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
    const [rejectionTarget, setRejectionTarget] = useState<Operation | null>(null);

    const { attentionOps, normalActiveOps, plannedOps } = useMemo(() => {
        const terminalOps = operations.filter(op => op.terminal === selectedTerminal);

        const searchedOps = terminalOps.filter(op => {
            if (!workspaceSearchTerm) return true;
            const term = workspaceSearchTerm.toLowerCase();
            return (
                op.transportId?.toLowerCase().includes(term) ||
                op.orderNumber?.toLowerCase().includes(term) ||
                op.licensePlate?.toLowerCase().includes(term) ||
                op.transferPlan.some(tp =>
                    tp.transfers.some(t =>
                        t.product?.toLowerCase().includes(term) ||
                        t.customer?.toLowerCase().includes(term)
                    )
                )
            );
        });

        const filteredTerminalOps = workspaceFilter === 'all'
            ? searchedOps
            : searchedOps.filter(op => op.modality === workspaceFilter);
        
        const activeOps = filteredTerminalOps.filter(op => op.status === 'active');
        
        const attentionOpsList: { op: Operation, attention: AttentionReason }[] = [];
        const normalActiveOpsList: Operation[] = [];
        
        const now = new Date().getTime();
        
        activeOps.forEach(op => {
            let needsAttention = false;
            if (op.modality === 'truck') {
                if (op.truckStatus === 'Registered') {
                    attentionOpsList.push({
                        op,
                        attention: {
                            reason: 'Arrival: Awaiting Approval',
                            details: 'Please accept or reject this truck.',
                            action: 'gate_approval'
                        }
                    });
                    needsAttention = true;
                } else if (op.delay?.active) {
                    attentionOpsList.push({ 
                        op, 
                        attention: { 
                            reason: 'Delayed', 
                            details: op.delay.reason || 'No reason provided',
                            action: 'reschedule'
                        } 
                    });
                    needsAttention = true;
                } else if (op.truckStatus === 'Waiting') {
                    const etaTime = new Date(op.eta).getTime();
                    const minutesWaiting = (now - etaTime) / 60000;
                    if (minutesWaiting > 15) {
                        attentionOpsList.push({ 
                            op, 
                            attention: { 
                                reason: 'Waiting for Bay', 
                                details: `For ${Math.round(minutesWaiting)} mins`,
                                action: 'call_off'
                            } 
                        });
                        needsAttention = true;
                    }
                }
            }
            
            if (!needsAttention) {
                normalActiveOpsList.push(op);
            }
        });

        // Sorting logic
        normalActiveOpsList.sort((a, b) => {
            if (sortBy === 'progress') {
                const progressA = calculateOperationProgress(a).percentage;
                const progressB = calculateOperationProgress(b).percentage;
                return progressB - progressA; // Descending progress
            }
            return (a.queuePriority || 0) - (b.queuePriority || 0); // Default sort
        });
        
        const sortedPlannedOps = filteredTerminalOps
            .filter(op => op.status === 'planned')
            .sort((a, b) => (a.queuePriority || 0) - (b.queuePriority || 0));

        return {
            attentionOps: attentionOpsList,
            normalActiveOps: normalActiveOpsList,
            plannedOps: sortedPlannedOps,
        };
    }, [operations, selectedTerminal, workspaceFilter, workspaceSearchTerm, sortBy]);

    const getIcon = (modality: string) => {
        switch (modality) {
            case 'vessel': return 'fa-ship';
            case 'truck': return 'fa-truck';
            case 'rail': return 'fa-train';
            default: return 'fa-question-circle';
        }
    };
    
    const renderTransferSummary = (op: Operation) => {
        const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
        if (!firstTransfer) return null;

        return (
            <p className="text-xs text-text-tertiary truncate mt-1">
                {firstTransfer.product} ({firstTransfer.from} &rarr; {firstTransfer.to})
            </p>
        );
    };

    const FinancialsBadge = ({ op }: { op: Operation }) => {
        const { totalValue } = calculateOperationValue(op, settings);
        return (
            <div className="text-xs font-bold text-green-800 bg-green-200 px-2 py-1 rounded-full whitespace-nowrap">
                {formatCurrency(totalValue)}
            </div>
        );
    };
    
    return (
        <div>
            <TruckRejectionModal
                isOpen={rejectionModalOpen}
                onClose={() => setRejectionModalOpen(false)}
                operation={rejectionTarget}
            />
            <div className="sticky top-0 z-10 bg-background-card p-3 sm:p-6 border-b border-border-primary">
                <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-4">
                    <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setWorkspaceSearchTerm} />
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 ml-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-secondary whitespace-nowrap">Sort by:</span>
                            <div className="flex items-center rounded-md bg-slate-200 p-1">
                                <button onClick={() => setSortBy('default')} className={`text-sm font-semibold px-3 py-1 rounded ${sortBy === 'default' ? 'bg-white shadow' : 'text-slate-600'}`}>Time</button>
                                <button onClick={() => setSortBy('progress')} className={`text-sm font-semibold px-3 py-1 rounded ${sortBy === 'progress' ? 'bg-white shadow' : 'text-slate-600'}`}>Progress</button>
                            </div>
                        </div>
                        <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} />
                    </div>
                </div>
            </div>
            <div className="p-3 sm:p-6 space-y-6">
                {attentionOps.length > 0 && (
                    <div>
                        <h3 className="text-xl font-semibold text-yellow-600 mb-4 flex items-center">
                            <i className="fas fa-exclamation-triangle mr-3"></i>Needs Attention
                        </h3>
                        <div className="space-y-3">
                            {attentionOps.map(({ op, attention }) => (
                                <div 
                                    key={op.id} 
                                    className="card p-3 bg-yellow-50 border-yellow-300 transition hover:shadow-lg cursor-pointer"
                                    onClick={() => switchView('operation-details', op.id)}
                                >
                                    <div className="grid grid-cols-[auto,1.5fr,2fr,auto] sm:grid-cols-[auto,2fr,3fr,auto] gap-4 items-center">
                                        <i className="fas fa-truck text-yellow-600 text-xl w-6 text-center"></i>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-base text-text-primary truncate">{op.transportId}</h4>
                                            {renderTransferSummary(op)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-yellow-700 truncate" title={`${attention.reason}: ${attention.details}`}>
                                                {attention.reason}: <span className="font-normal">{attention.details}</span>
                                            </p>
                                        </div>
                                        <div className="flex justify-end items-center gap-4">
                                            {isCommercials && <FinancialsBadge op={op} />}
                                            {attention.action === 'gate_approval' && (
                                                <div className="flex items-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); setRejectionTarget(op); setRejectionModalOpen(true); }} className="btn-danger !py-2 !px-4 text-sm flex-shrink-0">
                                                        Reject
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); acceptTruckArrival(op.id); }} className="btn-primary !bg-green-600 hover:!bg-green-700 !border-green-600 !py-2 !px-4 text-sm flex-shrink-0">
                                                        Accept
                                                    </button>
                                                </div>
                                            )}
                                            {attention.action === 'reschedule' && (
                                                <button onClick={(e) => { e.stopPropagation(); openRescheduleModal(op.id, new Date(), 'dashboard-delay'); }} className="btn-primary !bg-orange-500 !border-orange-500 hover:!bg-orange-600 !py-2 !px-4 text-sm flex-shrink-0">
                                                    Reschedule
                                                </button>
                                            )}
                                            {attention.action === 'call_off' && (
                                                <button onClick={(e) => { e.stopPropagation(); callOffTruck(op.id); }} className="btn-primary !bg-yellow-500 !border-yellow-500 hover:!bg-yellow-600 !py-2 !px-4 text-sm flex-shrink-0">
                                                    Direct to Bay
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-xl font-semibold text-text-primary mb-4">Active Operations</h3>
                    <div className="space-y-3">
                        {normalActiveOps.length > 0 ? normalActiveOps.map(op => {
                            const progress = calculateOperationProgress(op);
                            return (
                                <div 
                                    key={op.id} 
                                    className="card p-3 cursor-pointer transition hover:shadow-lg"
                                    onClick={() => switchView('operation-details', op.id)}
                                >
                                    <div className="grid grid-cols-[auto,1fr,1fr,auto] sm:grid-cols-[auto,2fr,1fr,1.5fr] gap-4 items-center">
                                        <i className={`fas ${getIcon(op.modality)} text-brand-primary text-xl w-6 text-center`}></i>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-base text-text-primary truncate">{op.transportId}</h4>
                                            {renderTransferSummary(op)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium truncate ${op.delay?.active ? 'text-red-600' : 'text-text-secondary'}`}>
                                                {op.delay?.active ? `Delayed: ${op.delay.reason}` : op.currentStatus}
                                            </p>
                                        </div>
                                        <div className="flex justify-end items-center gap-4">
                                            {isCommercials && <FinancialsBadge op={op} />}
                                            <div className="flex items-center gap-2 w-full max-w-[150px]">
                                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" title={`${progress.completed} of ${progress.total} steps`}>
                                                    <div 
                                                        className="h-full bg-green-500 rounded-full transition-all duration-500" 
                                                        style={{ width: `${progress.percentage}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs font-semibold text-text-secondary w-10 text-right">{progress.percentage.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : <div className="card text-center py-8 text-text-secondary">
                                {attentionOps.length > 0 ? "No other active operations." : "No active operations match the current filter."}
                            </div>
                        }
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-text-primary mb-4">Planned Operations</h3>
                    <div className="space-y-3">
                        {plannedOps.length > 0 ? plannedOps.map(op => {
                            return (
                                <div 
                                    key={op.id} 
                                    className="card p-3 cursor-pointer transition hover:shadow-lg"
                                    onClick={() => switchView('operation-plan', op.id)}
                                >
                                    <div className="grid grid-cols-[auto,1fr,2fr,auto] sm:grid-cols-[auto,2fr,2fr,1fr] gap-4 items-center">
                                        <i className={`fas ${getIcon(op.modality)} text-text-secondary text-xl w-6 text-center`}></i>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-base text-text-primary truncate">{op.transportId}</h4>
                                            {renderTransferSummary(op)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm text-text-tertiary truncate">ETA: {new Date(op.eta).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right flex items-center justify-end gap-4">
                                            {isCommercials && <FinancialsBadge op={op} />}
                                            <span className="font-semibold text-sm text-text-secondary truncate">
                                                {op.currentStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : <div className="card text-center py-8 text-text-secondary">No planned operations match the current filter.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;