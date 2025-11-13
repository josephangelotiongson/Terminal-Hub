import React, { useContext, useMemo } from 'react';
import Modal from './Modal';
import { AppContext } from '../context/AppContext';
import { formatDateTime, formatInfraName } from '../utils/helpers';
import { Operation, Hold } from '../types';

interface TankDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    tankId: string | null;
}

const TankDetailsModal: React.FC<TankDetailsModalProps> = ({ isOpen, onClose, tankId }) => {
    const context = useContext(AppContext);
    if (!context || !tankId) return null;

    const { operations, holds, currentTerminalSettings } = context;
    const tankData = currentTerminalSettings.masterTanks?.[tankId];

    const { connectedInfra, customerMappings, relatedOps, outageHistory } = useMemo(() => {
        if (!tankId) return { connectedInfra: [], customerMappings: [], relatedOps: [], outageHistory: [] };

        const infra = Object.entries(currentTerminalSettings.infrastructureTankMapping || {})
            // FIX: Add Array.isArray check to ensure 'tanks' is an array before calling .includes(), resolving a TypeScript error where 'tanks' was of type 'unknown'.
            .filter(([, tanks]) => Array.isArray(tanks) && tanks.includes(tankId))
            .map(([infraId]) => infraId);

        const mappings = (currentTerminalSettings.customerMatrix || [])
            .filter(m => m.tanks.includes(tankId));

        const ops = operations
            .filter(op => op.transferPlan.some(line => line.transfers.some(t => t.from === tankId || t.to === tankId)))
            .sort((a, b) => new Date(b.eta).getTime() - new Date(a.eta).getTime())
            .slice(0, 10); // Limit to 10 for display

        const history = holds.filter(h => h.tank === tankId);

        return {
            connectedInfra: infra,
            customerMappings: mappings,
            relatedOps: ops,
            outageHistory: history
        };
    }, [tankId, currentTerminalSettings, operations, holds]);

    if (!tankData) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Details for Tank ${tankId}`}
            footer={<button onClick={onClose} className="btn-secondary">Close</button>}
        >
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 text-sm">
                {/* Basic Info */}
                <div className="card p-4 bg-slate-50">
                    <h3 className="font-bold text-lg mb-2">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <p><strong className="font-semibold text-text-secondary">Product:</strong> {tankData.product}</p>
                        <p><strong className="font-semibold text-text-secondary">Customer:</strong> {tankData.customer}</p>
                        <p><strong className="font-semibold text-text-secondary">Capacity:</strong> {tankData.capacity.toLocaleString()} T</p>
                        <p><strong className="font-semibold text-text-secondary">Current Volume:</strong> {tankData.current.toLocaleString(undefined, {maximumFractionDigits: 2})} T</p>
                    </div>
                </div>

                {/* Connected Infrastructure */}
                <div className="card p-4 bg-slate-50">
                    <h3 className="font-bold text-lg mb-2">Connected Infrastructure</h3>
                    {connectedInfra.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {connectedInfra.map(id => (
                                <span key={id} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">{formatInfraName(id)}</span>
                            ))}
                        </div>
                    ) : <p className="text-text-secondary italic">Not connected to any infrastructure.</p>}
                </div>
                
                {/* Customer Mappings */}
                <div className="card p-4 bg-slate-50">
                     <h3 className="font-bold text-lg mb-2">Customer & Product Mappings</h3>
                     {customerMappings.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                            {customerMappings.map((m, i) => (
                                <li key={i}><strong className="font-semibold">{m.customer}</strong> for <strong className="font-semibold">{m.product}</strong></li>
                            ))}
                        </ul>
                     ) : <p className="text-text-secondary italic">No specific customer mappings for this tank.</p>}
                </div>

                {/* Related Operations */}
                 <div className="card p-4 bg-slate-50">
                     <h3 className="font-bold text-lg mb-2">Recent & Upcoming Operations</h3>
                     {relatedOps.length > 0 ? (
                        <div className="space-y-2">
                            {relatedOps.map(op => (
                                <div key={op.id} className="p-2 border rounded bg-white">
                                    <p className="font-semibold">{op.transportId} <span className={`text-xs px-2 py-0.5 rounded-full ${op.status === 'completed' ? 'bg-slate-200' : op.status === 'active' ? 'bg-green-200' : 'bg-yellow-200'}`}>{op.status}</span></p>
                                    <p className="text-xs text-text-secondary">ETA: {formatDateTime(op.eta)}</p>
                                </div>
                            ))}
                        </div>
                     ) : <p className="text-text-secondary italic">No recent or upcoming operations found.</p>}
                </div>

                {/* Outage History */}
                <div className="card p-4 bg-slate-50">
                     <h3 className="font-bold text-lg mb-2">Outage & Maintenance History</h3>
                     {outageHistory.length > 0 ? (
                        <div className="space-y-2">
                            {outageHistory.map(h => (
                                <div key={h.id} className="p-2 border rounded bg-white">
                                    <p className="font-semibold">{h.reason} <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'approved' ? 'bg-green-200' : 'bg-slate-200'}`}>{h.status}</span></p>
                                    <p className="text-xs text-text-secondary">{formatDateTime(h.startTime)} to {formatDateTime(h.endTime)}</p>
                                </div>
                            ))}
                        </div>
                     ) : <p className="text-text-secondary italic">No outage history for this tank.</p>}
                </div>
            </div>
        </Modal>
    );
};

export default TankDetailsModal;
