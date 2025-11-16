

import React, { useState, useEffect, useContext, useMemo } from 'react';
import Modal from './Modal';
import { Operation, Modality, Transfer, SpecialServiceData, TransferPlanItem } from '../types';
import { AppContext, CreateOperationDetails } from '../context/AppContext';
import DateTimePicker from './DateTimePicker';
import { formatInfraName } from '../utils/helpers';
import { VESSEL_COMMODITY_EVENTS } from '../constants';

const MODALITY_OPTIONS: { modality: Modality; icon: string; label: string }[] = [
    { modality: 'vessel', icon: 'fa-ship', label: 'Vessel' },
    { modality: 'truck', icon: 'fa-truck', label: 'Truck' },
    { modality: 'rail', icon: 'fa-train', label: 'Rail' },
];

const MODALITY_DIRECTIONS: Record<Modality, string[]> = {
    vessel: ['Vessel to Tank', 'Tank to Vessel'],
    truck: ['Tank to Truck', 'Truck to Tank'],
    rail: ['Tank to Rail', 'Rail to Tank'],
};

const getDefaultDuration = (mod: Modality) => {
    if (mod === 'vessel') return 12;
    if (mod === 'rail') return 2;
    return 1; // truck
};

// --- Vessel Transfer Form Component ---
interface VesselTransferFormProps {
    index: number;
    transferData: any;
    onUpdate: (index: number, field: string, value: any) => void;
    onRemove: (index: number) => void;
    onServiceChange: (index: number, serviceName: string, isChecked: boolean) => void;
}

