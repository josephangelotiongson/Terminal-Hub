import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { AppSettings, Modality, TerminalSettings, CalibrationPoint } from '../types';
import InputModal from './InputModal'; // Import the new component
import ConfirmModal from './ConfirmModal';
import { formatInfraName, naturalSort, createDocklineToWharfMap } from '../utils/helpers';
import CalibrationModal from './CalibrationModal';

// Reusable component for list-based master data management
const ListDataManager: React.FC<{
    title: string;
    items: string[];
    onAdd: (item: string) => void;
    onDelete: (item: string) => void;
    noun: string;
}> = ({ title, items, onAdd, onDelete, noun }) => {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim()) {
            onAdd(newItem.trim());
            setNewItem('');
        }
    };

    return (
        <div className="card h-full flex flex-col p-6">
            <h3 className="text-xl font-semibold text-text-primary mb-2">{title}</h3>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    placeholder={`New ${noun}...`}
                    className="flex-grow"
                />
                <button onClick={handleAdd} className="btn-primary">Add</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto p-1 flex-grow border-t pt-4">
                {items.map(item => (
                    <div key={item} className="p-2 rounded-md flex justify-between items-center hover:bg-gray-50">
                        <span className="text-base font-medium">{item}</span>
                        <button onClick={() => onDelete(item)} className="btn-icon danger" title={`Delete ${item}`}>
                            <i className="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ServicesManager: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings, setSettings } = context;

    const handleAddService = (category: 'vesselServices' | 'productServices' | `modalityServices.${Modality}`, service: string) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            if (category.startsWith('modalityServices')) {
                const modality = category.split('.')[1] as Modality;
                if (!newSettings.modalityServices[modality]) {
                    newSettings.modalityServices[modality] = [];
                }
                newSettings.modalityServices[modality].push(service);
                newSettings.modalityServices[modality].sort();
            } else {
                if (!newSettings[category]) {
                    newSettings[category] = [];
                }
                (newSettings[category] as string[]).push(service);
                (newSettings[category] as string[]).sort();
            }
            return newSettings;
        });
    };

    const handleDeleteService = (category: 'vesselServices' | 'productServices' | `modalityServices.${Modality}`, service: string) => {
         setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            if (category.startsWith('modalityServices')) {
                const modality = category.split('.')[1] as Modality;
                newSettings.modalityServices[modality] = newSettings.modalityServices[modality].filter((s: string) => s !== service);
            } else {
                (newSettings[category] as string[]) = (newSettings[category] as string[]).filter((s: string) => s !== service);
            }
            return newSettings;
        });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ListDataManager
                title="Vessel Services"
                items={settings.vesselServices || []}
                onAdd={(service) => handleAddService('vesselServices', service)}
                onDelete={(service) => handleDeleteService('vesselServices', service)}
                noun="Vessel Service"
            />
            <ListDataManager
                title="Product Services"
                items={settings.productServices || []}
                onAdd={(service) => handleAddService('productServices', service)}
                onDelete={(service) => handleDeleteService('productServices', service)}
                noun="Product Service"
            />
             <div className="card h-full flex flex-col p-6 space-y-4">
                 <ListDataManager
                    title="Truck Services"
                    items={settings.modalityServices?.truck || []}
                    onAdd={(service) => handleAddService('modalityServices.truck', service)}
                    onDelete={(service) => handleDeleteService('modalityServices.truck', service)}
                    noun="Truck Service"
                />
                 <ListDataManager
                    title="Rail Services"
                    items={settings.modalityServices?.rail || []}
                    onAdd={(service) => handleAddService('modalityServices.rail', service)}
                    onDelete={(service) => handleDeleteService('modalityServices.rail', service)}
                    noun="Rail Service"
                />
                 <ListDataManager
                    title="Vessel Transfer Services"
                    items={settings.modalityServices?.vessel || []}
                    onAdd={(service) => handleAddService('modalityServices.vessel', service)}
                    onDelete={(service) => handleDeleteService('modalityServices.vessel', service)}
                    noun="Transfer Service"
                />
            </div>
        </div>
    );
};

type MasterDataView = 'products' | 'customers' | 'tanks' | 'infrastructure' | 'services';

