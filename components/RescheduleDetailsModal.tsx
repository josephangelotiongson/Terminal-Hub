

import React, { useState, useEffect, useContext, useMemo } from 'react';
import Modal from './Modal';
import { Operation, Hold } from '../types';
import { AppContext } from '../context/AppContext';
import DateTimePicker from './DateTimePicker'; // Import the new component
import { formatInfraName, canEditPlan, getOperationDurationHours, validateOperationPlan } from '../utils/helpers';
import { MOCK_CURRENT_TIME } from '../constants';

interface RescheduleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    operation: Operation;
    viewDate: Date;
}

interface SuggestedSlot {
    time: Date;
    resource: string;
}

const RescheduleDetailsModal: React.FC<RescheduleDetailsModalProps> = ({ isOpen, onClose, operation, viewDate }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { operations, holds, currentTerminalSettings, setOperations, addActivityLog, rescheduleModalData, currentUser, simulatedTime, startPlacementMode, settings } = context;

    const [customDetails, setCustomDetails] = useState<any>({});
    const [newTime, setNewTime] = useState('');
    const [newResource, setNewResource] = useState('');
    const [suggestions, setSuggestions] = useState<SuggestedSlot[]>([]);
    const canSave = canEditPlan(currentUser);

    const validTruckInfra = useMemo(() => Object.keys(currentTerminalSettings.infrastructureModalityMapping || {})
        .filter(key => currentTerminalSettings.infrastructureModalityMapping[key] === 'truck'), [currentTerminalSettings]);

    const { reason, details } = useMemo(() => {
        if (!isOpen) return { reason: '', details: {} };
    
        // Priority 1: From dashboard delay button
        if (rescheduleModalData.source === 'dashboard-delay') {
            return { reason: 'From Delay', details: { ...operation.delay } };
        }
    
        // Priority 2: From explicit requeue (e.g., rejection, overdue)
        if (operation.requeueDetails) {
            return { reason: operation.requeueDetails.reason, details: operation.requeueDetails.details || {} };
        }
    
        // Priority 3: Implicit requeue from validation issues (e.g., hold conflict)
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        const validation = validateOperationPlan(operation, currentTerminalSettings, settings, activeHolds);
        const conflictIssue = validation.issues.find(issue => issue.toLowerCase().includes('conflict') && issue.toLowerCase().includes('hold'));
    
        if (conflictIssue) {
            // Find the conflicting hold to get structured data
            const opStart = new Date(operation.eta).getTime();
            const opEnd = opStart + getOperationDurationHours(operation) * 3600 * 1000;
            const conflictingHold = activeHolds.find(hold => {
                const holdStart = new Date(hold.startTime).getTime();
                const holdEnd = new Date(hold.endTime).getTime();
                if (!(opStart < holdEnd && opEnd > holdStart)) return false; // No time overlap
                
                return operation.transferPlan.some(tp => {
                    if (tp.infrastructureId !== hold.resource) return false;
                    if (hold.tank) {
                        return tp.transfers.some(t => t.from === hold.tank || t.to === hold.tank);
                    }
                    return true;
                });
            });
    
            return {
                reason: 'Hold Conflict',
                details: {
                    holdReason: conflictingHold?.reason || 'Unknown',
                    resource: conflictingHold?.resource || 'Unknown',
                }
            };
        }
    
        // Fallback for other validation issues
        if (validation.issues.length > 0) {
            return { reason: 'Plan Invalid', details: { issue: validation.issues[0] } };
        }
    
        // Fallback for status-based reasons if requeueDetails is missing
        if (operation.currentStatus === 'No Show') return { reason: 'No Show', details: {} };
        if (operation.currentStatus === 'Reschedule Required') return { reason: 'Overdue', details: {} };
    
        return { reason: 'Unknown Reason', details: {} };
    
    }, [isOpen, operation, holds, currentTerminalSettings, settings, rescheduleModalData.source]);

    useEffect(() => {
        if (isOpen) {
            setCustomDetails(details);
            setNewTime('');
            setNewResource('');
        }
    }, [isOpen, details]);

    useEffect(() => {
        if (isOpen) {
            const opDurationHours = getOperationDurationHours(operation);
            const opDurationMs = opDurationHours * 3600 * 1000;

            const scheduledItems = [...operations, ...holds].flatMap(item => {
                if ('resource' in item) { // It's a Hold
                    if (item.status === 'approved' || item.status === 'pending') {
                        return [{ resource: item.resource, start: new Date(item.startTime).getTime(), end: new Date(item.endTime).getTime() }];
                    }
                } else { // It's an Operation
                    if (item.id !== operation.id && ((item.status === 'planned' && item.currentStatus !== 'Reschedule Required') || item.status === 'active')) {
                        const start = new Date(item.eta).getTime();
                        const duration = getOperationDurationHours(item) * 3600 * 1000;
                        return item.transferPlan.map(tp => ({ resource: tp.infrastructureId, start, end: start + duration }));
                    }
                }
                return [];
            }).filter(Boolean);

            const transfer = operation.transferPlan[0]?.transfers[0];
            let compatibleInfra = validTruckInfra;
            if (transfer) {
                const requiredTank = transfer.direction === 'Tank to Truck' ? transfer.from : transfer.to;
                if (requiredTank && currentTerminalSettings.masterTanks?.[requiredTank]) {
                    compatibleInfra = validTruckInfra.filter(bay => 
                        (currentTerminalSettings.infrastructureTankMapping?.[bay] || []).includes(requiredTank)
                    );
                }
            }
            
            const foundSlots: SuggestedSlot[] = [];
            let searchStartMs = Math.max(simulatedTime.getTime(), new Date(viewDate).setHours(0,0,0,0));
            const remainder = searchStartMs % (15 * 60 * 1000);
            if (remainder !== 0) searchStartMs += (15 * 60 * 1000) - remainder;

            const searchEndMs = searchStartMs + 3 * 24 * 60 * 60 * 1000;

            for (let time = searchStartMs; time < searchEndMs && foundSlots.length < 3; time += 15 * 60 * 1000) {
                const slotEnd = time + opDurationMs;
                for (const infra of compatibleInfra) {
                    const conflict = scheduledItems.some(item => 
                        item.resource === infra && Math.max(item.start, time) < Math.min(item.end, slotEnd)
                    );
                    if (!conflict) {
                        foundSlots.push({ time: new Date(time), resource: infra });
                        if (foundSlots.length >= 3) break;
                    }
                }
            }
            setSuggestions(foundSlots);
        }
    }, [isOpen, operation, operations, holds, viewDate, currentTerminalSettings, simulatedTime, validTruckInfra, settings]);

    const handleSave = () => {
        if (!newTime || !newResource) {
            alert('Please select a new time and resource to reschedule.');
            return;
        }

        const finalTime = new Date(newTime);
        
        if (finalTime.getTime() < simulatedTime.getTime()) {
            alert('Cannot reschedule to a time in the past. Please select a future time.');
            return;
        }
        
        setOperations(prevOps => prevOps.map(op => {
            if (op.id === operation.id) {
                const updatedOp = JSON.parse(JSON.stringify(op)) as Operation;

                addActivityLog(operation.id, 'UPDATE', `Rescheduled to ${finalTime.toLocaleString()} at ${formatInfraName(newResource)}.`);

                updatedOp.eta = finalTime.toISOString();
                updatedOp.queuePriority = finalTime.getTime();
                updatedOp.currentStatus = 'Scheduled';
                updatedOp.truckStatus = 'Planned';
                updatedOp.transferPlan = updatedOp.transferPlan.map((tp: any) => ({ ...tp, infrastructureId: newResource }));
                
                // Clear flags that indicate a need for rescheduling
                updatedOp.delay = { active: false };
                updatedOp.requeueDetails = undefined;
                
                return updatedOp;
            }
            return op;
        }));
        
        onClose();
    };

    const handleDetailsChange = (field: string, value: string) => {
        setCustomDetails((prev: any) => ({ ...prev, [field]: value }));
    };
    
    const handleSuggestionClick = (slot: SuggestedSlot) => {
        setNewTime(slot.time.toISOString());
        setNewResource(slot.resource);
    };

    const handleSelectOnBoard = () => {
        startPlacementMode(operation.id);
        onClose();
    };

    const renderReasonFields = () => {
        switch (reason) {
            case 'Underloaded':
            case 'Overloaded':
                return (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label>Actual Loaded (T)</label>
                            <input type="number" value={customDetails.actual || ''} onChange={e => handleDetailsChange('actual', e.target.value)} />
                        </div>
                        <div>
                            <label>Expected Loaded (T)</label>
                            <input type="number" value={customDetails.expected || ''} onChange={e => handleDetailsChange('expected', e.target.value)} />
                        </div>
                    </div>
                );
            case 'Driver Delayed':
                return (
                    <div>
                        <label>New Driver ETA</label>
                        <DateTimePicker 
                            value={customDetails.eta || ''} 
                            onChange={(isoString) => handleDetailsChange('eta', isoString)} 
                        />
                    </div>
                );
            case 'Hold Conflict':
                 return (
                    <p className="text-sm mb-2 text-text-secondary">
                        This truck conflicts with a hold for 
                        <strong className="text-text-primary"> "{details.holdReason}"</strong> on <strong className="text-text-primary">{formatInfraName(details.resource)}</strong>.
                    </p>
                );
            case 'Plan Invalid':
                return (
                    <p className="text-sm mb-2 text-text-secondary">
                        Plan is invalid: <strong className="text-text-primary">{details.issue}</strong>
                    </p>
                );
            case 'From Delay':
                return (
                    <p className="text-sm mb-2 text-text-secondary">
                        This truck was delayed due to: 
                        <strong className="text-text-primary"> {operation.delay?.reason || 'Unknown'}</strong>.
                    </p>
                );
            default:
                return null;
        }
    };

    if (!isOpen) return null;
    
    const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Reschedule: ${operation.transportId}`}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary" disabled={!canSave} title={!canSave ? "Permission Denied" : ""}>Save Reschedule</button>
                </>
            }
        >
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-lg text-red-600">Reason: <span className="font-bold">{reason}</span></h4>
                    {operation.requeueDetails && <p className="text-sm text-text-tertiary">Logged by {operation.requeueDetails.user} at {new Date(operation.requeueDetails.time).toLocaleTimeString()}</p>}
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                    <h5 className="font-semibold mb-2">Details</h5>
                    {renderReasonFields()}
                    {details.notes && (
                        <div className="mt-4">
                            <label>Notes</label>
                            <p className="text-sm p-2 bg-white border rounded-md whitespace-pre-wrap">{details.notes}</p>
                        </div>
                    )}
                    {details.photo && (
                        <div className="mt-4">
                            <label>Attached Photo</label>
                            <a href={details.photo} target="_blank" rel="noopener noreferrer">
                                <img src={details.photo} alt="Rejection evidence" className="mt-1 rounded-lg border max-w-full h-auto max-h-48 cursor-pointer" />
                            </a>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                    <h5 className="font-semibold mb-2">Suggested Next Available Slots</h5>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                            {suggestions.length > 0 ? suggestions.map((slot, idx) => {
                                const isToday = isSameDay(slot.time, simulatedTime);
                                return (
                                    <button key={`${slot.resource}-${slot.time.toISOString()}-${idx}`} className="btn-suggestion text-left" onClick={() => handleSuggestionClick(slot)}>
                                        <div className="font-bold text-brand-dark">{formatInfraName(slot.resource)}</div>
                                        <div className="text-xs">
                                            {!isToday && <span className="mr-1">{slot.time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                                            {slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </button>
                                );
                            }) : <p className="text-sm text-text-secondary italic">No compatible slots found within the next 3 days.</p>}
                        </div>
                        <button className="btn-secondary w-full mt-2" onClick={handleSelectOnBoard}>
                            <i className="fas fa-th mr-2"></i>Select Slot on Board
                        </button>
                    </div>
                </div>

                <div>
                    <h5 className="font-semibold mb-2">Or Reschedule Manually</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label>New Scheduled Time</label>
                            <DateTimePicker value={newTime} onChange={setNewTime} />
                        </div>
                        <div>
                            <label>New Resource</label>
                            <select value={newResource} onChange={e => setNewResource(e.target.value)}>
                                <option value="">Select Bay...</option>
                                {validTruckInfra.map(infra => <option key={infra} value={infra}>{formatInfraName(infra)}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

            </div>
        </Modal>
    );
};

export default RescheduleDetailsModal;