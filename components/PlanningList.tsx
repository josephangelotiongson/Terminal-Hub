import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, AppSettings, TerminalSettings, Modality } from '../types';
import SteppedProgressBar from './SteppedProgressBar';
import { calculateOperationValue, formatCurrency, validateOperationPlan } from '../utils/helpers';

const PlanningList: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { operations, selectedTerminal, switchView, currentTerminalSettings, workspaceFilter, workspaceSearchTerm, currentUser, settings, holds, requeueOperation, openRescheduleModal } = context;
    const isCommercials = currentUser.role === 'Commercials';

    const filteredAndSortedOps = useMemo(() => {
        return operations
            .filter(op => 
                op.terminal === selectedTerminal &&
                op.currentStatus !== 'Reschedule Required' &&
                (op.status === 'planned' || op.status === 'active')
            )
            .filter(op => {
                if (workspaceFilter !== 'all' && op.modality !== workspaceFilter) return false;

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
            })
            .sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
    }, [operations, selectedTerminal, workspaceFilter, workspaceSearchTerm]);

    const getIcon = (modality: Modality) => {
        if (modality === 'truck') return 'fa-truck';
        if (modality === 'rail') return 'fa-train';
        return 'fa-ship';
    };

    return (
        <div className="space-y-4">
            {filteredAndSortedOps.length > 0 ? filteredAndSortedOps.map(op => {
                const eta = new Date(op.eta);
                const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
                const { totalValue } = isCommercials ? calculateOperationValue(op, settings) : { totalValue: 0 };
                
                const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
                const validation = (op.status === 'planned' || op.status === 'active')
                    ? validateOperationPlan(op, currentTerminalSettings, settings, activeHolds)
                    : { isValid: true, issues: [] };
                const hasIssues = !validation.isValid;

                return (
                    <div 
                        key={op.id} 
                        className={`card p-4 cursor-pointer hover:bg-slate-50 ${hasIssues ? 'border-yellow-400 border-2' : ''}`}
                        onClick={() => switchView('operation-details', op.id)}
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-4 min-w-0">
                                <i className={`fas ${getIcon(op.modality)} ${op.status === 'completed' ? 'text-slate-400' : 'text-brand-dark'} text-xl w-6 text-center`}></i>
                                <div className="min-w-0">
                                    <p className="font-bold text-lg text-brand-dark truncate">{op.transportId}</p>
                                    <p className="text-sm text-text-secondary">ETA: {eta.toLocaleString()}</p>
                                    {firstTransfer && (
                                        <p className="text-xs text-text-tertiary truncate mt-1">
                                            {firstTransfer.product} ({firstTransfer.from} &rarr; {firstTransfer.to})
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {hasIssues && (
                                    <div className="flex items-center gap-2">
                                        <div title={`Plan Issues:\n- ${validation.issues.join('\n- ')}`}>
                                            <i className="fas fa-exclamation-triangle text-yellow-500 text-xl animate-pulse"></i>
                                        </div>
                                        {op.status === 'planned' && (
                                            <button 
                                                className="btn-primary !py-1 !px-3 !text-sm !bg-orange-500 hover:!bg-orange-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    requeueOperation(op.id, validation.issues[0]);
                                                    openRescheduleModal(op.id, new Date());
                                                }}
                                            >
                                                Reschedule
                                            </button>
                                        )}
                                    </div>
                                )}
                                {isCommercials && (
                                    <div className="text-sm font-bold text-green-800 bg-green-100 px-3 py-1.5 rounded-full">
                                        {formatCurrency(totalValue)}
                                    </div>
                                )}
                                <span className="font-semibold text-sm">{op.currentStatus}</span>
                            </div>
                        </div>
                         <div className="mt-4">
                            <SteppedProgressBar op={op} />
                        </div>
                    </div>
                );
            }) : (
                <div className="card text-center py-8 text-text-secondary">
                    <p>No scheduled or active operations match the current filter.</p>
                </div>
            )}
        </div>
    );
};

export default PlanningList;