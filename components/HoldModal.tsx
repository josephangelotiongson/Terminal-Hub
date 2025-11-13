import React, { useState, useEffect, useContext } from 'react';
import Modal from './Modal';
import { Hold } from '../types';
import DateTimePicker from './DateTimePicker';
import { AppContext } from '../context/AppContext';
import { formatInfraName } from '../utils/helpers';

interface HoldModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (hold: Hold) => void;
    initialData: Partial<Hold>;
}

const HOLD_REASONS = [
    // Planned Outages
    "Preventative Maintenance",
    "Corrective Maintenance",
    "Inspection",
    "Outfitting / Commissioning",
    // Ad-hoc Holds
    "Pump Failure",
    "Safety Drill",
    "Incident",
    "Operator Unavailable",
    "Other (Specify)",
];

const HoldModal: React.FC<HoldModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const context = useContext(AppContext);
    const { currentTerminalSettings, currentUser, simulatedTime } = context!;
    
    const [resource, setResource] = useState('');
    const [tank, setTank] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [reason, setReason] = useState(HOLD_REASONS[0]);
    const [customReason, setCustomReason] = useState('');
    
    const allInfrastructure = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {});
    const connectedTanks = currentTerminalSettings.infrastructureTankMapping?.[resource] || [];

    const canCreate = ['Operations Lead', 'Operator'].includes(currentUser.role);
    const canEdit = ['Operations Lead', 'Terminal Planner', 'Maintenance Planner'].includes(currentUser.role) || initialData.user === currentUser.name;
    const canSave = initialData.id ? canEdit : canCreate;


    useEffect(() => {
        if (isOpen) {
            setResource(initialData.resource || '');
            setTank(initialData.tank || '');
            setStartTime(initialData.startTime || simulatedTime.toISOString());
            setEndTime(initialData.endTime || new Date(simulatedTime.getTime() + 60 * 60 * 1000).toISOString());
            setReason(initialData.reason && HOLD_REASONS.includes(initialData.reason) ? initialData.reason : "Other (Specify)");
            setCustomReason(initialData.reason && !HOLD_REASONS.includes(initialData.reason) ? initialData.reason : "");
        }
    }, [isOpen, initialData, simulatedTime]);
    
    useEffect(() => {
        // Reset tank if the selected resource doesn't have it
        if (resource && tank && !connectedTanks.includes(tank)) {
            setTank('');
        }
    }, [resource, tank, connectedTanks]);

    const handleSave = () => {
        if (!canSave) {
            alert("Permission Denied: You cannot schedule or edit outages.");
            return;
        }
        if (!resource) {
            alert("Please select an infrastructure resource.");
            return;
        }
        if (!startTime || !endTime || new Date(startTime) >= new Date(endTime)) {
            alert("Please enter a valid start and end time.");
            return;
        }
        
        const finalReason = reason === "Other (Specify)" ? customReason : reason;
        if (!finalReason) {
            alert("Please provide a reason for the hold.");
            return;
        }

        onSave({
            ...initialData,
            resource,
            tank: tank || undefined, // Ensure empty string becomes undefined
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            reason: finalReason,
        } as Hold);
        onClose();
    };
    
    const isMaintenanceUser = currentUser.role === 'Maintenance Planner';
    let title = initialData.id ? `Edit Outage / Hold` : 'Schedule New Outage';
    if (isMaintenanceUser) {
        title = initialData.id ? 'Edit Outage Request' : 'Request New Outage';
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-md">Cancel</button>
                    <button 
                        onClick={handleSave} 
                        className="btn-primary px-4 py-2 text-sm rounded-md"
                        disabled={!canSave}
                        title={!canSave ? "Permission Denied" : ""}
                    >
                        {isMaintenanceUser ? 'Submit Request' : 'Save'}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label>Infrastructure</label>
                        {initialData.resource ? (
                            <p className="font-semibold text-lg p-2 bg-slate-100 rounded-md">{formatInfraName(initialData.resource)}</p>
                        ) : (
                            <select
                                value={resource}
                                onChange={(e) => setResource(e.target.value)}
                                className="mt-1"
                            >
                                <option value="">Select Infrastructure...</option>
                                {allInfrastructure.map(infra => <option key={infra} value={infra}>{formatInfraName(infra)}</option>)}
                            </select>
                        )}
                    </div>
                     <div>
                        <label>Tank (for lineup outage)</label>
                        <select
                            value={tank}
                            onChange={(e) => setTank(e.target.value)}
                            className="mt-1"
                            disabled={!resource || connectedTanks.length === 0}
                        >
                            <option value="">Full Infrastructure Outage</option>
                            {connectedTanks.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label>Start Time</label>
                        <DateTimePicker value={startTime} onChange={setStartTime} />
                    </div>
                    <div>
                        <label>End Time</label>
                        <DateTimePicker value={endTime} onChange={setEndTime} />
                    </div>
                </div>
                <div>
                    <label>Reason</label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="mt-1"
                    >
                        {HOLD_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                {reason === "Other (Specify)" && (
                    <div>
                        <label>Custom Reason</label>
                        <input
                            type="text"
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            className="mt-1"
                            placeholder="Specify reason..."
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default HoldModal;