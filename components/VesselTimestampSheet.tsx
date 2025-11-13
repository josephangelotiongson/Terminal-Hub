
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Transfer, VesselCommonTimestamps, CommodityTimestamps } from '../types';
import { isoToDateInput, isoToTimeInput, combineToIso } from '../utils/helpers';

const TimeInputRow: React.FC<{
    label: string;
    value?: string;
    onValueChange: (newValue: string) => void;
}> = ({ label, value, onValueChange }) => {
    const { simulatedTime } = useContext(AppContext)!;
    const [datePart, setDatePart] = useState('');
    const [timePart, setTimePart] = useState('');

    useEffect(() => {
        setDatePart(isoToDateInput(value));
        setTimePart(isoToTimeInput(value));
    }, [value]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDatePart = e.target.value;
        setDatePart(newDatePart);
        onValueChange(combineToIso(newDatePart, timePart));
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTimePart = e.target.value;
        setTimePart(newTimePart);
        onValueChange(combineToIso(datePart, newTimePart));
    };

    const handleStampNow = () => {
        onValueChange(simulatedTime.toISOString());
    };
    
    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const hour = String(h).padStart(2, '0');
                const minute = String(m).padStart(2, '0');
                options.push(`${hour}:${minute}`);
            }
        }
        return options;
    }, []);


    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border-b border-slate-200 gap-2">
            <span className="font-semibold text-sm text-text-primary">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={datePart}
                    onChange={handleDateChange}
                    className="text-sm p-1.5 border border-slate-300 rounded-md bg-slate-50 focus:ring-brand-primary focus:border-brand-primary"
                />
                <select
                    value={timePart}
                    onChange={handleTimeChange}
                    className="text-sm p-1.5 border border-slate-300 rounded-md bg-slate-50 focus:ring-brand-primary focus:border-brand-primary"
                >
                    {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
                </select>
                <button onClick={handleStampNow} className="btn-secondary !text-xs !py-2 !px-3 whitespace-nowrap">Stamp Now</button>
            </div>
        </div>
    );
};


