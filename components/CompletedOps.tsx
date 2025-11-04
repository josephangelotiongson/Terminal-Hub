import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality } from '../types';
import ModalityFilter from './ModalityFilter';
import CompletedOpDetailsModal from './CompletedOpDetailsModal';
import WorkspaceSearch from './WorkspaceSearch';
import { calculateOperationValue, formatCurrency } from '../utils/helpers';

const CompletedOps: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <p>Loading...</p>;

    const { operations, selectedTerminal, workspaceFilter, setWorkspaceFilter, workspaceSearchTerm, setWorkspaceSearchTerm, currentUser, settings } = context;
    const isCommercials = currentUser.role === 'Commercials';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOp, setSelectedOp] = useState<Operation | null>(null);

    const filteredOps = useMemo(() => {
        return operations
            .filter(op =>
                op.terminal === selectedTerminal &&
                (op.status === 'completed' || op.status === 'cancelled') &&
                (workspaceFilter === 'all' || op.modality === workspaceFilter)
            )
            .filter(op => {
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
            .sort((a, b) => {
                const timeA = a.status === 'completed' ? a.completedTime : a.cancellationDetails?.time;
                const timeB = b.status === 'completed' ? b.completedTime : b.cancellationDetails?.time;
                return new Date(timeB || 0).getTime() - new Date(timeA || 0).getTime();
            });
    }, [operations, selectedTerminal, workspaceFilter, workspaceSearchTerm]);

    const handleViewDetails = (op: Operation) => {
        setSelectedOp(op);
        setIsModalOpen(true);
    };

    const getIcon = (op: Operation) => {
        if (op.status === 'cancelled') return 'fa-ban';
        switch (op.modality) {
            case 'vessel': return 'fa-ship';
            case 'truck': return 'fa-truck';
            case 'rail': return 'fa-train';
            default: return 'fa-question-circle';
        }
    };

    return (
        <>
            <CompletedOpDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                operation={selectedOp}
            />
            <div>
                <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6 border-b border-border-primary">
                    <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-4">
                        <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setWorkspaceSearchTerm} />
                        <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} />
                    </div>
                </div>

                <div className="p-3 sm:p-6">
                    <div className="space-y-3">
                        {filteredOps.length > 0 ? filteredOps.map(op => {
                            const isCancelled = op.status === 'cancelled';
                            const eventTime = isCancelled ? op.cancellationDetails?.time : op.completedTime;
                            const eventLabel = isCancelled ? 'Cancelled' : 'Completed';
                            const { totalValue } = isCommercials ? calculateOperationValue(op, settings) : { totalValue: 0 };
                            const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
                            
                            return (
                                <div 
                                    key={op.id} 
                                    className={`card p-3 cursor-pointer ${isCancelled ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}
                                    onClick={() => handleViewDetails(op)}
                                >
                                    <div className="grid grid-cols-[auto,1.5fr,2fr,1fr] gap-x-4 items-center">
                                        {/* Col 1: Icon + Transport ID */}
                                        <div className="flex items-center space-x-4 min-w-0">
                                            <i className={`fas ${getIcon(op)} ${isCancelled ? 'text-red-500' : 'text-text-secondary'} text-xl w-6 text-center`}></i>
                                            <p className="font-bold text-base text-text-primary truncate">{op.transportId}</p>
                                        </div>

                                        {/* Col 2: Product/Customer Info */}
                                        <div className="min-w-0">
                                            {firstTransfer && (
                                                <>
                                                    <p className="text-sm font-medium truncate" title={firstTransfer.product}>{firstTransfer.product}</p>
                                                    <p className="text-xs text-text-tertiary truncate" title={firstTransfer.customer}>{firstTransfer.customer}</p>
                                                </>
                                            )}
                                        </div>

                                        {/* Col 3: Status Info */}
                                        <div className="min-w-0">
                                            <p className={`text-sm ${isCancelled ? 'text-red-600' : 'text-text-tertiary'}`}>
                                                {eventLabel}: {eventTime ? new Date(eventTime).toLocaleString() : 'N/A'}
                                            </p>
                                            {isCancelled && (
                                                <p className="text-xs text-red-700 font-semibold truncate" title={op.cancellationDetails?.reason}>
                                                    Reason: {op.cancellationDetails?.reason}
                                                </p>
                                            )}
                                        </div>

                                        {/* Col 4: Financials */}
                                        <div className="flex justify-end">
                                            {isCommercials && (
                                                <div className="text-xs font-bold text-green-800 bg-green-100 px-2 py-1 rounded-full whitespace-nowrap">
                                                    {formatCurrency(totalValue)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        }) : (
                            <div className="card text-center py-8 text-text-secondary">
                                <p>No completed or cancelled operations match the current filter.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default CompletedOps;