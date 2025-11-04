import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality, Transfer } from '../types';
import ModalityFilter from './ModalityFilter';
import SteppedProgressBar from './SteppedProgressBar';
import { calculateOperationProgress, getActiveTransfers, calculateOperationValue, formatCurrency } from '../utils/helpers';
import WorkspaceSearch from './WorkspaceSearch';
import TruckRejectionModal from './TruckRejectionModal';

const ElapsedTime: React.FC<{ startTime: string }> = ({ startTime }) => {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        const calculateElapsed = () => {
            const start = new Date(startTime).getTime();
            const now = new Date().getTime();
            const diff = now - start;
            if (diff < 0) return '0m';
            
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            return `${minutes}m`;
        };
        setElapsed(calculateElapsed());
        const interval = setInterval(() => setElapsed(calculateElapsed()), 60000);
        return () => clearInterval(interval);
    }, [startTime]);
    
    return <span className="font-semibold text-blue-600">({elapsed})</span>;
};

const ActiveOpsList: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <p>Loading...</p>;

    const { operations, selectedTerminal, switchView, workspaceFilter, setWorkspaceFilter, workspaceSearchTerm, setWorkspaceSearchTerm, currentUser, callOffTruck, revertCallOff, settings } = context;
    const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
    const [rejectionTarget, setRejectionTarget] = useState<Operation | null>(null);
    const isCommercials = currentUser.role === 'Commercials';
    
    const activeOps = useMemo(() => {
        return operations
            .filter(op => 
                op.terminal === selectedTerminal && 
                op.status === 'active' &&
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
                const progressA = calculateOperationProgress(a).percentage;
                const progressB = calculateOperationProgress(b).percentage;
                if (progressA !== progressB) {
                    return progressA - progressB;
                }
                return (a.queuePriority || 0) - (b.queuePriority || 0);
            });
    }, [operations, selectedTerminal, workspaceFilter, workspaceSearchTerm]);

    const getLatestStatusTime = (op: Operation) => {
        if (op.activityHistory.length === 0) return op.eta;
        return op.activityHistory[op.activityHistory.length - 1].time;
    };
    
    const renderStatus = (op: Operation) => {
        const activeTransfers = getActiveTransfers(op);
        const statusTime = getLatestStatusTime(op);

        if (activeTransfers.length > 0 && (op.currentStatus.toLowerCase().includes('pumping') || op.currentStatus.toLowerCase().includes('loading'))) {
            const firstActive = activeTransfers[0];
            const additionalTransfers = activeTransfers.length > 1 ? ` (+${activeTransfers.length - 1} more)` : '';
            return (
                <p className="text-base text-text-tertiary truncate">
                    {op.currentStatus}: <span className="font-semibold text-text-secondary">{firstActive.product} ({firstActive.from} &rarr; {firstActive.to}) for {firstActive.customer}</span>{additionalTransfers} <ElapsedTime startTime={statusTime} />
                </p>
            );
        }

        return (
            <p className="text-base text-text-tertiary">
                {op.currentStatus} <ElapsedTime startTime={statusTime} />
            </p>
        );
    };

    return (
        <>
            <TruckRejectionModal
                isOpen={rejectionModalOpen}
                onClose={() => setRejectionModalOpen(false)}
                operation={rejectionTarget}
            />
            <div>
                <div className="sticky top-0 z-10 bg-background-body p-4 sm:p-6 border-b border-border-primary">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setWorkspaceSearchTerm} />
                        <div className="flex-grow" />
                        <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} />
                    </div>
                </div>
                <div className="p-3 sm:p-6">
                    <div className="space-y-6">
                        {activeOps.length > 0 ? activeOps.map(op => {
                            const { totalValue } = isCommercials ? calculateOperationValue(op, settings) : { totalValue: 0 };
                            return (
                                <div 
                                    key={op.id} 
                                    className="card p-6 transition-shadow hover:shadow-lg cursor-pointer"
                                    onClick={() => switchView('operation-details', op.id)}
                                >
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                        <div className="flex items-center space-x-6 min-w-0">
                                            <i className={`fas ${op.modality === 'vessel' ? 'fa-ship' : op.modality === 'truck' ? 'fa-truck' : 'fa-train'} text-3xl text-brand-primary w-8 text-center`}></i>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-2xl text-text-primary truncate">{op.transportId}</h4>
                                                {renderStatus(op)}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4 justify-start sm:justify-end shrink-0 self-end sm:self-center">
                                            {isCommercials && (
                                                <div className="text-sm font-bold text-green-800 bg-green-200 px-3 py-1.5 rounded-full">
                                                    {formatCurrency(totalValue)}
                                                </div>
                                            )}
                                            {currentUser.role === 'Operations Lead' && op.modality === 'truck' && op.truckStatus === 'Waiting' && <button className="btn-secondary !py-3 !px-4 text-base" onClick={(e) => { e.stopPropagation(); callOffTruck(op.id); }}>Direct to Bay</button>}
                                            {currentUser.role === 'Operations Lead' && op.modality === 'truck' && op.truckStatus === 'Directed to Bay' && <button className="btn-secondary !py-3 !px-4 text-base" onClick={(e) => { e.stopPropagation(); revertCallOff(op.id); }}>Revert Call</button>}
                                            {op.modality === 'truck' && op.truckStatus !== 'Registered' && <button title="Re-queue Truck" className="btn-secondary !py-3 !px-4 text-base" onClick={(e) => { e.stopPropagation(); setRejectionTarget(op); setRejectionModalOpen(true);}}><i className="fas fa-undo mr-1"></i>Re-queue</button>}
                                        </div>
                                    </div>
                                    <div className="mt-6">
                                        <SteppedProgressBar op={op} />
                                    </div>
                                </div>
                            );
                        }) : (
                             <div className="card text-center py-8 text-text-secondary">
                                <p>No active operations match the current filter.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ActiveOpsList;