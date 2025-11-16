

import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Transfer, TransferPlanItem, Modality, SpecialServiceData, Hold, ActivityLogItem, SOFItem } from '../types';
import TankLevelIndicator from './TankLevelIndicator';
import DateTimePicker from './DateTimePicker'; // Import the new component
import CancelModal from './CancelModal';
import { formatInfraName, validateOperationPlan, getOperationDurationHours, canReschedule, canEditPlan } from '../utils/helpers';
import RequeuePriorityModal from './RequeuePriorityModal';
import DocumentManager from './DocumentManager';
import { LINE_CLEANING_EVENTS } from '../constants';

const getIcon = (modality: Modality): string => {
    switch (modality) {
        case 'vessel': return 'fa-ship';
        case 'truck': return 'fa-truck';
        case 'rail': return 'fa-train';
        default: return 'fa-question-circle';
    }
};

const MODALITY_DIRECTIONS: Record<Modality, string[]> = {
    vessel: ['Vessel to Tank', 'Tank to Vessel', 'Tank to Tank'],
    truck: ['Tank to Truck', 'Truck to Tank'],
    rail: ['Tank to Rail', 'Rail to Tank'],
};

const OperationPlan: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading context...</div>;

    const { activeOpId, saveCurrentPlan, goBack, switchView, settings, currentTerminalSettings, addActivityLog, cancelOperation, editingOp: plan, setEditingOp: setPlan, holds, requeueOperation, openRescheduleModal, currentUser } = context;

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'transfers' | 'requirements' | 'services' | 'documents'>('transfers');
    const [priorityModalOpen, setPriorityModalOpen] = useState(false);
    // FIX: The `canReschedule` function expects only one argument (`user`), but was called with two. The second argument `plan` has been removed.
    const canUserReschedule = canReschedule(currentUser);
    const isReadOnly = !canEditPlan(currentUser);

    const checkCompatibility = React.useCallback(
        (infraId: string, currentProduct: string, lineTransfers: Transfer[], transferIndex: number): { compatible: boolean; message: string; } => {
            if (!currentProduct) return { compatible: true, message: '' };

            let prevProduct: string | undefined;

            if (transferIndex === 0) {
                prevProduct = currentTerminalSettings.docklines?.[infraId]?.lastProduct;
            } else {
                prevProduct = lineTransfers[transferIndex - 1]?.product;
            }

            if (!prevProduct) return { compatible: true, message: '' };
            
            const prevGroup = settings.productGroups[prevProduct];
            const currentGroup = settings.productGroups[currentProduct];

            if (prevGroup && currentGroup && settings.compatibility[prevGroup]?.[currentGroup] === 'X') {
                return {
                    compatible: false,
                    message: `Incompatible with previous product (${prevProduct}).`
                };
            }

            return { compatible: true, message: '' };
        },
        [currentTerminalSettings.docklines, settings.productGroups, settings.compatibility]
    );

    const validation = useMemo(() => {
        if (!plan) return { isValid: false, issues: ['No plan loaded.'] };
        const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');
        return validateOperationPlan(plan, currentTerminalSettings, settings, activeHolds);
    }, [plan, currentTerminalSettings, settings, holds]);

    const handlePlanChange = (field: keyof Operation, value: any) => {
        if (!plan) return;
        
        const newPlan = { ...plan, [field]: value };
        
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

    const handleDocumentUpdate = (updatedOperation: Operation, auditDetails: { action: string; details: string; }) => {
        if (plan) {
            const newLog: ActivityLogItem = {
                time: new Date().toISOString(),
                user: currentUser.name,
                action: auditDetails.action,
                details: auditDetails.details,
            };
            const finalOp = {
                ...updatedOperation,
                activityHistory: [...(updatedOperation.activityHistory || []), newLog]
            };
            setPlan(finalOp);
        }
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
            const transfer = newTransferPlan[lineIndex]?.transfers?.[transferIndex];
            
            if (!transfer) {
                console.warn(`Attempted to edit non-existent transfer at [${lineIndex}, ${transferIndex}]`);
                return prevPlan;
            }

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

    const handleAddCleaning = (lineIndex: number, transferIndex: number) => {
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newPlan = JSON.parse(JSON.stringify(prevPlan)) as Operation;
            const transfer = newPlan.transferPlan[lineIndex]?.transfers[transferIndex];
            if (transfer) {
                transfer.preTransferCleaningSof = LINE_CLEANING_EVENTS.map(event => ({
                    event,
                    status: 'pending',
                    time: '',
                    user: '',
                    loop: 1
                }));
            }
            return newPlan;
        });
    };

    const handleSave = () => {
        if (plan) {
            saveCurrentPlan(plan);
            goBack();
        }
    };
    
    const handleReschedule = (priority: 'high' | 'normal') => {
        if (!plan || validation.isValid) return;
        requeueOperation(plan.id, validation.issues[0], priority);
        openRescheduleModal(plan.id, new Date());
    };

    const handleConfirmCancel = (reason: string) => {
        if (plan) {
            cancelOperation(plan.id, reason);
        }
        setIsCancelModalOpen(false);
    };

    const availableVesselTransferServices = useMemo(() => {
        const modServices = (settings.modalityServices && Array.isArray(settings.modalityServices.vessel)) ? settings.modalityServices.vessel : [];
        const prodServices = Array.isArray(settings.productServices) ? settings.productServices : [];
        return [...new Set([...modServices, ...prodServices])].sort();
    }, [settings]);

    const handleVesselTransferServiceChange = (lineIndex: number, transferIndex: number, serviceName: string, isChecked: boolean) => {
        if (!plan) return;

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newPlan = JSON.parse(JSON.stringify(prevPlan)) as Operation;
            const transfer = newPlan.transferPlan[lineIndex]?.transfers[transferIndex];
            if (!transfer) return newPlan;

            const currentServices = transfer.specialServices || [];

            if (isChecked) {
                if (!currentServices.some(s => s.name === serviceName)) {
                    transfer.specialServices = [...currentServices, { name: serviceName, data: {} }];
                }
            } else {
                transfer.specialServices = currentServices.filter(s => s.name !== serviceName);
            }
            
            return newPlan;
        });
    };
    
    const handleRequirementChange = (requirementName: string, isChecked: boolean) => {
        if (!plan) return;
    
        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newPlan = JSON.parse(JSON.stringify(prevPlan)) as Operation;
            const currentRequirements = newPlan.specialRequirements || [];
            
            if (isChecked) {
                if (!currentRequirements.some(r => r.name === requirementName)) {
                    newPlan.specialRequirements = [...currentRequirements, { name: requirementName, data: {} }];
                }
            } else {
                newPlan.specialRequirements = currentRequirements.filter(r => r.name !== requirementName);
            }
            return newPlan;
        });
    };

    const availableModalityServices = useMemo(() => {
        if (!plan || plan.modality === 'vessel') return [];
        const modServices = (settings.modalityServices && Array.isArray(settings.modalityServices[plan.modality])) ? settings.modalityServices[plan.modality] : [];
        const prodServices = Array.isArray(settings.productServices) ? settings.productServices : [];
        return [...new Set([...modServices, ...prodServices])].sort();
    }, [settings, plan]);

    const handleModalityServiceChange = (serviceName: string, isChecked: boolean) => {
        if (!plan) return;
        
        // Assuming services are on the first transfer for trucks/rail
        const lineIndex = 0;
        const transferIndex = 0;

        setPlan(prevPlan => {
            if (!prevPlan) return null;
            const newPlan = JSON.parse(JSON.stringify(prevPlan)) as Operation;

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
            
            const currentServices = newPlan.transferPlan[lineIndex].transfers[transferIndex].specialServices || [];

            if (isChecked) {
                if (!currentServices.some(s => s.name === serviceName)) {
                    newPlan.transferPlan[lineIndex].transfers[transferIndex].specialServices = [...currentServices, { name: serviceName, data: {} }];
                }
            } else {
                newPlan.transferPlan[lineIndex].transfers[transferIndex].specialServices = currentServices.filter(s => s.name !== serviceName);
            }

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
    
    const availableVesselServices = useMemo(() => {
        return Array.isArray(settings.vesselServices) ? settings.vesselServices : [];
    }, [settings.vesselServices]);

    const selectedModalityServices = (plan.transferPlan[0]?.transfers[0]?.specialServices || []).map(s => s.name);
    
    return (
        <>
            <RequeuePriorityModal
                isOpen={priorityModalOpen}
                onClose={() => setPriorityModalOpen(false)}
                onSelect={(priority) => {
                    setPriorityModalOpen(false);
                    handleReschedule(priority);
                }}
            />
            <CancelModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleConfirmCancel}
                operation={plan}
            />
            <div className="p-4 sm:p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-brand-dark flex items-center gap-3">
                        <span>{isReadOnly ? 'View Plan' : 'Plan'}: {plan.transportId}</span>
                        <i className={`fas ${getIcon(plan.modality)} text-3xl text-text-secondary`} title={plan.modality}></i>
                    </h2>
                    <div className="flex space-x-2">
                        <button onClick={() => setIsCancelModalOpen(true)} className="btn-danger" disabled={isReadOnly}><i className="fas fa-ban mr-2"></i>Cancel Operation</button>
                        <button onClick={handleSave} className="btn-secondary" disabled={isReadOnly}><i className="fas fa-save mr-2"></i>Save & Close</button>
                         {!validation.isValid && plan.status === 'planned' && canUserReschedule && (
                             <button 
                                onClick={() => setPriorityModalOpen(true)}
                                className="btn-primary !bg-orange-500 hover:!bg-orange-600"
                                title="This plan has issues and should be rescheduled."
                                disabled={isReadOnly}
                            >
                                <i className="fas fa-calendar-alt mr-2"></i>Reschedule
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label>Transport ID</label>
                            <input type="text" value={plan.transportId} onChange={(e) => handlePlanChange('transportId', e.target.value)} disabled={isReadOnly} />
                        </div>
                        {plan.modality === 'truck' && (
                             <div>
                                <label>License Plate</label>
                                <input type="text" value={plan.licensePlate || ''} onChange={(e) => handlePlanChange('licensePlate', e.target.value)} disabled={isReadOnly} />
                            </div>
                        )}
                        <div>
                            <label>ETA / Scheduled Time</label>
                            <DateTimePicker 
                                value={plan.eta} 
                                onChange={(isoString) => handlePlanChange('eta', isoString)} 
                                disabled={isReadOnly}
                            />
                        </div>
                         <div>
                            <label>Estimated Duration (hours)</label>
                            <input type="number" value={plan.durationHours || getOperationDurationHours(plan)} onChange={(e) => handlePlanChange('durationHours', parseFloat(e.target.value) || 1)} min="0.5" step="0.5" disabled={isReadOnly}/>
                        </div>
                    </div>
                     {plan.modality === 'truck' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 border-t pt-6">
                            <div>
                                <label>Driver Name</label>
                                <input type="text" value={plan.driverName || ''} onChange={(e) => handlePlanChange('driverName', e.target.value)} placeholder="e.g. John Doe" disabled={isReadOnly}/>
                            </div>
                            <div>
                                <label>Driver Phone</label>
                                <input type="text" value={plan.driverPhone || ''} onChange={(e) => handlePlanChange('driverPhone', e.target.value)} placeholder="e.g. 555-123-4567" disabled={isReadOnly}/>
                            </div>
                            <div>
                                <label>Driver Email</label>
                                <input type="email" value={plan.driverEmail || ''} onChange={(e) => handlePlanChange('driverEmail', e.target.value)} placeholder="e.g. john.d@example.com" disabled={isReadOnly}/>
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
                                    Vessel Services
                                </button>
                            )}
                             {(plan.modality === 'truck' || plan.modality === 'rail') && (
                                <button onClick={() => setActiveTab('services')} className={`tab ${activeTab === 'services' ? 'active' : ''}`}>
                                    Services
                                </button>
                            )}
                            <button onClick={() => setActiveTab('documents')} className={`tab ${activeTab === 'documents' ? 'active' : ''}`}>
                                Documents ({(plan.documents || []).length})
                            </button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeTab === 'transfers' && (
                            <div className="space-y-6">
                                {plan.transferPlan.map((line, lineIndex) => (
                                    <div key={lineIndex} className="card p-6 bg-slate-50 border">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-semibold text-text-primary">Infrastructure: {line.infrastructureId ? formatInfraName(line.infrastructureId) : `Lineup #${lineIndex + 1}`}</h3>
                                            {plan.modality !== 'truck' && <button onClick={() => handleRemoveInfrastructure(lineIndex)} className="btn-icon danger" title="Remove Infrastructure" disabled={isReadOnly}><i className="fas fa-trash"></i></button>}
                                        </div>
                                        <div>
                                            <label>Infrastructure ID</label>
                                            <select value={line.infrastructureId} onChange={(e) => handleInfraChange(lineIndex, e.target.value)} disabled={isReadOnly}>
                                                <option value="">Select Infrastructure...</option>
                                                {allInfrastructureForModality.map(infra => (
                                                    <option key={infra} value={infra}>{formatInfraName(infra)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        {line.transfers.map((transfer, transferIndex) => {
                                            const incompatibilityInfo = useMemo(() => {
                                                if (!transfer.product) return null;
                                        
                                                let prevProduct: string | undefined;
                                                let context: 'line' | 'sequence' | null = null;
                                        
                                                if (transferIndex === 0) {
                                                    prevProduct = currentTerminalSettings.docklines?.[line.infrastructureId]?.lastProduct;
                                                    context = 'line';
                                                } else {
                                                    prevProduct = line.transfers[transferIndex - 1]?.product;
                                                    context = 'sequence';
                                                }
                                        
                                                if (!prevProduct) return null;
                                        
                                                const prevGroup = settings.productGroups[prevProduct];
                                                const currentGroup = settings.productGroups[transfer.product];
                                        
                                                if (prevGroup && currentGroup && settings.compatibility[prevGroup]?.[currentGroup] === 'X') {
                                                    return {
                                                        is_incompatible: true,
                                                        previous_product: prevProduct,
                                                        context,
                                                    };
                                                }
                                        
                                                return null;
                                            }, [transfer.product, transferIndex, line.infrastructureId, line.transfers, settings, currentTerminalSettings]);

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
                                                    ?.find(m => m.customer === transfer.customer && m.product === transfer.product)?.tanks || [];
                                                
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
                                            
                                            const transferIssues = validation.issues.filter(issue => 
                                                (issue.includes(transfer.from) || issue.includes(transfer.to) || issue.includes(transfer.product))
                                            );


                                            const isFromTank = transfer.direction.startsWith('Tank to');
                                            const isToTank = transfer.direction.endsWith(' to Tank');
                                            const tankName = currentTerminalSettings.masterTanks?.[transfer.to] ? transfer.to : currentTerminalSettings.masterTanks?.[transfer.from] ? transfer.from : null;
                                            const isIncoming = tankName ? transfer.to === tankName : false;
                                            const fromPlaceholder = isFromTank ? 'Select Tank...' : 'Vessel/Rail Compartment ID';

                                            return (
                                                <div key={transferIndex} className="pt-6 mt-6 border-t relative bg-white p-4 rounded-lg shadow-sm">
                                                    
                                                    {incompatibilityInfo && (
                                                        <div className="p-3 mb-4 bg-red-100 border border-red-300 rounded-lg flex items-center justify-between gap-4">
                                                            <div>
                                                                <h5 className="font-bold text-red-800"><i className="fas fa-exclamation-triangle mr-2"></i>Incompatible Product</h5>
                                                                <p className="text-sm text-red-700">
                                                                    Cleaning is required after <strong>{incompatibilityInfo.previous_product}</strong> ({incompatibilityInfo.context === 'line' ? 'last on line' : 'previous transfer'}) before <strong>{transfer.product}</strong>.
                                                                </p>
                                                            </div>
                                                            {!transfer.preTransferCleaningSof ? (
                                                                <button onClick={() => handleAddCleaning(lineIndex, transferIndex)} className="btn-primary !bg-red-600 hover:!bg-red-700 flex-shrink-0" disabled={isReadOnly}>Add Required Cleaning</button>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                                                                    <i className="fas fa-check-circle"></i> Cleaning Added
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <h4 className="font-semibold mb-4 text-text-secondary">Transfer #{transferIndex + 1}</h4>
                                                    <div className="absolute top-4 right-0">
                                                        {plan.modality !== 'truck' && <button onClick={() => handleRemoveTransfer(lineIndex, transferIndex)} className="btn-icon danger" title="Remove Transfer" disabled={isReadOnly}><i className="fas fa-times"></i></button>}
                                                    </div>

                                                    {plan.modality === 'vessel' && (
                                                        <div className="mt-4 pt-4 border-t">
                                                            <h5 className="font-semibold text-text-secondary text-sm mb-2">Transfer Services</h5>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                                {availableVesselTransferServices.map(service => {
                                                                    const isChecked = transfer.specialServices.some(s => s.name === service);
                                                                    return (
                                                                        <label key={service} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-50 cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                                                                checked={isChecked}
                                                                                onChange={(e) => handleVesselTransferServiceChange(lineIndex, transferIndex, service, e.target.checked)}
                                                                                disabled={isReadOnly}
                                                                            />
                                                                            <span className="text-xs font-medium text-gray-700">{service}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 mt-4">
                                                        <div>
                                                            <label>Customer</label>
                                                            <select value={transfer.customer} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'customer', e.target.value)} disabled={isReadOnly}>
                                                                <option value="">Select Customer</option>
                                                                {availableCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label>Product</label>
                                                            <select value={transfer.product} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'product', e.target.value)} disabled={!transfer.customer || isReadOnly}>
                                                                <option value="">Select Product</option>
                                                                {availableProductsForCustomer.map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="relative">
                                                            <label>Tonnes</label>
                                                            <input type="number" value={transfer.tonnes} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'tonnes', e.target.value)} disabled={isReadOnly}/>
                                                             {transferIssues.length > 0 && (
                                                                <div className="absolute top-1/2 right-2 mt-1" title={transferIssues.join('\n')}>
                                                                    <i className="fas fa-exclamation-triangle text-yellow-500"></i>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="lg:col-span-2 flex items-end gap-2">
                                                            <div className="flex-1">
                                                                <label>From</label>
                                                                {isFromTank ? (
                                                                    <>
                                                                        <select value={transfer.from} onChange={e => handleTransferChange(lineIndex, transferIndex, 'from', e.target.value)} disabled={!line.infrastructureId || !transfer.product || isReadOnly}>
                                                                            <option value="">{fromPlaceholder}</option>
                                                                            {finalTankOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                                        </select>
                                                                        {tankWarningMessage && <p className="text-xs text-red-600 mt-1">{tankWarningMessage}</p>}
                                                                    </>
                                                                ) : (
                                                                    <input type="text" value={transfer.from} onChange={e => handleTransferChange(lineIndex, transferIndex, 'from', e.target.value)} placeholder={fromPlaceholder} disabled={isReadOnly}/>
                                                                )}
                                                            </div>
                                                            <i className="fas fa-long-arrow-alt-right text-text-tertiary pb-3 text-xl"></i>
                                                            <div className="flex-1">
                                                                <label>To</label>
                                                                {isToTank ? (
                                                                    <>
                                                                        <select value={transfer.to} onChange={e => handleTransferChange(lineIndex, transferIndex, 'to', e.target.value)} disabled={!line.infrastructureId || !transfer.product || isReadOnly}>
                                                                            <option value="">Select Tank...</option>
                                                                            {finalTankOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                                        </select>
                                                                        {tankWarningMessage && <p className="text-xs text-red-600 mt-1">{tankWarningMessage}</p>}
                                                                    </>
                                                                ) : plan.modality === 'truck' ? (
                                                                    <input type="text" value={transfer.to} onChange={e => handleTransferChange(lineIndex, transferIndex, 'to', e.target.value)} placeholder="Enter Truck ID/Plate" disabled={isReadOnly}/>
                                                                ) : (
                                                                    <input type="text" value={transfer.to} disabled placeholder={plan.transportId} className="bg-slate-100" />
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label>Direction</label>
                                                            <select value={transfer.direction} onChange={(e) => handleTransferChange(lineIndex, transferIndex, 'direction', e.target.value)} disabled={isReadOnly}>
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
                                        {plan.modality !== 'truck' && <button onClick={() => handleAddTransfer(lineIndex)} className="btn-secondary text-sm mt-6" disabled={isReadOnly}><i className="fas fa-plus mr-2"></i>Add Transfer</button>}
                                    </div>
                                ))}
                                {plan.modality !== 'truck' && <div className="mt-6">
                                    <button onClick={handleAddInfrastructure} className="btn-secondary text-sm" disabled={isReadOnly}><i className="fas fa-plus mr-2"></i>Add Infrastructure Lineup</button>
                                </div>}
                            </div>
                        )}

                        {activeTab === 'requirements' && plan.modality === 'vessel' && (
                            <div>
                                <h3 className="text-xl font-semibold text-text-primary mb-4">Vessel Services</h3>
                                <p className="text-sm text-text-secondary mb-4">Select all services that apply to this vessel operation.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {availableVesselServices.map(req => {
                                        const isChecked = plan.specialRequirements?.some(r => r.name === req) ?? false;
                                        return (
                                            <label key={req} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                                    checked={isChecked}
                                                    onChange={(e) => handleRequirementChange(req, e.target.checked)}
                                                    disabled={isReadOnly}
                                                />
                                                <span className="text-sm font-medium text-gray-700">{req}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'services' && (plan.modality === 'truck' || plan.modality === 'rail') && (
                            <div>
                                <h3 className="text-xl font-semibold text-text-primary mb-4">Special Services</h3>
                                <p className="text-sm text-text-secondary mb-4">Select all services that apply to this {plan.modality} operation.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {availableModalityServices.map(service => {
                                        const isChecked = selectedModalityServices.includes(service);
                                        return (
                                            <label key={service} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                                    checked={isChecked}
                                                    onChange={(e) => handleModalityServiceChange(service, e.target.checked)}
                                                    disabled={isReadOnly}
                                                />
                                                <span className="text-sm font-medium text-gray-700">{service}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {activeTab === 'documents' && (
                            <DocumentManager operation={plan} onUpdate={handleDocumentUpdate as any} isReadOnly={isReadOnly}/>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default OperationPlan;
