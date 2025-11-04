import React, { useState, useEffect, useContext } from 'react';
import Modal from './Modal';
import { Operation, Modality, Transfer } from '../types';
import { AppContext } from '../context/AppContext';
import DateTimePicker from './DateTimePicker';

interface NewOperationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MODALITY_OPTIONS: { modality: Modality; icon: string; label: string }[] = [
    { modality: 'vessel', icon: 'fa-ship', label: 'Vessel' },
    { modality: 'truck', icon: 'fa-truck', label: 'Truck' },
    { modality: 'rail', icon: 'fa-train', label: 'Rail' },
];

const MODALITY_DIRECTIONS: Record<Modality, string[]> = {
    vessel: ['Vessel to Tank', 'Tank to Vessel', 'Tank to Tank'],
    truck: ['Tank to Truck', 'Truck to Tank'],
    rail: ['Tank to Rail', 'Rail to Tank'],
};

const NewOperationModal: React.FC<NewOperationModalProps> = ({ isOpen, onClose }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { createNewOperation, currentTerminalSettings, settings } = context;

    const [modality, setModality] = useState<Modality>('truck');
    const [transportId, setTransportId] = useState('');
    const [eta, setEta] = useState(() => new Date(new Date().getTime() + 60 * 60 * 1000).toISOString());
    const [licensePlate, setLicensePlate] = useState('');
    const [driverName, setDriverName] = useState('');
    const [transfer, setTransfer] = useState<Partial<Transfer>>({
        customer: '', product: '', tonnes: 0, direction: MODALITY_DIRECTIONS.truck[0]
    });

    useEffect(() => {
        if (isOpen) {
            setModality('truck');
            setTransportId('');
            setEta(new Date(new Date().getTime() + 60 * 60 * 1000).toISOString());
            setLicensePlate('');
            setDriverName('');
            setTransfer({ customer: '', product: '', tonnes: 0, direction: MODALITY_DIRECTIONS.truck[0] });
        }
    }, [isOpen]);

    const handleModalityChange = (newModality: Modality) => {
        setModality(newModality);
        setTransfer(t => ({ ...t, product: '', customer: '', direction: MODALITY_DIRECTIONS[newModality][0] }));
    };
    
    const handleTransferChange = (field: keyof Transfer, value: any) => {
        const newTransfer = { ...transfer, [field]: value };
        if(field === 'customer') {
            newTransfer.product = '';
        }
        setTransfer(newTransfer);
    };

    const handleCreate = () => {
        if (!transportId || !transfer.customer || !transfer.product || (transfer.tonnes || 0) <= 0) {
            alert('Please fill in Transport ID, Customer, Product, and a valid Tonnes amount.');
            return;
        }

        createNewOperation({
            modality,
            transportId,
            eta,
            licensePlate: modality === 'truck' ? licensePlate : undefined,
            driverName: modality === 'truck' ? driverName : undefined,
            transfer,
        });
        onClose();
    };

    const availableCustomers = currentTerminalSettings.masterCustomers || [];
    const availableProductsForCustomer = (() => {
        if (!transfer.customer) return [];
        const customerProducts = new Set(
            currentTerminalSettings.customerMatrix
                .filter(m => m.customer === transfer.customer)
                .map(m => m.product)
        );
        return settings.masterProducts.filter(p => customerProducts.has(p));
    })();
    const availableDirections = MODALITY_DIRECTIONS[modality] || [];
    
    const isFormValid = transportId && transfer.customer && transfer.product && (transfer.tonnes || 0) > 0;
    const modalTitle = `Create New ${modality.charAt(0).toUpperCase() + modality.slice(1)} Order`;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleCreate} disabled={!isFormValid} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                        Create Order
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div>
                    <label>Modality</label>
                    <div className="flex space-x-2 mt-1">
                        {MODALITY_OPTIONS.map(opt => {
                            const isSelected = modality === opt.modality;
                            return (
                                <button
                                    key={opt.modality}
                                    onClick={() => handleModalityChange(opt.modality)}
                                    className={`flex-1 p-3 border rounded-lg flex items-center justify-center space-x-2 transition-colors ${isSelected ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'bg-white hover:bg-slate-50'}`}
                                >
                                    <i className={`fas ${opt.icon} ${isSelected ? 'text-white' : 'text-slate-700'}`}></i>
                                    <span className={`font-semibold ${isSelected ? 'text-white' : 'text-slate-700'}`}>{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label>Transport ID</label>
                        <input type="text" value={transportId} onChange={e => setTransportId(e.target.value)} placeholder={modality === 'vessel' ? 'Vessel Name' : modality === 'truck' ? 'Trucking Company' : 'Railcar ID'} />
                    </div>
                    <div>
                        <label>ETA / Scheduled Time</label>
                        <DateTimePicker value={eta} onChange={setEta} />
                    </div>
                    {modality === 'truck' && (
                        <>
                            <div>
                                <label>License Plate</label>
                                <input type="text" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} placeholder="e.g., ABC-123"/>
                            </div>
                            <div>
                                <label>Driver Name</label>
                                <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="e.g., John Smith"/>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t mt-4">
                    <h4 className="font-semibold text-lg mb-2">Initial Transfer</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label>Customer</label>
                            <select value={transfer.customer} onChange={e => handleTransferChange('customer', e.target.value)}>
                                <option value="">Select Customer...</option>
                                {availableCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label>Product</label>
                            <select value={transfer.product} onChange={e => handleTransferChange('product', e.target.value)} disabled={!transfer.customer}>
                                <option value="">Select Product...</option>
                                {availableProductsForCustomer.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                             <label>Tonnes</label>
                             <input type="number" value={transfer.tonnes || ''} onChange={e => handleTransferChange('tonnes', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                            <label>Direction</label>
                            <select value={transfer.direction} onChange={e => handleTransferChange('direction', e.target.value)}>
                                {availableDirections.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default NewOperationModal;