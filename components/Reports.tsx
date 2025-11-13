import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Modality, ReportType, AppSettings } from '../types';
import WorkspaceSearch from './WorkspaceSearch';
import ModalityFilter from './ModalityFilter';
import { calculateOperationValue, formatCurrency, formatInfraName, downloadCsv, formatDateTime } from '../utils/helpers';

const getIcon = (modality: Modality): string => {
    switch (modality) {
        case 'vessel': return 'fa-ship';
        case 'truck': return 'fa-truck';
        case 'rail': return 'fa-train';
        default: return 'fa-question-circle';
    }
};

// --- CHART COMPONENTS (Defined within Reports.tsx for simplicity) ---

const TRUCK_CYCLE_TIME_STEPS = [
    { key: 'arrivalToOnBay', name: 'Arrival to On Bay', startEvent: 'Arrived', endEvent: 'On Bay', color: '#374151' },
    { key: 'onBayToStartPump', name: 'On Bay to Start Pumping', startEvent: 'On Bay', endEvent: 'Pumping Started', color: '#6b7280' },
    { key: 'pumpDuration', name: 'Pumping Duration', startEvent: 'Pumping Started', endEvent: 'Pumping Stopped', color: '#9ca3be' },
    { key: 'stopToPaperwork', name: 'Stop to Paperwork Done', startEvent: 'Pumping Stopped', endEvent: 'Paperwork Done', color: '#d1d5db' },
    { key: 'paperworkToDeparture', name: 'Paperwork to Departure', startEvent: 'Paperwork Done', endEvent: 'Departed', color: '#f97316' },
];

const VESSEL_CYCLE_TIME_STEPS = [
    { key: 'norToBerth', name: 'NOR Tendered to Alongside', startEvent: 'NOR Tendered', endEvent: 'Alongside Berth', color: '#1e3a8a' },
    { key: 'berthToStartPump', name: 'Alongside to Start Pumping', startEvent: 'Alongside Berth', endEvent: 'START PUMPING', color: '#3b82f6' },
    { key: 'pumpDuration', name: 'Pumping Duration', startEvent: 'START PUMPING', endEvent: 'STOP PUMPING', color: '#93c5fd' },
    { key: 'stopToDeparture', name: 'Pumping Stopped to Departure', startEvent: 'STOP PUMPING', endEvent: 'Departure', color: '#bfdbfe' },
];

const RAIL_CYCLE_TIME_STEPS = [
    { key: 'arrivalToSiding', name: 'Arrival to On Siding', startEvent: 'Arrived at Terminal', endEvent: 'On Siding', color: '#4b5563' },
    { key: 'sidingToStartPump', name: 'On Siding to Start Pumping', startEvent: 'On Siding', endEvent: 'Pumping Started', color: '#6b7280' },
    { key: 'pumpDuration', name: 'Pumping Duration', startEvent: 'Pumping Started', endEvent: 'Pumping Stopped', color: '#9ca3be' },
    { key: 'stopToDeparture', name: 'Pumping Stopped to Departure', startEvent: 'Pumping Stopped', endEvent: 'Departed', color: '#d1d5db' },
];

const CYCLE_TIME_CONFIG: Record<Modality, typeof TRUCK_CYCLE_TIME_STEPS> = {
    truck: TRUCK_CYCLE_TIME_STEPS,
    vessel: VESSEL_CYCLE_TIME_STEPS,
    rail: RAIL_CYCLE_TIME_STEPS,
};

