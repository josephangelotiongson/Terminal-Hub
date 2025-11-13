import React, { useMemo, useContext } from 'react';
import Modal from './Modal';
import { Operation, SOFItem } from '../types';
import { formatInfraName, calculateOperationValue, formatCurrency } from '../utils/helpers';
import { AppContext } from '../context/AppContext';

interface CompletedOpDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    operation: Operation | null;
}

const FinancialSummary: React.FC<{ op: Operation }> = ({ op }) => {
    const { settings } = useContext(AppContext)!;
    const { throughputValue, servicesValue, totalValue } = calculateOperationValue(op, settings);
    const allServices = op.transferPlan.flatMap(tp => tp.transfers.flatMap(t => t.specialServices || []));

    return (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-base text-green-800 mb-2">Financial Summary</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
                 <div>
                    <p className="text-xs font-semibold text-text-secondary">Throughput</p>
                    <p className="text-lg font-bold text-text-primary">{formatCurrency(throughputValue)}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold text-text-secondary">Services</p>
                    <p className="text-lg font-bold text-text-primary">{formatCurrency(servicesValue)}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-green-700">Total Value</p>
                    <p className="text-lg font-bold text-green-800">{formatCurrency(totalValue)}</p>
                </div>
            </div>
        </div>
    );
};

const CompletedOpDetailsModal: React.FC<CompletedOpDetailsModalProps> = ({ isOpen, onClose, operation }) => {
    const { currentUser } = useContext(AppContext)!;
    const isCommercials = currentUser.role === 'Commercials';

    if (!isOpen || !operation) {
        return null;
    }

    const isCancelled = operation.status === 'cancelled';
    const eventTime = isCancelled ? operation.cancellationDetails?.time : operation.completedTime;
    const eventLabel = isCancelled ? 'Cancellation Time' : 'Completed Time';
    
    const wasStarted = operation.transferPlan.some(tp => tp.transfers.some(t => (t.sof || []).some(s => s.status === 'complete')));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${isCancelled ? 'Cancelled' : 'Completed'}: ${operation.transportId}`}
            footer={
                <button onClick={onClose} className="btn-secondary">Close</button>
            }
        >
            <div className="space-y-6 text-sm">
                <div className={`grid grid-cols-2 gap-4 p-3 rounded-lg ${isCancelled ? 'bg-red-50' : 'bg-slate-50'}`}>
                     <div>
                        <p className="font-semibold text-text-secondary">{eventLabel}</p>
                        <p className="text-text-primary">{eventTime ? new Date(eventTime).toLocaleString() : 'N/A'}</p>
                    </div>
                    {isCancelled && operation.cancellationDetails && (
                        <div>
                            <p className="font-semibold text-text-secondary">Cancellation Reason</p>
                            <p className="font-bold text-red-700">{operation.cancellationDetails.reason} <span className="font-normal text-text-tertiary">({operation.cancellationDetails.user})</span></p>
                        </div>
                    )}
                </div>
                
                {isCommercials && <FinancialSummary op={operation} />}

                {operation.modality === 'truck' && (operation.licensePlate || operation.driverName || operation.driverPhone || operation.driverEmail) && (
                    <div>
                        <h4 className="font-semibold text-base text-text-primary mb-2">Truck & Driver Details</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border rounded-md bg-slate-50">
                            {operation.licensePlate && <div className="truncate"><p className="font-semibold text-text-secondary text-xs">License Plate</p><p className="font-mono text-sm">{operation.licensePlate}</p></div>}
                            {operation.driverName && <div className="truncate"><p className="font-semibold text-text-secondary text-xs">Driver Name</p><p className="text-sm">{operation.driverName}</p></div>}
                            {operation.driverPhone && <div className="truncate"><p className="font-semibold text-text-secondary text-xs">Driver Phone</p><p className="text-sm">{operation.driverPhone}</p></div>}
                            {operation.driverEmail && <div className="truncate"><p className="font-semibold text-text-secondary text-xs">Driver Email</p><p className="text-sm">{operation.driverEmail}</p></div>}
                        </div>
                    </div>
                )}

                <div>
                    <h4 className="font-semibold text-base text-text-primary mb-2">Transfer Plan Summary</h4>
                    <div className="space-y-4">
                        {operation.transferPlan.map((line, index) => (
                            <div key={index} className="p-3 border rounded-md bg-slate-50">
                                <p className="font-bold text-text-secondary">Infrastructure: {formatInfraName(line.infrastructureId)}</p>
                                {line.transfers.map((t, tIndex) => (
                                    <div key={tIndex} className="mt-2 pt-2 border-t">
                                        <p className="font-semibold">{t.product} ({(t.transferredTonnes || t.tonnes).toLocaleString()} T)</p>
                                        <p className="text-text-secondary">{t.customer}</p>
                                        <div className="flex items-center gap-2 mt-1 text-sm">
                                            <span className="font-mono">{t.from}</span>
                                            <i className="fas fa-long-arrow-alt-right text-text-tertiary"></i>
                                            <span className="font-mono">{t.to}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {wasStarted && operation.transferPlan.map((line, lineIndex) => (
                    <div key={line.infrastructureId}>
                        {line.transfers.map((transfer, transferIndex) => {
                            const loops: { [loopNum: number]: SOFItem[] } = {};
                            (transfer.sof || []).forEach(item => {
                                if (!loops[item.loop]) loops[item.loop] = [];
                                loops[item.loop].push(item);
                            });
                            const sofLoops = Object.entries(loops).map(([loopNum, items]) => ({ loopNum: parseInt(loopNum), items: items.sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime()) })).sort((a, b) => a.loopNum - b.loopNum);

                            return (
                                <div key={transferIndex} className="mt-4">
                                    <h4 className="font-semibold text-base text-text-primary mb-2">Statement of Facts Summary: {transfer.product}</h4>
                                    <div className="space-y-4">
                                        {sofLoops.map(({ loopNum, items }) => (
                                            <div key={loopNum} className="p-3 border rounded-md">
                                                <p className="font-bold text-text-secondary mb-2">{loopNum > 1 ? `Rework #${loopNum}` : 'Initial Attempt'}</p>
                                                <div className="activity-log max-h-40 overflow-y-auto">
                                                    {items.filter(item => item.status === 'complete').map(item => (
                                                        <div key={item.event} className="activity-log-item !text-xs">
                                                            <span className="time">{new Date(item.time).toLocaleString()}</span>
                                                            <span className="flex-1">{item.event}</span>
                                                            <span className="user">({item.user})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                 <div>
                    <h4 className="font-semibold text-base text-text-primary mb-2">Full Activity History</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md bg-slate-50">
                        {operation.activityHistory.slice().reverse().map((log, index) => (
                            <div key={index} className="text-xs p-1.5 rounded bg-white shadow-sm">
                                <div className="flex justify-between items-baseline">
                                    <div className="flex items-baseline min-w-0">
                                        <span className="font-semibold text-slate-700 truncate">
                                            {log.action.replace(/_/g, ' ')} by {log.user}
                                        </span>
                                    </div>
                                    <span className="text-slate-400 flex-shrink-0 ml-2">{new Date(log.time).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-600 whitespace-pre-wrap mt-1">{log.details}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CompletedOpDetailsModal;