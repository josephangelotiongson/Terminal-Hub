import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Transfer, TransferPlanItem, Modality, SpecialServiceData, Hold } from '../types';
import TankLevelIndicator from './TankLevelIndicator';
import DateTimePicker from './DateTimePicker'; // Import the new component
import SpecialServices from './SpecialServices';
import { SOF_EVENTS_MODALITY } from '../constants';
import CancelModal from './CancelModal';
import { formatInfraName, validateOperationPlan } from '../utils/helpers';

const MODALITY_DIRECTIONS: Record<Modality, string[]> = {
    vessel: ['Vessel to Tank', 'Tank to Vessel', 'Tank to Tank'],
    truck: ['Tank to Truck', 'Truck to Tank'],
    rail: ['Tank to Rail', 'Rail to Tank'],
};

const OperationPlan: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading context...</div>;

    const { activeOpId, saveCurrentPlan, goBack, switchView, settings, currentTerminalSettings, addActivityLog, cancelOperation, editingOp: plan, setEditingOp: setPlan, holds, requeueOperation, openRescheduleModal } = context;

    const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState<{lineIndex: number, transferIndex: number} | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'transfers' | 'requirements' | 'services'>('transfers');

    const validation = useMemo(() => {
        if (!plan) return { isValid: false, issues: ['No plan loaded.'] };
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        return validateOperationPlan(plan, currentTerminalSettings, settings, activeHolds);
    }, [plan, currentTerminalSettings, settings, holds]);

    const handlePlanChange = (field: keyof Operation, value: any) => {
        if (!plan) return;
        
        const newPlan = { ...plan, [field]: value };
        
        // Sync top-level transportId with transfer 'to' fields for trucks, if they match the old ID
        if (field === 'transportId' && newPlan.modality === 'truck') {
            newPlan.transferPlan = newPlan.transferPlan.map(tp => ({
                ...tp,
                transfers: tp.transfers.map(t => {
                    if (t.direction === 'Tank to Truck' && t.to === plan.transportId) {
                        return { ...t, to: value };
                    }
                    return t;
                })
            }));
        }

        setPlan(newPlan);
    };

    const handleAddInfrastructure = () => {
        if (!plan) return;
        const newInfra: TransferPlanItem = {
            infrastructureId: '',
            transfers: []
        };
        const newPlan = { ...plan, transferPlan: [...plan.transferPlan, newInfra] };
        setPlan(newPlan);
    };

    const handleRemoveInfrastructure = (lineIndex: number) => {
        if (!plan) return;
        const newTransferPlan = plan.transferPlan.filter((_, i) => i !== lineIndex);
        setPlan({ ...plan, transferPlan: newTransferPlan });
    };
    
    const handleInfraChange = (lineIndex: number, value: string) => {
        if (!plan || plan.transferPlan[lineIndex].infrastructureId === value) return;

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newTransferPlan = JSON.parse(JSON.stringify(prevPlan.transferPlan)) as TransferPlanItem[];
            const line = newTransferPlan[lineIndex];
            line.infrastructureId = value;
        
            // Reset transfers since tank options will change
            line.transfers.forEach((t: Transfer) => {
                t.from = '';
                t.to = t.direction.endsWith(' to Tank') ? '' : prevPlan.transportId;
            });
            return { ...prevPlan, transferPlan: newTransferPlan };
        });
    };

    const handleAddTransfer = (lineIndex: number) => {
        if (!plan) return;
        const direction = MODALITY_DIRECTIONS[plan.modality][0] || '';
        const newTransfer: Transfer = {
            customer: '', product: '', from: '', 
            to: (plan.modality === 'truck' && direction === 'Tank to Truck') ? plan.transportId : '',
            tonnes: 0,
            direction, 
            specialServices: []
        };
        
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newTransferPlan = [...prevPlan.transferPlan];
            newTransferPlan[lineIndex].transfers.push(newTransfer);
            return { ...prevPlan, transferPlan: newTransferPlan };
        });
    };

    const handleRemoveTransfer = (lineIndex: number, transferIndex: number) => {
        if (!plan) return;
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newTransferPlan = [...prevPlan.transferPlan];
            newTransferPlan[lineIndex].transfers = newTransferPlan[lineIndex].transfers.filter((_, i) => i !== transferIndex);
            return { ...prevPlan, transferPlan: newTransferPlan };
        });
    };
    
    const handleTransferChange = (lineIndex: number, transferIndex: number, field: keyof Transfer, value: any) => {
        if (!plan) return;

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newTransferPlan = JSON.parse(JSON.stringify(prevPlan.transferPlan)) as TransferPlanItem[];
            const transfer = newTransferPlan[lineIndex].transfers[transferIndex];
            
            const oldValue = (transfer as any)[field];
            if (oldValue === value) return prevPlan;
            (transfer as any)[field] = field === 'tonnes' ? parseFloat(value) || 0 : value;

            if (field === 'customer') {
                transfer.product = '';
                transfer.from = '';
                transfer.to = '';
            } else if (field === 'product' || field === 'direction') {
                transfer.from = '';
                transfer.to = '';
            }
            
            if (!transfer.direction.endsWith(' to Tank')) {
                transfer.to = prevPlan.transportId;
            }
            
            return { ...prevPlan, transferPlan: newTransferPlan };
        });
    };

    const handleSave = () => {
        if (plan) {
            saveCurrentPlan(plan);
            goBack();
        }
    };
    
    const handleActivate = () => {
        if (!plan || !validation.isValid || plan.status === 'active' || plan.modality === 'truck') return;

        const activatedPlan: Operation = JSON.parse(JSON.stringify(plan));
        activatedPlan.status = 'active';
        
        saveCurrentPlan(activatedPlan);
        addActivityLog(plan.id, 'UPDATE', 'Operation has been activated.');
        switchView('active-operations-list');
    };
    
    const handleReschedule = () => {
        if (!plan || validation.isValid) return;
        requeueOperation(plan.id, validation.issues[0]);
        openRescheduleModal(plan.id, new Date());
    };

    const handleConfirmCancel = (reason: string) => {
        if (plan) {
            cancelOperation(plan.id, reason);
        }
        setIsCancelModalOpen(false);
    };

    const openServicesModal = (lineIndex: number, transferIndex: number) => {
        setEditingTransfer({ lineIndex, transferIndex });
        setIsServicesModalOpen(true);
    };
    
    const closeServicesModal = () => {
        setIsServicesModalOpen(false);
        setEditingTransfer(null);
    };

    const handleServicesUpdate = (updatedServices: SpecialServiceData[]) => {
        if (!plan || !editingTransfer) return;
        const { lineIndex, transferIndex } = editingTransfer;

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newPlan = JSON.parse(JSON.stringify(prevPlan)) as Operation;
            newPlan.transferPlan[lineIndex].transfers[transferIndex].specialServices = updatedServices;
            return newPlan;
        });
    };

    const handleRequirementChange = (requirementName: string, isChecked: boolean) => {
        if (!plan) return;
    
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            let newRequirements = prevPlan.specialRequirements ? [...prevPlan.specialRequirements] : [];
            if (isChecked) {
                if (!newRequirements.some(r => r.name === requirementName)) {
                    newRequirements.push({ name: requirementName, data: {} });
                }
            } else {
                newRequirements = newRequirements.filter(r => r.name === requirementName);
            }
            return { ...prevPlan, specialRequirements: newRequirements };
        });
    };

    const handleTruckServiceChange = (serviceName: string, isChecked: boolean) => {
        if (!plan) return;
        
        // Assuming services are on the first transfer for trucks
        const lineIndex = 0;
        const transferIndex = 0;

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newPlan = JSON.parse(JSON.stringify(prevPlan)) as Operation;

            // Ensure transfer plan structure exists
            if (!newPlan.transferPlan[lineIndex]) {
                newPlan.transferPlan[lineIndex] = { infrastructureId: '', transfers: [] };
            }
            if (!newPlan.transferPlan[lineIndex].transfers[transferIndex]) {
                const direction = MODALITY_DIRECTIONS[newPlan.modality][0] || '';
                newPlan.transferPlan[lineIndex].transfers[transferIndex] = {
                    customer: '', product: '', from: '', 
                    to: (newPlan.modality === 'truck' && direction === 'Tank to Truck') ? newPlan.transportId : '',
                    tonnes: 0, direction, specialServices: []
                };
            }
            
            let services = newPlan.transferPlan[lineIndex].transfers[transferIndex].specialServices || [];

            if (isChecked) {
                if (!services.some(s => s.name === serviceName)) {
                    services.push({ name: serviceName, data: {} });
                }
            } else {
                services = services.filter(s => s.name === serviceName);
            }

            newPlan.transferPlan[lineIndex].transfers[transferIndex].specialServices = services;
            return newPlan;
        });
    };


    if (!plan) {
        return <div className="card text-center p-8">Loading operation plan...</div>;
    }

    const availableCustomers = currentTerminalSettings.masterCustomers || [];
    const availableDirections = MODALITY_DIRECTIONS[plan.modality] || [];
    const allInfrastructureForModality = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {})
        .filter(key => currentTerminalSettings.infrastructureModalityMapping[key] === plan.modality);
    const availableVesselRequirements = settings.specialServices.vessel || [];
    const availableTruckServices = settings.specialServices.truck || [];
    const selectedTruckServices = plan.transferPlan[0]?.transfers[0]?.specialServices.map(s => s.name) || [];
    
    const isAlreadyActive = plan.status === 'active';
    const isTruck = plan.modality === 'truck';

    const getActivateButtonTitle = () => {
        if (isAlreadyActive) return 'This operation is already active.';
        if (!validation.isValid) return `Cannot activate:\n- ${validation.issues.join('\n- ')}`;
        return 'Activate Operation';
    };

    const checkCompatibility = (lineId: string, product: string) => {
        if (!lineId || !product) return { compatible: true, message: '' };
        const dockline = currentTerminalSettings.docklines?.[lineId];
        if (!dockline) return { compatible: true, message: '' };

        const lastProduct = dockline.lastProduct;
        const lastGroup = settings.productGroups[lastProduct];
        const currentGroup = settings.productGroups[product];

        if (lastGroup && currentGroup && settings.compatibility[lastGroup]?.[currentGroup] === 'X') {
            return { compatible: false, message: `Incompatible: Last product on ${lineId} was ${lastProduct} (${lastGroup}).` };
        }
        return { compatible: true, message: '' };
    };

    return (
        <>
            {isServicesModalOpen && editingTransfer && plan && (
                <SpecialServices
                    isOpen={isServicesModalOpen}
                    onClose={closeServicesModal}
                    transfer={plan.transferPlan[editingTransfer.lineIndex].transfers[editingTransfer.transferIndex]}
                    modality={plan.modality}
                    onUpdate={handleServicesUpdate}
                />
            )}
            <CancelModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleConfirmCancel}
                operation={plan}
            />
            <div className="p-4 sm:p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-brand-dark">
                        Plan: {plan.transportId} ({plan.modality})
                    </h2>
                    <div className="flex space-x-2">
                        <button onClick={() => setIsCancelModalOpen(true)} className="btn-danger"><i className="fas fa-ban mr-2"></i>Cancel Operation</button>
                        <button onClick={handleSave} className="btn-secondary"><i className="fas fa-save mr-2"></i>Save & Close</button>
                         {!validation.isValid && plan.status === 'planned' && (
                             <button 
                                onClick={handleReschedule} 
                                className="btn-primary !bg-orange-500 hover:!bg-orange-600"
                                title="This plan has issues and should be rescheduled."
                            >
                                <i className="fas fa-calendar-alt mr-2"></i>Reschedule
                            </button>
                        )}
                        {!isTruck && (
                            <button 
                                onClick={handleActivate} 
                                disabled={!validation.isValid || isAlreadyActive} 
                                className="btn-primary disabled:!bg-slate-400 disabled:cursor-not-allowed" 
                                title={getActivateButtonTitle()}
                            >
                                <i className="fas fa-check mr-2"></i>
                                {isAlreadyActive ? 'Activated' : 'Activate'}
                            </button>
                        )}
                    </div>
                </div>

                {!validation.isValid && (
                    <div className="card p-4 bg-yellow-50 border-yellow-300">
                        <h3 className="font-bold text-yellow-800 text-lg mb-2 flex items-center"><i className="fas fa-exclamation-triangle mr-3"></i>Plan Incomplete or Unsafe</h3>
                        <ul className="list-disc list-inside space-y-1 text-yellow-700 font-medium text-sm">
                            {validation.issues.map((issue, index) => <li key={index}>{issue}</li>)}
                        </ul>
                    </div>
                )}

                <div className="card p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label>Transport ID</label>
                            <input type="text" value={plan.transportId} onChange={(e) => handlePlanChange('transportId', e.target.value)} />
                        </div>
                        {plan.modality === 'truck' && (
                             <div>
                                <label>License Plate</label>
                                <input type="text" value={plan.licensePlate || ''} onChange={(e) => handlePlanChange('licensePlate', e.target.value)} />
                            </div>
                        )}
                        <div>
                            <label>ETA / Scheduled Time</label>
                            <DateTimePicker 
                                value={plan.eta} 
                                onChange={(isoString) => handlePlanChange('eta', isoString)} 
                            />
                        </div>
                    </div>
                     {plan.modality === 'truck' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 border-t pt-6">
                            <div>
                                <label>Driver Name</label>
                                <input type="text" value={plan.driverName || ''} onChange={(e) => handlePlanChange('driverName', e.target.value)} placeholder="e.g. John Doe"/>
                            </div>
                            <div>
                                <label>Driver Phone</label>
                                <input type="text" value={plan.driverPhone || ''} onChange={(e) => handlePlanChange('driverPhone', e.target.value)} placeholder="e.g. 555-123-4567"/>
                            </div>
                            <div>
                                <label>Driver Email</label>
                                <input type="email" value={plan.driverEmail || ''} onChange={(e) => handlePlanChange('driverEmail', e.target.value)} placeholder="e.g. john.d@example.com"/>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="border-b">
                        <nav className="-mb-px flex space-x-6 px-6">
                            <button onClick={() => setActiveTab('transfers')} className={`tab ${activeTab === 'transfers' ? 'active' : ''}`}>
                                {plan.modality === 'truck' ? 'Transfer Details' : 'Infrastructure & Transfers'}
                            </button>
                            {plan.modality === 'vessel' && (
                                <button onClick={() => setActiveTab('requirements')} className={`tab ${activeTab === 'requirements' ? 'active' : ''}`}>
                                    Special Requirements
                                </button>
                            )}
                             {plan.modality === 'truck' && (
                                <button onClick={() => setActiveTab('services')} className={`tab ${activeTab === 'services' ? 'active' : ''}`}>
                                    Services
                                </button>
                            )}
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeTab === 'transfers' && (
                            <div className="space-y-6">
                                {plan.transferPlan.map((line, lineIndex) => (
                                    <div key={lineIndex} className="card p-6 bg-slate-50 border">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-semibold text-text-primary">Infrastructure: {line.infrastructureId ? formatInfraName(line.infrastructureId) : `Lineup #${lineIndex + 1}`}</h3>
                                            {plan.modality !== 'truck' && <button onClick={() => handleRemoveInfrastructure(lineIndex)} className="btn-icon danger" title="Remove Infrastructure"><i className="fas fa-trash"></i></button>}
                                        </div>
                                        <div>
                                            <label>Infrastructure ID</label>
                                            <select value={line.infrastructureId} onChange={(e) => handleInfraChange(lineIndex, e.target.value)}>
                                                <option value="">Select Infrastructure...</option>
                                                {allInfrastructureForModality.map(infra => (
                                                    <option key={infra} value={infra}>{formatInfraName(infra)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        {line.transfers.map((transfer, transferIndex) => {
                                            const compatibility = checkCompatibility(line.infrastructureId, transfer.product);

                                            // Smarter dropdown logic
                                            const availableProductsForCustomer = (() => {
                                                if (!transfer.customer) return [];
                                                const customerProducts = new Set(
                                                    currentTerminalSettings.customerMatrix
                                                        .filter(m => m.customer === transfer.customer)
                                                        .map(m => m.product)
                                                );
                                                return settings.masterProducts.filter(p => customerProducts.has(p));
                                            })();

                                            const { finalTankOptions, tankWarningMessage } = (() => {
                                                const isFromTank = transfer.direction.startsWith('Tank to');
                                                const isToTank = transfer.direction.endsWith(' to Tank');

                                                if (!transfer.customer || !transfer.product || !line.infrastructureId || (!isFromTank && !isToTank)) {
                                                    return { finalTankOptions: [], tankWarningMessage: '' };
                                                }

                                                const customerAllowedTanks = currentTerminalSettings.customerMatrix
                                                    .find(m => m.customer === transfer.customer && m.product === transfer.product)?.tanks || [];
                                                
                                                const infraAllowedTanks = currentTerminalSettings.infrastructureTankMapping?.[line.infrastructureId] || [];
                                                
                                                const options = customerAllowedTanks.filter(tank => infraAllowedTanks.includes(tank));

                                                let warning = '';
                                                if (options.length === 0) {
                                                    if (customerAllowedTanks.length > 0) {
                                                        warning = 'No configured tanks are connected to this infrastructure. Check Infrastructure Mappings.';
                                                    } else {
                                                        warning = 'No tanks configured for this customer and product. Check Customer Mappings.';
                                                    }
                                                }
                                                return { finalTankOptions: options, tankWarningMessage: warning };
                                            })();

                                            const isFromTank = transfer.direction.startsWith('Tank to');
                                            const isToTank = transfer.direction.endsWith(' to Tank');
                                            const tankName = currentTerminalSettings.masterTanks?.[transfer.to] ? transfer.to : currentTerminalSettings.masterTanks?.[transfer.from] ? transfer.from : null;
                                            const isIncoming = tankName ? transfer.to === tankName : false;
                                            const fromPlaceholder = isFromTank ? 'Select Tank...' : 'Vessel/Rail Compartment ID';

                                            return (
                                                <div key={transferIndex} className="pt-6 mt-6 border-t relative bg-white p-4 rounded-lg shadow-sm">
                                                    <h4 className="font-semibold mb-4 text-text-secondary">Transfer #{transferIndex + 1}</h4>
                                                    <div className="absolute top-4 right-0">
                                                        {plan.modality !== 'truck' && <button onClick={() => handleRemoveTransfer(lineIndex, transferIndex)} className="btn-icon danger" title="Remove Transfer"><i className="fas fa-times"></i></button>}
                                                    </div>

                                                    {plan.modality !== 'truck' && <div className="mb-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h5 className="font-semibold text-text-secondary text-sm">Special Services:</h5>
                                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                    {transfer.specialServices.length > 0 ? transfer.specialServices.map(s => (
                                                                        <span key={s.name} className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-1 rounded-full">{s.name}</span>
                                                                    )) : <span className="text-xs italic text-text-tertiary">None</span>}
                                                                </div>
                                                            </div>
                                                            <button onClick={() => openServicesModal(lineIndex, transferIndex)} className="btn-secondary !py-1 !px-3 text-sm" title="Edit Special Services"><i className="fas fa-cog mr-2"></i>Edit Services</button>
                                                        </div>
                                                    </div>}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                                        <div>
                                                            <label>Customer</label>
                                                            <select value={transfer.customer} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'customer', e.target.value)}>
                                                                <option value="">Select Customer</option>
                                                                {availableCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label>Product</label>
                                                            <select value={transfer.product} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'product', e.target.value)} disabled={!transfer.customer}>
                                                                <option value="">Select Product</option>
                                                                {availableProductsForCustomer.map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                            {!compatibility.compatible && <p className="text-red-600 text-xs mt-1 font-semibold">{compatibility.message}</p>}
                                                        </div>
                                                        <div>
                                                            <label>Tonnes</label>
                                                            <input type="number" value={transfer.tonnes} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'tonnes', e.target.value)} />
                                                        </div>
                                                        
                                                        <div className="lg:col-span-2 flex items-end gap-2">
                                                            <div className="flex-1">
                                                                <label>From</label>
                                                                {isFromTank ? (
                                                                    <>
                                                                        <select value={transfer.from} onChange={e => handleTransferChange(lineIndex, transferIndex, 'from', e.target.value)} disabled={!line.infrastructureId || !transfer.product}>
                                                                            <option value="">{fromPlaceholder}</option>
                                                                            {finalTankOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                                        </select>
                                                                        {tankWarningMessage && <p className="text-xs text-red-600 mt-1">{tankWarningMessage}</p>}
                                                                    </>
                                                                ) : (
                                                                    <input type="text" value={transfer.from} onChange={e => handleTransferChange(lineIndex, transferIndex, 'from', e.target.value)} placeholder={fromPlaceholder} />
                                                                )}
                                                            </div>
                                                            <i className="fas fa-long-arrow-alt-right text-text-tertiary pb-3 text-xl"></i>
                                                            <div className="flex-1">
                                                                <label>To</label>
                                                                {isToTank ? (
                                                                    <>
                                                                        <select value={transfer.to} onChange={e => handleTransferChange(lineIndex, transferIndex, 'to', e.target.value)} disabled={!line.infrastructureId || !transfer.product}>
                                                                            <option value="">Select Tank...</option>
                                                                            {finalTankOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                                        </select>
                                                                        {tankWarningMessage && <p className="text-xs text-red-600 mt-1">{tankWarningMessage}</p>}
                                                                    </>
                                                                ) : plan.modality === 'truck' ? (
                                                                    <input type="text" value={transfer.to} onChange={e => handleTransferChange(lineIndex, transferIndex, 'to', e.target.value)} placeholder="Enter Truck ID/Plate" />
                                                                ) : (
                                                                    <input type="text" value={transfer.to} disabled placeholder={plan.transportId} className="bg-slate-100" />
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label>Direction</label>
                                                            <select value={transfer.direction} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'direction', e.target.value)}>
                                                                {availableDirections.map(d => <option key={d} value={d}>{d}</option>)}
                                                            </select>
                                                        </div>

                                                        {tankName && (
                                                            <div className="md:col-span-2 lg:col-span-3 mt-4">
                                                                <TankLevelIndicator 
                                                                    tankName={tankName}
                                                                    transferVolume={transfer.tonnes}
                                                                    transferDirection={isIncoming ? 'in' : 'out'}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {plan.modality !== 'truck' && <button onClick={() => handleAddTransfer(lineIndex)} className="btn-secondary text-sm mt-6"><i className="fas fa-plus mr-2"></i>Add Transfer</button>}
                                    </div>
                                ))}
                                {plan.modality !== 'truck' && <div className="mt-6">
                                    <button onClick={handleAddInfrastructure} className="btn-secondary text-sm"><i className="fas fa-plus mr-2"></i>Add Infrastructure Lineup</button>
                                </div>}
                            </div>
                        )}

                        {activeTab === 'requirements' && plan.modality === 'vessel' && (
                            <div>
                                <h3 className="text-xl font-semibold text-text-primary mb-4">Special Requirements</h3>
                                <p className="text-sm text-text-secondary mb-4">Select all requirements that apply to this vessel operation.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {availableVesselRequirements.map(req => {
                                        const isChecked = plan.specialRequirements?.some(r => r.name === req) ?? false;
                                        return (
                                            <label key={req} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                                    checked={isChecked}
                                                    onChange={(e) => handleRequirementChange(req, e.target.checked)}
                                                />
                                                <span className="text-sm font-medium text-gray-700">{req}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'services' && plan.modality === 'truck' && (
                            <div>
                                <h3 className="text-xl font-semibold text-text-primary mb-4">Special Services</h3>
                                <p className="text-sm text-text-secondary mb-4">Select all services that apply to this truck operation.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {availableTruckServices.map(service => {
                                        const isChecked = selectedTruckServices.includes(service);
                                        return (
                                            <label key={service} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                                    checked={isChecked}
                                                    onChange={(e) => handleTruckServiceChange(service, e.target.checked)}
                                                />
                                                <span className="text-sm font-medium text-gray-700">{service}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default OperationPlan;