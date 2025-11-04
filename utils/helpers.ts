import { Operation, SOFItem, Transfer, AppSettings, Modality, CalibrationPoint, TerminalSettings, Hold } from '../types';
import { SOF_EVENTS_MODALITY } from '../constants';

// Helper function for conditional class names
export const cn = (...classes: (string | boolean | undefined)[]) => {
    return classes.filter(Boolean).join(' ');
};

// Formatting helpers
export const formatNumber = (num: number | undefined) => (num || 0).toLocaleString();
export const formatDate = (dateStr: string | undefined) => dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';
export const formatTime = (dateStr: string | undefined) => dateStr ? new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
export const formatDateTime = (dateStr: string | undefined) => dateStr ? new Date(dateStr).toLocaleString() : 'N/A';
export const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '$0.00';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

// FIX: Export getOperationDurationHours to make it available for AppContext.
export const getOperationDurationHours = (op: Operation): number => {
    switch (op.modality) {
        case 'vessel': return 4;
        case 'truck': return 1;
        case 'rail': return 2;
        default: return 1;
    }
};

export const isoToDateInput = (isoString?: string): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        // Adjust for timezone offset
        const tzoffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzoffset).toISOString().split('T')[0];
    } catch {
        return '';
    }
};

export const isoToTimeInput = (isoString?: string): string => {
    if (!isoString) return '00:00';
    try {
        const date = new Date(isoString);
        const MS_PER_30_MINS = 30 * 60 * 1000;
        const roundedTime = new Date(Math.round(date.getTime() / MS_PER_30_MINS) * MS_PER_30_MINS);
        const hours = String(roundedTime.getHours()).padStart(2, '0');
        const minutes = String(roundedTime.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch {
        return '00:00';
    }
};

export const combineToIso = (datePart: string, timePart: string): string => {
    if (!datePart || !timePart) return '';
    try {
        // This assumes the inputs are in local time and creates a date object representing that local time, then converts to ISO (UTC)
        return new Date(`${datePart}T${timePart}:00`).toISOString();
    } catch {
        return '';
    }
};


export const formatInfraName = (infraId: string): string => {
    if (!infraId) return 'N/A';

    // Check if it's already formatted to avoid "Truck Truck Bay 1"
    if (infraId.toLowerCase().startsWith('truck ') || infraId.toLowerCase().startsWith('rail ') || infraId.toLowerCase().startsWith('dockline ')) {
        return infraId;
    }

    if (infraId.toLowerCase().startsWith('bay')) {
        return `Truck ${infraId}`;
    }
    if (infraId.toLowerCase().startsWith('siding')) {
        return `Rail ${infraId}`;
    }
    if (infraId.match(/^L\d+/)) {
        return `Dockline ${infraId}`;
    }
    return infraId;
};

export const calculateOperationValue = (operation: Operation, settings: AppSettings): { throughputValue: number; servicesValue: number; totalValue: number } => {
    if (!settings.contracts) {
        return { throughputValue: 0, servicesValue: 0, totalValue: 0 };
    }

    const { serviceRates, customerRates } = settings.contracts;
    let throughputValue = 0;
    let servicesValue = 0;

    operation.transferPlan.forEach(tp => {
        tp.transfers.forEach(t => {
            // Calculate throughput value
            const rate = customerRates?.[t.customer]?.[t.product]?.ratePerTonne || 0;
            const tonnes = operation.status === 'completed' ? t.tonnes : (t.transferredTonnes ?? t.tonnes);
            throughputValue += tonnes * rate;

            // Calculate services value
            t.specialServices.forEach(s => {
                servicesValue += serviceRates?.[s.name] || 0;
            });
        });
    });

    return {
        throughputValue,
        servicesValue,
        totalValue: throughputValue + servicesValue
    };
};

export const calculateOperationProgress = (op: Operation | null): { completed: number, total: number, percentage: number } => {
    if (!op) return { completed: 0, total: 0, percentage: 0 };

    // For non-active ops, progress is 0 or 100.
    if (op.status !== 'active') {
        const totalSteps = (SOF_EVENTS_MODALITY[op.modality]?.length || 1) * (op.transferPlan?.flatMap(tp => tp.transfers).length || 1);
        const percentage = op.status === 'completed' ? 100 : 0;
        return { completed: percentage === 100 ? totalSteps : 0, total: totalSteps, percentage };
    }

    let totalSofWeight = 0;
    let completedSofWeight = 0;

    op.transferPlan.forEach(tp => {
        tp.transfers.forEach(t => {
            const sof = t.sof || [];
            const modalitySteps = SOF_EVENTS_MODALITY[op.modality] || [];
            
            // Group SOF items by loop to handle reworks correctly
            const sofByLoop: Record<number, SOFItem[]> = sof.reduce((acc: Record<number, SOFItem[]>, s: SOFItem) => {
                (acc[s.loop] = acc[s.loop] || []).push(s);
                return acc;
            }, {});

            // Consider progress only for the latest loop
            const latestLoopNum = Math.max(0, ...Object.keys(sofByLoop).map(Number));
            const latestLoopSof = sofByLoop[latestLoopNum] || [];

            totalSofWeight += modalitySteps.length;
            
            let completedStepsInLoop = 0;
            let pumpingStarted = false;
            let pumpingStopped = false;

            latestLoopSof.forEach(s => {
                if (s.status === 'complete') {
                    completedStepsInLoop++;
                    const eventName = s.event.replace(/^(Rework #\d+: )/, '');
                    if (eventName === 'Pumping Started') pumpingStarted = true;
                    if (eventName === 'Pumping Stopped') pumpingStopped = true;
                }
            });

            if (pumpingStarted && !pumpingStopped) {
                // Pumping is active. Calculate fractional progress for this step.
                const tonnesProgress = (t.transferredTonnes || 0) / (t.tonnes || 1);
                // Subtract the 'Pumping Started' step that was counted as whole, and add its fractional progress.
                completedSofWeight += (completedStepsInLoop - 1 + Math.min(tonnesProgress, 1));
            } else {
                completedSofWeight += completedStepsInLoop;
            }
        });
    });

    if (totalSofWeight === 0) {
        // Fallback for active ops without SOF initialized
        const numTransfers = op.transferPlan?.flatMap(tp => tp.transfers).length || 1;
        const totalSteps = (SOF_EVENTS_MODALITY[op.modality]?.length || 1) * numTransfers;
        return { completed: 0, total: totalSteps > 0 ? totalSteps : 1, percentage: 0 };
    }
    
    const percentage = totalSofWeight > 0 ? (completedSofWeight / totalSofWeight) * 100 : 0;

    return {
        completed: Math.round(completedSofWeight),
        total: totalSofWeight,
        percentage: Math.min(percentage, 100) // Cap at 100%
    };
};

export const calculateTransferProgress = (transfer: Transfer | undefined, modality: Modality): { completed: number, total: number, percentage: number } => {
    if (!transfer) return { completed: 0, total: 1, percentage: 0 };
    const sof = transfer.sof || [];
    const modalitySteps = SOF_EVENTS_MODALITY[modality] || [];
    const total = modalitySteps.length;
    if (total === 0) return { completed: 0, total: 0, percentage: 0 };
    
    const sofByLoop: Record<number, SOFItem[]> = sof.reduce((acc: Record<number, SOFItem[]>, s: SOFItem) => {
        (acc[s.loop] = acc[s.loop] || []).push(s);
        return acc;
    }, {});

    const latestLoopNum = Math.max(0, ...Object.keys(sofByLoop).map(Number));
    const latestLoopSof = sofByLoop[latestLoopNum] || [];
    const completed = latestLoopSof.filter(s => s.status === 'complete').length;

    const percentage = total > 0 ? (completed / total) * 100 : 0;
    return { completed, total, percentage: Math.min(100, percentage) };
};


/**
 * Identifies which specific transfers within an operation are currently active (i.e., pumping).
 * @param op The operation to check.
 * @returns An array of active Transfer objects.
 */
export const getActiveTransfers = (op: Operation): Transfer[] => {
    if (!op || op.status !== 'active') {
        return [];
    }

    const activeTransfers: Transfer[] = [];

    op.transferPlan?.forEach(tp => {
        tp.transfers?.forEach(t => {
            if (!t.sof || t.sof.length === 0) {
                return;
            }

            // Group SOF items by loop number
            const sofByLoop: Record<number, SOFItem[]> = t.sof.reduce((acc: Record<number, SOFItem[]>, s: SOFItem) => {
                (acc[s.loop] = acc[s.loop] || []).push(s);
                return acc;
            }, {});

            let isActiveInAnyLoop = false;
            for (const loopNum in sofByLoop) {
                const loopEvents = sofByLoop[loopNum];
                const hasStarted = loopEvents.some(s => s.event.includes('Pumping Started') && s.status === 'complete');
                const hasStopped = loopEvents.some(s => s.event.includes('Pumping Stopped') && s.status === 'complete');
                
                if (hasStarted && !hasStopped) {
                    isActiveInAnyLoop = true;
                    break;
                }
            }
            
            if (isActiveInAnyLoop) {
                activeTransfers.push(t);
            }
        });
    });

    return activeTransfers;
};

export const downloadCsv = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

export const interpolate = (dip: number, points: CalibrationPoint[]): number => {
    if (!points || points.length === 0) return 0;
    
    const sortedPoints = [...points].sort((a, b) => a.dip - b.dip);

    // Handle edge cases: dip is outside the calibration range
    if (dip <= sortedPoints[0].dip) return sortedPoints[0].volume;
    if (dip >= sortedPoints[sortedPoints.length - 1].dip) return sortedPoints[sortedPoints.length - 1].volume;

    // Find the two points to interpolate between
    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const p1 = sortedPoints[i];
        const p2 = sortedPoints[i + 1];
        if (dip >= p1.dip && dip <= p2.dip) {
            if (p2.dip - p1.dip === 0) return p1.volume; // Avoid division by zero
            const slope = (p2.volume - p1.volume) / (p2.dip - p1.dip);
            return p1.volume + slope * (dip - p1.dip);
        }
    }
    
    // Fallback for single point or other unexpected cases
    return sortedPoints[0]?.volume || 0;
};

export const validateOperationPlan = (op: Operation, terminalSettings: TerminalSettings, allSettings: AppSettings, holds: Hold[]): { isValid: boolean; issues: string[] } => {
    const issues: string[] = [];
    const { masterTanks, docklines } = terminalSettings;

    if (!op.transferPlan || op.transferPlan.length === 0) {
        issues.push("Plan has no infrastructure or transfers.");
    }

    op.transferPlan.forEach((line, lineIndex) => {
        if (!line.infrastructureId) {
            issues.push(`Lineup #${lineIndex + 1}: Missing infrastructure assignment.`);
        }

        if (line.transfers.length === 0 && op.modality !== 'truck') { // Trucks might not have a transfer initially
            issues.push(`Lineup #${lineIndex + 1} (${formatInfraName(line.infrastructureId)}): No transfers planned.`);
        }

        line.transfers.forEach((transfer, transferIndex) => {
            const isToTank = transfer.direction.endsWith(' to Tank');
            const isFromTank = transfer.direction.startsWith('Tank to');

            // MASTER DATA VALIDATION: Check if a valid tank can even be selected
            if (transfer.customer && transfer.product && line.infrastructureId && (isToTank || isFromTank)) {
                const customerAllowedTanks = terminalSettings.customerMatrix
                    ?.find(m => m.customer === transfer.customer && m.product === transfer.product)?.tanks || [];

                if (customerAllowedTanks.length === 0) {
                    issues.push(`Transfer #${transferIndex + 1} (${transfer.product}): No tanks configured for this customer and product. Check Customer Mappings.`);
                } else {
                    const infraAllowedTanks = terminalSettings.infrastructureTankMapping?.[line.infrastructureId] || [];
                    const availableOptions = customerAllowedTanks.filter(tank => infraAllowedTanks.includes(tank));
                    if (availableOptions.length === 0) {
                        issues.push(`Transfer #${transferIndex + 1} (${transfer.product}): No configured tanks for this product are connected to ${formatInfraName(line.infrastructureId)}. Check Infrastructure Mappings.`);
                    }
                }
            }

            // Check for missing tanks
            if (isToTank && !transfer.to) {
                issues.push(`Transfer #${transferIndex + 1} (${transfer.product || 'New'}): Missing destination tank.`);
            }
            if (isFromTank && !transfer.from) {
                issues.push(`Transfer #${transferIndex + 1} (${transfer.product || 'New'}): Missing source tank.`);
            }
            
            // Check for unsafe transfers if tanks are selected
            if (isToTank || isFromTank) {
                const tankName = isToTank ? transfer.to : transfer.from;
                const tankData = masterTanks?.[tankName];
                
                if (tankName && !tankData) {
                    issues.push(`Tank "${tankName}" is not found in master data.`);
                } else if (tankData) {
                    const currentVolume = tankData.current || 0;
                    const capacity = tankData.capacity || 0;
                    const transferVolume = transfer.tonnes || 0;
                    const safeFillVolume = capacity * 0.98;

                    if (isToTank && (currentVolume + transferVolume > safeFillVolume)) {
                        issues.push(`UNSAFE: Transfer to ${tankName} exceeds safe fill level by ${((currentVolume + transferVolume) - safeFillVolume).toLocaleString()} T.`);
                    }
                    if (isFromTank && (currentVolume - transferVolume < 0)) {
                        issues.push(`UNSAFE: Transfer from ${tankName} results in a negative volume.`);
                    }
                }
            }
            
            // Check for compatibility
            if (line.infrastructureId && transfer.product) {
                const dockline = docklines?.[line.infrastructureId];
                if (dockline) {
                    const lastProduct = dockline.lastProduct;
                    const lastGroup = allSettings.productGroups[lastProduct];
                    const currentGroup = allSettings.productGroups[transfer.product];

                    if (lastGroup && currentGroup && allSettings.compatibility[lastGroup]?.[currentGroup] === 'X') {
                         issues.push(`INCOMPATIBLE: ${transfer.product} (${currentGroup}) is incompatible with last product on ${formatInfraName(line.infrastructureId)} (${lastProduct} - ${lastGroup}).`);
                    }
                }
            }
        });

         // Check for Hold conflicts
        if (line.infrastructureId) {
            const opStart = new Date(op.eta).getTime();
            const opEnd = opStart + getOperationDurationHours(op) * 3600 * 1000;
            const activeHolds = holds.filter(h => h.status === 'approved' && h.workOrderStatus !== 'Closed');

            const conflictingHold = activeHolds.find(hold => {
                if (hold.resource !== line.infrastructureId) return false;
                const holdStart = new Date(hold.startTime).getTime();
                const holdEnd = new Date(hold.endTime).getTime();
                const timeOverlap = opStart < holdEnd && opEnd > holdStart;
                if (!timeOverlap) return false;

                // If hold is for a specific tank, check if the op uses that tank
                if (hold.tank) {
                    return line.transfers.some(t => t.from === hold.tank || t.to === hold.tank);
                }
                
                return true; // Full infrastructure hold
            });

            if (conflictingHold) {
                issues.push(`CONFLICT: Plan for ${formatInfraName(line.infrastructureId)} overlaps with a hold for "${conflictingHold.reason}".`);
            }
        }
    });

    return {
        isValid: issues.length === 0,
        issues,
    };
};