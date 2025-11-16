import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality } from '../types';
import CompletedOpDetailsModal from './CompletedOpDetailsModal';
import { calculateOperationValue, formatCurrency, canEditCompletedOpFinancials, calculateActualDuration, getIcon } from '../utils/helpers';
import ModalityFilter from './ModalityFilter';
import WorkspaceSearch from './WorkspaceSearch';

const EditableCell: React.FC<{
    value: string | number;
    onSave: (newValue: string | number) => void;
    type?: 'text' | 'number' | 'date';
    disabled?: boolean;
}> = ({ value, onSave, type = 'text', disabled = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    const handleSave = () => {
        setIsEditing(false);
        if (currentValue !== value) {
            onSave(currentValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSave();
        else if (e.key === 'Escape') {
            setCurrentValue(value);
            setIsEditing(false);
        }
    };
    
    const handleClick = (e: React.MouseEvent) => {
        if (disabled) return;
        e.stopPropagation();
        setIsEditing(true);
    };

    if (isEditing) {
        return (
            <input
                type={type}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-white border border-brand-primary rounded-md px-1 py-0.5"
            />
        );
    }

    const displayValue = type === 'date' && !value ? 'N/A' : value;
    const isCurrency = type === 'number' && (String(value).startsWith('$') || typeof value === 'number');

    return (
        <div onClick={handleClick} className={`group relative w-full h-full px-2 py-1 min-h-[2rem] flex items-center ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
            {isCurrency && <span className="text-gray-500 mr-1">$</span>}
            <span>{isCurrency ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : displayValue}</span>
            {!disabled && <i className="fas fa-pen absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs pointer-events-none"></i>}
        </div>
    );
};

const VesselReportTable: React.FC<{
    rows: any[];
    onViewDetails: (op: Operation) => void;
    onUpdate: (opId: string, transferId: string, field: string, value: string | number) => void;
    canEditFinancials: boolean;
}> = ({ rows, onViewDetails, onUpdate, canEditFinancials }) => {
    const headers = ["Site", "Movement Date", "Vessel Name", "Customer", "Product", "Product Note", "Ship Qty", "Shore Qty", "Gain/Loss", "Variance %", "Direction", "Alongside (Hrs)", "Discharge (Hrs)", "Pump Rate (T/hr)", "Labour Rec.", "Other Rec.", "Invoiced Amt", "Date Invoiced", "Month", "Year"];
    
    return (
        <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
                <tr>{headers.map(h => <th key={h} className="p-3 font-semibold text-slate-500 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap uppercase text-xs tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row) => (
                    <tr key={`${row.opId}-${row.transferId}`} className="hover:bg-slate-50/70 cursor-pointer transition-colors" onClick={() => onViewDetails(row.originalOp)}>
                        <td className="p-2 whitespace-nowrap">{row.site}</td>
                        <td className="p-2 whitespace-nowrap">{new Date(row.movementDate!).toLocaleDateString()}</td>
                        <td className="p-2 whitespace-nowrap font-semibold">{row.transportId}</td>
                        <td className="p-2 whitespace-nowrap">{row.customer}</td>
                        <td className="p-2 whitespace-nowrap">{row.product}</td>
                        <td className="p-0 bg-yellow-50/50"><EditableCell value={row.productNote || ''} onSave={(val) => onUpdate(row.opId, row.transferId, 'productNote', val as string)} /></td>
                        <td className="p-2 text-right whitespace-nowrap">{row.shipQuantity.toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.shoreQuantity.toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
                        <td className={`p-2 text-right whitespace-nowrap font-semibold ${row.gainLoss < 0 ? 'text-red-600' : ''}`}>{row.gainLoss.toLocaleString(undefined, {maximumFractionDigits: 3})}</td>
                        <td className={`p-2 text-right whitespace-nowrap font-semibold ${row.variance < 0 ? 'text-red-600' : ''}`}>{row.variance.toFixed(3)}%</td>
                        <td className="p-2 whitespace-nowrap">{row.direction}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.alongsideHours}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.dischargeHours.toFixed(2)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.pumpingRate.toFixed(0)}</td>
                        <td className="p-0 text-right bg-yellow-50/50"><EditableCell value={row.labourRecovery || 0} onSave={(val) => onUpdate(row.opId, row.transferId, 'labourRecovery', val)} type="number" disabled={!canEditFinancials} /></td>
                        <td className="p-0 text-right bg-yellow-50/50"><EditableCell value={row.otherRecoveries || 0} onSave={(val) => onUpdate(row.opId, row.transferId, 'otherRecoveries', val)} type="number" disabled={!canEditFinancials} /></td>
                        <td className="p-2 text-right whitespace-nowrap font-semibold text-green-700">{formatCurrency(row.invoicedAmount)}</td>
                        <td className="p-0 bg-yellow-50/50"><EditableCell value={row.dateInvoiced || ''} onSave={(val) => onUpdate(row.opId, row.transferId, 'dateInvoiced', val as string)} type="date" disabled={!canEditFinancials} /></td>
                        <td className="p-2 whitespace-nowrap">{row.month}</td>
                        <td className="p-2 whitespace-nowrap">{row.year}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const TruckReportTable: React.FC<{
    rows: any[];
    onViewDetails: (op: Operation) => void;
    onUpdate: (opId: string, transferId: string, field: string, value: string | number) => void;
    canEditFinancials: boolean;
}> = ({ rows, onViewDetails, onUpdate, canEditFinancials }) => {
    const headers = ["Site", "Completed", "Trucking Co.", "Plate", "Driver", "Customer", "Product", "Planned (T)", "Loaded (T)", "Variance", "Total Time", "Wait Time", "Service Time", "Pump Time", "Labour Rec.", "Other Rec.", "Invoiced", "Date Invoiced"];
    
    return (
        <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
                <tr>{headers.map(h => <th key={h} className="p-3 font-semibold text-slate-500 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap uppercase text-xs tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
                {rows.map((row) => (
                    <tr key={row.opId} className="hover:bg-slate-50/70 cursor-pointer transition-colors" onClick={() => onViewDetails(row.originalOp)}>
                        <td className="p-2 whitespace-nowrap">{row.site}</td>
                        <td className="p-2 whitespace-nowrap">{new Date(row.completedTime).toLocaleDateString()}</td>
                        <td className="p-2 whitespace-nowrap font-semibold">{row.transportId}</td>
                        <td className="p-2 whitespace-nowrap font-mono">{row.licensePlate}</td>
                        <td className="p-2 whitespace-nowrap">{row.driverName}</td>
                        <td className="p-2 whitespace-nowrap">{row.customer}</td>
                        <td className="p-2 whitespace-nowrap">{row.product}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.plannedTonnes.toFixed(2)}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.loadedTonnes.toFixed(2)}</td>
                        <td className={`p-2 text-right whitespace-nowrap font-semibold ${row.variance < 0 ? 'text-red-600' : ''}`}>{row.variance.toFixed(2)}%</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.totalTime}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.waitTime}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.serviceTime}</td>
                        <td className="p-2 text-right whitespace-nowrap">{row.pumpTime}</td>
                        <td className="p-0 text-right bg-yellow-50/50"><EditableCell value={row.labourRecovery || 0} onSave={(val) => onUpdate(row.opId, row.transferId, 'labourRecovery', val)} type="number" disabled={!canEditFinancials} /></td>
                        <td className="p-0 text-right bg-yellow-50/50"><EditableCell value={row.otherRecoveries || 0} onSave={(val) => onUpdate(row.opId, row.transferId, 'otherRecoveries', val)} type="number" disabled={!canEditFinancials} /></td>
                        <td className="p-2 text-right whitespace-nowrap font-semibold text-green-700">{formatCurrency(row.invoicedAmount)}</td>
                        <td className="p-0 bg-yellow-50/50"><EditableCell value={row.dateInvoiced || ''} onSave={(val) => onUpdate(row.opId, row.transferId, 'dateInvoiced', val as string)} type="date" disabled={!canEditFinancials} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const CompletedOpCard: React.FC<{ op: Operation; onViewDetails: (op: Operation) => void }> = ({ op, onViewDetails }) => {
    const plannedTonnes = useMemo(() => op.transferPlan.reduce((sum, line) => sum + line.transfers.reduce((s, t) => s + t.tonnes, 0), 0), [op.transferPlan]);
    const actualTonnes = useMemo(() => op.transferPlan.reduce((sum, line) => sum + line.transfers.reduce((s, t) => s + (t.loadedWeight || t.transferredTonnes || 0), 0), 0), [op.transferPlan]);
    const plannedDuration = op.durationHours || 0;
    const actualDuration = useMemo(() => calculateActualDuration(op), [op]);

    const firstTransfer = op.transferPlan[0]?.transfers[0];

    return (
        <div onClick={() => onViewDetails(op)} className="card p-3 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-slate-100 rounded-lg">
                <i className={`fas ${getIcon(op.modality)} text-2xl text-slate-500`}></i>
            </div>
            <div className="flex-grow grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 items-center">
                <div className="md:col-span-2">
                    <p className="font-bold text-base truncate">{op.transportId} {op.licensePlate && <span className="font-mono text-sm">({op.licensePlate})</span>}</p>
                    <p className="text-xs text-text-secondary">{op.completedTime ? new Date(op.completedTime).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                    <p className="font-semibold text-sm truncate">{firstTransfer?.customer}</p>
                    <p className="text-xs text-text-tertiary truncate">{firstTransfer?.product}</p>
                </div>
                <div className="text-sm">
                    <p className="font-semibold text-text-secondary">Volume (T)</p>
                    <p className="font-mono">{actualTonnes.toFixed(2)} / {plannedTonnes.toFixed(2)}</p>
                </div>
                <div className="text-sm">
                    <p className="font-semibold text-text-secondary">Duration (Hrs)</p>
                    <p className="font-mono">{actualDuration.toFixed(2)} / {plannedDuration.toFixed(2)}</p>
                </div>
            </div>
            <div className="flex-shrink-0">
                <i className="fas fa-chevron-right text-text-tertiary"></i>
            </div>
        </div>
    );
};

const CompletedOps: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <p>Loading...</p>;

    // FIX: Aliased 'setWorkspaceSearchTerm' to 'setSearchTerm' to match prop expected by WorkspaceSearch component.
    const { operations, selectedTerminal, workspaceFilter, setWorkspaceFilter, workspaceSearchTerm, setWorkspaceSearchTerm: setSearchTerm, settings, updateCompletedOperationDetails, currentUser, uiState, setCompletedOpsTab } = context;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOp, setSelectedOp] = useState<Operation | null>(null);
    const activeTab = uiState.completedOps?.activeTab || 'list';

    const canEditFinancials = canEditCompletedOpFinancials(currentUser);
    
    // If the global filter is 'all', default to showing 'vessel' for the report view, but don't change the global state.
    const reportFilter = workspaceFilter === 'all' ? 'vessel' : workspaceFilter;
    
    const completedOps = useMemo(() => {
        return operations.filter(op => 
            op.terminal === selectedTerminal &&
            op.status === 'completed'
        ).filter(op => {
            if (!workspaceSearchTerm) return true;
            const term = workspaceSearchTerm.toLowerCase();
            return op.transportId?.toLowerCase().includes(term) ||
                op.licensePlate?.toLowerCase().includes(term) ||
                op.driverName?.toLowerCase().includes(term) ||
                op.transferPlan.some(tp => tp.transfers.some(t => t.product?.toLowerCase().includes(term) || t.customer?.toLowerCase().includes(term)));
        }).sort((a,b) => new Date(b.completedTime!).getTime() - new Date(a.completedTime!).getTime());
    }, [operations, selectedTerminal, workspaceSearchTerm]);

    const vesselReportRows = useMemo(() => {
        // This is computationally expensive, so only run if the view is active.
        if(activeTab !== 'report' || reportFilter !== 'vessel') return [];

        const rows = completedOps.filter(op => op.modality === 'vessel').flatMap(op => {
            const opValue = calculateOperationValue(op, settings);
            let alongsideHours: string | number = 'N/A';
            if (op.modality === 'vessel') {
                const alongside = op.vesselCommonTimestamps?.vesselAlongside;
                const disconnected = op.vesselCommonTimestamps?.lastHoseDisconnected;
                alongsideHours = (alongside && disconnected) ? ((new Date(disconnected).getTime() - new Date(alongside).getTime()) / 3600000).toFixed(2) : 0;
            }

            return op.transferPlan.flatMap(line => line.transfers.map(transfer => {
                const shipQty = transfer.tonnes || 0;
                const shoreQty = transfer.transferredTonnes || 0;
                const gainLoss = shoreQty - shipQty;
                const variance = shipQty > 0 ? (gainLoss / shipQty) * 100 : 0;
                const startPump = transfer.commodityTimestamps?.startPumping;
                const stopPump = transfer.commodityTimestamps?.stopPumping;
                const dischargeHours = (startPump && stopPump) ? (new Date(stopPump).getTime() - new Date(startPump).getTime()) / 3600000 : 0;
                const pumpingRate = dischargeHours > 0 ? shoreQty / dischargeHours : 0;
                const completedDate = new Date(op.completedTime!);

                return {
                    opId: op.id, transferId: transfer.id!, site: op.terminal, movementDate: op.completedTime, transportId: op.transportId,
                    customer: transfer.customer, product: transfer.product, productNote: transfer.productNote, shipQuantity: shipQty, shoreQuantity: shoreQty,
                    gainLoss, variance, direction: transfer.direction.includes(' to Tank') ? 'Inwards' : 'Outwards', alongsideHours,
                    dischargeHours, pumpingRate, labourRecovery: op.labourRecovery, otherRecoveries: op.otherRecoveries,
                    invoicedAmount: opValue.totalValue, dateInvoiced: op.dateInvoiced,
                    month: `${String(completedDate.getMonth() + 1).padStart(2, '0')} (${completedDate.toLocaleString('default', { month: 'long' })})`,
                    year: completedDate.getFullYear(), originalOp: op 
                };
            }));
        });
        return rows;
    }, [completedOps, settings, activeTab, reportFilter]);

    const truckReportRows = useMemo(() => {
        // This is computationally expensive, so only run if the view is active.
        if(activeTab !== 'report' || reportFilter !== 'truck') return [];
        
        const getDuration = (start?: string, end?: string): number => {
            if (!start || !end) return 0;
            const durationMs = new Date(end).getTime() - new Date(start).getTime();
            return durationMs / 60000; // in minutes
        };

        const rows = completedOps.filter(op => op.modality === 'truck').map(op => {
            const transfer = op.transferPlan[0].transfers[0];
            const opValue = calculateOperationValue(op, settings);
            const plannedTonnes = transfer.tonnes;
            const loadedTonnes = transfer.loadedWeight || transfer.transferredTonnes || 0;
            const variance = plannedTonnes > 0 ? ((loadedTonnes - plannedTonnes) / plannedTonnes) * 100 : 0;
            
            const ct = op.cycleTimeData || {};
            const totalTime = getDuration(ct['Arrived'], ct['Departed']);
            const waitTime = getDuration(ct['Arrived'], ct['On Bay']);
            const serviceTime = getDuration(ct['On Bay'], ct['Departed']);
            const pumpTime = getDuration(ct['Pumping Started'], ct['Pumping Stopped']);

            return {
                opId: op.id, transferId: transfer.id!, site: op.terminal, completedTime: op.completedTime, transportId: op.transportId, licensePlate: op.licensePlate, driverName: op.driverName,
                customer: transfer.customer, product: transfer.product, plannedTonnes, loadedTonnes, variance,
                totalTime: totalTime > 0 ? `${totalTime.toFixed(1)}m` : '-',
                waitTime: waitTime > 0 ? `${waitTime.toFixed(1)}m` : '-',
                serviceTime: serviceTime > 0 ? `${serviceTime.toFixed(1)}m` : '-',
                pumpTime: pumpTime > 0 ? `${pumpTime.toFixed(1)}m` : '-',
                labourRecovery: op.labourRecovery, otherRecoveries: op.otherRecoveries,
                invoicedAmount: opValue.totalValue, dateInvoiced: op.dateInvoiced, originalOp: op
            };
        });
        return rows;
    }, [completedOps, settings, activeTab, reportFilter]);

    const listOps = useMemo(() => {
        return completedOps.filter(op => {
            if (workspaceFilter === 'all') return true;
            return op.modality === workspaceFilter;
        });
    }, [completedOps, workspaceFilter]);

    const handleViewDetails = (op: Operation) => {
        setSelectedOp(op);
        setIsModalOpen(true);
    };

    const handleUpdate = (opId: string, transferId: string, field: string, value: string | number) => {
        const isOpField = ['labourRecovery', 'otherRecoveries', 'dateInvoiced'].includes(field);
        const isTransferField = ['productNote'].includes(field);
        
        const numericValue = (field === 'labourRecovery' || field === 'otherRecoveries') ? parseFloat(value as string) || 0 : value;

        if (isOpField) updateCompletedOperationDetails(opId, { [field]: numericValue });
        else if (isTransferField) updateCompletedOperationDetails(opId, {}, transferId, { [field]: value });
    };
    
    const activeReportRows = reportFilter === 'vessel' ? vesselReportRows : reportFilter === 'truck' ? truckReportRows : [];
    
    return (
        <>
            <CompletedOpDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} operation={selectedOp} />
            <div className="p-3 sm:p-6 flex flex-col h-full">
                <div className="pb-4 flex justify-between items-center gap-4 flex-wrap">
                    <h2 className="text-2xl font-bold text-brand-dark">Completed Operations</h2>
                    <div className="flex items-center gap-4">
                        <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setSearchTerm} />
                        <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} showAllOption={true} />
                    </div>
                </div>

                <div className="border-b border-border-primary">
                    <nav className="-mb-px flex space-x-6">
                        <button onClick={() => setCompletedOpsTab('report')} className={`tab ${activeTab === 'report' ? 'active' : ''}`}>
                            {reportFilter.charAt(0).toUpperCase() + reportFilter.slice(1)} Report
                        </button>
                        <button onClick={() => setCompletedOpsTab('list')} className={`tab ${activeTab === 'list' ? 'active' : ''}`}>
                            Order List
                        </button>
                    </nav>
                </div>

                <div className="flex-grow overflow-auto pt-4">
                    {activeTab === 'report' && (
                        <div className="border border-slate-200 rounded-lg overflow-auto">
                            {reportFilter === 'vessel' && <VesselReportTable rows={vesselReportRows} onViewDetails={handleViewDetails} onUpdate={handleUpdate} canEditFinancials={canEditFinancials} />}
                            {reportFilter === 'truck' && <TruckReportTable rows={truckReportRows} onViewDetails={handleViewDetails} onUpdate={handleUpdate} canEditFinancials={canEditFinancials} />}
                            {reportFilter === 'rail' && <div className="text-center p-8 text-text-secondary"><p>Rail report is coming soon.</p></div>}
                            {activeReportRows.length === 0 && reportFilter !== 'rail' && <div className="text-center p-8 text-text-secondary"><p>No completed {reportFilter} operations match the current filter.</p></div>}
                        </div>
                    )}
                    {activeTab === 'list' && (
                        <div className="space-y-3">
                            {listOps.length > 0 ? (
                                listOps.map(op => <CompletedOpCard key={op.id} op={op} onViewDetails={handleViewDetails} />)
                            ) : (
                                <div className="text-center p-8 text-text-secondary">
                                    <p>No completed operations match the current filter.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CompletedOps;
