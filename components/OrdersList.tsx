
import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation } from '../types';
import { formatDateTime, getIcon, validateOperationPlan, formatNumber } from '../utils/helpers';
import CancelModal from './CancelModal';

const OrdersList: React.FC = () => {
    const { 
        operations, selectedTerminal, workspaceFilter, workspaceSearchTerm, 
        switchView, currentUser, settings, currentTerminalSettings, holds, 
        cancelOperation, planningCustomerFilter, setPlanningCustomerFilter 
    } = useContext(AppContext)!;
    
    const [opToCancel, setOpToCancel] = useState<Operation | null>(null);
    const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false);
    const customerFilterRef = useRef<HTMLDivElement>(null);

    const masterCustomers = useMemo(() => (currentTerminalSettings.masterCustomers || []).sort(), [currentTerminalSettings.masterCustomers]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isCustomerFilterOpen && customerFilterRef.current && !customerFilterRef.current.contains(e.target as Node)) {
                setIsCustomerFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCustomerFilterOpen]);

    const handleCustomerFilterChange = (customerName: string) => {
        setPlanningCustomerFilter(prev => {
            if (customerName === 'All') {
                return prev.includes('All') ? [] : ['All'];
            }
    
            let currentSelection = prev.includes('All') ? [] : prev;
            let newSelection = new Set(currentSelection);
    
            if (newSelection.has(customerName)) {
                newSelection.delete(customerName);
            } else {
                newSelection.add(customerName);
            }
            
            const finalSelection = Array.from(newSelection);
    
            if (masterCustomers.length > 0 && finalSelection.length === masterCustomers.length) {
                return ['All'];
            }
            
            return finalSelection.sort();
        });
    };

    const filteredOrders = useMemo(() => {
        return operations.filter(op => {
            // Filter by Terminal
            if (op.terminal !== selectedTerminal) return false;
            // Filter by Status (Non-finalized = Planned)
            if (op.status !== 'planned') return false;
            // Filter by Modality
            if (workspaceFilter !== 'all' && op.modality !== workspaceFilter) return false;
            
            // Filter by Customer
            if (!planningCustomerFilter.includes('All')) {
                const hasMatchingCustomer = op.transferPlan.some(line => 
                    line.transfers.some(t => t.customer && planningCustomerFilter.includes(t.customer))
                );
                if (!hasMatchingCustomer) return false;
            }

            // Search
            if (workspaceSearchTerm) {
                const term = workspaceSearchTerm.toLowerCase();
                const firstTransfer = op.transferPlan[0]?.transfers[0];
                return (
                    op.transportId.toLowerCase().includes(term) ||
                    op.orderNumber?.toLowerCase().includes(term) ||
                    firstTransfer?.customer.toLowerCase().includes(term) ||
                    firstTransfer?.product.toLowerCase().includes(term)
                );
            }
            return true;
        }).sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
    }, [operations, selectedTerminal, workspaceFilter, workspaceSearchTerm, planningCustomerFilter]);

    const activeHolds = useMemo(() => holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed'), [holds]);

    return (
        <div className="p-6">
            {/* Cancel Modal */}
            {opToCancel && (
                <CancelModal
                    isOpen={!!opToCancel}
                    onClose={() => setOpToCancel(null)}
                    onConfirm={(reason) => { cancelOperation(opToCancel.id, reason); setOpToCancel(null); }}
                    operation={opToCancel}
                />
            )}

            {/* Filter Bar */}
            <div className="flex justify-end mb-4">
                <div ref={customerFilterRef} className="relative">
                    <button onClick={() => setIsCustomerFilterOpen(prev => !prev)} className="btn-secondary !py-2">
                        <i className="fas fa-user-friends mr-2"></i>
                        Customers ({planningCustomerFilter.includes('All') ? 'All' : planningCustomerFilter.length})
                    </button>
                    {isCustomerFilterOpen && (
                        <div className="absolute top-full right-0 mt-2 w-60 bg-white border rounded-lg shadow-xl z-30 p-3">
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                <label className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer font-semibold">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                        checked={planningCustomerFilter.includes('All')}
                                        onChange={() => handleCustomerFilterChange('All')}
                                    />
                                    <span>All Customers</span>
                                </label>
                                <hr/>
                                {masterCustomers.map(name => (
                                    <label key={name} className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                            checked={planningCustomerFilter.includes('All') || planningCustomerFilter.includes(name)}
                                            onChange={() => handleCustomerFilterChange(name)}
                                        />
                                        <span className="text-sm">{name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                        <tr>
                            <th className="p-4 w-12"></th>
                            <th className="p-4">Order #</th>
                            <th className="p-4">Customer</th>
                            <th className="p-4">Transport</th>
                            <th className="p-4">Product / Qty</th>
                            <th className="p-4">ETA</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map(op => {
                            const validation = validateOperationPlan(op, currentTerminalSettings, settings, activeHolds);
                            const firstTransfer = op.transferPlan[0]?.transfers[0];
                            const totalQty = op.transferPlan.reduce((acc, line) => acc + line.transfers.reduce((sum, t) => sum + t.tonnes, 0), 0);
                            const productSummary = firstTransfer ? `${firstTransfer.product} (${op.transferPlan.flatMap(l => l.transfers).length > 1 ? 'Multi' : ''})` : 'No Product';

                            return (
                                <tr key={op.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => switchView('operation-plan', op.id)}>
                                    <td className="p-4 text-center text-slate-400">
                                        <i className={`fas ${getIcon(op.modality)} text-lg`}></i>
                                    </td>
                                    <td className="p-4 font-medium text-brand-dark">
                                        {op.orderNumber || 'N/A'}
                                    </td>
                                    <td className="p-4 text-slate-600">
                                        {firstTransfer?.customer || '-'}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-semibold">{op.transportId}</div>
                                        {op.licensePlate && <div className="text-xs text-slate-500 font-mono">{op.licensePlate}</div>}
                                    </td>
                                    <td className="p-4">
                                        <div>{productSummary}</div>
                                        <div className="text-xs text-slate-500">{formatNumber(totalQty)} T</div>
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        {formatDateTime(op.eta)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                                {op.currentStatus}
                                            </span>
                                            {!validation.isValid && (
                                                <i className="fas fa-exclamation-triangle text-yellow-500" title={validation.issues.join('\n')}></i>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => switchView('operation-plan', op.id)} className="btn-icon text-slate-500 hover:text-brand-primary" title="Edit Plan">
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button onClick={() => setOpToCancel(op)} className="btn-icon text-slate-500 hover:text-red-600" title="Cancel Order">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredOrders.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-500">
                                    No planned orders found matching current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrdersList;
