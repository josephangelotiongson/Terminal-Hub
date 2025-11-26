import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Hold, WorkOrderStatus } from '../types';
import WorkOrderDetailsModal from './WorkOrderDetailsModal';
import { formatDateTime, formatInfraName } from '../utils/helpers';

const WORKFLOW_STAGES: WorkOrderStatus[] = ['Requested', 'Acknowledged', 'In Progress', 'Pending Parts', 'Completed', 'Closed'];

const WorkOrderCard: React.FC<{
    wo: Hold;
    onStatusChange: (newStatus: WorkOrderStatus) => void;
    onViewDetails: () => void;
}> = ({ wo, onStatusChange, onViewDetails }) => {
    const context = useContext(AppContext);
    if (!context) return null;
    const { currentUser, approveWorkOrderCompletion } = context;

    const renderActions = () => {
        if (currentUser.role === 'Operations Lead' && wo.workOrderStatus === 'Completed') {
            return <button onClick={() => approveWorkOrderCompletion(wo.id!)} className="btn-primary w-full !text-xs !py-1 !bg-green-600 hover:!bg-green-700">Approve Completion</button>;
        }
        
        if (!['Maintenance Tech', 'Maintenance Planner'].includes(currentUser.role)) return null;
        
        switch (wo.workOrderStatus) {
            case 'Requested':
                return <button onClick={() => onStatusChange('Acknowledged')} className="btn-primary w-full !text-xs !py-1">Acknowledge</button>;
            case 'Acknowledged':
                return <button onClick={() => onStatusChange('In Progress')} className="btn-primary w-full !text-xs !py-1">Start Work</button>;
            case 'In Progress':
                return (
                    <div className="flex gap-1">
                        <button onClick={() => onStatusChange('Pending Parts')} className="btn-secondary w-full !text-xs !py-1">Wait for Parts</button>
                        <button onClick={() => onStatusChange('Completed')} className="btn-primary w-full !text-xs !py-1">Mark Complete</button>
                    </div>
                );
            case 'Pending Parts':
                return <button onClick={() => onStatusChange('In Progress')} className="btn-primary w-full !text-xs !py-1">Resume Work</button>;
            default:
                return null;
        }
    };

    return (
        <div className="card !p-3 bg-white space-y-2">
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-base text-brand-dark">{formatInfraName(wo.resource)}</h4>
                <button onClick={onViewDetails} className="text-xs text-blue-600 hover:underline">Details</button>
            </div>
            <p className="text-sm text-text-secondary">{wo.reason}</p>
            <p className="text-xs text-text-tertiary">Requested by {wo.user} on {formatDateTime(wo.time)}</p>
            <div className="pt-2 border-t">{renderActions()}</div>
        </div>
    );
};

const Maintenance: React.FC = () => {
    const context = useContext(AppContext);
    
    // Safe defaults
    const holds = context?.holds || [];
    const updateWorkOrderStatus = context?.updateWorkOrderStatus || (() => {});

    const [selectedWO, setSelectedWO] = useState<Hold | null>(null);
    const [mobileActiveStage, setMobileActiveStage] = useState<WorkOrderStatus>('Requested');

    const maintenanceWorkOrders = useMemo(() => {
        return holds.filter(h => h.workOrderStatus);
    }, [holds]);
    
    const columns = useMemo(() => {
        const grouped: { [key in WorkOrderStatus]?: Hold[] } = {};
        maintenanceWorkOrders.forEach(wo => {
            if (wo.workOrderStatus) {
                if (!grouped[wo.workOrderStatus]) {
                    grouped[wo.workOrderStatus] = [];
                }
                grouped[wo.workOrderStatus]!.push(wo);
            }
        });
        return grouped;
    }, [maintenanceWorkOrders]);

    if (!context) return <div>Loading...</div>;

    const handleStatusChange = (woId: string, newStatus: WorkOrderStatus) => {
        updateWorkOrderStatus(woId, newStatus);
    };

    return (
        <>
            <WorkOrderDetailsModal 
                isOpen={!!selectedWO}
                onClose={() => setSelectedWO(null)}
                workOrder={selectedWO}
            />
            <div className="flex flex-col h-full">
                <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6 border-b border-border-primary">
                    <h2 className="text-2xl font-bold text-brand-dark">Maintenance Work Orders</h2>
                </div>

                 {/* Mobile/Tablet View (Tabs) */}
                <div className="lg:hidden">
                    <div className="border-b border-border-primary overflow-x-auto">
                        <nav className="-mb-px flex space-x-4 px-4" aria-label="Tabs">
                            {WORKFLOW_STAGES.map(stage => (
                                <button
                                    key={stage}
                                    onClick={() => setMobileActiveStage(stage)}
                                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                                        mobileActiveStage === stage
                                            ? 'border-brand-primary text-brand-primary'
                                            : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                                    }`}
                                >
                                    {stage} ({columns[stage]?.length || 0})
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="p-3 sm:p-6">
                        <div className="space-y-3">
                            {(columns[mobileActiveStage] || []).map(wo => (
                                <WorkOrderCard
                                    key={wo.id}
                                    wo={wo}
                                    onStatusChange={(newStatus) => handleStatusChange(wo.id!, newStatus)}
                                    onViewDetails={() => setSelectedWO(wo)}
                                />
                            ))}
                            {(columns[mobileActiveStage]?.length || 0) === 0 && (
                                <div className="text-center py-8 text-text-secondary">
                                    No work orders in this stage.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Desktop View (Kanban) */}
                <div className="hidden lg:flex flex-grow p-3 sm:p-6 overflow-x-auto">
                    <div className="flex space-x-4 h-full min-w-max">
                        {WORKFLOW_STAGES.map(stage => (
                            <div key={stage} className="w-72 flex-shrink-0 bg-slate-100 rounded-lg p-3 flex flex-col">
                                <h3 className="font-semibold text-text-primary px-1 mb-3">{stage} ({columns[stage]?.length || 0})</h3>
                                <div className="space-y-3 overflow-y-auto flex-grow pr-1">
                                    {(columns[stage] || []).map(wo => (
                                        <WorkOrderCard 
                                            key={wo.id}
                                            wo={wo}
                                            onStatusChange={(newStatus) => handleStatusChange(wo.id!, newStatus)}
                                            onViewDetails={() => setSelectedWO(wo)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Maintenance;