
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, SOFItem } from '../types';
import { canApproveGate, getIcon } from '../utils/helpers';

const getArrivalStatus = (eta: string, now: Date): { label: string; colorClass: string; textColor: string; } => {
    const etaTime = new Date(eta).getTime();
    const nowTime = now.getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    const oneHour = 60 * 60 * 1000;

    if (etaTime < nowTime - fifteenMinutes) {
        return { label: 'Overdue', colorClass: 'bg-red-100', textColor: 'text-red-800' };
    }
    if (etaTime >= nowTime - fifteenMinutes && etaTime < nowTime + oneHour) {
        return { label: 'Due for Arrival', colorClass: 'bg-blue-100', textColor: 'text-blue-800' };
    }
    if (etaTime > nowTime + (4 * oneHour)) {
        return { label: 'Early', colorClass: 'bg-green-100', textColor: 'text-green-800' };
    }
    return { label: 'Upcoming', colorClass: 'bg-slate-100', textColor: 'text-slate-800' };
};

const UpcomingOpRow: React.FC<{ op: Operation; onMarkArrived: (opId: string) => void }> = ({ op, onMarkArrived }) => {
    const { simulatedTime, currentUser, switchView } = useContext(AppContext)!;

    const canMarkArrived = canApproveGate(currentUser);
    const firstTransfer = op.transferPlan?.flatMap(tp => tp.transfers)[0];
    const arrivalStatus = getArrivalStatus(op.eta, simulatedTime);

    const borderColors: { [key: string]: string } = {
        'Overdue': 'border-red-400',
        'Due for Arrival': 'border-blue-400',
        'Early': 'border-green-400',
        'Upcoming': 'border-slate-300',
    };

    return (
        <div className={`card !p-0 flex items-center border-l-4 ${borderColors[arrivalStatus.label]}`}>
            <div 
                className="flex-grow p-3 cursor-pointer hover:bg-slate-50"
                onClick={() => switchView('operation-plan', op.id)}
            >
                <div className="grid grid-cols-[auto,1fr,1fr,1.5fr,1fr] items-center gap-4">
                    <i className={`fas ${getIcon(op.modality)} text-2xl text-text-secondary w-8 text-center`} title={op.modality}></i>
                    <div className="min-w-0">
                        <p className="font-bold text-lg text-brand-dark truncate" title={op.transportId}>
                            {op.transportId}
                        </p>
                        {op.modality === 'truck' && op.licensePlate && 
                            <p className="font-mono text-sm text-text-secondary truncate">{op.licensePlate}</p>
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{firstTransfer?.customer}</p>
                        <p className="text-xs text-text-tertiary truncate">{firstTransfer?.product}</p>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm">Scheduled: {new Date(op.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${arrivalStatus.colorClass} ${arrivalStatus.textColor}`}>
                            {arrivalStatus.label}
                        </span>
                    </div>
                    <div className="text-right">
                        {op.modality === 'truck' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onMarkArrived(op.id); }}
                                className="btn-primary !py-2 !px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!canMarkArrived}
                                title={canMarkArrived ? "Mark truck as arrived" : "Permission Denied"}
                            >
                                Mark Arrived
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ArrivedOpRow: React.FC<{ op: Operation, arrivalTime: string | undefined }> = ({ op, arrivalTime }) => {
    const { currentUser, switchView } = useContext(AppContext)!;
    
    const canApprove = canApproveGate(currentUser);
    const firstTransfer = op.transferPlan?.flatMap(tp => tp.transfers)[0];

    return (
        <div className="card !p-0 flex items-center border-l-4 border-blue-500">
            <div 
                className="flex-grow p-3 cursor-pointer hover:bg-slate-50"
                onClick={() => switchView('operation-details', op.id)}
            >
                <div className="grid grid-cols-[auto,1fr,1fr,1.5fr,1fr] items-center gap-4">
                    <i className={`fas ${getIcon(op.modality)} text-2xl text-text-secondary w-8 text-center`} title={op.modality}></i>
                    <div className="min-w-0">
                        <p className="font-bold text-lg text-brand-dark truncate" title={op.transportId}>
                            {op.transportId}
                        </p>
                        {op.modality === 'truck' && op.licensePlate && 
                            <p className="font-mono text-sm text-text-secondary truncate">{op.licensePlate}</p>
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{firstTransfer?.customer}</p>
                        <p className="text-xs text-text-tertiary truncate">{firstTransfer?.product}</p>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-sm">Arrived: {arrivalTime ? new Date(arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
                        <p className="text-xs text-text-tertiary">Scheduled: {new Date(op.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right">
                        {op.modality === 'truck' && (
                            <button
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    switchView('operation-details', op.id); 
                                }}
                                className="btn-secondary !py-2 !px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!canApprove}
                                title={canApprove ? "Verify arrival checklist" : "Permission Denied"}
                            >
                                Verify Checklist
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const UpcomingSection: React.FC<{ title: string; ops: Operation[]; onMarkArrived: (opId: string) => void; }> = ({ title, ops, onMarkArrived }) => {
    if (ops.length === 0) {
        return null;
    }
    return (
        <div>
            <h3 className="font-bold text-lg text-text-secondary px-1 mb-2">{title} ({ops.length})</h3>
            <div className="space-y-3">
                {ops.map(op => <UpcomingOpRow key={op.id} op={op} onMarkArrived={onMarkArrived} />)}
            </div>
        </div>
    );
};

const ArrivedOpsSection: React.FC<{ title: string; ops: {op: Operation, arrivalTime: string | undefined}[]; }> = ({ title, ops }) => {
    if (ops.length === 0) {
        return null;
    }
    return (
        <div>
            <h3 className="font-bold text-lg text-text-secondary px-1 mb-2">{title} ({ops.length})</h3>
            <div className="space-y-3">
                {ops.map(({op, arrivalTime}) => <ArrivedOpRow key={op.id} op={op} arrivalTime={arrivalTime} />)}
            </div>
        </div>
    );
};

const getArrivalTime = (op: Operation): string | undefined => {
    let arrivalEventName: string;
    let sof: SOFItem[] | undefined;

    switch (op.modality) {
        case 'truck':
            arrivalEventName = 'Arrived';
            sof = op.transferPlan?.[0]?.transfers?.[0]?.sof;
            break;
        case 'vessel':
            arrivalEventName = 'VESSEL ALONGSIDE';
            sof = op.sof;
            break;
        case 'rail':
            arrivalEventName = 'Arrived at Terminal';
            sof = op.transferPlan?.[0]?.transfers?.[0]?.sof;
            break;
        default:
            return undefined;
    }
    
    if (!sof) return undefined;

    const arrivalSof = sof.find(s => s.event.includes(arrivalEventName) && s.status === 'complete');
    return arrivalSof?.time;
};

const ArrivalsModule: React.FC<{ operations: Operation[] }> = ({ operations }) => {
    const { simulatedTime, markTruckArrived, workspaceSearchTerm } = useContext(AppContext)!;

    const { arrived, overdue, arrivingNow, upcoming } = useMemo(() => {
        const arrivedOps: Operation[] = [];
        const upcomingOps: Operation[] = [];

        const ARRIVED_STATUSES = {
            truck: ['Registered'],
            vessel: ['Alongside', 'Preparations', 'Surveying'],
            rail: ['Arrived', 'On Siding']
        };

        operations.forEach(op => {
            // Basic filtering
            if (!['planned', 'active'].includes(op.status)) return;
            if (['Reschedule Required', 'No Show'].includes(op.currentStatus)) return;
            
            // Search term filtering
            if (workspaceSearchTerm) {
                const term = workspaceSearchTerm.toLowerCase();
                const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
                const matches = (
                    op.transportId?.toLowerCase().includes(term) ||
                    op.licensePlate?.toLowerCase().includes(term) ||
                    firstTransfer?.product?.toLowerCase().includes(term) ||
                    firstTransfer?.customer?.toLowerCase().includes(term)
                );
                if (!matches) return;
            }

            // Grouping
            const arrivedStatusesForModality = ARRIVED_STATUSES[op.modality] || [];
            if (op.status === 'active' && (arrivedStatusesForModality.includes(op.currentStatus) || (op.modality === 'truck' && arrivedStatusesForModality.includes(op.truckStatus || '')))) {
                arrivedOps.push(op);
            } else if (op.status === 'planned') {
                upcomingOps.push(op);
            }
        });

        const now = simulatedTime.getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        const oneHour = 60 * 60 * 1000;
        
        const overdueTrucks: Operation[] = [];
        const arrivingNowTrucks: Operation[] = [];
        const upcomingTrucks: Operation[] = [];

        upcomingOps.forEach(op => {
            const etaTime = new Date(op.eta).getTime();
            if (etaTime < now - fifteenMinutes) {
                overdueTrucks.push(op);
            } else if (etaTime < now + oneHour) {
                arrivingNowTrucks.push(op);
            } else {
                upcomingTrucks.push(op);
            }
        });
        
        const sortByEta = (a: Operation, b: Operation) => new Date(a.eta).getTime() - new Date(b.eta).getTime();
        overdueTrucks.sort(sortByEta);
        arrivingNowTrucks.sort(sortByEta);
        upcomingTrucks.sort(sortByEta);

        const arrivedWithTime = arrivedOps.map(op => ({ op, arrivalTime: getArrivalTime(op) }));
        arrivedWithTime.sort((a, b) => {
            if (a.arrivalTime && b.arrivalTime) return new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime();
            return 0;
        });

        return { arrived: arrivedWithTime, overdue: overdueTrucks, arrivingNow: arrivingNowTrucks, upcoming: upcomingTrucks };
    }, [operations, simulatedTime, workspaceSearchTerm]);

    return (
        <div className="p-4 sm:p-6 space-y-8">
            <ArrivedOpsSection title="Arrived - Awaiting Further Action" ops={arrived} />
            <UpcomingSection title="Overdue Arrivals" ops={overdue} onMarkArrived={markTruckArrived} />
            <UpcomingSection title="Arriving Now" ops={arrivingNow} onMarkArrived={markTruckArrived} />
            <UpcomingSection title="Upcoming Today" ops={upcoming} onMarkArrived={markTruckArrived} />

            {arrived.length === 0 && overdue.length === 0 && arrivingNow.length === 0 && upcoming.length === 0 && (
                 <div className="card text-center py-12 text-text-secondary">
                    <p>No planned or recently arrived operations match the current filter.</p>
                </div>
            )}
        </div>
    );
};

export default ArrivalsModule;
