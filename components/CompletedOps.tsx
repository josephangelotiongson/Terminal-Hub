import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality } from '../types';
import CompletedOpDetailsModal from './CompletedOpDetailsModal';
import { calculateOperationValue, formatCurrency, canEditCompletedOpFinancials } from '../utils/helpers';
import ModalityFilter from './ModalityFilter';
import WorkspaceSearch from './WorkspaceSearch';

const getIcon = (modality: Modality): string => {
    switch (modality) {
        case 'vessel': return 'fa-ship';
        case 'truck': return 'fa-truck';
        case 'rail': return 'fa-train';
        default: return '';
    }
};

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


const CompletedOps: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <p>Loading...</p>;

    const { operations, selectedTerminal, workspaceFilter, setWorkspaceFilter, workspaceSearchTerm, setWorkspaceSearchTerm, settings, updateCompletedOperationDetails, currentUser } = context;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOp, setSelectedOp] = useState<Operation | null>(null);

    const canEditFinancials = canEditCompletedOpFinancials(currentUser);
    
    useEffect(() => {
        if (workspaceFilter === 'all') {
            setWorkspaceFilter('vessel');
        }
    }, [workspaceFilter, setWorkspaceFilter]);

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
        });
    }, [operations, selectedTerminal, workspaceSearchTerm]);

    const vesselReportRows = useMemo(() => {
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
        rows.sort((a, b) => new Date(b.movementDate!).getTime() - new Date(a.movementDate!).getTime());
        return rows;
    }, [completedOps, settings]);

    const truckReportRows = useMemo(() => {
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
        rows.sort((a, b) => new Date(b.completedTime!).getTime() - new Date(a.completedTime!).getTime());
        return rows;
    }, [completedOps, settings]);

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
    
    const activeRows = workspaceFilter === 'vessel' ? vesselReportRows : workspaceFilter === 'truck' ? truckReportRows : [];
    
    return (
        <>
            <CompletedOpDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} operation={selectedOp} />
            <div className="p-3 sm:p-6 flex flex-col h-full">
                <div className="pb-4 flex justify-between items-center gap-4 flex-wrap">
                    <h2 className="text-2xl font-bold text-brand-dark">Completed Operations Report</h2>
                    <div className="flex items-center gap-4">
                        <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setWorkspaceSearchTerm} />
                        <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} showAllOption={false} />
                    </div>
                </div>
                <div className="flex-grow overflow-auto border border-slate-200 rounded-lg">
                    {workspaceFilter === 'vessel' && (
                        <VesselReportTable rows={vesselReportRows} onViewDetails={handleViewDetails} onUpdate={handleUpdate} canEditFinancials={canEditFinancials} />
                    )}
                    {workspaceFilter === 'truck' && (
                        <TruckReportTable rows={truckReportRows} onViewDetails={handleViewDetails} onUpdate={handleUpdate} canEditFinancials={canEditFinancials} />
                    )}
                    {workspaceFilter === 'rail' && (
                        <div className="text-center p-8 text-text-secondary">
                            <p>Rail report is coming soon.</p>
                        </div>
                    )}

                    {activeRows.length === 0 && workspaceFilter !== 'rail' && (
                        <div className="text-center p-8 text-text-secondary">
                            <p>No completed operations match the current filter.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CompletedOps;