import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { AppSettings, Modality } from '../types';
import ConfirmModal from './ConfirmModal';
import { formatInfraName, naturalSort, createDocklineToWharfMap } from '../utils/helpers';

type ConfigView = 'compatibility' | 'mappings' | 'infra-mappings' | 'infra-modality-mappings' | 'contracts';

const ProductCompatibility: React.FC = () => {
    const context = useContext(AppContext);
    const settings = context?.settings || { productGroups: {}, compatibility: {} };
    const setSettings = context?.setSettings || (() => {});
    
    const { productGroups = {}, compatibility = {} } = settings;

    const groupNames = useMemo(() => {
        return [...new Set(Object.values(productGroups))].sort();
    }, [productGroups]);
    
    if (!context) return null;

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
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [formState, setFormState] = useState({ customer: '', product: '', tanks: [] as string[] });
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    
    if (!context) return null;

    const { settings, setSettings, selectedTerminal, currentTerminalSettings } = context;
    
    const handleSettingChange = (key: string, value: any) => {
        setSettings(prev => {
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
                            <tr className="bg-slate-50">
                                <td className="p-2">
                                    <select value={formState.customer} onChange={e => setFormState(f => ({...f, customer: e.target.value, product: '', tanks: []}))} className="!py-1 !px-2 w-full">
                                        <option value="">New Customer...</option>
                                        {currentTerminalSettings.masterCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </td>
                                <td className="p-2">
                                    <select value={formState.product} onChange={e => setFormState(f => ({...f, product: e.target.value, tanks: []}))} className="!py-1 !px-2 w-full" disabled={!formState.customer}>
                                        <option value="">New Product...</option>
                                        {settings.masterProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </td>
                                <td className="p-2">
                                    <TankSelector 
                                        selectedTanks={formState.tanks} 
                                        onChange={tanks => setFormState(f => ({ ...f, tanks }))}
                                    />
                                </td>
                                <td className="p-2 text-right">
                                    <button onClick={handleAdd} className="btn-primary !py-1 !px-2 text-xs">Add</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

const InfraTankMappings: React.FC = () => {
    const context = useContext(AppContext);
    const [editingInfra, setEditingInfra] = useState<string | null>(null);
    const [selectedTanks, setSelectedTanks] = useState<string[]>([]);
    
    if (!context) return null;

    const { settings, setSettings, selectedTerminal, currentTerminalSettings } = context;
    
    const infraMapping = currentTerminalSettings.infrastructureTankMapping || {};
    const docklineToWharfMap = createDocklineToWharfMap(currentTerminalSettings);
    const allInfrastructure = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {}).sort(naturalSort);

    const handleEdit = (infraId: string) => {
        setEditingInfra(infraId);
        setSelectedTanks(infraMapping[infraId] || []);
    };

    const handleCancel = () => {
        setEditingInfra(null);
        setSelectedTanks([]);
    };

    const handleSave = () => {
        if (!editingInfra) return;
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            newSettings[selectedTerminal].infrastructureTankMapping[editingInfra] = selectedTanks;
            return newSettings;
        });
        handleCancel();
    };

    return (
        <div className="card p-6">
            <p className="text-sm text-text-secondary mb-4">Map which tanks are physically connected to each piece of infrastructure.</p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-left bg-slate-50">
                        <tr>
                            <th className="p-2">Infrastructure</th>
                            <th className="p-2">Connected Tanks</th>
                            <th className="p-2 w-32 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allInfrastructure.map(infraId => {
                            const wharf = docklineToWharfMap[infraId];
                            const displayName = wharf ? `${wharf} - ${formatInfraName(infraId)}` : formatInfraName(infraId);
                            return (
                                <tr key={infraId} className="border-b">
                                    <td className="p-2 font-medium">{displayName}</td>
                                    {editingInfra === infraId ? (
                                        <>
                                            <td className="p-2">
                                                <TankSelector selectedTanks={selectedTanks} onChange={setSelectedTanks} />
                                            </td>
                                            <td className="p-2 text-right space-x-1">
                                                <button onClick={handleSave} className="btn-icon" title="Save"><i className="fas fa-save text-xs"></i></button>
                                                <button onClick={handleCancel} className="btn-icon" title="Cancel"><i className="fas fa-times text-xs"></i></button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-2 text-gray-600">{(infraMapping[infraId] || []).join(', ')}</td>
                                            <td className="p-2 text-right">
                                                <button onClick={() => handleEdit(infraId)} className="btn-icon" title="Edit"><i className="fas fa-pen text-xs"></i></button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const InfraModalityMappings: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings, setSettings, selectedTerminal, currentTerminalSettings } = context;

    const modalityMapping = currentTerminalSettings.infrastructureModalityMapping || {};
    const docklineToWharfMap = createDocklineToWharfMap(currentTerminalSettings);
    const allInfrastructure = Object.keys(modalityMapping).sort(naturalSort);

    const handleModalityChange = (infraId: string, modality: Modality) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            newSettings[selectedTerminal].infrastructureModalityMapping[infraId] = modality;
            return newSettings;
        });
    };

    return (
        <div className="card p-6">
            <p className="text-sm text-text-secondary mb-4">Assign a modality (Vessel, Truck, or Rail) to each piece of infrastructure.</p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-left bg-slate-50">
                        <tr>
                            <th className="p-2">Infrastructure</th>
                            <th className="p-2">Modality</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allInfrastructure.map(infraId => {
                             const wharf = docklineToWharfMap[infraId];
                             const displayName = wharf ? `${wharf} - ${formatInfraName(infraId)}` : formatInfraName(infraId);
                             return (
                                <tr key={infraId} className="border-b">
                                    <td className="p-2 font-medium">{displayName}</td>
                                    <td className="p-2">
                                        <select 
                                            value={modalityMapping[infraId] || ''} 
                                            onChange={e => handleModalityChange(infraId, e.target.value as Modality)}
                                            className="!py-1 !px-2 w-40"
                                        >
                                            <option value="">Select...</option>
                                            <option value="vessel">Vessel</option>
                                            <option value="truck">Truck</option>
                                            <option value="rail">Rail</option>
                                        </select>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ContractRatesConfig: React.FC = () => {
    const context = useContext(AppContext);
    // Safe defaults
    const settings = context?.settings || { contracts: { serviceRates: {}, customerRates: {} }, vesselServices: [], productServices: [], modalityServices: {} as any, masterProducts: [] };
    const currentTerminalSettings = context?.currentTerminalSettings || { masterCustomers: [], customerMatrix: [] };
    const setSettings = context?.setSettings || (() => {});

    const [localContracts, setLocalContracts] = useState(settings.contracts);
    
    const allServices = useMemo(() => {
        const services = new Set<string>();
        (settings.vesselServices || []).forEach(s => services.add(s));
        (settings.productServices || []).forEach(s => services.add(s));
        // FIX: Add array check to prevent crash if modalityServices is not as expected.
        Object.values(settings.modalityServices || {}).forEach(modalityServices => {
            if (Array.isArray(modalityServices)) {
                modalityServices.forEach(s => services.add(s));
            }
        });
        return Array.from(services).sort();
    }, [settings.vesselServices, settings.productServices, settings.modalityServices]);

    if (!context) return null;

    const handleServiceRateChange = (serviceName: string, rate: string) => {
        const numRate = parseFloat(rate);
        setLocalContracts(prev => ({
            ...prev,
            serviceRates: {
                ...prev.serviceRates,
                [serviceName]: isNaN(numRate) ? 0 : numRate
            }
        }));
    };
    
    const handleCustomerRateChange = (customer: string, product: string, rate: string) => {
        const numRate = parseFloat(rate);
        setLocalContracts(prev => {
            const newCustomerRates = JSON.parse(JSON.stringify(prev.customerRates));
            if (!newCustomerRates[customer]) {
                newCustomerRates[customer] = {};
            }
            newCustomerRates[customer][product] = { ratePerTonne: isNaN(numRate) ? 0 : numRate };
            return { ...prev, customerRates: newCustomerRates };
        });
    };
    
    const handleSaveChanges = () => {
        setSettings(prev => ({
            ...prev,
            contracts: localContracts
        }));
        alert('Contract rates saved!');
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={handleSaveChanges} className="btn-primary">Save All Contract Rates</button>
            </div>

            <div className="card p-6">
                <h3 className="text-xl font-semibold text-text-primary mb-4">Service Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    {allServices.map(service => (
                        <div key={service}>
                            <label htmlFor={`service-${service}`}>{service}</label>
                            <div className="flex items-center">
                                <span className="p-2 bg-slate-200 border border-r-0 border-slate-300 rounded-l-md">$</span>
                                <input
                                    id={`service-${service}`}
                                    type="number"
                                    value={localContracts.serviceRates[service] || ''}
                                    onChange={e => handleServiceRateChange(service, e.target.value)}
                                    className="!rounded-l-none"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card p-6">
                <h3 className="text-xl font-semibold text-text-primary mb-4">Customer Product Rates (per Tonne)</h3>
                <div className="space-y-6">
                    {(currentTerminalSettings.masterCustomers || []).map(customer => (
                        <div key={customer} className="p-4 border rounded-lg bg-slate-50">
                            <h4 className="font-bold text-lg mb-3">{customer}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                {(settings.masterProducts || []).map(product => {
                                    const hasRate = settings.contracts?.customerRates?.[customer]?.[product] !== undefined;
                                    const rate = localContracts.customerRates?.[customer]?.[product]?.ratePerTonne || '';
                                    
                                    const customerUsesProduct = currentTerminalSettings.customerMatrix.some(m => m.customer === customer && m.product === product);
                                    if (!customerUsesProduct && !hasRate) return null;

                                    return (
                                    <div key={product}>
                                        <label htmlFor={`rate-${customer}-${product}`}>{product}</label>
                                        <div className="flex items-center">
                                            <span className="p-2 bg-slate-200 border border-r-0 border-slate-300 rounded-l-md">$</span>
                                            <input
                                                id={`rate-${customer}-${product}`}
                                                type="number"
                                                value={rate}
                                                onChange={e => handleCustomerRateChange(customer, product, e.target.value)}
                                                className="!rounded-l-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ConfigMatrix: React.FC = () => {
    const [view, setView] = useState<ConfigView>('compatibility');

    const renderView = () => {
        switch (view) {
            case 'compatibility':
                return <ProductCompatibility />;
            case 'mappings':
                return <CustomerMappings />;
            case 'infra-mappings':
                return <InfraTankMappings />;
            case 'infra-modality-mappings':
                return <InfraModalityMappings />;
            case 'contracts':
                return <ContractRatesConfig />;
            default:
                return (
                    <div className="card p-6 text-center">
                        <h3 className="text-lg font-semibold">View Not Implemented</h3>
                        <p className="text-text-secondary">This configuration section is not yet available.</p>
                    </div>
                );
        }
    };

    return (
        <div>
            <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6">
                <div className="border-b border-border-primary">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setView('compatibility')} className={`tab ${view === 'compatibility' ? 'active' : ''}`}>Product Compatibility</button>
                        <button onClick={() => setView('mappings')} className={`tab ${view === 'mappings' ? 'active' : ''}`}>Customer Mappings</button>
                        <button onClick={() => setView('infra-mappings')} className={`tab ${view === 'infra-mappings' ? 'active' : ''}`}>Infra-Tank Mappings</button>
                        <button onClick={() => setView('infra-modality-mappings')} className={`tab ${view === 'infra-modality-mappings' ? 'active' : ''}`}>Infra-Modality Mappings</button>
                        <button onClick={() => setView('contracts')} className={`tab ${view === 'contracts' ? 'active' : ''}`}>Contracts</button>
                    </nav>
                </div>
            </div>
            <div className="p-3 sm:p-6">
                {renderView()}
            </div>
        </div>
    );
};

export default ConfigMatrix;