const MonthlyChart = ({ data, modality, yAxisTitle }: { data: any[]; modality: Modality, yAxisTitle: string }) => {
    const cycleTimeSteps = CYCLE_TIME_CONFIG[modality];
    const isCycleTime = yAxisTitle.toLowerCase().includes('hour');
    const isRevenue = yAxisTitle.toLowerCase().includes('revenue');

    const { yAxisMax, yAxisLabels } = useMemo(() => {
        const dataMax = Math.max(0, ...data.map(d => d.total));

        if (dataMax === 0) {
            if (isCycleTime) return { yAxisMax: 5, yAxisLabels: ['5', '4', '3', '2', '1', '0'] };
            if (isRevenue) return { yAxisMax: 50000, yAxisLabels: ['50k', '40k', '30k', '20k', '10k', '0'] };
            return { yAxisMax: 5000, yAxisLabels: ['5k', '4k', '3k', '2k', '1k', '0'] };
        }

        const numTicks = 6;
        const rawStep = dataMax / (numTicks - 1);
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const residual = rawStep / magnitude;

        let niceStep;
        if (residual > 5) niceStep = 10 * magnitude;
        else if (residual > 2) niceStep = 5 * magnitude;
        else if (residual > 1) niceStep = 2 * magnitude;
        else niceStep = magnitude;

        const yMax = Math.ceil(dataMax / niceStep) * niceStep;

        const labels: number[] = [];
        if (niceStep > 0) {
            for (let i = yMax; i >= 0; i -= niceStep) {
                labels.push(i);
            }
        } else {
            return { yAxisMax: dataMax, yAxisLabels: [dataMax.toString(), '0'] };
        }
        
        const formattedLabels = labels.map(label => {
            if (isCycleTime) {
                if (niceStep < 1 && niceStep > 0) return label.toFixed(1);
                return label.toFixed(0);
            }
            if (label >= 1000000) return `${parseFloat((label / 1000000).toFixed(1))}m`;
            if (label >= 1000) return `${Math.round(label / 1000)}k`;
            return String(Math.round(label));
        });

        return { yAxisMax: yMax, yAxisLabels: formattedLabels };
    }, [data, isCycleTime, isRevenue]);

    const title = isCycleTime ? 'Average Cycle Time' : isRevenue ? 'Total Revenue' : 'Total Throughput';
    const totalFormatter = isCycleTime 
        ? (val: number) => val.toFixed(2) 
        : isRevenue
        ? (val: number) => formatCurrency(val).replace(/\.00$/, '')
        : (val: number) => val.toLocaleString();

    return (
        <div className="p-4 h-[350px] sm:h-[400px] flex flex-col">
            <h3 className="font-semibold text-lg">{title}</h3>
            <div className="flex-grow flex mt-4">
                <div className="flex flex-col justify-between text-right text-xs text-gray-500 pr-2">
                    {yAxisLabels.map(label => <span key={label}>{label}</span>)}
                </div>
                <div className="flex-grow border-l border-b border-gray-200 flex justify-around items-end gap-2 px-2">
                    {data.map(monthData => (
                        <div key={monthData.month} className="flex-1 flex flex-col items-center h-full">
                            <div className="relative w-3/4 h-full flex flex-col-reverse items-center">
                                {monthData.count > 0 && (
                                    <div className="absolute -top-5 text-center">
                                        <span className="font-bold text-sm">{totalFormatter(monthData.total)}</span>
                                    </div>
                                )}
                                <div className="w-full h-full flex flex-col-reverse" title={monthData.count > 0 ? `${title}: ${totalFormatter(monthData.total)}` : 'No Data'}>
                                    {monthData.count > 0 ? (
                                        isCycleTime ? cycleTimeSteps.map(step => (
                                            <div
                                                key={step.key}
                                                className="w-full"
                                                style={{ backgroundColor: step.color, height: `${(yAxisMax > 0 ? monthData.steps[step.key] / yAxisMax : 0) * 100}%` }}
                                                title={`${step.name}: ${monthData.steps[step.key].toFixed(2)} hrs`}
                                            ></div>
                                        )) : (
                                            <div className="w-full" style={{ backgroundColor: isRevenue ? '#16a34a' : '#4f46e5', height: `${(yAxisMax > 0 ? monthData.total / yAxisMax : 0) * 100}%` }}></div>
                                        )
                                    ) : (
                                        <div className="w-full h-full bg-slate-50"></div>
                                    )}
                                </div>
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{monthData.month.split(' ')[0]}</span>
                        </div>
                    ))}
                </div>
            </div>
             {isCycleTime && <div className="flex justify-center items-center flex-wrap gap-x-4 gap-y-1 mt-4">
                {cycleTimeSteps.map(step => (
                    <div key={step.key} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: step.color }}></div>
                        <span className="text-xs text-gray-600">{step.name}</span>
                    </div>
                ))}
            </div>}
        </div>
    );
};

