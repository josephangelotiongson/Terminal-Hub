import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { AppSettings, Modality } from '../types';
import ConfirmModal from './ConfirmModal'; // Import the new component

type ConfigView = 'compatibility' | 'mappings' | 'infra-mappings' | 'infra-modality-mappings' | 'contracts';

const ProductCompatibility: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings, setSettings } = context;
    const { productGroups = {}, compatibility = {} } = settings;

    const groupNames = useMemo(() => {
        return [...new Set(Object.values(productGroups))].sort();
    }, [productGroups]);
    
    const handleCellClick = (rowGroup: string, colGroup: string) => {
        setSettings(prevSettings => {
            const newCompatibility = JSON.parse(JSON.stringify(prevSettings.compatibility || {})) as AppSettings['compatibility'];
            const currentValue = newCompatibility[rowGroup]?.[colGroup];
            const nextValue: "C" | "X" = currentValue === 'C' ? 'X' : 'C';

            if (!newCompatibility[rowGroup]) newCompatibility[rowGroup] = {};
            if (!newCompatibility[colGroup]) newCompatibility[colGroup] = {};

            newCompatibility[rowGroup][colGroup] = nextValue;
            newCompatibility[colGroup][rowGroup] = nextValue;
            
            return { ...prevSettings, compatibility: newCompatibility };
        });
    };
    
    return (
        <div className="card p-6">
            <p className="text-sm text-text-secondary mb-4">Click a cell to toggle between Compatible (C) and Incompatible (X).</p>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2"></th>
                            {groupNames.map((g: string) => <th key={g} className="border p-2 text-xs">{g}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {groupNames.map((rowGroup: string) => (
                            <tr key={rowGroup}>
                                <td className="border p-2 font-bold text-xs">{rowGroup}</td>
                                {groupNames.map((colGroup: string) => {
                                    const status = compatibility[rowGroup]?.[colGroup] || '?';
                                    const cellClass = status === 'C' ? 'compatibility-c' : status === 'X' ? 'compatibility-x' : 'bg-gray-100';
                                    return (
                                        <td
                                            key={colGroup}
                                            className={`border p-2 text-center font-mono cursor-pointer ${cellClass}`}
                                            onClick={() => handleCellClick(rowGroup, colGroup)}
                                        >
                                            {status}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TankSelector: React.FC<{ selectedTanks: string[]; onChange: (tanks: string[]) => void }> = ({ selectedTanks, onChange }) => {
    const context = useContext(AppContext);
    if (!context) return null;
    const { currentTerminalSettings } = context;
    const allTanks = Object.keys(currentTerminalSettings.masterTanks || {}).sort();

    const handleTankChange = (tankName: string, isChecked: boolean) => {
        if (isChecked) {
            onChange([...selectedTanks, tankName].sort());
        } else {
            onChange(selectedTanks.filter(t => t !== tankName));
        }
    };

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 bg-slate-50 border rounded-md max-h-32 overflow-y-auto">
            {allTanks.map(tank => (
                <label key={tank} className="flex items-center space-x-2 text-xs font-medium text-text-secondary cursor-pointer hover:bg-slate-100 p-1 rounded">
                    <input
                        type="checkbox"
                        checked={selectedTanks.includes(tank)}
                        onChange={e => handleTankChange(tank, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span>{tank}</span>
                </label>
            ))}
        </div>
    );
};


const CustomerMappings: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings, setSettings, selectedTerminal, currentTerminalSettings } = context;
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [formState, setFormState] = useState({ customer: '', product: '', tanks: [] as string[] });
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    
    const handleSettingChange = (key: string, value: any) => {
        setSettings(prev => {
// FIX: Added type assertion to JSON.parse for type safety.
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            (newSettings[selectedTerminal] as any)[key] = value;
            return newSettings;
        });
    };
    
    const handleEdit = (index: number) => {
        setEditingIndex(index);
        const mapping = currentTerminalSettings.customerMatrix[index];
        setFormState({ ...mapping });
    };

    const handleCancel = () => {
        setEditingIndex(null);
        setFormState({ customer: '', product: '', tanks: [] });
    };

    const handleSave = () => {
        if (editingIndex === null) return;
        const updatedMapping = { customer: formState.customer, product: formState.product, tanks: formState.tanks };

        const newMatrix = [...currentTerminalSettings.customerMatrix];
        newMatrix[editingIndex] = updatedMapping;
        handleSettingChange('customerMatrix', newMatrix);
        handleCancel();
    };

    const handleAdd = () => {
        if(!formState.customer || !formState.product || formState.tanks.length === 0) return alert("Customer, Product, and at least one Tank are required.");
        
        const newMapping = { customer: formState.customer, product: formState.product, tanks: formState.tanks };
        handleSettingChange('customerMatrix', [...currentTerminalSettings.customerMatrix, newMapping]);
        setFormState({ customer: '', product: '', tanks: [] });
    };

    const handleDelete = (index: number) => {
        setConfirmDelete(index);
    };

    const confirmDeletion = () => {
        if (confirmDelete !== null) {
            const newMatrix = currentTerminalSettings.customerMatrix.filter((_, i) => i !== confirmDelete);
            handleSettingChange('customerMatrix', newMatrix);
            setConfirmDelete(null);
        }
    };
    
    return (
        <>
            <ConfirmModal 
                isOpen={confirmDelete !== null}
                onClose={() => setConfirmDelete(null)}
                onConfirm={confirmDeletion}
                title="Delete Mapping"
                message="Are you sure you want to delete this mapping? This action cannot be undone."
            />
            <div className="card p-6">
                <p className="text-sm text-text-secondary mb-4">Define which products each customer can use and which specific tanks are approved for those transfers.</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left bg-slate-50">
                            <tr>
                                <th className="p-2">Customer</th><th className="p-2">Product</th><th className="p-2">Allowed Tanks</th><th className="p-2 w-32 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentTerminalSettings.customerMatrix?.map((mapping, index) => (
                                <tr key={index} className="border-b">
                                    {editingIndex === index ? (
                                        <>
                                            <td className="p-2"><select value={formState.customer} onChange={e => setFormState(f => ({...f, customer: e.target.value}))} className="!py-1 !px-2 w-full">{currentTerminalSettings.masterCustomers.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                                            <td className="p-2"><select value={formState.product} onChange={e => setFormState(f => ({...f, product: e.target.value}))} className="!py-1 !px-2 w-full">{settings.masterProducts.map(p => <option key={p} value={p}>{p}</option>)}</select></td>
                                            <td className="p-2">
                                                <TankSelector 
                                                    selectedTanks={formState.tanks} 
                                                    onChange={tanks => setFormState(f => ({ ...f, tanks }))}
                                                />
                                            </td>
                                            <td className="p-2 text-right space-x-1">
                                                <button onClick={handleSave} className="btn-icon" title="Save"><i className="fas fa-save text-xs"></i></button>
                                                <button onClick={handleCancel} className="btn-icon" title="Cancel"><i className="fas fa-times text-xs"></i></button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-2 font-medium">{mapping.customer}</td>
                                            <td className="p-2">{mapping.product}</td>
                                            <td className="p-2 text-gray-600">{mapping.tanks.join(', ')}</td>
                                            <td className="p-2 text-right space-x-1">
                                                <button onClick={() => handleEdit(index)} className="btn-icon" title="Edit"><i className="fas fa-pen text-xs"></i></button>
                                                <button onClick={() => handleDelete(index)} className="btn-icon danger" title="Delete"><i className="fas fa-trash text-xs"></i></button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {/* Add New Row */}
                            <tr className="bg-slate-50">
                                <td className="p-2"><select value={formState.customer} onChange={e => setFormState(f => ({...f, customer: e.target.value, product: '', tanks: []}))} className="!py-1 !px-2 w-full"><option value="">Select Customer</option>{currentTerminalSettings.masterCustomers.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                                <td className="p-2"><select value={formState.product} onChange={e => setFormState(f => ({...f, product: e.target.value}))} className="!py-1 !px-2 w-full" disabled={!formState.customer}><option value="">Select Product</option>{settings.masterProducts.map(p => <option key={p} value={p}>{p}</option>)}</select></td>
                                <td className="p-2">
                                    <TankSelector 
                                        selectedTanks={formState.tanks} 
                                        onChange={tanks => setFormState(f => ({ ...f, tanks }))}
                                    />
                                </td>
                                <td className="p-2 text-right"><button onClick={handleAdd} disabled={editingIndex !== null} className="btn-primary !py-1 !px-2">Add</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

const InfrastructureMappings: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings, setSettings, selectedTerminal, currentTerminalSettings } = context;

    const allInfrastructure = useMemo(() => {
        const infra = new Set([
            ...Object.keys(currentTerminalSettings.docklines || {}),
            ...Object.keys(currentTerminalSettings.assetHolds || {})
        ]);
        return Array.from(infra).sort();
    }, [currentTerminalSettings]);

    const handleMappingChange = (infraId: string, tanks: string[]) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            if (!newSettings[selectedTerminal].infrastructureTankMapping) {
                newSettings[selectedTerminal].infrastructureTankMapping = {};
            }
            newSettings[selectedTerminal].infrastructureTankMapping[infraId] = tanks;
            return newSettings;
        });
    };

    return (
        <div className="card p-6">
            <p className="text-sm text-text-secondary mb-4">Define which tanks are physically connected to each piece of infrastructure.</p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-left bg-slate-50">
                        <tr>
                            <th className="p-2 w-1/4">Infrastructure</th>
                            <th className="p-2">Connected Tanks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allInfrastructure.map(infraId => (
                            <tr key={infraId} className="border-b">
                                <td className="p-2 font-medium">{infraId}</td>
                                <td className="p-2">
                                    <TankSelector
                                        selectedTanks={currentTerminalSettings.infrastructureTankMapping?.[infraId] || []}
                                        onChange={(tanks) => handleMappingChange(infraId, tanks)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const InfrastructureModalityMappings: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings, setSettings, selectedTerminal, currentTerminalSettings } = context;

    const allInfrastructure = useMemo(() => {
        const infra = new Set([
            ...Object.keys(currentTerminalSettings.docklines || {}),
            ...Object.keys(currentTerminalSettings.assetHolds || {}),
            ...Object.keys(currentTerminalSettings.infrastructureTankMapping || {}),
            ...Object.keys(currentTerminalSettings.infrastructureModalityMapping || {})
        ]);
        return Array.from(infra).sort();
    }, [currentTerminalSettings]);

    const handleMappingChange = (infraId: string, modality: Modality) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            if (!newSettings[selectedTerminal].infrastructureModalityMapping) {
                newSettings[selectedTerminal].infrastructureModalityMapping = {};
            }
            newSettings[selectedTerminal].infrastructureModalityMapping[infraId] = modality;
            return newSettings;
        });
    };

    return (
        <div className="card p-6">
            <p className="text-sm text-text-secondary mb-4">Assign a modality to each piece of infrastructure to enable filtering on the planning board.</p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-left bg-slate-50">
                        <tr>
                            <th className="p-2 w-1/4">Infrastructure</th>
                            <th className="p-2">Assigned Modality</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allInfrastructure.map(infraId => (
                            <tr key={infraId} className="border-b">
                                <td className="p-2 font-medium">{infraId}</td>
                                <td className="p-2">
                                    <select
                                        value={currentTerminalSettings.infrastructureModalityMapping?.[infraId] || ''}
                                        onChange={(e) => handleMappingChange(infraId, e.target.value as Modality)}
                                        className="!py-1 !px-2 w-48"
                                    >
                                        <option value="">Select Modality...</option>
                                        <option value="vessel">Vessel</option>
                                        <option value="truck">Truck</option>
                                        <option value="rail">Rail</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ContractRatesConfig: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings, setSettings } = context;
    const { contracts, masterProducts, specialServices } = settings;
    const { masterCustomers } = settings[context.selectedTerminal] as any;
    
    const [newRate, setNewRate] = useState({ customer: '', product: '', ratePerTonne: '' });

    const allServices = useMemo(() => {
        const serviceSet = new Set<string>();
        (Object.values(specialServices) as string[][]).forEach(sList => sList.forEach(s => serviceSet.add(s)));
        return Array.from(serviceSet).sort();
    }, [specialServices]);
    
    const handleServiceRateChange = (serviceName: string, rate: string) => {
        const newRate = parseFloat(rate);
        if (isNaN(newRate)) return;
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            newSettings.contracts.serviceRates[serviceName] = newRate;
            return newSettings;
        });
    };

    const handleCustomerRateChange = (customer: string, product: string, rate: string) => {
        const newRate = parseFloat(rate);
        if (isNaN(newRate)) return;
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            newSettings.contracts.customerRates[customer][product].ratePerTonne = newRate;
            return newSettings;
        });
    };
    
    const handleAddNewRate = () => {
        if (!newRate.customer || !newRate.product || !newRate.ratePerTonne) {
            alert('Please select a customer, product, and enter a rate.');
            return;
        }
        const rate = parseFloat(newRate.ratePerTonne);
        if(isNaN(rate)) {
            alert('Please enter a valid number for the rate.');
            return;
        }

        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            if (!newSettings.contracts.customerRates[newRate.customer]) {
                newSettings.contracts.customerRates[newRate.customer] = {};
            }
            newSettings.contracts.customerRates[newRate.customer][newRate.product] = { ratePerTonne: rate };
            return newSettings;
        });
        setNewRate({ customer: '', product: '', ratePerTonne: '' });
    };

    const handleDeleteRate = (customer: string, product: string) => {
         setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            delete newSettings.contracts.customerRates[customer][product];
            if (Object.keys(newSettings.contracts.customerRates[customer]).length === 0) {
                delete newSettings.contracts.customerRates[customer];
            }
            return newSettings;
        });
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 card p-6">
                <h3 className="text-lg font-semibold mb-4">Service Rates</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {allServices.map(service => (
                        <div key={service} className="flex items-center justify-between gap-2">
                            <label className="text-sm flex-1">{service}</label>
                            <div className="flex items-center">
                               <span className="mr-1 text-sm">$</span>
                                <input 
                                    type="number" 
                                    value={contracts.serviceRates[service] || '0'} 
                                    onChange={e => handleServiceRateChange(service, e.target.value)}
                                    className="w-24 text-right !py-1"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-2 card p-6">
                <h3 className="text-lg font-semibold mb-4">Customer Throughput Rates ($ per Tonne)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left bg-slate-50">
                            <tr>
                                <th className="p-2">Customer</th><th className="p-2">Product</th><th className="p-2">Rate/Tonne</th><th className="p-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(contracts.customerRates).flatMap(([customer, productRates]) => 
                                Object.entries(productRates).map(([product, rates]) => (
                                    <tr key={`${customer}-${product}`} className="border-b">
                                        <td className="p-2 font-medium">{customer}</td>
                                        <td className="p-2">{product}</td>
                                        <td className="p-2">
                                            <input 
                                                type="number" 
                                                value={rates.ratePerTonne} 
                                                onChange={e => handleCustomerRateChange(customer, product, e.target.value)}
                                                className="w-24 !py-1 text-right"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <button onClick={() => handleDeleteRate(customer, product)} className="btn-icon danger" title="Delete Rate"><i className="fas fa-trash text-xs"></i></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            <tr className="bg-slate-50">
                                <td className="p-2">
                                    <select value={newRate.customer} onChange={e => setNewRate(s => ({...s, customer: e.target.value, product: ''}))} className="w-full !py-1">
                                        <option value="">Select Customer...</option>
                                        {masterCustomers.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </td>
                                <td className="p-2">
                                     <select value={newRate.product} onChange={e => setNewRate(s => ({...s, product: e.target.value}))} className="w-full !py-1" disabled={!newRate.customer}>
                                        <option value="">Select Product...</option>
                                        {masterProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </td>
                                <td className="p-2">
                                    <input type="number" value={newRate.ratePerTonne} onChange={e => setNewRate(s => ({...s, ratePerTonne: e.target.value}))} className="w-24 !py-1" placeholder="0.00"/>
                                </td>
                                <td className="p-2">
                                    <button onClick={handleAddNewRate} className="btn-primary !py-1 !px-2">Add</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


const ConfigMatrix: React.FC = () => {
    const [view, setView] = useState<ConfigView>('compatibility');

    const renderView = () => {
        switch (view) {
            case 'compatibility': return <ProductCompatibility />;
            case 'mappings': return <CustomerMappings />;
            case 'infra-mappings': return <InfrastructureMappings />;
            case 'infra-modality-mappings': return <InfrastructureModalityMappings />;
            case 'contracts': return <ContractRatesConfig />;
            default: return null;
        }
    };

    return (
        <div>
            <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6">
                <div className="border-b border-border-primary">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        <button onClick={() => setView('compatibility')} className={`tab ${view === 'compatibility' ? 'active' : ''}`}>Product Group Compatibility</button>
                        <button onClick={() => setView('mappings')} className={`tab ${view === 'mappings' ? 'active' : ''}`}>Customer & Asset Mappings</button>
                        <button onClick={() => setView('infra-mappings')} className={`tab ${view === 'infra-mappings' ? 'active' : ''}`}>Infrastructure & Tank Mappings</button>
                        <button onClick={() => setView('infra-modality-mappings')} className={`tab ${view === 'infra-modality-mappings' ? 'active' : ''}`}>Infrastructure & Modality Mappings</button>
                        <button onClick={() => setView('contracts')} className={`tab ${view === 'contracts' ? 'active' : ''}`}>Contracts & Rates</button>
                    </nav>
                </div>
            </div>

            <div className="p-3 sm:p-6">
                {renderView()}
            </div>
        </div>
    );
};

// FIX: Add default export for the component.
export default ConfigMatrix;