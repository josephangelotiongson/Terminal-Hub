import React, { useMemo, useContext } from 'react';
import Modal from './Modal';
import { Operation, ActivityLogItem } from '../types';
import { formatInfraName, calculateOperationValue, formatCurrency, formatDateTime, calculateActualDuration } from '../utils/helpers';
import { AppContext } from '../context/AppContext';

interface CompletedOpDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    operation: Operation | null;
}

const FinancialSummary: React.FC<{ op: Operation }> = ({ op }) => {
    const { settings } = useContext(AppContext)!;
    const { throughputValue, servicesValue, totalValue } = calculateOperationValue(op, settings);

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

const VarianceDisplay: React.FC<{ planned: number; actual: number; unit: string; positiveIsGood?: boolean }> = ({ planned, actual, unit, positiveIsGood = false }) => {
    const diff = actual - planned;
    if (isNaN(diff)) return null;

    const isPositive = diff >= 0;
    const isNeutral = Math.abs(diff) < 0.01;

    let colorClass = 'text-slate-500';
    if (!isNeutral) {
        colorClass = (isPositive && positiveIsGood) || (!isPositive && !positiveIsGood) ? 'text-green-600' : 'text-red-600';
    }
    
    return (
        <div className={`text-right ${colorClass}`}>
            <p className="font-mono">{actual.toFixed(2)} {unit}</p>
            <p className="text-xs font-semibold">
                ({isPositive && !isNeutral ? '+' : ''}{diff.toFixed(2)} {unit})
            </p>
        </div>
    );
};

const CompletedOpDetailsModal: React.FC<CompletedOpDetailsModalProps> = ({ isOpen, onClose, operation }) => {
    const { currentUser } = useContext(AppContext)!;
    const isCommercials = currentUser.role === 'Commercials';

    const actualDuration = useMemo(() => operation ? calculateActualDuration(operation) : 0, [operation]);

    if (!isOpen || !operation) {
        return null;
    }

    const isCancelled = operation.status === 'cancelled';
    const eventTime = isCancelled ? operation.cancellationDetails?.time : operation.completedTime;
    const eventLabel = isCancelled ? 'Cancellation Time' : 'Completed Time';
    
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

                 <div className="card p-4 bg-slate-50">
                    <h3 className="font-bold text-lg mb-3">Planned vs. Actual</h3>
                    <div className="space-y-4">
                        {/* Duration */}
                        <div className="grid grid-cols-3 items-center">
                            <div className="col-span-1 font-semibold">Duration</div>
                            <div className="col-span-1 text-right font-mono">{operation.durationHours?.toFixed(2) || '0.00'} hrs</div>
                            <div className="col-span-1"><VarianceDisplay planned={operation.durationHours || 0} actual={actualDuration} unit="hrs" positiveIsGood={false} /></div>
                        </div>

                        {/* Volume per transfer */}
                        {operation.transferPlan.flatMap(line => line.transfers).map(transfer => {
                            const actualVolume = transfer.loadedWeight || transfer.transferredTonnes || 0;
                            return (
                                <div key={transfer.id} className="grid grid-cols-3 items-center border-t pt-2">
                                    <div className="col-span-1">
                                        <p className="font-semibold truncate">{transfer.product}</p>
                                        <p className="text-xs text-text-secondary truncate">{transfer.customer}</p>
                                    </div>
                                    <div className="col-span-1 text-right font-mono">{transfer.tonnes.toFixed(2)} T</div>
                                    <div className="col-span-1"><VarianceDisplay planned={transfer.tonnes} actual={actualVolume} unit="T" positiveIsGood={true} /></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {isCommercials && <FinancialSummary op={operation} />}
                
                <div>
                    <h4 className="font-semibold text-base text-text-primary mb-2">Full Activity History</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md bg-slate-50">
                        {operation.activityHistory.slice().reverse().map((log: ActivityLogItem, index: number) => (
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
