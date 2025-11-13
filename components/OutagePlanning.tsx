import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Hold, OutageStatus } from '../types';
import HoldModal from './HoldModal';
import InputModal from './InputModal';
import { formatDateTime, formatInfraName, naturalSort } from '../utils/helpers';
import TerminalMap from './TerminalMap';

const OutagePlanning: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading...</div>;

    const { holds, saveHoldAndRequeueConflicts, cancelHold, selectedTerminal, currentTerminalSettings, currentUser, approveOutage, rejectOutage } = context;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHold, setEditingHold] = useState<Partial<Hold>>({});
    const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);

    const allInfrastructure = useMemo(() => {
        const infraMap = currentTerminalSettings.infrastructureModalityMapping || {};
        return Object.keys(infraMap).sort(naturalSort);
    }, [currentTerminalSettings]);

    const sortedHolds = useMemo(() => {
        return [...holds].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }, [holds]);

    const openModal = (item?: Hold | string) => {
        if (typeof item === 'string') {
            setEditingHold({ resource: item, terminal: selectedTerminal });
        } else {
            setEditingHold(item || { terminal: selectedTerminal });
        }
        setIsModalOpen(true);
    };

    const handleConfirmCancel = (reason: string) => {
        if (cancellingHoldId) {
            cancelHold(cancellingHoldId, reason);
            setCancellingHoldId(null);
        }
    };

    const getStatusIndicator = (status: OutageStatus) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
            case 'approved':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Approved</span>;
            case 'rejected':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>;
            case 'cancelled':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">Cancelled</span>;
            default:
                return null;
        }
    };
    
    const isMaintenanceUser = currentUser.role === 'Maintenance Planner';
    const buttonText = isMaintenanceUser ? "Request New Outage" : "Schedule New Outage";

    return (
        <>
            <HoldModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={saveHoldAndRequeueConflicts}
                initialData={editingHold}
            />
            <InputModal
                isOpen={!!cancellingHoldId}
                onClose={() => setCancellingHoldId(null)}
                onSave={handleConfirmCancel}
                title="Cancel Hold"
                label="Reason for Cancellation (Required)"
                initialValue="Entered in error"
            />
            <div>
                 <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6 border-b border-border-primary flex justify-end items-center">
                    <button onClick={() => openModal()} className="btn-primary">
                        <i className="fas fa-plus-circle mr-2"></i>{buttonText}
                    </button>
                </div>

                <div className="p-3 sm:p-6 space-y-6">
                     <TerminalMap
                        infrastructure={allInfrastructure}
                        holds={holds}
                        onAssetClick={openModal}
                    />
                    <div className="card p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left bg-slate-50">
                                    <tr>
                                        <th className="p-3 font-semibold">Target</th>
                                        <th className="p-3 font-semibold">Reason</th>
                                        <th className="p-3 font-semibold">Approval</th>
                                        <th className="p-3 font-semibold">WO Status</th>
                                        <th className="p-3 font-semibold">Start Time</th>
                                        <th className="p-3 font-semibold">End Time</th>
                                        <th className="p-3 font-semibold">Requester</th>
                                        <th className="p-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedHolds.length > 0 ? sortedHolds.map(hold => {
                                        const canCancel = (currentUser.role === 'Operations Lead' || currentUser.name === hold.user) && hold.status !== 'rejected' && hold.status !== 'cancelled';
                                        return (
                                        <tr key={hold.id} className="border-b hover:bg-slate-50">
                                            <td className="p-3 font-medium">
                                                {formatInfraName(hold.resource)}
                                                {hold.tank && <span className="text-xs text-slate-500 block">Lineup: {hold.tank}</span>}
                                            </td>
                                            <td className="p-3">
                                                {hold.reason}
                                                {hold.status === 'cancelled' && hold.cancellationDetails && (
                                                    <span className="text-xs text-slate-500 block italic" title={hold.cancellationDetails.reason}>
                                                        Cancelled: {hold.cancellationDetails.reason}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">{getStatusIndicator(hold.status)}</td>
                                            <td className="p-3 font-medium text-xs">{hold.workOrderStatus || 'N/A'}</td>
                                            <td className="p-3">{formatDateTime(hold.startTime)}</td>
                                            <td className="p-3">{formatDateTime(hold.endTime)}</td>
                                            <td className="p-3 text-text-secondary">{hold.user}</td>
                                            <td className="p-3 text-right space-x-1">
                                                {currentUser.role === 'Operations Lead' && hold.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => approveOutage(hold.id!)} className="btn-primary !py-1 !px-2 !bg-green-600" title="Approve"><i className="fas fa-check"></i></button>
                                                        <button onClick={() => rejectOutage(hold.id!)} className="btn-danger !py-1 !px-2" title="Reject"><i className="fas fa-times"></i></button>
                                                    </>
                                                )}
                                                <button onClick={() => openModal(hold)} className="btn-icon" title="Edit Outage">
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>
                                                {canCancel && (
                                                    <button onClick={() => setCancellingHoldId(hold.id!)} className="btn-icon danger" title="Cancel Outage">
                                                        <i className="fas fa-ban text-xs"></i>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )}) : (
                                        <tr>
                                            <td colSpan={8} className="text-center p-8 text-text-secondary">
                                                No planned outages scheduled. Use the button above or click an asset on the map to create one.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default OutagePlanning;