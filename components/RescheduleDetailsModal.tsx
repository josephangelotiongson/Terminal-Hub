import React, { useState, useEffect, useContext } from 'react';
import Modal from './Modal';
import { Operation, Hold } from '../types';
import { AppContext } from '../context/AppContext';
import DateTimePicker from './DateTimePicker'; // Import the new component
import { formatInfraName } from '../utils/helpers';

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

    const { operations, holds, currentTerminalSettings, setOperations, addActivityLog, rescheduleModalData } = context;

    const [details, setDetails] = useState<any>({});
    const [newTime, setNewTime] = useState('');
    const [newResource, setNewResource] = useState('');
    const [suggestions, setSuggestions] = useState<SuggestedSlot[]>([]);

    const validTruckInfra = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {})
        .filter(key => currentTerminalSettings.infrastructureModalityMapping[key] === 'truck');

    useEffect(() => {
        if (isOpen) {
            setDetails(operation.requeueDetails?.details || {});
            setNewTime('');
            setNewResource('');

            // --- Recommendation Engine ---
            const scheduledItems: { resource: string, start: number, end: number }[] = [];
            const truckDurationMs = 1 * 60 * 60 * 1000; // 1 hour

            operations.forEach(op => {
                if (op.status === 'planned' && op.currentStatus !== 'Reschedule Required') {
                    const start = new Date(op.eta).getTime();
                    const duration = (op.modality === 'truck' ? 1 : op.modality === 'rail' ? 2 : 4) * 3600 * 1000;
                    op.transferPlan.forEach(tp => {
                        scheduledItems.push({ resource: tp.infrastructureId, start, end: start + duration });
                    });
                }
            });

            holds.forEach(hold => {
                scheduledItems.push({ resource: hold.resource, start: new Date(hold.startTime).getTime(), end: new Date(hold.endTime).getTime() });
            });
            
            const foundSlots: SuggestedSlot[] = [];
            const searchStart = new Date();
            if (viewDate.toDateString() !== searchStart.toDateString()) {
                searchStart.setHours(0,0,0,0);
            }
             searchStart.setMinutes(Math.ceil(searchStart.getMinutes()/15)*15, 0, 0);

            const searchEnd = new Date(viewDate);
            searchEnd.setHours(23, 59, 59, 999);

            for (let time = searchStart.getTime(); time < searchEnd.getTime() && foundSlots.length < 3; time += 15 * 60 * 1000) {
                for (const infra of validTruckInfra) {
                    const slotStart = time;
                    const slotEnd = slotStart + truckDurationMs;
                    
                    const conflict = scheduledItems.some(item => 
                        item.resource === infra &&
                        Math.max(item.start, slotStart) < Math.min(item.end, slotEnd)
                    );

                    if (!conflict) {
                        foundSlots.push({ time: new Date(slotStart), resource: infra });
                        if (foundSlots.length >= 3) break;
                    }
                }
                if (foundSlots.length >= 3) break;
            }
            setSuggestions(foundSlots);

        }
    }, [isOpen, operation, operations, holds, viewDate, currentTerminalSettings]);

    const handleSave = () => {
        if (!newTime || !newResource) {
            alert('Please select a new time and resource to reschedule.');
            return;
        }

        const finalTime = new Date(newTime);
        
        if (finalTime.getTime() < new Date().getTime()) {
            alert('Cannot reschedule to a time in the past. Please select a future time.');
            return;
        }
        
        setOperations(prevOps => prevOps.map(op => {
            if (op.id === operation.id) {
// FIX: Added type assertion to JSON.parse for type safety.
                const updatedOp = JSON.parse(JSON.stringify(op)) as Operation;

                if (rescheduleModalData.source === 'dashboard-delay') {
                    updatedOp.status = 'planned'; // Atomic state change
                    addActivityLog(operation.id, 'REQUEUE', `Sent to planning from active/delayed state.`);
                     updatedOp.requeueDetails = {
                        reason: 'From Delay',
                        user: context.currentUser.name,
                        time: new Date().toISOString(),
                        details: { ...details, originalReason: op.delay?.reason || 'Unknown' }
                    };
                }

                if (updatedOp.requeueDetails) {
                    updatedOp.requeueDetails.details = details;
                }
                updatedOp.eta = finalTime.toISOString();
                updatedOp.queuePriority = finalTime.getTime();
                updatedOp.currentStatus = 'Scheduled';
                updatedOp.truckStatus = 'Planned';
                updatedOp.transferPlan = updatedOp.transferPlan.map((tp: any) => ({ ...tp, infrastructureId: newResource }));
                
                addActivityLog(operation.id, 'UPDATE', `Rescheduled to ${finalTime.toLocaleString()} at ${newResource}.`);
                return updatedOp;
            }
            return op;
        }));
        
        onClose();
    };

    const handleDetailsChange = (field: string, value: string) => {
        setDetails((prev: any) => ({ ...prev, [field]: value }));
    };
    
    const handleSuggestionClick = (slot: SuggestedSlot) => {
        setNewTime(slot.time.toISOString());
        setNewResource(slot.resource);
    };

    const renderReasonFields = () => {
        const reason = rescheduleModalData.source === 'dashboard-delay' ? 'From Delay' : operation.requeueDetails?.reason;
        
        switch (reason) {
            case 'Underloaded':
            case 'Overloaded':
                return (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label>Actual Loaded (T)</label>
                            <input type="number" value={details.actual || ''} onChange={e => handleDetailsChange('actual', e.target.value)} />
                        </div>
                        <div>
                            <label>Expected Loaded (T)</label>
                            <input type="number" value={details.expected || ''} onChange={e => handleDetailsChange('expected', e.target.value)} />
                        </div>
                    </div>
                );
            case 'Driver Delayed':
                return (
                    <div>
                        <label>New Driver ETA</label>
                        <DateTimePicker 
                            value={details.eta || ''} 
                            onChange={(isoString) => handleDetailsChange('eta', isoString)} 
                        />
                    </div>
                );
            case 'Hold Conflict':
                 return (
                    <p className="text-sm mb-2 text-text-secondary">
                        This truck conflicts with a hold for 
                        <strong className="text-text-primary"> {details.holdReason}</strong> on <strong className="text-text-primary">{formatInfraName(details.resource)}</strong>.
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

    const reason = rescheduleModalData.source === 'dashboard-delay' ? 'From Delay' : operation.requeueDetails?.reason;
    if (!reason) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Reschedule: ${operation.transportId}`}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save Reschedule</button>
                </>
            }
        >
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-lg text-red-600">Reason: <span className="font-bold">{reason}</span></h4>
                    {operation.requeueDetails && <p className="text-sm text-text-tertiary">Logged by {operation.requeueDetails.user} at {new Date(operation.requeueDetails.time).toLocaleTimeString()}</p>}
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                    <h5 className="font-semibold mb-2">Rejection Details</h5>
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
                    <h5 className="font-semibold mb-2">Suggested Slots</h5>
                    <div className="flex flex-wrap gap-2">
                        {suggestions.length > 0 ? suggestions.map(slot => (
                            <button key={`${slot.resource}-${slot.time.toISOString()}`} className="btn-suggestion" onClick={() => handleSuggestionClick(slot)}>
                                {formatInfraName(slot.resource)} @ {slot.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </button>
                        )) : <p className="text-sm text-text-secondary italic">No available slots found for the rest of today.</p>}
                    </div>
                </div>

                <div>
                    <h5 className="font-semibold mb-2">Or Reschedule Manually</h5>
                    <p className="text-xs text-text-secondary mb-2 italic">Hint: You can also drag and drop the truck onto the planning grid.</p>
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