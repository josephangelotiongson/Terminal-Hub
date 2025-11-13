
import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, DipSheetEntry, Transfer } from '../types';

const DipSheet: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading context...</div>;

    const { activeOpId, getOperationById, saveCurrentPlan, currentUser, currentTerminalSettings, editingOp, setEditingOp, simulatedTime } = context;

    const op = getOperationById(activeOpId);
    
    // Extract the primary transfer for header info
    const primaryTransfer: Transfer | undefined = useMemo(() => editingOp?.transferPlan.flatMap(tp => tp.transfers)[0], [editingOp]);

    useEffect(() => {
        // Initialize sheet data within the editingOp if it's not present
        if (editingOp && (!editingOp.dipSheetData || editingOp.dipSheetData.length === 0)) {
            const initialData = [
                { id: `start-${Date.now()}`, isStartRow: true, time: '', dipReading: '', tankInnage: '', initials: '' },
                { id: `row-${Date.now()}`, time: '', dipReading: '', tankInnage: '', initials: '' }
            ];
            setEditingOp(prev => prev ? ({ ...prev, dipSheetData: initialData }) : null);
        }
    }, [editingOp?.id]);

    const { pumpingStartTime, tankInfo, safeFill, tankName } = useMemo(() => {
        const pumpingStartedEvent = primaryTransfer?.sof?.find(s => 
            s.event.includes('Pumping Started') && s.status === 'complete'
        );
        const startTime = pumpingStartedEvent ? new Date(pumpingStartedEvent.time) : null;

        const tn = primaryTransfer?.direction.includes('Tank to') ? primaryTransfer.from : primaryTransfer.to;
        const info = tn ? currentTerminalSettings.masterTanks?.[tn] : undefined;
        const fill = info ? info.capacity * 0.98 : 0;

        return { pumpingStartTime: startTime, tankInfo: info, safeFill: fill, tankName: tn };
    }, [primaryTransfer, currentTerminalSettings]);
    
    // Auto-logger effect - runs on every simulatedTime update
    useEffect(() => {
        if (!op || !pumpingStartTime || !primaryTransfer || !editingOp) {
            return; // Don't run if op isn't active or pumping hasn't started
        }

        setEditingOp(currentOp => {
            if (!currentOp) return null;

            const currentData = currentOp.dipSheetData || [];
            const lastEntry = currentData[currentData.length - 1];
            if (!lastEntry) return currentOp;

            let lastEntryTime: Date;
            if (lastEntry.time) {
                const [hours, minutes] = lastEntry.time.split(':').map(Number);
                lastEntryTime = new Date(pumpingStartTime); // Use pumping start date as base
                lastEntryTime.setHours(hours, minutes, 0, 0);
            } else if (lastEntry.isStartRow) {
                lastEntryTime = pumpingStartTime;
            } else {
                    return currentOp; // Cannot determine time of last entry
            }

            const fifteenMinutesAgo = new Date(simulatedTime.getTime() - 15 * 60 * 1000);

            if (lastEntryTime > fifteenMinutesAgo) {
                return currentOp; // Last entry was too recent
            }

            const startVolume = parseFloat(currentData.find(d => d.isStartRow)?.tankInnage || '0');
            if (startVolume === 0) return currentOp;

            const latestOp = getOperationById(op.id);
            const latestPrimaryTransfer = latestOp?.transferPlan.flatMap(tp => tp.transfers)[0];
            if (!latestPrimaryTransfer) return currentOp;

            const transferredTonnes = latestPrimaryTransfer.transferredTonnes || 0;
            const isIncoming = latestPrimaryTransfer.direction.includes(' to Tank');
            const newTankInnage = isIncoming ? startVolume + transferredTonnes : startVolume - transferredTonnes;

            const now = simulatedTime;
            const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            const newEntry: DipSheetEntry = {
                id: `auto-${now.getTime()}`,
                time: timeString,
                dipReading: 'SCADA',
                tankInnage: newTankInnage.toFixed(2),
                initials: 'AUTO'
            };
            
            if (lastEntry.time === newEntry.time && lastEntry.initials === 'AUTO') {
                return currentOp; // Prevent duplicates
            }

            return { ...currentOp, dipSheetData: [...currentData, newEntry] };
        });

    }, [simulatedTime, op, pumpingStartTime, primaryTransfer, getOperationById, setEditingOp]);

    const sheetData = editingOp?.dipSheetData || [];

    const processedSheetData = useMemo(() => {
        const startVolume = parseFloat(sheetData.find(d => d.isStartRow)?.tankInnage || '0');
        
        // Don't calculate if pumping hasn't started or there's no start volume
        if (!pumpingStartTime || startVolume === 0 || !primaryTransfer) {
            return sheetData.map(entry => ({
                ...entry,
                calculated: { totalQtyTransferred: '----', transferRate: '----', ullageRemaining: '----', estTimeToComplete: '----' }
            }));
        }

        return sheetData.map(entry => {
            if (entry.isStartRow) {
                return { ...entry, calculated: { totalQtyTransferred: '----', transferRate: '----', ullageRemaining: '----', estTimeToComplete: '----' } };
            }

            const tankInnage = parseFloat(entry.tankInnage) || 0;
            // Combine current date with input time for accurate calculation
            const entryDate = new Date(pumpingStartTime);
            const [hours, minutes] = entry.time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                entryDate.setHours(hours, minutes);
            }
            const entryTime = entry.time ? entryDate : null;

            if (!entryTime || tankInnage === 0) {
                 return { ...entry, calculated: { totalQtyTransferred: '----', transferRate: '----', ullageRemaining: '----', estTimeToComplete: '----' } };
            }
            
            const isIncoming = primaryTransfer.direction.includes(' to Tank');
            const totalQtyTransferred = isIncoming ? tankInnage - startVolume : startVolume - tankInnage;
            const hrsPumping = (entryTime.getTime() - pumpingStartTime.getTime()) / (3600 * 1000);
            
            const transferRate = (hrsPumping > 0.001) ? totalQtyTransferred / hrsPumping : 0; // Avoid division by zero
            const ullageRemaining = safeFill > 0 ? safeFill - tankInnage : 0;
            const qtyRemaining = primaryTransfer.tonnes - totalQtyTransferred;
            const estTimeToComplete = (transferRate > 0) ? qtyRemaining / transferRate : Infinity;

            return {
                ...entry,
                calculated: {
                    totalQtyTransferred: totalQtyTransferred.toFixed(2),
                    transferRate: transferRate.toFixed(2),
                    ullageRemaining: ullageRemaining.toFixed(2),
                    estTimeToComplete: isFinite(estTimeToComplete) && estTimeToComplete > 0 ? `${estTimeToComplete.toFixed(2)} hrs` : '----',
                }
            };
        });
    }, [sheetData, pumpingStartTime, safeFill, primaryTransfer?.tonnes, primaryTransfer?.direction]);


    const handleUpdateEntry = (id: string, field: keyof DipSheetEntry, value: string) => {
        setEditingOp(currentOp => {
            if (!currentOp) return null;
            const newDipSheetData = (currentOp.dipSheetData || []).map(entry =>
                entry.id === id ? { ...entry, [field]: value } : entry
            );
            return { ...currentOp, dipSheetData: newDipSheetData };
        });
    };

    const addRow = () => {
        setEditingOp(currentOp => {
            if (!currentOp) return null;
            const newEntry: DipSheetEntry = { id: `row-${Date.now()}`, time: '', dipReading: '', tankInnage: '', initials: '' };
            const newDipSheetData = [...(currentOp.dipSheetData || []), newEntry];
            return { ...currentOp, dipSheetData: newDipSheetData };
        });
    };
    
    const handleSave = () => {
        if(op && editingOp) {
            saveCurrentPlan(editingOp);
            context.addActivityLog(op.id, 'UPDATE', 'Dip Calculation Sheet was updated.');
        }
    };

    if (!op || !primaryTransfer || !editingOp) {
        return <div className="card p-8 text-center text-text-secondary">Operation data not found or no transfers in plan.</div>;
    }

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Dip Calculation Sheet</h2>
                <div>
                     <button onClick={addRow} className="btn-secondary mr-2"><i className="fas fa-plus mr-2"></i>Add Row</button>
                    <button onClick={handleSave} className="btn-primary"><i className="fas fa-save mr-2"></i>Save Sheet</button>
                </div>
            </div>

            <div className="card p-6">
                 {/* Header Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm border-b pb-4 mb-4">
                    <div><span className="font-semibold block">Product:</span> {primaryTransfer.product}</div>
                    <div><span className="font-semibold block">From:</span> {primaryTransfer.from}</div>
                    <div><span className="font-semibold block">To:</span> {primaryTransfer.to}</div>
                    <div><span className="font-semibold block">Tank No.:</span> {tankName}</div>
                    <div><span className="font-semibold block">Date:</span> {new Date(op.eta).toLocaleDateString()}</div>
                    <div className="lg:col-span-2"><span className="font-semibold">QTY to be transferred (MT):</span> {primaryTransfer.tonnes.toLocaleString()}</div>
                    <div><span className="font-semibold block">Safe Fill (MT):</span> {safeFill > 0 ? safeFill.toLocaleString() : 'N/A'}</div>
                    <div><span className="font-semibold block">Stop Dip:</span> N/A</div>
                    <div><span className="font-semibold block">Density:</span> N/A</div>
                </div>
                
                {/* Dip Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead className="text-center bg-blue-50">
                            <tr>
                                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Initial'].map(char => <th key={char} className="p-2 border font-semibold w-24">{char}</th>)}
                            </tr>
                            <tr>
                                <th className="p-2 border font-semibold">TIME</th>
                                <th className="p-2 border font-semibold">DIP READING</th>
                                <th className="p-2 border font-semibold">TANK INNAGE VOLUME (MT)</th>
                                <th className="p-2 border font-semibold">TOTAL QTY TRANSFERRED</th>
                                <th className="p-2 border font-semibold">TRANSFER RATE M3</th>
                                <th className="p-2 border font-semibold">ULLAGE REMAINING</th>
                                <th className="p-2 border font-semibold">EST TIME TO COMPLETE</th>
                                <th className="p-2 border font-semibold">TOTAL QTY TRANSFERRED (MT)</th>
                                <th className="p-2 border font-semibold">INITIAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedSheetData.map(entry => {
                                const isAuto = entry.initials === 'AUTO';
                                return (
                                    <tr key={entry.id} className={`text-center ${isAuto ? 'bg-slate-100 text-slate-500' : ''}`}>
                                        <td className="p-0 border h-10">
                                            {entry.isStartRow ? <span className="font-bold">START VOLUME</span> : (isAuto ? <span className="p-2 block">{entry.time}</span> : <input type="time" className="w-full h-full border-none text-center bg-transparent" value={entry.time} onChange={e => handleUpdateEntry(entry.id, 'time', e.target.value)} />)}
                                        </td>
                                        <td className="p-0 border">{isAuto ? <span className="p-2 block">{entry.dipReading}</span> : <input type="text" className="w-full h-full border-none text-center bg-transparent" value={entry.dipReading} onChange={e => handleUpdateEntry(entry.id, 'dipReading', e.target.value)} />}</td>
                                        <td className="p-0 border">{isAuto ? <span className="p-2 block">{entry.tankInnage}</span> : <input type="number" className="w-full h-full border-none text-center bg-transparent" value={entry.tankInnage} onChange={e => handleUpdateEntry(entry.id, 'tankInnage', e.target.value)} />}</td>
                                        <td className="p-1 border bg-slate-50">{entry.calculated?.totalQtyTransferred}</td>
                                        <td className="p-1 border bg-slate-50">{entry.calculated?.transferRate}</td>
                                        <td className="p-1 border bg-slate-50">{entry.calculated?.ullageRemaining}</td>
                                        <td className="p-1 border bg-slate-50">{entry.calculated?.estTimeToComplete}</td>
                                        <td className="p-1 border bg-slate-50">{entry.calculated?.totalQtyTransferred}</td>
                                        <td className="p-0 border">{isAuto ? <span className="p-2 block">{entry.initials}</span> : <input type="text" className="w-full h-full border-none text-center bg-transparent" value={entry.initials} onChange={e => handleUpdateEntry(entry.id, 'initials', e.target.value)} />}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DipSheet;
