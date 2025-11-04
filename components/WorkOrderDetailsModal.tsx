import React, { useContext, useState } from 'react';
import Modal from './Modal';
import { Hold, WorkOrderNote } from '../types';
import { AppContext } from '../context/AppContext';

interface WorkOrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: Hold | null;
}

const WorkOrderDetailsModal: React.FC<WorkOrderDetailsModalProps> = ({ isOpen, onClose, workOrder }) => {
    const context = useContext(AppContext);
    const [note, setNote] = useState('');

    if (!context || !workOrder) return null;
    const { updateWorkOrderStatus, currentUser } = context;

    const handleAddNote = () => {
        if (note.trim()) {
            // A bit of a workaround - we use the update status function to just add a note
            // by passing the current status.
            if (workOrder.id && workOrder.workOrderStatus) {
                updateWorkOrderStatus(workOrder.id, workOrder.workOrderStatus, note);
            }
            setNote('');
        }
    };
    
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Work Order for ${workOrder.resource}`}
            footer={<button onClick={onClose} className="btn-secondary">Close</button>}
        >
            <div className="space-y-4 text-sm">
                <div>
                    <h4 className="font-semibold">Details</h4>
                    <p><strong>Reason:</strong> {workOrder.reason}</p>
                    <p><strong>Status:</strong> {workOrder.workOrderStatus}</p>
                    <p><strong>Requested By:</strong> {workOrder.user} at {workOrder.time ? new Date(workOrder.time).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                    <h4 className="font-semibold">History & Notes</h4>
                    <div className="max-h-60 overflow-y-auto border p-2 rounded-md space-y-2 mt-1">
                        {(workOrder.workOrderNotes || []).slice().reverse().map((n: WorkOrderNote, index: number) => (
                            <div key={index} className="p-2 bg-slate-50 rounded text-xs">
                                <p className="font-semibold">{n.note}</p>
                                <p className="text-slate-500 italic">by {n.user} at {new Date(n.time).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {currentUser.role === 'Maintenance Tech' && (
                    <div>
                        <h4 className="font-semibold">Add Note</h4>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                            className="w-full"
                            placeholder="Add progress update..."
                        />
                        <button onClick={handleAddNote} className="btn-primary mt-2">Add Note</button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default WorkOrderDetailsModal;