const BarChart = ({ title, data, maxValue, valueFormatter = (val: number) => val.toFixed(1), reportType }: { title: string, data: { name: string, value: number }[], maxValue: number, valueFormatter?: (val: number) => string, reportType: ReportType }) => {
    
    const getBarColor = () => {
        switch(reportType) {
            case 'revenue': return 'bg-green-500';
            case 'throughput': return 'bg-blue-500';
            case 'cycleTime': return 'bg-slate-500';
            case 'downtime': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    // Handle case where there is no data to prevent layout collapse
    if (data.length === 0) {
        return (
             <div>
                <h4 className="font-semibold text-center text-lg mb-4">{title}</h4>
                <div className="flex justify-center items-center h-48 text-sm text-text-tertiary">
                    No data available.
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <h4 className="font-semibold text-center text-lg mb-4">{title}</h4>
            <div className="flex justify-around items-end h-48 gap-3 px-2">
                {data.map(item => (
                    <div key={item.name} className="flex-1 flex flex-col items-center text-center w-full" style={{minWidth: '20px'}}>
                         <span className="font-semibold text-text-tertiary text-xs mb-1">{valueFormatter(item.value)}</span>
                        <div 
                            className={`w-full rounded-t-sm ${getBarColor()} hover:opacity-80 transition-opacity`} 
                            style={{ height: `${(maxValue > 0 ? (item.value / maxValue) * 100 : 0)}%` }}
                            title={`${item.name}: ${valueFormatter(item.value)}`}
                        >
                        </div>
                        <span className="truncate text-xs text-text-secondary mt-1 w-full" title={item.name}>{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};


const BreakdownCharts = ({ data, settings, modality, reportType }: { data: Operation[], settings: AppSettings, modality: Modality, reportType: ReportType }) => {
    if (reportType === 'downtime') return null;
    const isCommercials = reportType === 'revenue';
    const isThroughput = reportType === 'throughput';
    const cycleTimeSteps = CYCLE_TIME_CONFIG[modality];
    
    const createGroupedData = (key: 'customer' | 'product') => {
        // Group full operations by the key first. An op can belong to multiple groups.
        const groupedOps = data.reduce((acc, op) => {
            const uniqueKeys = new Set<string>();
            op.transferPlan?.forEach(tp => {
                tp.transfers.forEach(t => {
                    if (t[key]) uniqueKeys.add(t[key] as string);
                });
            });

            uniqueKeys.forEach(groupKey => {
                if (!acc[groupKey]) acc[groupKey] = [];
                acc[groupKey].push(op);
            });
            return acc;
        }, {} as Record<string, Operation[]>);

        // Now, calculate the value for each group correctly.
        const result = Object.entries(groupedOps).map(([name, ops]) => {
            let totalValue = 0;
            
            if (isCommercials) {
                // Sum the value of *only relevant transfers* across all ops in the group.
                ops.forEach(op => {
                    const relevantTransfers = op.transferPlan.flatMap(tp => tp.transfers).filter(t => t[key] === name);
                    // Create a temporary operation with only the relevant transfers to calculate value correctly
                    const tempOp = { ...op, transferPlan: [{ infrastructureId: 'temp', transfers: relevantTransfers }] };
                    totalValue += calculateOperationValue(tempOp, settings).totalValue;
                });
            } else if (isThroughput) {
                // Sum the tonnes of *only relevant transfers*.
                ops.forEach(op => {
                    const relevantTransfers = op.transferPlan.flatMap(tp => tp.transfers).filter(t => t[key] === name);
                    const throughputForGroup = relevantTransfers.reduce((sum, t) => sum + (t.transferredTonnes || t.tonnes), 0);
                    totalValue += throughputForGroup;
                });
            } else { // Cycle Time
                let totalHours = 0;
                let validOpsCount = 0;
                ops.forEach(op => {
                    const ct = op.cycleTimeData;
                    if (!ct) return;

                    let opTotalHours = 0;
                    let opHasValidSteps = false;

                    cycleTimeSteps.forEach(step => {
                        const start = ct[step.startEvent] ? new Date(ct[step.startEvent]).getTime() : 0;
                        const end = ct[step.endEvent] ? new Date(ct[step.endEvent]).getTime() : 0;
                        if (start && end && end >= start) {
                            opTotalHours += (end - start) / 3600000; // ms to hours
                            opHasValidSteps = true;
                        }
                    });

                    if (opHasValidSteps) {
                        totalHours += opTotalHours;
                        validOpsCount++;
                    }
                });
                totalValue = validOpsCount > 0 ? totalHours / validOpsCount : 0;
            }

            return { name, value: totalValue };
        });

        return result.sort((a, b) => b.value - a.value).slice(0, 6);
    };
    
    // Avg by Plant (Terminal) - Only for Cycle Time
    const byPlant = useMemo(() => {
        if (isCommercials || isThroughput) return [];
        const grouped = data.reduce((acc, op) => {
            (acc[op.terminal] = acc[op.terminal] || []).push(op);
            return acc;
        }, {} as Record<string, Operation[]>);
        
        return Object.entries(grouped).map(([terminal, ops]) => {
            let totalHours = 0;
            const stepTotals = cycleTimeSteps.reduce((acc, step) => ({...acc, [step.key]: 0}), {} as Record<string, number>);
            let validOpCount = 0;

            ops.forEach(op => {
                const ct = op.cycleTimeData;
                if (!ct) return;

                let opHasValidSteps = false;
                const opStepHours: Record<string, number> = {};
                let opTotalHours = 0;

                cycleTimeSteps.forEach(step => {
                    const start = ct[step.startEvent] ? new Date(ct[step.startEvent]).getTime() : 0;
                    const end = ct[step.endEvent] ? new Date(ct[step.endEvent]).getTime() : 0;
                    if (start && end && end >= start) {
                        const durationHours = (end - start) / 3600000;
                        opStepHours[step.key] = durationHours;
                        opTotalHours += durationHours;
                        opHasValidSteps = true;
                    }
                });

                if (opHasValidSteps) {
                    validOpCount++;
                    totalHours += opTotalHours;
                    for (const key of cycleTimeSteps.map(s => s.key)) {
                        stepTotals[key] += opStepHours[key] || 0;
                    }
                }
            });
            
            const avgSteps = cycleTimeSteps.reduce((acc, step) => ({...acc, [step.key]: validOpCount > 0 ? stepTotals[step.key] / validOpCount : 0 }), {} as Record<string, number>);
            const totalAvg = validOpCount > 0 ? totalHours / validOpCount : 0;
            
            return { name: terminal, total: totalAvg, steps: avgSteps };
        });
    }, [data, cycleTimeSteps, isCommercials, isThroughput]);
    
    const byCustomer = useMemo(() => createGroupedData('customer'), [data, settings, cycleTimeSteps, isCommercials, isThroughput]);
    const byProduct = useMemo(() => createGroupedData('product'), [data, settings, cycleTimeSteps, isCommercials, isThroughput]);

    const maxByPlant = Math.max(...byPlant.map(p => p.total), 0);
    const maxByCustomer = Math.max(...byCustomer.map(c => c.value), 0);
    const maxByProduct = Math.max(...byProduct.map(p => p.value), 0);
    
    let gridClass = `grid grid-cols-1 md:grid-cols-2 ${modality === 'vessel' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-4`;
    if (isCommercials || isThroughput) {
        gridClass = 'grid grid-cols-1 md:grid-cols-2 gap-8';
    }
    
    const titleMap: Record<ReportType, { customer: string, product: string }> = {
        revenue: { customer: "Revenue by Customer", product: "Revenue by Product" },
        throughput: { customer: "Throughput by Customer", product: "Throughput by Product" },
        cycleTime: { customer: "Avg Cycle Time by Customer", product: "Avg Cycle Time by Product" },
        downtime: { customer: "", product: "" }
    };

    const valueFormatterMap: Record<string, (v: number) => string> = {
        revenue: (v: number) => formatCurrency(v).replace(/\.00$/, ''),
        throughput: (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} T`,
        cycleTime: (v: number) => v.toFixed(1),
    };

    return (
        <div className={gridClass}>
            {/* Avg Cycle Time by Plant */}
            {reportType === 'cycleTime' && modality !== 'vessel' && (
                <div className="min-w-[200px] p-2">
                    <h4 className="font-semibold text-center text-sm mb-2">Avg Cycle Time by Plant</h4>
                    <div className="space-y-1 text-xs">
                        {byPlant.map(item => (
                            <div key={item.name} className="flex items-center gap-2">
                                <span className="w-12 truncate text-right">{item.name}</span>
                                <div className="flex-grow flex h-4 rounded-sm overflow-hidden" title={`Total: ${item.total.toFixed(2)}`}>
                                    {cycleTimeSteps.map(step => (
                                        <div key={step.key} style={{ backgroundColor: step.color, width: `${(maxByPlant > 0 ? item.steps[step.key] / maxByPlant : 0) * 100}%` }}></div>
                                    ))}
                                </div>
                                <span className="w-8 text-left font-bold">{item.total.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="min-w-[200px] p-2">
                <BarChart 
                    title={titleMap[reportType].customer} 
                    data={byCustomer} 
                    maxValue={maxByCustomer} 
                    valueFormatter={valueFormatterMap[reportType]}
                    reportType={reportType}
                />
            </div>
            <div className="min-w-[200px] p-2">
                 <BarChart 
                    title={titleMap[reportType].product} 
                    data={byProduct} 
                    maxValue={maxByProduct} 
                    valueFormatter={valueFormatterMap[reportType]}
                    reportType={reportType}
                />
            </div>
        </div>
    );
};


const Reports: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return <div>Loading reports...</div>;

    const { operations, settings, selectedTerminal, workspaceFilter, setWorkspaceFilter, workspaceSearchTerm, setWorkspaceSearchTerm, currentTerminalSettings, currentUser, holds } = context;
    const isCommercials = currentUser.role === 'Commercials';
    
    // --- FILTERS ---
    const [reportType, setReportType] = useState<ReportType>(isCommercials ? 'revenue' : 'cycleTime');
    const lastYear = new Date().getFullYear() - 1;
    const [startDate, setStartDate] = useState(`${lastYear}-01-01`);
    const [endDate, setEndDate] = useState(`${lastYear}-12-31`);
    const [customer, setCustomer] = useState('All');
    const [productGroup, setProductGroup] = useState('All');

    useEffect(() => {
        if (!isCommercials && reportType === 'revenue') {
            setReportType('cycleTime');
        }
    }, [isCommercials, reportType]);
    
    useEffect(() => {
        if (workspaceFilter === 'all') {
            setWorkspaceFilter('truck');
        }
    }, [workspaceFilter, setWorkspaceFilter]);
    
    const { uniqueCustomers, uniqueProductGroups } = useMemo(() => {
        const customers = currentTerminalSettings.masterCustomers || [];
        const groups = new Set<string>(Object.values(settings.productGroups));
        return {
            uniqueCustomers: ['All', ...customers.sort()],
            uniqueProductGroups: ['All', ...Array.from(groups).sort()],
        };
    }, [currentTerminalSettings.masterCustomers, settings.productGroups]);

    const modalityForReport: Modality = (workspaceFilter === 'all' ? 'truck' : workspaceFilter) as Modality;
    const cycleTimeStepsForModality = CYCLE_TIME_CONFIG[modalityForReport];

    const { filteredOps, totalRevenue, filteredHolds, filteredDelayedOps } = useMemo(() => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1);

        const ops = operations.filter(op => {
            if (op.terminal !== selectedTerminal) return false;
            if (workspaceFilter !== 'all' && op.modality !== workspaceFilter) return false;
            if (op.status !== 'completed' && op.status !== 'cancelled') return false;

            const opTime = new Date(op.status === 'completed' ? op.completedTime! : op.cancellationDetails!.time).getTime();
            if (opTime < start || opTime > end) return false;

            const hasTransfers = op.transferPlan && op.transferPlan.length > 0 && op.transferPlan.some(tp => tp.transfers.length > 0);
            
            if (customer !== 'All' || productGroup !== 'All') {
                if (!hasTransfers) return false;
                return op.transferPlan.some(tp => 
                    tp.transfers.some(t => {
                        const customerMatch = (customer === 'All' || t.customer === customer);
                        const pg = settings.productGroups[t.product];
                        const productGroupMatch = (productGroup === 'All' || pg === productGroup);
                        return customerMatch && productGroupMatch;
                    })
                );
            }

            if (workspaceSearchTerm) {
                const term = workspaceSearchTerm.toLowerCase();
                const opLevelMatch = op.transportId?.toLowerCase().includes(term);

                if (!hasTransfers && !opLevelMatch) return false;
                
                const transferLevelMatch = hasTransfers && op.transferPlan.some(tp =>
                    tp.transfers.some(t =>
                        t.customer?.toLowerCase().includes(term) ||
                        t.product?.toLowerCase().includes(term)
                    )
                );
                if (!opLevelMatch && !transferLevelMatch) return false;
            }
            
            return true;
        });

        const revenue = isCommercials
            ? ops.reduce((sum, op) => (op.status === 'completed' ? sum + calculateOperationValue(op, settings).totalValue : sum), 0)
            : 0;

        const fHolds = holds.filter(h => {
            const holdStart = new Date(h.startTime).getTime();
            return h.terminal === selectedTerminal && holdStart >= start && holdStart <= end;
        });

        const fDelays = ops.filter(op => op.delay?.active && op.delay.time);

        return { filteredOps: ops, totalRevenue: revenue, filteredHolds: fHolds, filteredDelayedOps: fDelays };
    }, [operations, holds, startDate, endDate, selectedTerminal, customer, productGroup, settings, workspaceFilter, workspaceSearchTerm, isCommercials]);
    
    const completedOps = useMemo(() => {
        if (reportType === 'revenue' || reportType === 'throughput') {
            return filteredOps.filter(op => op.status === 'completed');
        }
        if (reportType === 'cycleTime') {
            return filteredOps.filter(op => op.status === 'completed' && op.cycleTimeData);
        }
        return [];
    }, [filteredOps, reportType]);
    
    const { downtimeByAsset, downtimeByReason, delaysByReason } = useMemo(() => {
        const dba = filteredHolds.reduce((acc, hold) => {
            const duration = (new Date(hold.endTime).getTime() - new Date(hold.startTime).getTime()) / 3600000;
            acc[hold.resource] = (acc[hold.resource] || 0) + duration;
            return acc;
        }, {} as Record<string, number>);
        const dbr = filteredHolds.reduce((acc, hold) => {
            acc[hold.reason] = (acc[hold.reason] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const dly = filteredDelayedOps.reduce((acc, op) => {
            if (op.delay?.reason) {
                acc[op.delay.reason] = (acc[op.delay.reason] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const toChartData = (data: Record<string, number>) => Object.entries(data).map(([name, value]) => ({name, value})).sort((a,b) => b.value - a.value).slice(0, 10);

        return { downtimeByAsset: toChartData(dba), downtimeByReason: toChartData(dbr), delaysByReason: toChartData(dly) };
    }, [filteredHolds, filteredDelayedOps]);

    const monthlyData = useMemo(() => {
        const startYear = new Date(startDate).getFullYear();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        const months = monthNames.map((name, i) => ({
            month: `${name} ${startYear.toString().slice(-2)}`,
            steps: cycleTimeStepsForModality.reduce((acc, step) => ({ ...acc, [step.key]: 0 }), {} as Record<string, number>),
            stepCounts: cycleTimeStepsForModality.reduce((acc, step) => ({ ...acc, [step.key]: 0 }), {} as Record<string, number>),
            total: 0,
            count: 0,
            year: startYear,
            monthIndex: i
        }));

        completedOps.forEach(op => {
            if (op.modality !== modalityForReport) return;
            
            const eventDate = op.completedTime ? new Date(op.completedTime) : new Date(op.eta);
            const monthIndex = eventDate.getMonth();
            const year = eventDate.getFullYear();

            const targetMonth = months.find(m => m.monthIndex === monthIndex && m.year === year);
            if (!targetMonth) return;

            if (reportType === 'revenue') {
                targetMonth.total += calculateOperationValue(op, settings).totalValue;
                targetMonth.count++;
                return;
            }
            if (reportType === 'throughput') {
                 targetMonth.total += (op.transferPlan || []).reduce((sum, tp) => sum + (tp.transfers || []).reduce((s, t) => s + (t.transferredTonnes || t.tonnes), 0), 0);
                 targetMonth.count++;
                 return;
            }
            
            if (reportType === 'cycleTime') {
                if (!op.cycleTimeData) return;
                const ct = op.cycleTimeData;
                let opHasData = false;
                
                cycleTimeStepsForModality.forEach(step => {
                    const start = ct[step.startEvent] ? new Date(ct[step.startEvent]).getTime() : 0;
                    const end = ct[step.endEvent] ? new Date(ct[step.endEvent]).getTime() : 0;
                    if (start && end && end >= start) {
                        const durationMs = end - start;
                        targetMonth.steps[step.key] += durationMs;
                        targetMonth.stepCounts[step.key]++;
                        opHasData = true;
                    }
                });
                // Use a general count of operations that have at least one valid step.
                // This is used for displaying the total in the title, not for averaging individual steps.
                if (opHasData) {
                    targetMonth.count++;
                }
            }
        });

        return months.map(month => {
            if (reportType === 'revenue' || reportType === 'throughput') {
                 if (month.count > 0 && reportType === 'revenue') {
                    // No change needed for total revenue
                } else if (month.count > 0 && reportType === 'throughput') {
                    // No change needed for total throughput
                }
                return month;
            }
            
            // For cycle time, calculate averages for each step based on its own count
            const avgSteps = Object.keys(month.steps).reduce((acc, key) => {
                const count = month.stepCounts[key];
                acc[key] = count > 0 ? (month.steps[key] / count) / 3600000 : 0; // ms to hours
                return acc;
            }, {} as Record<string, number>);
            
            const total = Object.values(avgSteps).reduce((sum, val) => sum + val, 0);
            
            return { ...month, steps: avgSteps, total, count: month.count };
        });

    }, [completedOps, startDate, modalityForReport, cycleTimeStepsForModality, reportType, settings]);

    const handleExport = () => {
        let headers: string[] = [];
        let rows: string[][] = [];
        const fileName = `${selectedTerminal}_${reportType}_${startDate}_to_${endDate}.csv`;
        const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;

        switch(reportType) {
            case 'cycleTime':
                headers = ['Transport ID', 'Modality', 'Customer', 'Product', 'ETA', ...cycleTimeStepsForModality.map(s => s.name)];
                rows = completedOps.map(op => {
                    const transfer = (op.transferPlan || [])[0]?.transfers[0];
                    if (!transfer || !op.cycleTimeData) return [];
                    const row = [op.transportId, op.modality, transfer.customer, transfer.product, formatDateTime(op.eta)];
                    cycleTimeStepsForModality.forEach(step => {
                        const start = op.cycleTimeData![step.startEvent] ? new Date(op.cycleTimeData![step.startEvent]).getTime() : 0;
                        const end = op.cycleTimeData![step.endEvent] ? new Date(op.cycleTimeData![step.endEvent]).getTime() : 0;
                        const durationHrs = (start && end && end > start) ? ((end-start)/3600000).toFixed(2) : '0';
                        row.push(durationHrs);
                    });
                    return row;
                }).filter(r => r.length > 0);
                break;
            case 'revenue':
            case 'throughput':
                headers = ['Transport ID', 'Modality', 'Customer', 'Product', 'Tonnes', 'Completed At'];
                if(reportType === 'revenue') headers.push('Throughput Value', 'Services Value', 'Total Value');
                rows = completedOps.map(op => {
                    const transfer = (op.transferPlan || [])[0]?.transfers[0];
                    if (!transfer) return [];
                    const row: (string|number)[] = [op.transportId, op.modality, transfer.customer, transfer.product, (transfer.transferredTonnes || transfer.tonnes), formatDateTime(op.completedTime)];
                     if(reportType === 'revenue') {
                        const { throughputValue, servicesValue, totalValue } = calculateOperationValue(op, settings);
                        row.push(throughputValue, servicesValue, totalValue);
                    }
                    return row.map(String);
                }).filter(r => r.length > 0);
                break;
            case 'downtime':
                 headers = ['Type', 'Resource/Transport', 'Reason', 'Start', 'End', 'Duration (Hrs)'];
                 const holdRows = filteredHolds.map(h => [
                    'Downtime', h.resource, h.reason, formatDateTime(h.startTime), formatDateTime(h.endTime), 
                    ((new Date(h.endTime).getTime() - new Date(h.startTime).getTime())/3600000).toFixed(2)
                 ]);
                 const delayRows = filteredDelayedOps.map(op => [
                    'Delay', op.transportId, op.delay?.reason || '', formatDateTime(op.delay?.time), 'N/A', 'N/A'
                 ]);
                 rows = [...holdRows, ...delayRows];
                break;
        }

        const csvContent = [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))].join('\n');
        downloadCsv(csvContent, fileName);
    };

    const renderReport = () => {
        const dataForModality = completedOps.filter(op => op.modality === modalityForReport);
        
        if (reportType === 'downtime') {
            const maxDowntimeAsset = Math.max(...downtimeByAsset.map(i => i.value), 0);
            const maxDowntimeReason = Math.max(...downtimeByReason.map(i => i.value), 0);
            const maxDelayReason = Math.max(...delaysByReason.map(i => i.value), 0);
            return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="card p-4"><BarChart title="Downtime by Asset (Hrs)" data={downtimeByAsset} maxValue={maxDowntimeAsset} valueFormatter={(v) => v.toFixed(1)} reportType="downtime" /></div>
                    <div className="card p-4"><BarChart title="Downtime Events by Reason" data={downtimeByReason} maxValue={maxDowntimeReason} valueFormatter={(v) => v.toFixed(0)} reportType="downtime" /></div>
                    <div className="card p-4"><BarChart title="Delay Events by Reason" data={delaysByReason} maxValue={maxDelayReason} valueFormatter={(v) => v.toFixed(0)} reportType="downtime" /></div>
                </div>
            );
        }

        if (dataForModality.length === 0) {
            return (
                <div className="card p-8 text-center text-text-secondary">
                    No completed '{modalityForReport}' operations match the selected filters.
                </div>
            );
        }

        const getYAxisTitle = () => {
            switch(reportType) {
                case 'throughput': return 'Tonnes';
                case 'revenue': return 'Revenue ($)';
                case 'cycleTime': return 'Hours';
                default: return '';
            }
        }
        
        return (
            <>
                <div className="card">
                    <MonthlyChart data={monthlyData} modality={modalityForReport} yAxisTitle={getYAxisTitle()}/>
                </div>
                <div className="card p-4">
                    <BreakdownCharts data={dataForModality} settings={settings} modality={modalityForReport} reportType={reportType} />
                </div>
            </>
        );
    };

    const reportTitles: Record<ReportType, string> = {
        cycleTime: 'Commercial Cycle Times',
        revenue: 'Commercial Revenue',
        throughput: 'Throughput Analysis',
        downtime: 'Downtime & Delays'
    };
    const modalityTitle = modalityForReport.charAt(0).toUpperCase() + modalityForReport.slice(1);

    return (
        <div>
            {/* Filter Bar */}
            <div className="sticky top-0 z-10 bg-background-card p-3 sm:p-4 border-b border-border-primary">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div>
                        <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="!py-1.5 font-semibold text-lg">
                            {isCommercials && <option value="revenue">Commercial Revenue</option>}
                            <option value="cycleTime">Cycle Times</option>
                            <option value="throughput">Throughput</option>
                            <option value="downtime">Downtime & Delays</option>
                        </select>
                    </div>
                    {reportType !== 'downtime' && <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setWorkspaceSearchTerm} />}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">From:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="!py-1.5"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">To:</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="!py-1.5"/>
                    </div>
                    {reportType !== 'downtime' && <>
                        <div>
                            <select value={customer} onChange={e => setCustomer(e.target.value)} className="!py-1.5">
                                {uniqueCustomers.map(c => <option key={c} value={c}>{c === 'All' ? 'All Customers' : c}</option>)}
                            </select>
                        </div>
                        <div>
                            <select value={productGroup} onChange={e => setProductGroup(e.target.value)} className="!py-1.5">
                                {uniqueProductGroups.map(pg => <option key={pg} value={pg}>{pg === 'All' ? 'All Product Groups' : pg}</option>)}
                            </select>
                        </div>
                    </>}
                    <div className="ml-auto flex items-center gap-4">
                         <button onClick={handleExport} className="btn-secondary">
                            <i className="fas fa-file-csv mr-2"></i>Export to CSV
                        </button>
                        {reportType !== 'downtime' && <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} showAllOption={false} />}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 sm:p-6 space-y-6 relative z-0">
                 <div className="pl-1 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-brand-dark flex items-center gap-x-3">
                        <span>{reportTitles[reportType]}</span>
                        {reportType !== 'downtime' && (
                            <span className="flex items-center gap-x-2 text-text-secondary" title={modalityTitle}>
                                <span>-</span>
                                <i className={`fas ${getIcon(modalityForReport)}`}></i>
                            </span>
                        )}
                    </h2>
                    {reportType === 'revenue' && (
                        <div className="card p-3 bg-green-100">
                            <p className="text-sm font-semibold text-green-700">Total Revenue (Filtered)</p>
                            <p className="text-2xl font-bold text-green-800">{formatCurrency(totalRevenue)}</p>
                        </div>
                    )}
                </div>
                {renderReport()}
            </div>
        </div>
    );
};

export default Reports;