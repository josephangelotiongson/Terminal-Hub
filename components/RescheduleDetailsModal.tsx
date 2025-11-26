
import React, { useState, useEffect, useContext, useMemo } from 'react';
import Modal from './Modal';
import { Operation, Hold } from '../types';
import { AppContext } from '../context/AppContext';
import DateTimePicker from './DateTimePicker'; // Import the new component
import { formatInfraName, canReschedule, getOperationDurationHours, validateOperationPlan } from '../utils/helpers';
import { MOCK_CURRENT_TIME } from '../constants';

interface RescheduleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    operation: Operation;
    viewDate: Date;
}

const RescheduleDetailsModal: React.FC<RescheduleDetailsModalProps> = ({ isOpen, onClose, operation, viewDate }) => {
    const context = useContext(AppContext);
    
    // Safe defaults for unconditional execution
    const operations = context?.operations || [];
    const holds = context?.holds || [];
    const currentTerminalSettings = context?.currentTerminalSettings || { infrastructureModalityMapping: {}, customerMatrix: {}, infrastructureTankMapping: {} } as any;
    const setOperations = context?.setOperations || (() => {});
    const addActivityLog = context?.addActivityLog || (() => {});
    const rescheduleModalData = context?.rescheduleModalData || { source: undefined };
    const currentUser = context?.currentUser || { role: 'Operator', name: 'Unknown' };
    const simulatedTime = context?.simulatedTime || MOCK_CURRENT_TIME;
    const startPlacementMode = context?.startPlacementMode || (() => {});
    const settings = context?.settings || {} as any;
    const switchView = context?.switchView || (() => {});

    const [customDetails, setCustomDetails] = useState<any>({});
    const [newTime, setNewTime] = useState('');
    const [newResource, setNewResource] = useState('');
    const canSave = canReschedule(currentUser);

    const validTruckInfra = useMemo(() => {
        if (!operation || operation.modality !== 'truck') {
            return [];
        }

        const transfer = operation.transferPlan?.[0]?.transfers?.[0];
        const allTruckBays = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {})
            .filter(key => currentTerminalSettings.infrastructureModalityMapping[key] === 'truck');

        if (!transfer?.customer || !transfer.product) {
            // Fallback: return all truck bays if product/customer info is missing
            return allTruckBays;
        }

        const { customer, product } = transfer;

        // 1. Find tanks allowed for this customer/product combination
        const allowedTanksForProduct = new Set(
            (currentTerminalSettings.customerMatrix || [])
                .find(m => m.customer === customer && m.product === product)?.tanks || []
        );

        if (allowedTanksForProduct.size === 0) {
            return []; // No tanks configured for this product, so no bays are valid.
        }
        
        // 2. Filter bays to only those connected to an allowed tank
        const compatibleBays = allTruckBays.filter(bayId => {
            const connectedTanks = currentTerminalSettings.infrastructureTankMapping?.[bayId] || [];
            return connectedTanks.some(tank => allowedTanksForProduct.has(tank));
        });

        return compatibleBays;

    }, [operation, currentTerminalSettings]);

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

    const handleSave = () => {
        if (!canSave) {
            alert("Permission Denied: You cannot reschedule operations.");
            return;
        }

        if (!newTime || !newResource) {
            alert('Please select a new time and resource to reschedule.');
            return;
        }

        const finalTime = new Date(newTime);
        
        if (finalTime.getTime() < simulatedTime.getTime()) {
            alert('Cannot reschedule to a time in the past. Please select a future time.');
            return;
        }
        
        const opDurationHours = getOperationDurationHours(operation);
        const opStart = finalTime.getTime();
        const opEnd = opStart + opDurationHours * 3600 * 1000;

        // Check for conflicts with other operations
        const conflictingOp = operations.find(op => {
            if (op.id === operation.id || op.status === 'cancelled') return false;
            
            const opResource = op.transferPlan?.[0]?.infrastructureId;
            if (opResource !== newResource) return false;

            const otherOpStart = new Date(op.eta).getTime();
            const otherOpEnd = otherOpStart + getOperationDurationHours(op) * 3600 * 1000;

            return opStart < otherOpEnd && opEnd > otherOpStart;
        });

        if (conflictingOp) {
            alert(`Conflict detected! The selected time slot overlaps with operation ${conflictingOp.transportId} (${conflictingOp.licensePlate}). Please choose a different time or resource.`);
            return;
        }

        // Check for conflicts with holds
        const conflictingHold = holds.find(hold => {
            if (hold.resource !== newResource || hold.status !== 'approved' || hold.workOrderStatus === 'Closed') return false;

            const holdStart = new Date(hold.startTime).getTime();
            const holdEnd = new Date(hold.endTime).getTime();

            return opStart < holdEnd && opEnd > holdStart;
        });

        if (conflictingHold) {
            alert(`Conflict detected! The selected time slot overlaps with a hold for "${conflictingHold.reason}". Please choose a different time or resource.`);
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

    const handleSelectOnBoard = () => {
        onClose();
        switchView('planning');
        startPlacementMode(operation.id);
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

    if (!context || !isOpen) return null;

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

                <div>
                    <h5 className="font-semibold mb-2">Reschedule Options</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label>New Scheduled Time</label>
                            <DateTimePicker value={newTime} onChange={setNewTime} disabled={!canSave} />
                        </div>
                        <div>
                            <label>New Resource</label>
                            <select value={newResource} onChange={e => setNewResource(e.target.value)} disabled={!canSave}>
                                <option value="">Select Bay...</option>
                                {validTruckInfra.map(infra => <option key={infra} value={infra}>{formatInfraName(infra)}</option>)}
                            </select>
                        </div>
                    </div>
                    <button className="btn-secondary w-full mt-4" onClick={handleSelectOnBoard} disabled={!canSave}>
                        <i className="fas fa-th mr-2"></i>Or, Select Slot Visually on Board
                    </button>
                </div>

            </div>
        </Modal>
    );
};

export default RescheduleDetailsModal;