const VesselTimestampSheet: React.FC<{ operation: Operation }> = ({ operation }) => {
    const { saveCurrentPlan, addActivityLog } = useContext(AppContext)!;
    const [sheetData, setSheetData] = useState<Operation>(() => JSON.parse(JSON.stringify(operation)));
    
    useEffect(() => {
        setSheetData(JSON.parse(JSON.stringify(operation)));
    }, [operation]);

    const handleCommonTimestampChange = (field: keyof VesselCommonTimestamps, value: string) => {
        setSheetData(prev => {
            const newTimestamps = { ...(prev.vesselCommonTimestamps || {}), [field]: value };
            return { ...prev, vesselCommonTimestamps: newTimestamps };
        });
    };

    const handleCommodityTimestampChange = (lineIndex: number, transferIndex: number, field: keyof CommodityTimestamps, value: string) => {
        setSheetData(prev => {
            const newPlan = JSON.parse(JSON.stringify(prev.transferPlan));
            const transfer = newPlan[lineIndex].transfers[transferIndex];
            if (!transfer.commodityTimestamps) {
                transfer.commodityTimestamps = {};
            }
            transfer.commodityTimestamps[field] = value;
            return { ...prev, transferPlan: newPlan };
        });
    };

    const handleSaveChanges = () => {
        saveCurrentPlan(sheetData);
        addActivityLog(sheetData.id, 'UPDATE', 'Vessel Timestamp Sheet updated.');
        alert('Timestamp sheet saved successfully!');
    };
    
    const commonTimeFields: { label: string; field: keyof VesselCommonTimestamps }[] = [
        { label: 'START PREPARATIONS / CREW ONSITE', field: 'startPreparations' },
        { label: 'CREW ARRIVE TO WHARF', field: 'crewArriveToWharf' },
        { label: 'VESSEL ALONGSIDE', field: 'vesselAlongside' },
        { label: 'VESSEL ALLFAST', field: 'vesselAllfast' },
        { label: 'GANGWAY DOWN', field: 'gangwayDown' },
        { label: 'SURVEYOR ONBOARD', field: 'surveyorOnboard' },
        { label: 'SURVEYOR CHECKS COMPLETED', field: 'surveyorChecksCompleted' },
        { label: 'LAST HOSE DISCONNECTED', field: 'lastHoseDisconnected' },
        { label: 'CLEAN UP COMPLETION', field: 'cleanUpCompletion' },
        { label: 'CREW COMPLETED / SITE SECURE', field: 'crewCompletedSiteSecure' },
    ];

    const commodityTimeFields: { label: string; field: keyof CommodityTimestamps }[] = [
        { label: 'HOSE CONNECTED', field: 'hoseConnected' },
        { label: 'HOSE LEAK CHECK / PRESSURE CHECK', field: 'hoseLeakCheck' },
        { label: 'START PUMPING', field: 'startPumping' },
        { label: 'LIQUID AT WHARF', field: 'liquidAtWharf' },
        { label: 'LIQUID AT TERMINAL', field: 'liquidAtTerminal' },
        { label: 'SLOPS SAMPLE PASSED / PRODUCT INTO TANK', field: 'slopsSamplePassed' },
        { label: 'STOP PUMPING', field: 'stopPumping' },
        { label: 'HOSES BLOWN', field: 'hosesBlown' },
        { label: 'HOSES DISCONNECTED', field: 'hosesDisconnected' },
        { label: 'PIG AWAY', field: 'pigAway' },
        { label: 'PIG RECEIVED / COMMODITY COMPLETED', field: 'pigReceived' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={handleSaveChanges} className="btn-primary">
                    <i className="fas fa-save mr-2"></i>Save Changes
                </button>
            </div>
            {/* Vessel Info */}
            <div className="card overflow-hidden">
                <div className="p-3 bg-slate-50 border-b flex items-center">
                    <div className="w-48 bg-yellow-300 text-yellow-800 font-bold p-3 text-center text-sm">FILE NAME OF VESSEL</div>
                    <div className="flex-1 grid grid-cols-1">
                         <div className="flex items-center justify-between p-3 border-b border-white">
                            <span className="font-semibold text-sm text-text-primary">SHIP NAME</span>
                            <span className="text-sm text-text-secondary">{sheetData.transportId}</span>
                         </div>
                         <div className="flex items-center justify-between p-3">
                            <span className="font-semibold text-sm text-text-primary">DATE OF ARRIVAL</span>
                            <span className="text-sm text-text-secondary">{new Date(sheetData.eta).toLocaleDateString()}</span>
                         </div>
                    </div>
                </div>
            </div>

            {/* Common Times */}
            <div className="card overflow-hidden">
                <div className="flex">
                    <div className="w-48 bg-yellow-300 text-yellow-800 font-bold p-3 text-center text-sm flex items-center justify-center">COMMON TIMES FOR EVERY VESSEL</div>
                    <div className="flex-1">
                        {commonTimeFields.map(({ label, field }) => (
                            <TimeInputRow
                                key={field}
                                label={label}
                                value={sheetData.vesselCommonTimestamps?.[field]}
                                onValueChange={(value) => handleCommonTimestampChange(field, value)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Individual Times per Commodity */}
            {sheetData.transferPlan.map((line, lineIndex) => 
                line.transfers.map((transfer, transferIndex) => (
                    <div key={`${lineIndex}-${transferIndex}`} className="card overflow-hidden">
                        <div className="flex">
                            <div className="w-48 bg-yellow-300 text-yellow-800 font-bold p-3 text-center text-sm flex items-center justify-center">
                                INDIVIDUAL TIME STAMPS PER COMMODITY
                            </div>
                            <div className="flex-1">
                                <div className="p-3 border-b bg-green-50">
                                    <h4 className="font-bold text-lg text-green-800">Commodity #{transferIndex + 1}</h4>
                                </div>
                                <div className="flex items-center justify-between p-3 border-b">
                                    <span className="font-semibold text-sm text-text-primary">CUSTOMER</span>
                                    <span className="text-sm text-text-secondary">{transfer.customer}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 border-b">
                                    <span className="font-semibold text-sm text-text-primary">PRODUCT</span>
                                    <span className="text-sm text-text-secondary">{transfer.product}</span>
                                </div>
                                 <div className="flex items-center justify-between p-3 border-b">
                                    <span className="font-semibold text-sm text-text-primary">EXPECTED VOLUME</span>
                                    <span className="text-sm text-text-secondary">{transfer.tonnes.toLocaleString()} T</span>
                                </div>
                                {commodityTimeFields.map(({ label, field }) => (
                                     <TimeInputRow
                                        key={field}
                                        label={label}
                                        value={transfer.commodityTimestamps?.[field]}
                                        onValueChange={(value) => handleCommodityTimestampChange(lineIndex, transferIndex, field, value)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default VesselTimestampSheet;