const VesselTransferForm: React.FC<VesselTransferFormProps> = ({ index, transferData, onUpdate, onRemove, onServiceChange }) => {
    const { currentTerminalSettings, settings } = useContext(AppContext)!;

    const { availableProducts, availableInfra, availableTanks } = useMemo(() => {
        const prods = (currentTerminalSettings.customerMatrix || [])
            .filter(m => m.customer === transferData.customer)
            .map(m => m.product);

        if (!transferData.customer || !transferData.product) {
            return { availableProducts: prods, availableInfra: [], availableTanks: [] };
        }

        const allowedTanks = new Set((currentTerminalSettings.customerMatrix || [])
            .find(m => m.customer === transferData.customer && m.product === transferData.product)?.tanks || []);
        
        const infra = Object.entries(currentTerminalSettings.infrastructureTankMapping || {})
            .filter(([, tanks]) => Array.isArray(tanks) && tanks.some(t => allowedTanks.has(t)))
            .map(([infraId]) => infraId);

        const tanks = (currentTerminalSettings.infrastructureTankMapping?.[transferData.infrastructureId] || [])
            .filter(t => allowedTanks.has(t));

        return { availableProducts: prods, availableInfra: infra, availableTanks: tanks };
    }, [transferData.customer, transferData.product, transferData.infrastructureId, currentTerminalSettings]);

    const availableTransferServices = useMemo(() => {
        const modServices = settings.modalityServices?.vessel || [];
        const prodServices = settings.productServices || [];
        return [...new Set([...modServices, ...prodServices])].sort();
    }, [settings]);

    return (
        <div className="p-4 border rounded-lg bg-slate-50 relative">
            <h4 className="font-bold mb-2">Transfer #{index + 1}</h4>
             <button onClick={() => onRemove(index)} className="absolute top-2 right-2 btn-icon danger !p-1" title="Remove Transfer"><i className="fas fa-times text-xs"></i></button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label>Customer</label><select value={transferData.customer} onChange={e => onUpdate(index, 'customer', e.target.value)}><option value="">Select...</option>{(currentTerminalSettings.masterCustomers || []).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label>Product</label><select value={transferData.product} onChange={e => onUpdate(index, 'product', e.target.value)} disabled={!transferData.customer}><option value="">Select...</option>{availableProducts.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label>Tonnes</label><input type="number" value={transferData.tonnes} onChange={e => onUpdate(index, 'tonnes', parseFloat(e.target.value) || 0)} /></div>
                <div><label>Direction</label><select value={transferData.direction} onChange={e => onUpdate(index, 'direction', e.target.value)}>{MODALITY_DIRECTIONS.vessel.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label>Infrastructure</label><select value={transferData.infrastructureId} onChange={e => onUpdate(index, 'infrastructureId', e.target.value)} disabled={!transferData.product}><option value="">Select...</option>{availableInfra.map(i => <option key={i} value={i}>{formatInfraName(i)}</option>)}</select></div>
                <div><label>Tank</label><select value={transferData.tank} onChange={e => onUpdate(index, 'tank', e.target.value)} disabled={!transferData.infrastructureId}><option value="">Select...</option>{availableTanks.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div className="mt-4 pt-4 border-t">
                <h5 className="font-semibold text-text-secondary text-sm mb-2">Transfer Services</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {availableTransferServices.map(service => {
                        const isChecked = (transferData.specialServices || []).some((s: SpecialServiceData) => s.name === service);
                        return (
                            <label key={service} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                    checked={isChecked}
                                    onChange={(e) => onServiceChange(index, service, e.target.checked)}
                                />
                                <span className="text-xs font-medium text-gray-700">{service}</span>
                            </label>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};


// --- Main Modal Component ---
interface NewOperationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const NewOperationModal: React.FC<NewOperationModalProps> = ({ isOpen, onClose }) => {
    const { createNewOperation, currentTerminalSettings, settings, newOpInitialData, simulatedTime } = useContext(AppContext)!;
    
    // Common state
    const [modality, setModality] = useState<Modality>('truck');
    
    // Truck/Rail State
    const [truckRailTransportId, setTruckRailTransportId] = useState('');
    const [truckRailEta, setTruckRailEta] = useState('');
    const [truckRailDuration, setTruckRailDuration] = useState(1);
    const [licensePlate, setLicensePlate] = useState('');
    const [driverName, setDriverName] = useState('');
    const [simpleTransfer, setSimpleTransfer] = useState<Partial<Transfer>>({ specialServices: [] });
    const [infrastructureId, setInfrastructureId] = useState('');

    // Vessel State
    const [vesselTransportId, setVesselTransportId] = useState('');
    const [vesselEta, setVesselEta] = useState('');
    const [vesselDuration, setVesselDuration] = useState(12);
    const [vesselRequirements, setVesselRequirements] = useState<string[]>([]);
    const [transfers, setTransfers] = useState<any[]>([]);

    const availableTanks = useMemo(() => {
        if (!simpleTransfer.customer || !simpleTransfer.product || !infrastructureId) {
            return [];
        }
        const customerAllowedTanks = new Set(
            (currentTerminalSettings.customerMatrix || [])
                .find(m => m.customer === simpleTransfer.customer && m.product === simpleTransfer.product)?.tanks || []
        );
        const infraConnectedTanks = new Set(
            currentTerminalSettings.infrastructureTankMapping?.[infrastructureId] || []
        );
        const options = [...customerAllowedTanks].filter(tank => infraConnectedTanks.has(tank));
        return options.sort();
    }, [simpleTransfer.customer, simpleTransfer.product, infrastructureId, currentTerminalSettings]);

    useEffect(() => {
        if (isOpen) {
            const initialModality = newOpInitialData?.modality || 'truck';
            handleModalityChange(initialModality);

            const defaultTruckEta = new Date(simulatedTime.getTime() + 60 * 60 * 1000).toISOString();
            const defaultVesselEta = new Date(simulatedTime.getTime() + 4 * 60 * 60 * 1000).toISOString();

            setTruckRailEta(newOpInitialData?.eta || defaultTruckEta);
            setVesselEta(newOpInitialData?.eta || defaultVesselEta);

            setInfrastructureId(newOpInitialData?.transferPlan?.[0]?.infrastructureId || '');
        } else {
            setInfrastructureId('');
        }
    }, [isOpen, newOpInitialData, simulatedTime]);

    const handleModalityChange = (newModality: Modality) => {
        setModality(newModality);
        
        if (newModality === 'vessel') {
            setVesselDuration(12);
            setTransfers([{ customer: 'Apex Refining', product: '', tonnes: 0, direction: MODALITY_DIRECTIONS.vessel[0], infrastructureId: '', tank: '', specialServices: [] }]);
            setVesselRequirements([]);
        } else {
            setTruckRailDuration(getDefaultDuration(newModality));
            setSimpleTransfer({ customer: '', product: '', tonnes: 0, direction: MODALITY_DIRECTIONS[newModality][0], specialServices: [] });
            setInfrastructureId('');
        }
    };

    const handleCreate = () => {
        if (modality === 'vessel') {
            if (!vesselTransportId || transfers.some(t => !t.customer || !t.product || !t.tonnes || !t.infrastructureId || !t.tank)) {
                alert('Please fill out all required fields for the vessel and each transfer.');
                return;
            }
            const transferPlan = transfers.reduce((acc, t) => {
                const newTransfer: Transfer = {
                    id: `transfer-${Date.now()}-${Math.random()}`, customer: t.customer, product: t.product, tonnes: t.tonnes, direction: t.direction,
                    from: t.direction === 'Tank to Vessel' ? t.tank : vesselTransportId,
                    to: t.direction === 'Vessel to Tank' ? t.tank : vesselTransportId,
                    specialServices: t.specialServices || [], transferredTonnes: 0, slopsTransferredTonnes: 0,
                    sof: VESSEL_COMMODITY_EVENTS.map(event => ({ event, status: 'pending', time: '', user: '', loop: 1 }))
                };
                let line = acc.find(l => l.infrastructureId === t.infrastructureId);
                if (!line) {
                    line = { infrastructureId: t.infrastructureId, transfers: [] };
                    acc.push(line);
                }
                line.transfers.push(newTransfer);
                return acc;
            }, [] as TransferPlanItem[]);

            createNewOperation({
                modality, transportId: vesselTransportId, eta: vesselEta, durationHours: vesselDuration,
                transferPlan,
                specialRequirements: vesselRequirements.map(name => ({ name, data: {} }))
            });

        } else {
            if (!truckRailTransportId || !simpleTransfer.customer || !simpleTransfer.product || !simpleTransfer.tonnes || !infrastructureId) {
                alert('Please fill all required fields, including infrastructure.');
                return;
            }
            createNewOperation({
                modality, transportId: truckRailTransportId, eta: truckRailEta, durationHours: truckRailDuration,
                licensePlate, driverName, 
                transfer: {
                    ...simpleTransfer,
                    specialServices: simpleTransfer.specialServices || [], // Ensure it's passed
                },
                transferPlan: [{ infrastructureId, transfers: [] }]
            });
        }
        onClose();
    };
    
    // --- Vessel Form Handlers ---
    const handleAddTransfer = () => setTransfers(t => [...t, { customer: currentTerminalSettings.masterCustomers[0] || '', product: '', tonnes: 0, direction: MODALITY_DIRECTIONS.vessel[0], infrastructureId: '', tank: '', specialServices: [] }]);
    const handleRemoveTransfer = (index: number) => setTransfers(t => t.filter((_, i) => i !== index));
    const handleUpdateTransfer = (index: number, field: string, value: any) => setTransfers(t => {
        const newTransfers = [...t];
        newTransfers[index][field] = value;
        // Reset dependent fields
        if (field === 'customer') newTransfers[index].product = '';
        if (field === 'product') newTransfers[index].infrastructureId = '';
        if (field === 'infrastructureId') newTransfers[index].tank = '';
        return newTransfers;
    });
    
    const handleVesselTransferServiceChange = (transferIndex: number, serviceName: string, isChecked: boolean) => {
        setTransfers(prevTransfers => {
            const newTransfers = JSON.parse(JSON.stringify(prevTransfers));
            const transfer = newTransfers[transferIndex];
            const currentServices = transfer.specialServices || [];

            if (isChecked) {
                if (!currentServices.some((s: SpecialServiceData) => s.name === serviceName)) {
                    transfer.specialServices = [...currentServices, { name: serviceName, data: {} }];
                }
            } else {
                transfer.specialServices = currentServices.filter((s: SpecialServiceData) => s.name !== serviceName);
            }
            return newTransfers;
        });
    };

    const handleSimpleTransferChange = (field: keyof Transfer, value: any) => {
        setSimpleTransfer(prev => {
            const newTransfer = { ...prev, [field]: value };
            
            if (field === 'customer') { newTransfer.product = ''; newTransfer.from = ''; newTransfer.to = ''; }
            if (field === 'product' || field === 'direction') { newTransfer.from = ''; newTransfer.to = ''; }
            
            const modalityDirection = MODALITY_DIRECTIONS[modality][0];
            if (modalityDirection) {
                if (newTransfer.direction === modalityDirection) { newTransfer.to = truckRailTransportId; }
                else { newTransfer.from = truckRailTransportId; }
            }

            return newTransfer;
        });
    };
    
    useEffect(() => {
        const modalityDirection = MODALITY_DIRECTIONS[modality]?.[0];
        if (!modalityDirection) return;

        if (simpleTransfer.direction === modalityDirection) {
            setSimpleTransfer(t => ({...t, to: truckRailTransportId}));
        } else {
            setSimpleTransfer(t => ({...t, from: truckRailTransportId}));
        }
    }, [truckRailTransportId, simpleTransfer.direction, modality]);


    const availableInfra = useMemo(() => {
        if (modality === 'vessel') return [];
        return Object.keys(currentTerminalSettings.infrastructureModalityMapping || {})
            .filter(key => currentTerminalSettings.infrastructureModalityMapping[key] === modality);
    }, [modality, currentTerminalSettings]);

    const isFormValid = useMemo(() => {
        if (modality === 'vessel') {
            return vesselTransportId && transfers.every(t => t.customer && t.product && t.tonnes && t.infrastructureId && t.tank);
        }
        return truckRailTransportId && simpleTransfer.customer && simpleTransfer.product && simpleTransfer.tonnes && infrastructureId && (
            (simpleTransfer.direction?.startsWith('Tank to') && simpleTransfer.from) ||
            (simpleTransfer.direction?.endsWith(' to Tank') && simpleTransfer.to)
        );
    }, [modality, vesselTransportId, transfers, truckRailTransportId, simpleTransfer, infrastructureId]);

    const availableModalityServices = useMemo(() => {
        if (modality === 'vessel') return []; // Handled separately
        const modServices = settings.modalityServices?.[modality] || [];
        const prodServices = settings.productServices || [];
        return [...new Set([...modServices, ...prodServices])].sort();
    }, [settings, modality]);

    const handleSimpleServiceChange = (serviceName: string, isChecked: boolean) => {
        setSimpleTransfer(prev => {
            const currentServices = prev.specialServices || [];
            let newServices: SpecialServiceData[];
            if (isChecked) {
                if (!currentServices.some(s => s.name === serviceName)) {
                    newServices = [...currentServices, { name: serviceName, data: { status: 'pending' } }];
                } else {
                    newServices = currentServices;
                }
            } else {
                newServices = currentServices.filter(s => s.name !== serviceName);
            }
            return { ...prev, specialServices: newServices };
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Create New ${modality} Order`} footer={<><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleCreate} disabled={!isFormValid} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Create Order</button></>}>
            <div className="space-y-6">
                <div><label>Modality</label><div className="flex space-x-2 mt-1">{MODALITY_OPTIONS.map(opt => <button key={opt.modality} onClick={() => handleModalityChange(opt.modality)} className={`flex-1 p-3 border rounded-lg flex items-center justify-center space-x-2 transition-colors ${modality === opt.modality ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'bg-white hover:bg-slate-50'}`}><i className={`fas ${opt.icon} ${modality === opt.modality ? 'text-white' : 'text-slate-700'}`}></i><span className={`font-semibold ${modality === opt.modality ? 'text-white' : 'text-slate-700'}`}>{opt.label}</span></button>)}</div></div>

                {modality === 'vessel' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                            <div><label>Vessel Name</label><input type="text" value={vesselTransportId} onChange={e => setVesselTransportId(e.target.value)} /></div>
                            <div><label>ETA</label><DateTimePicker value={vesselEta} onChange={setVesselEta} /></div>
                            <div><label>Est. Duration (hours)</label><input type="number" value={vesselDuration} onChange={e => setVesselDuration(parseFloat(e.target.value) || 1)} min="1" step="1" /></div>
                        </div>
                            <div className="space-y-3">
                            <h3 className="font-semibold text-lg">Transfers</h3>
                            {transfers.map((t, i) => <VesselTransferForm key={i} index={i} transferData={t} onUpdate={handleUpdateTransfer} onRemove={handleRemoveTransfer} onServiceChange={handleVesselTransferServiceChange} />)}
                            <button onClick={handleAddTransfer} className="btn-secondary w-full"><i className="fas fa-plus mr-2"></i>Add Transfer</button>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Vessel Services</h3>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                                {(settings.vesselServices || []).map(service => <label key={service} className="flex items-center space-x-2"><input type="checkbox" className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary" checked={vesselRequirements.includes(service)} onChange={e => setVesselRequirements(p => e.target.checked ? [...p, service] : p.filter(s => s !== service))} /><span>{service}</span></label>)}
                            </div>
                        </div>
                    </div>
                ) : ( // Truck or Rail Form
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label>Transport ID</label><input type="text" value={truckRailTransportId} onChange={e => setTruckRailTransportId(e.target.value)} placeholder={modality === 'truck' ? 'Trucking Co.' : 'Railcar ID'} /></div>
                            <div><label>ETA</label><DateTimePicker value={truckRailEta} onChange={setTruckRailEta} /></div>
                            <div><label>Est. Duration (hours)</label><input type="number" value={truckRailDuration} onChange={e => setTruckRailDuration(parseFloat(e.target.value) || 1)} min="0.5" step="0.5" /></div>
                            
                            <div className="md:col-span-3">
                                <label>Infrastructure</label>
                                <select value={infrastructureId} onChange={e => setInfrastructureId(e.target.value)}>
                                    <option value="">Select Bay/Siding...</option>
                                    {availableInfra.map(infra => <option key={infra} value={infra}>{formatInfraName(infra)}</option>)}
                                </select>
                            </div>

                            {modality === 'truck' && <>
                                <div><label>License Plate</label><input type="text" value={licensePlate} onChange={e => setLicensePlate(e.target.value)} /></div>
                                <div className="md:col-span-2"><label>Driver Name</label><input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} /></div>
                            </>}
                        </div>
                        <div className="p-4 border-t mt-4">
                            <h4 className="font-semibold text-lg mb-2">Transfer Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label>Customer</label><select value={simpleTransfer.customer || ''} onChange={e => handleSimpleTransferChange('customer', e.target.value)}><option value="">Select...</option>{(currentTerminalSettings.masterCustomers || []).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                <div><label>Product</label><select value={simpleTransfer.product || ''} onChange={e => handleSimpleTransferChange('product', e.target.value)} disabled={!simpleTransfer.customer}><option value="">Select...</option>{((currentTerminalSettings.customerMatrix || []).filter(m => m.customer === simpleTransfer.customer).map(m => m.product)).map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                <div><label>Tonnes</label><input type="number" value={simpleTransfer.tonnes || ''} onChange={e => handleSimpleTransferChange('tonnes', parseFloat(e.target.value) || 0)} /></div>
                                <div className="md:col-span-1"><label>Direction</label><select value={simpleTransfer.direction || ''} onChange={e => handleSimpleTransferChange('direction', e.target.value)}><option value="">Select...</option>{(MODALITY_DIRECTIONS[modality] || []).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                                
                                {simpleTransfer.direction?.startsWith('Tank to') && (
                                    <div className="md:col-span-2">
                                        <label>Source Tank</label>
                                        <select value={simpleTransfer.from || ''} onChange={e => handleSimpleTransferChange('from', e.target.value)} disabled={availableTanks.length === 0}>
                                            <option value="">Select Tank...</option>
                                            {availableTanks.map(tank => <option key={tank} value={tank}>{tank}</option>)}
                                        </select>
                                        {availableTanks.length === 0 && simpleTransfer.product && <p className="text-xs text-red-500 mt-1">No tanks available for this product/bay combination.</p>}
                                    </div>
                                )}
                                {simpleTransfer.direction?.endsWith(' to Tank') && (
                                    <div className="md:col-span-2">
                                        <label>Destination Tank</label>
                                        <select value={simpleTransfer.to || ''} onChange={e => handleSimpleTransferChange('to', e.target.value)} disabled={availableTanks.length === 0}>
                                            <option value="">Select Tank...</option>
                                            {availableTanks.map(tank => <option key={tank} value={tank}>{tank}</option>)}
                                        </select>
                                        {availableTanks.length === 0 && simpleTransfer.product && <p className="text-xs text-red-500 mt-1">No tanks available for this product/bay combination.</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t">
                            <h4 className="font-semibold text-lg mb-2">Services</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {availableModalityServices.map(service => {
                                    const isChecked = (simpleTransfer.specialServices || []).some(s => s.name === service);
                                    return (
                                        <label key={service} className="flex items-center space-x-2 p-1 rounded-md hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                                checked={isChecked}
                                                onChange={(e) => handleSimpleServiceChange(service, e.target.checked)}
                                            />
                                            <span className="text-sm font-medium text-gray-700">{service}</span>
                                        </label>
                                    );
                                })}
                                {availableModalityServices.length === 0 && <p className="text-xs text-slate-400 italic">No services available for this modality.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default NewOperationModal;