const MasterData: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading...</div>;

    const { settings, setSettings, selectedTerminal, currentTerminalSettings, currentUser, operations } = context;
    const [activeView, setActiveView] = useState<MasterDataView>('products');
    
    // Edit States
    const [editingCustomer, setEditingCustomer] = useState<{ oldName: string, newName: string } | null>(null);
    const [editingTank, setEditingTank] = useState<{ name: string, capacity: string } | null>(null);
    const [editingInfra, setEditingInfra] = useState<{ id: string, lastProduct: string } | null>(null);
    const [editingCalibration, setEditingCalibration] = useState<string | null>(null);


    // New Entry States
    const [newProductName, setNewProductName] = useState('');
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newTankName, setNewTankName] = useState('');
    const [newTankCapacity, setNewTankCapacity] = useState('');
    const [newInfraId, setNewInfraId] = useState('');
    const [newInfraModality, setNewInfraModality] = useState<Modality | ''>('');
    
    // Modal states
    const [holdReasonModal, setHoldReasonModal] = useState<{ isOpen: boolean; tankName: string | null }>({ isOpen: false, tankName: null });
    const [deletingInfraId, setDeletingInfraId] = useState<string | null>(null);
    const [newGroupForProduct, setNewGroupForProduct] = useState<string | null>(null);
    const [deletingTankName, setDeletingTankName] = useState<string | null>(null);


    const { allInfrastructure, docklineToWharfMap } = useMemo(() => {
        const infra = new Set([
            ...Object.keys(currentTerminalSettings.docklines || {}),
            ...Object.keys(currentTerminalSettings.assetHolds || {}),
            ...Object.keys(currentTerminalSettings.infrastructureTankMapping || {}),
            ...Object.keys(currentTerminalSettings.infrastructureModalityMapping || {})
        ]);
        const dtlwMap = createDocklineToWharfMap(currentTerminalSettings);
        return { 
            allInfrastructure: Array.from(infra).sort(naturalSort),
            docklineToWharfMap: dtlwMap,
        };
    }, [currentTerminalSettings]);


    const handleSettingChange = (key: keyof TerminalSettings, value: any) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            (newSettings[selectedTerminal] as any)[key] = value;
            return newSettings;
        });
    };
    
    // --- Products ---
    const handleAddProduct = (product: string) => setSettings(p => ({ ...p, masterProducts: [...p.masterProducts, product] }));
    const handleDeleteProduct = (product: string) => setSettings(p => ({ ...p, masterProducts: p.masterProducts.filter(i => i !== product) }));
    const handleProductGroupChange = (product: string, group: string) => setSettings(p => ({ ...p, productGroups: { ...p.productGroups, [product]: group } }));
    
    // --- Customers ---
    const handleAddCustomer = (customer: string) => handleSettingChange('masterCustomers', [...currentTerminalSettings.masterCustomers, customer]);
    const handleDeleteCustomer = (customer: string) => handleSettingChange('masterCustomers', currentTerminalSettings.masterCustomers.filter(c => c !== customer));
    const handleSaveCustomer = () => {
        if (!editingCustomer) return;
        const newCustomers = currentTerminalSettings.masterCustomers.map(c => c === editingCustomer.oldName ? editingCustomer.newName : c);
        handleSettingChange('masterCustomers', newCustomers);
        setEditingCustomer(null);
    };

    // --- Tanks ---
    const handleSaveTank = () => {
         if (!editingTank) return;
         setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            newSettings[selectedTerminal].masterTanks[editingTank.name].capacity = parseInt(editingTank.capacity) || 0;
            return newSettings;
        });
        setEditingTank(null);
    };

    const handleAddTank = () => {
        const capacity = parseInt(newTankCapacity);
        if (!newTankName || !capacity) return alert('Tank Name and a valid Capacity are required.');
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            newSettings[selectedTerminal].masterTanks[newTankName] = { capacity, current: 0, calibrationData: [] };
            return newSettings;
        });
        setNewTankName('');
        setNewTankCapacity('');
    };
    
    const toggleTankHold = (tankName: string) => {
        const hold = currentTerminalSettings.tankHolds?.[tankName];
        if (hold && hold.active) {
            setSettings(prev => {
                const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
                delete newSettings[selectedTerminal].tankHolds[tankName];
                return newSettings;
            });
        } else {
            setHoldReasonModal({ isOpen: true, tankName });
        }
    };

    const handleSaveHoldReason = (reason: string) => {
        const { tankName } = holdReasonModal;
        if (tankName) {
            setSettings(prev => {
                const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
                if (!newSettings[selectedTerminal].tankHolds) {
                    newSettings[selectedTerminal].tankHolds = {};
                }
                newSettings[selectedTerminal].tankHolds[tankName] = { active: true, reason, user: currentUser.name, time: new Date().toISOString() };
                return newSettings;
            });
        }
        setHoldReasonModal({ isOpen: false, tankName: null });
    };

    const handleSaveCalibration = (tankName: string, data: CalibrationPoint[]) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            if(newSettings[selectedTerminal].masterTanks[tankName]) {
                newSettings[selectedTerminal].masterTanks[tankName].calibrationData = data;
            }
            return newSettings;
        });
    };

    const handleDeleteTank = (tankName: string) => {
        const isInUse = operations.some(op => 
            (op.status === 'planned' || op.status === 'active') &&
            op.transferPlan.some(line => 
                line.transfers.some(t => t.from === tankName || t.to === tankName)
            )
        );
        if (isInUse) {
            alert(`Cannot delete tank "${tankName}" because it is currently in use in a planned or active operation.`);
            return;
        }
        setDeletingTankName(tankName);
    };
    
    const confirmTankDeletion = () => {
        if (!deletingTankName) return;
    
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            const terminalData = newSettings[selectedTerminal];
    
            // 1. Remove from masterTanks
            delete terminalData.masterTanks[deletingTankName];
            
            // 2. Remove from tankHolds
            if (terminalData.tankHolds) {
                delete terminalData.tankHolds[deletingTankName];
            }
    
            // 3. Remove from customerMatrix
            terminalData.customerMatrix = terminalData.customerMatrix.map((mapping: any) => ({
                ...mapping,
                tanks: mapping.tanks.filter((t: string) => t !== deletingTankName)
            }));
    
            // 4. Remove from infrastructureTankMapping
            Object.keys(terminalData.infrastructureTankMapping).forEach(infraId => {
                terminalData.infrastructureTankMapping[infraId] = terminalData.infrastructureTankMapping[infraId].filter((t: string) => t !== deletingTankName);
            });
    
            return newSettings;
        });
    
        setDeletingTankName(null);
    };

    // --- Infrastructure ---
    const handleAddInfrastructure = () => {
        const id = newInfraId.trim();
        if (!id || !newInfraModality) {
            alert('Infrastructure ID and Modality are required.');
            return;
        }
        if (allInfrastructure.includes(id)) {
            alert('Infrastructure ID already exists.');
            return;
        }

        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            const terminal = newSettings[selectedTerminal];

            terminal.infrastructureModalityMapping[id] = newInfraModality;
            terminal.infrastructureTankMapping[id] = [];
            if(!terminal.assetHolds) terminal.assetHolds = {};
            terminal.assetHolds[id] = { active: false, reason: '', user: '', time: null };

            if (newInfraModality === 'vessel') {
                if(!terminal.docklines) terminal.docklines = {};
                terminal.docklines[id] = { lastProduct: '' };
            }
            return newSettings;
        });
        setNewInfraId('');
        setNewInfraModality('');
    };

    const confirmDeleteInfra = () => {
        if (!deletingInfraId) return;

        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            const terminal = newSettings[selectedTerminal];
            delete terminal.infrastructureModalityMapping?.[deletingInfraId];
            delete terminal.infrastructureTankMapping?.[deletingInfraId];
            delete terminal.assetHolds?.[deletingInfraId];
            delete terminal.docklines?.[deletingInfraId];
            return newSettings;
        });
        setDeletingInfraId(null);
    };

    const handleUpdateLastProduct = () => {
        if (!editingInfra) return;
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            if (newSettings[selectedTerminal].docklines[editingInfra.id]) {
                newSettings[selectedTerminal].docklines[editingInfra.id].lastProduct = editingInfra.lastProduct;
            }
            return newSettings;
        });
        setEditingInfra(null);
    };


    const handleAddProductClick = () => {
        if (newProductName.trim()) {
            handleAddProduct(newProductName.trim());
            setNewProductName('');
        }
    };
    
    const handleAddCustomerClick = () => {
        if (newCustomerName.trim()) {
            handleAddCustomer(newCustomerName.trim());
            setNewCustomerName('');
        }
    };
    

    const renderContent = () => {
        switch (activeView) {
            case 'products':
                return (
                    <div className="card p-6">
                        <h3 className="text-xl font-semibold text-text-primary mb-2">Global Products & Groups</h3>
                         <div className="pt-2 pb-4 border-b mb-4">
                            <h4 className="font-semibold text-lg text-text-primary mb-2">Add New Product</h4>
                            <div className="flex gap-2">
                                <input type="text" value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="New Product Name" />
                                <button onClick={handleAddProductClick} className="btn-primary">Add Product</button>
                            </div>
                        </div>
                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto p-1">
                            {settings.masterProducts.map(product => (
                                <div key={product} className="p-2 rounded-md flex justify-between items-center hover:bg-gray-50">
                                    <span className="font-medium">{product}</span>
                                    <div className="flex items-center gap-2">
                                        <select value={settings.productGroups[product] || ''} 
                                            onChange={(e) => {
                                                if (e.target.value === 'ADD_NEW_GROUP') {
                                                    setNewGroupForProduct(product);
                                                } else {
                                                    handleProductGroupChange(product, e.target.value);
                                                }
                                            }}
                                            className="text-sm !py-1 !px-2 w-40">
                                            <option value="">Select Group</option>
                                            {[...new Set(Object.values(settings.productGroups))].sort().map((g: string) => <option key={g} value={g}>{g}</option>)}
                                            <option value="ADD_NEW_GROUP" className="italic text-blue-600 font-semibold">Add New Group...</option>
                                        </select>
                                        <button onClick={() => handleDeleteProduct(product)} className="btn-icon danger" title="Delete Product"><i className="fas fa-trash text-xs"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'customers':
                return (
                    <div className="card p-6">
                        <h3 className="text-xl font-semibold text-text-primary mb-2">Customers ({selectedTerminal})</h3>
                        <div className="pt-2 pb-4 border-b mb-4">
                            <h4 className="font-semibold text-lg text-text-primary mb-2">Add New Customer</h4>
                            <div className="flex gap-2">
                                <input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="New Customer Name" />
                                <button onClick={handleAddCustomerClick} className="btn-primary">Add Customer</button>
                            </div>
                        </div>
                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto p-1">
                            {(currentTerminalSettings.masterCustomers || []).map(customer => (
                                <div key={customer} className="p-2 rounded-md flex justify-between items-center hover:bg-gray-50">
                                    {editingCustomer?.oldName === customer ? (
                                        <input type="text" value={editingCustomer.newName} onChange={e => setEditingCustomer({...editingCustomer, newName: e.target.value})} className="!py-1 !px-2"/>
                                    ) : (
                                        <span className="font-medium">{customer}</span>
                                    )}
                                    <div className="flex items-center gap-1">
                                        {editingCustomer?.oldName === customer ? (
                                            <>
                                            <button onClick={handleSaveCustomer} className="btn-icon"><i className="fas fa-save text-xs"></i></button>
                                            <button onClick={() => setEditingCustomer(null)} className="btn-icon"><i className="fas fa-times text-xs"></i></button>
                                            </>
                                        ) : (
                                            <>
                                            <button onClick={() => setEditingCustomer({ oldName: customer, newName: customer })} className="btn-icon"><i className="fas fa-pen text-xs"></i></button>
                                            <button onClick={() => handleDeleteCustomer(customer)} className="btn-icon danger"><i className="fas fa-trash text-xs"></i></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'tanks':
                 return (
                    <>
                        {editingCalibration && (
                            <CalibrationModal
                                isOpen={!!editingCalibration}
                                onClose={() => setEditingCalibration(null)}
                                onSave={(data) => handleSaveCalibration(editingCalibration, data)}
                                tankName={editingCalibration}
                                initialData={currentTerminalSettings.masterTanks?.[editingCalibration]?.calibrationData || []}
                            />
                        )}
                        <div className="card p-6">
                             <h3 className="text-xl font-semibold text-text-primary mb-2">Tanks & Holds ({selectedTerminal})</h3>
                              <div className="pt-2 pb-4 border-b mb-4">
                                 <h4 className="font-semibold text-lg text-text-primary mb-2">Add New Tank</h4>
                                 <div className="flex gap-2">
                                     <input type="text" value={newTankName} onChange={e => setNewTankName(e.target.value)} placeholder="New Tank Name (e.g. D05)" />
                                     <input type="number" value={newTankCapacity} onChange={e => setNewTankCapacity(e.target.value)} placeholder="Capacity (Tonnes)" />
                                     <button onClick={handleAddTank} className="btn-primary">Add</button>
                                 </div>
                              </div>
                              <div className="space-y-2 max-h-[400px] overflow-y-auto p-1 mb-4">
                                {Object.entries(currentTerminalSettings.masterTanks || {}).map(([tankName, tankData]) => {
                                     const typedTankData = tankData as { capacity: number; current: number };
                                     const hold = currentTerminalSettings.tankHolds?.[tankName];
                                     return (
                                        <div key={tankName} className={`p-3 rounded-md flex justify-between items-center ${hold?.active ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                                            <div>
                                                <p className={`font-bold text-base ${hold?.active ? 'text-red-800' : 'text-gray-800'}`}>{tankName}</p>
                                                {editingTank?.name === tankName ? (
                                                    <input type="number" value={editingTank.capacity} onChange={e => setEditingTank(editingTank ? {...editingTank, capacity: e.target.value } : null)} className="!py-1 !px-2 w-32 mt-1" />
                                                ) : (
                                                    <p className="text-sm text-gray-500">{typedTankData.capacity.toLocaleString()} T Capacity</p>
                                                )}
                                                {hold?.active && <p className="text-sm font-semibold text-red-600">ON HOLD: {hold.reason}</p>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {editingTank?.name === tankName ? (
                                                    <>
                                                    <button onClick={handleSaveTank} className="btn-icon" title="Save"><i className="fas fa-save text-xs"></i></button>
                                                    <button onClick={() => setEditingTank(null)} className="btn-icon" title="Cancel"><i className="fas fa-times text-xs"></i></button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => setEditingTank({ name: tankName, capacity: String(typedTankData.capacity) })} className="btn-icon" title="Edit Capacity"><i className="fas fa-pen text-xs"></i></button>
                                                )}
                                                <button onClick={() => setEditingCalibration(tankName)} className="btn-secondary !text-xs !py-1 !px-2">Calibrate</button>
                                                <button onClick={() => toggleTankHold(tankName)} className={`!py-2 !px-4 text-sm ${hold?.active ? 'btn-danger' : 'btn-secondary'}`}>
                                                    {hold?.active ? 'Remove Hold' : 'Place Hold'}
                                                </button>
                                                <button onClick={() => handleDeleteTank(tankName)} className="btn-icon danger" title="Delete Tank"><i className="fas fa-trash text-xs"></i></button>
                                            </div>
                                        </div>
                                    )
                                })}
                              </div>
                        </div>
                    </>
                );
            case 'infrastructure':
                return (
                    <>
                        <ConfirmModal
                            isOpen={!!deletingInfraId}
                            onClose={() => setDeletingInfraId(null)}
                            onConfirm={confirmDeleteInfra}
                            title="Delete Infrastructure"
                            message={`Are you sure you want to delete "${deletingInfraId ? formatInfraName(deletingInfraId) : ''}"? This will remove it from all mappings and cannot be undone.`}
                        />
                        <div className="card p-6">
                             <h3 className="text-xl font-semibold text-text-primary mb-2">Infrastructure ({selectedTerminal})</h3>
                             <div className="p-4 border rounded-md bg-slate-50 mb-6">
                                <h4 className="font-semibold text-lg text-text-primary mb-2">Add New Infrastructure</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                    <input type="text" value={newInfraId} onChange={e => setNewInfraId(e.target.value)} placeholder="New ID (e.g., Bay 4)" />
                                    <select value={newInfraModality} onChange={e => setNewInfraModality(e.target.value as Modality)}>
                                        <option value="">Select Modality...</option>
                                        <option value="vessel">Vessel</option>
                                        <option value="truck">Truck</option>
                                        <option value="rail">Rail</option>
                                    </select>
                                    <button onClick={handleAddInfrastructure} className="btn-primary">Add</button>
                                </div>
                             </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-left bg-slate-50">
                                        <tr>
                                            <th className="p-2">ID</th>
                                            <th className="p-2">Modality</th>
                                            <th className="p-2">Last Product</th>
                                            <th className="p-2 w-48 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allInfrastructure.map(infraId => {
                                            const modality = currentTerminalSettings.infrastructureModalityMapping?.[infraId];
                                            const isDockline = !!currentTerminalSettings.docklines?.[infraId];
                                            const lastProduct = currentTerminalSettings.docklines?.[infraId]?.lastProduct;
                                            const isEditing = editingInfra?.id === infraId;
                                            const wharf = docklineToWharfMap[infraId];
                                            const displayName = wharf ? `${wharf} - ${formatInfraName(infraId)}` : formatInfraName(infraId);

                                            return (
                                                <tr key={infraId} className="border-b hover:bg-slate-50">
                                                    <td className="p-2 font-medium">{displayName}</td>
                                                    <td className="p-2">{modality || <span className="text-xs italic text-red-600">Not Set</span>}</td>
                                                    <td className="p-2">
                                                        {isDockline ? (
                                                            isEditing ? (
                                                                <select value={editingInfra.lastProduct} onChange={e => setEditingInfra({...editingInfra, lastProduct: e.target.value})} className="!py-1 !px-2 text-xs">
                                                                    <option value="">None</option>
                                                                    {settings.masterProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                                                </select>
                                                            ) : (
                                                                <span>{lastProduct || <span className="text-xs italic text-gray-400">Not set</span>}</span>
                                                            )
                                                        ) : <span className="text-xs text-gray-400">N/A</span>}
                                                    </td>
                                                    <td className="p-2 text-right space-x-1">
                                                        {isDockline && (
                                                            isEditing ? (
                                                                <>
                                                                    <button onClick={handleUpdateLastProduct} className="btn-icon" title="Save"><i className="fas fa-save text-xs"></i></button>
                                                                    <button onClick={() => setEditingInfra(null)} className="btn-icon" title="Cancel"><i className="fas fa-times text-xs"></i></button>
                                                                </>
                                                            ) : (
                                                                <button onClick={() => setEditingInfra({ id: infraId, lastProduct: lastProduct || '' })} className="btn-icon" title="Edit Last Product"><i className="fas fa-pen text-xs"></i></button>
                                                            )
                                                        )}
                                                        <button onClick={() => setDeletingInfraId(infraId)} className="btn-icon danger" title="Delete Infrastructure"><i className="fas fa-trash text-xs"></i></button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                );
            case 'services':
                return <ServicesManager />;
            default:
                return null;
        }
    };

    return (
        <div>
            <InputModal
                isOpen={!!newGroupForProduct}
                onClose={() => setNewGroupForProduct(null)}
                onSave={(newGroup) => {
                    if (newGroup && newGroupForProduct) {
                        handleProductGroupChange(newGroupForProduct, newGroup);
                    }
                    setNewGroupForProduct(null);
                }}
                title="Add New Product Group"
                label="New Group Name"
            />
            <ConfirmModal 
                isOpen={!!deletingTankName}
                onClose={() => setDeletingTankName(null)}
                onConfirm={confirmTankDeletion}
                title={`Delete Tank ${deletingTankName}`}
                message={`Are you sure you want to permanently delete tank "${deletingTankName}"? This will remove it from all mappings and cannot be undone.`}
            />
            <InputModal 
                isOpen={holdReasonModal.isOpen}
                onClose={() => setHoldReasonModal({ isOpen: false, tankName: null })}
                onSave={handleSaveHoldReason}
                title={`Place Hold on Tank ${holdReasonModal.tankName}`}
                label="Reason for Hold"
                initialValue="Maintenance"
            />
            <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6">
                <div className="border-b border-border-primary">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveView('products')} className={`tab ${activeView === 'products' ? 'active' : ''}`}>Products</button>
                        <button onClick={() => setActiveView('customers')} className={`tab ${activeView === 'customers' ? 'active' : ''}`}>Customers</button>
                        <button onClick={() => setActiveView('tanks')} className={`tab ${activeView === 'tanks' ? 'active' : ''}`}>Tanks</button>
                        <button onClick={() => setActiveView('infrastructure')} className={`tab ${activeView === 'infrastructure' ? 'active' : ''}`}>Infrastructure</button>
                        <button onClick={() => setActiveView('services')} className={`tab ${activeView === 'services' ? 'active' : ''}`}>Services</button>
                    </nav>
                </div>
            </div>
            
            <div className="p-3 sm:p-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default MasterData;