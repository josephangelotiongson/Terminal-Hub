


import { Operation, SOFItem, Transfer, AppSettings, Modality, CalibrationPoint, TerminalSettings, Hold, OperationStatus, User } from '../types';
import { SOF_EVENTS_MODALITY, VESSEL_COMMON_EVENTS, VESSEL_COMMODITY_EVENTS } from '../constants';

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

export const formatFileSize = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// FIX: Added and exported the 'getIcon' helper function to be used across multiple components.
export const getIcon = (modality: Modality): string => {
    switch (modality) {
        case 'vessel': return 'fa-ship';
        case 'truck': return 'fa-truck';
        case 'rail': return 'fa-train';
        default: return 'fa-question-circle';
    }
};


export const getOperationDurationHours = (op: Operation): number => {
    if (op.modality === 'vessel' && op.transferPlan?.some(l => l.transfers?.length > 0)) {
        const totalTonnes = op.transferPlan.reduce((sum, line) => 
            sum + line.transfers.reduce((s, t) => s + (t.tonnes || 0), 0), 
        0);
        // Assuming an average pump rate of 1000 T/hr + some setup/teardown time
        const PUMP_RATE = 1000;
        const SETUP_TEARDOWN_HOURS = 2;
        const cleaningHours = op.transferPlan.reduce((sum, line) =>
            sum + line.transfers.filter(t => t.preTransferCleaningSof).length, 0
        ); // Add 1 hour for each cleaning
        return (totalTonnes / PUMP_RATE) + SETUP_TEARDOWN_HOURS + cleaningHours;
    }

    if (op.durationHours && typeof op.durationHours === 'number' && op.durationHours > 0) {
        return op.durationHours;
    }
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

// --- NEW PERMISSION HELPERS ---

export const canCreateOperation = (user: User): boolean => {
    return user.role === 'Terminal Planner';
};

export const canCreateHold = (user: User): boolean => {
    return ['Operations Lead', 'Operator'].includes(user.role);
};

export const canEditPlan = (user: User): boolean => {
    return ['Operations Lead', 'Dispatch', 'Terminal Planner'].includes(user.role);
};

export const canReschedule = (user: User): boolean => {
    return ['Operations Lead', 'Dispatch', 'Terminal Planner'].includes(user.role);
};

export const canRequestReschedule = (user: User): boolean => {
    return user.role === 'Operator';
};

export const canPerformSofAction = (user: User, opModality: Modality, sofEventName: string): boolean => {
    const eventBaseName = sofEventName.replace(/^(Rework #\d+: )?(.*)$/, '$2');

    if (user.role === 'Operations Lead' || user.delegatedBy) {
        return true;
    }

    if (opModality === 'truck') {
        const dispatchSteps = ['Arrived', 'Ready / Approved', 'Directed to Bay', 'Paperwork Done', 'BOL Printed', 'Departed'];
        const operatorSteps = ['On Bay', 'Pumping Started', 'Pumping Stopped', 'Post-Load Weighing', 'Seal Applied'];

        if (user.role === 'Dispatch') {
            return dispatchSteps.includes(eventBaseName);
        }
        if (user.role === 'Operator') {
            return operatorSteps.includes(eventBaseName);
        }
    } else { // For vessel and rail, the rules are simpler for now
        if (user.role === 'Operator' || user.role === 'Dispatch') {
            return true;
        }
    }

    return false;
};

export const canDispatchTrucks = (user: User): boolean => {
    return ['Operations Lead', 'Dispatch'].includes(user.role);
};

export const canClearBay = (user: User): boolean => {
    return ['Operations Lead', 'Dispatch'].includes(user.role);
};

export const canApproveGate = (user: User): boolean => {
    return ['Operations Lead', 'Dispatch'].includes(user.role);
};

export const canEditCompletedOpFinancials = (user: User): boolean => {
    return ['Operations Lead', 'Commercials'].includes(user.role);
}

// --- END PERMISSION HELPERS ---

export const calculateOperationValue = (operation: Operation, settings: AppSettings): { throughputValue: number; servicesValue: number; totalValue: number } => {
    if (!settings.contracts) {
        return { throughputValue: 0, servicesValue: 0, totalValue: 0 };
    }

    const { serviceRates, customerRates } = settings.contracts;
    let throughputValue = 0;
    let servicesValue = 0;

    (operation.transferPlan || []).forEach(tp => {
        (tp.transfers || []).forEach(t => {
            const rate = customerRates?.[t.customer]?.[t.product]?.ratePerTonne || 0;
            
            // Determine the billable tonnes. For completed ops, it's what was actually moved.
            let billableTonnes = 0;
            if (operation.status === 'completed') {
                billableTonnes = t.loadedWeight || t.transferredTonnes || t.tonnes || 0;
            } else {
                // For active ops, it's what has been transferred so far.
                 billableTonnes = (t.transferredTonnes || 0) + (t.slopsTransferredTonnes || 0);
            }

            throughputValue += billableTonnes * rate;

            (t.specialServices || []).forEach(s => {
                servicesValue += serviceRates?.[s.name] || 0;
            });
        });
    });
    
    // Add vessel-level services
    (operation.specialRequirements || []).forEach(s => {
        servicesValue += serviceRates?.[s.name] || 0;
    });

    const labourRecovery = operation.labourRecovery || 0;
    const otherRecoveries = operation.otherRecoveries || 0;

    return {
        throughputValue,
        servicesValue,
        totalValue: throughputValue + servicesValue + labourRecovery + otherRecoveries
    };
};

export const calculateActualDuration = (op: Operation): number => {
    if (!op.completedTime) return 0;

    const allSofs = [
        ...(op.sof || []),
        ...op.transferPlan.flatMap(tp => tp.transfers.flatMap(t => t.sof || []))
    ].filter(s => s.status === 'complete' && s.time);

    if (allSofs.length === 0) {
        // Fallback to ETA if no SOF events exist
        return (new Date(op.completedTime).getTime() - new Date(op.eta).getTime()) / (3600 * 1000);
    }
  
    // Find the earliest SOF time
    const firstSofTime = allSofs.map(s => new Date(s.time).getTime()).reduce((min, t) => Math.min(min, t), Infinity);
    const lastSofTime = new Date(op.completedTime).getTime();

    if (isFinite(firstSofTime) && lastSofTime > firstSofTime) {
        return (lastSofTime - firstSofTime) / (3600 * 1000);
    }
    
    // Fallback if SOF times are weird
    return (new Date(op.completedTime).getTime() - new Date(op.eta).getTime()) / (3600 * 1000);
};

export const calculateOperationProgress = (op: Operation | null, infraId?: string): { completed: number, total: number, percentage: number } => {
    if (!op) {
        return { completed: 0, total: 1, percentage: 0 };
    }

    const transfersToConsider = (op.transferPlan || [])
        .filter(line => !infraId || line.infrastructureId === infraId)
        .flatMap(line => line.transfers);

    const totalTonnes = transfersToConsider.reduce((sum, t) => sum + (t.tonnes || 0), 0);

    if (totalTonnes === 0) {
        return { completed: 0, total: 0, percentage: 0 };
    }

    // For cancelled ops, progress is always 0.
    if (op.status === 'cancelled') {
        return { completed: 0, total: totalTonnes, percentage: 0 };
    }

    // For all other statuses (planned, active, completed), calculate based on actual transferred volume.
    // For 'planned', transferredTonnes will be 0.
    // For 'completed', transferredTonnes will be forced to equal totalTonnes.
    let transferredTonnes = transfersToConsider.reduce((sum, t) => 
        sum + (t.transferredTonnes || 0) + (t.slopsTransferredTonnes || 0), 
        0
    );

    // If the operation is marked complete, we assume 100% of the planned volume was transferred.
    if (op.status === 'completed') {
        if (op.modality === 'truck') {
            transferredTonnes = transfersToConsider.reduce((sum, t) => sum + (t.loadedWeight || t.transferredTonnes || t.tonnes || 0), 0);
        } else {
            transferredTonnes = transfersToConsider.reduce((sum, t) => sum + (t.transferredTonnes || t.tonnes || 0), 0);
        }
    }

    // Clamp transferred tonnes to not exceed total planned tonnes.
    transferredTonnes = Math.min(transferredTonnes, totalTonnes);

    const percentage = (transferredTonnes / totalTonnes) * 100;
    
    return {
        completed: transferredTonnes,
        total: totalTonnes,
        percentage: Math.min(100, Math.max(0, percentage)), // Clamp between 0 and 100
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

    (op.transferPlan || []).forEach(tp => {
        (tp.transfers || []).forEach(t => {
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

    if (!Array.isArray(op.transferPlan) || op.transferPlan.length === 0) {
        issues.push("Plan has no infrastructure or transfers.");
    }

    (op.transferPlan || []).forEach((line, lineIndex) => {
        if (!line.infrastructureId) {
            issues.push(`Lineup #${lineIndex + 1}: Missing infrastructure assignment.`);
        }

        if (!Array.isArray(line.transfers) || (line.transfers.length === 0 && op.modality !== 'truck')) {
            issues.push(`Lineup #${lineIndex + 1} (${formatInfraName(line.infrastructureId)}): No transfers planned.`);
        }
        
        (line.transfers || []).forEach((transfer, transferIndex) => {
            // --- CONSOLIDATED INCOMPATIBILITY CHECKS ---
            let prevProduct: string | undefined;
            let context = '';

            if (transferIndex === 0) {
                // First transfer on the line: check against last product used on the infrastructure
                prevProduct = docklines?.[line.infrastructureId]?.lastProduct;
                if (prevProduct) {
                    context = `Last product on ${formatInfraName(line.infrastructureId)} was ${prevProduct}.`;
                }
            } else {
                // Subsequent transfer: check against the previous transfer in this operation's plan
                prevProduct = line.transfers[transferIndex - 1]?.product;
                if (prevProduct) {
                    context = `Previous transfer was ${prevProduct}.`;
                }
            }

            if (prevProduct && transfer.product) {
                const prevGroup = allSettings.productGroups[prevProduct];
                const currentGroup = allSettings.productGroups[transfer.product];

                if (prevGroup && currentGroup && allSettings.compatibility[prevGroup]?.[currentGroup] === 'X') {
                    // If incompatible, the plan is only valid if cleaning is explicitly scheduled.
                    if (!transfer.preTransferCleaningSof || transfer.preTransferCleaningSof.length === 0) {
                        issues.push(`INCOMPATIBLE: Cleaning required before transferring ${transfer.product}. ${context}`);
                    }
                }
            }

            // --- OTHER VALIDATION CHECKS (Mappings, Tanks, etc.) ---
            const isToTank = transfer.direction.endsWith(' to Tank');
            const isFromTank = transfer.direction.startsWith('Tank to');

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

            if (isToTank && !transfer.to) {
                issues.push(`Transfer #${transferIndex + 1} (${transfer.product || 'New'}): Missing destination tank.`);
            }
            if (isFromTank && !transfer.from) {
                issues.push(`Transfer #${transferIndex + 1} (${transfer.product || 'New'}): Missing source tank.`);
            }
            
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
        });

        // --- HOLD CONFLICT CHECK ---
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

                if (hold.tank) {
                    return (line.transfers || []).some(t => t.from === hold.tank || t.to === hold.tank);
                }
                
                return true;
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

/**
 * Derives the currentStatus, truckStatus, and overall status for an operation based on its SOF progress.
 * @param op The operation to analyze.
 * @param force Whether to override a "sticky" issue status. Defaults to false.
 * @returns An object with new statuses if a change is detected, otherwise null.
 */
export const deriveStatusFromSof = (op: Operation, force: boolean = false): Partial<Operation> | null => {
    if (!force) {
        const stickyIssueStatuses = ['Reschedule Required', 'No Show', 'Delayed', 'Reschedule Requested'];
        if (stickyIssueStatuses.includes(op.currentStatus) || op.delay?.active) {
            return null;
        }
    }

    let newStatuses: Partial<Operation> | null = null;

    switch (op.modality) {
        case 'truck': {
            const transfer = op.transferPlan?.[0]?.transfers?.[0];
            if (!transfer?.sof || transfer.sof.length === 0) return null;

            const maxLoop = Math.max(1, ...transfer.sof.map(s => s.loop));
            const currentLoopSof = transfer.sof.filter(s => s.loop === maxLoop);
            const truckSofEventSequence = SOF_EVENTS_MODALITY['truck'];

            const completedEventsInCurrentLoop = new Set(
                currentLoopSof
                    .filter(s => s.status === 'complete')
                    .map(s => s.event.replace(/^(Rework #\d+: )/, ''))
            );

            let latestCompletedStep: string | null = null;
            for (let i = truckSofEventSequence.length - 1; i >= 0; i--) {
                if (completedEventsInCurrentLoop.has(truckSofEventSequence[i])) {
                    latestCompletedStep = truckSofEventSequence[i];
                    break;
                }
            }

            let currentStatus = 'Scheduled', truckStatus = 'Planned', status: OperationStatus = 'planned';
            switch (latestCompletedStep) {
                case 'Departed': currentStatus = 'Departed'; truckStatus = 'Departed'; status = 'completed'; break;
                case 'BOL Printed': currentStatus = 'Paperwork'; truckStatus = 'Awaiting Departure'; status = 'active'; break;
                case 'Seal Applied': currentStatus = 'Sealing'; truckStatus = 'Completing'; status = 'active'; break;
                case 'Post-Load Weighing': currentStatus = 'Weighing'; truckStatus = 'Completing'; status = 'active'; break;
                case 'Pumping Stopped': currentStatus = 'Completing'; truckStatus = 'Completing'; status = 'active'; break;
                case 'Pumping Started': currentStatus = 'Pumping'; truckStatus = 'Loading'; status = 'active'; break;
                case 'On Bay': currentStatus = 'On Bay'; truckStatus = 'On Bay'; status = 'active'; break;
                case 'Directed to Bay': currentStatus = 'Directed to Bay'; truckStatus = 'Directed to Bay'; status = 'active'; break;
                case 'Ready / Approved': currentStatus = 'Waiting for Bay'; truckStatus = 'Waiting'; status = 'active'; break;
                case 'Arrived': currentStatus = 'Awaiting Approval'; truckStatus = 'Registered'; status = 'active'; break;
            }
            newStatuses = { currentStatus, truckStatus, status };
            break;
        }
        case 'vessel': {
            // This logic is simple as rework is not implemented for vessels yet. It can be improved later.
            const completedCommonSof = new Set((op.sof || []).filter(s => s.status === 'complete').map(s => s.event));
            const isPumping = op.transferPlan.some(tp => tp.transfers.some(t => (t.sof || []).some(s => s.event.includes('START PUMPING') && s.status === 'complete' && !(t.sof || []).some(s2 => s2.event.includes('STOP PUMPING') && s2.status === 'complete'))));

            let currentStatus = 'Scheduled', status: OperationStatus = 'planned';
            if (completedCommonSof.has('CREW COMPLETED / SITE SECURE')) { currentStatus = 'Departed'; status = 'completed'; }
            else if (completedCommonSof.has('LAST HOSE DISCONNECTED')) { currentStatus = 'Completing'; status = 'active'; }
            else if (isPumping) { currentStatus = 'Pumping'; status = 'active'; }
            else if (completedCommonSof.has('SURVEYOR ONBOARD')) { currentStatus = 'Surveying'; status = 'active'; }
            else if (completedCommonSof.has('VESSEL ALONGSIDE')) { currentStatus = 'Alongside'; status = 'active'; }
            else if (completedCommonSof.has('START PREPARATIONS / CREW ONSITE')) { currentStatus = 'Preparations'; status = 'active'; }
            
            newStatuses = { currentStatus, status };
            break;
        }
        case 'rail': {
            // This logic is simple as rework is not implemented for rail yet.
            const transfer = op.transferPlan?.[0]?.transfers?.[0];
            if (!transfer?.sof) return null;
            const railSofEvents = SOF_EVENTS_MODALITY['rail'];
            const completedSof = new Set(transfer.sof.filter(s => s.status === 'complete').map(s => s.event.replace(/^(Rework #\d+: )/, '')));
            
            let latestCompletedStep: string | null = null;
            for (let i = railSofEvents.length - 1; i >= 0; i--) {
                if (completedSof.has(railSofEvents[i])) { latestCompletedStep = railSofEvents[i]; break; }
            }

            let currentStatus = 'Scheduled', status: OperationStatus = 'planned';
            switch (latestCompletedStep) {
                case 'Departed': currentStatus = 'Departed'; status = 'completed'; break;
                case 'Paperwork Done': currentStatus = 'Completing'; status = 'active'; break;
                case 'Hose Disconnect': currentStatus = 'Completing'; status = 'active'; break;
                case 'Pumping Stopped': currentStatus = 'Completing'; status = 'active'; break;
                case 'Pumping Started': currentStatus = 'Pumping'; status = 'active'; break;
                case 'Checks OK': currentStatus = 'On Siding'; status = 'active'; break;
                case 'On Siding': currentStatus = 'On Siding'; status = 'active'; break;
                case 'Arrived at Terminal': currentStatus = 'Arrived'; status = 'active'; break;
            }
            newStatuses = { currentStatus, status };
            break;
        }
    }

    if (newStatuses && (newStatuses.currentStatus !== op.currentStatus || newStatuses.truckStatus !== op.truckStatus || (newStatuses.status && newStatuses.status !== op.status))) {
        return newStatuses;
    }

    return null;
};

export const calculateAndSetCycleTime = (op: Operation): Operation => {
    const cycleTimeData = { ...(op.cycleTimeData || {}) };
    const allSof = (op.transferPlan || []).flatMap(tp => (tp.transfers || []).flatMap(t => t.sof || []));
    (op.sof || []).forEach(s => allSof.push(s));
    
    allSof.forEach(s => {
        if(s.status === 'complete') {
            const eventName = s.event.replace(/^(Rework #\d+: )?(.*)$/, '$2');
            if(!cycleTimeData[eventName]) {
                 cycleTimeData[eventName] = s.time;
            }
        }
    });
    return { ...op, cycleTimeData };
};

export const getLatestSofTimestamp = (op: Operation): string => {
    const allSof = [
        ...(op.sof || []),
        ...(op.transferPlan || []).flatMap(tp => (tp.transfers || []).flatMap(t => t.sof || []))
    ];
    
    const completedSteps = allSof.filter(s => s.status === 'complete' && s.time);
    
    if (completedSteps.length === 0) {
        return op.eta; // For planned items, their "last activity" is their scheduled start
    }
    
    // Find the latest time among all completed steps
    completedSteps.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    
    return completedSteps[0].time;
};

export const getOperationColorClass = (op: Operation): string => {
    // Priority 1: Issues that require attention
    if (op.status === 'cancelled' || op.delay?.active || op.currentStatus === 'Reschedule Required' || op.currentStatus === 'No Show' || op.truckStatus === 'Rejected' || op.currentStatus === 'Reschedule Requested') {
        return 'status-rejected'; // Red
    }
    // Priority 2: Completed operations
    if (op.status === 'completed' || op.currentStatus === 'Departed') {
        return 'status-departed'; // Grey
    }
    // Priority 3: Active operations (with different states)
    if (op.status === 'active') {
        // Check for completing states first
        const completingStates = ['Completing', 'Awaiting Departure', 'Weighing', 'Sealing', 'Paperwork', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Pumping Stopped'];
        if (completingStates.includes(op.currentStatus) || completingStates.includes(op.truckStatus || '')) {
            return 'status-completing';
        }

        // Now check for active pumping/loading states
        const loadingStates = ['On Bay', 'Loading', 'Pumping'];
        if (loadingStates.includes(op.currentStatus) || loadingStates.includes(op.truckStatus || '')) {
             return 'status-loading';
        }

        // NEW logic for trucks
        if (op.modality === 'truck') {
            if (op.truckStatus === 'Registered' || op.currentStatus === 'Awaiting Approval') {
                return 'status-arrived'; // Dark Blue
            }
            if (op.truckStatus === 'Waiting' || op.truckStatus === 'Directed to Bay' || op.currentStatus === 'Waiting for Bay' || op.currentStatus === 'Directed to Bay') {
                return 'status-approved'; // Light Green
            }
        }
        
        // Fallback for other active states (e.g. vessel alongside)
        return 'status-arrived'; // Use dark blue as a general "active but waiting"
    }
    // Priority 4: Default planned state
    if (op.status === 'planned') {
        return 'status-planned'; // Light Blue
    }
    
    // Fallback
    return 'status-departed'; // Default to grey if status is unknown
};

export const getOperationBorderColorClass = (op: Operation): string => {
    // Priority 1: Issues that require attention
    if (op.status === 'cancelled' || op.delay?.active || op.currentStatus === 'Reschedule Required' || op.currentStatus === 'No Show' || op.truckStatus === 'Rejected' || op.currentStatus === 'Reschedule Requested') {
        return 'border-rose-700'; // Red
    }
    // Priority 2: Completed operations
    if (op.status === 'completed' || op.currentStatus === 'Departed') {
        return 'border-slate-600'; // Grey
    }
    // Priority 3: Active operations (with different states)
    if (op.status === 'active') {
        // Check for completing states first
        const completingStates = ['Completing', 'Awaiting Departure', 'Weighing', 'Sealing', 'Paperwork', 'Post-Load Weighing', 'Seal Applied', 'BOL Printed', 'Pumping Stopped'];
        if (completingStates.includes(op.currentStatus) || completingStates.includes(op.truckStatus || '')) {
            return 'border-slate-400';
        }

        // Now check for active pumping/loading states
        const loadingStates = ['On Bay', 'Loading', 'Pumping'];
        if (loadingStates.includes(op.currentStatus) || loadingStates.includes(op.truckStatus || '')) {
             return 'border-green-600';
        }
        
        if (op.modality === 'truck') {
            if (op.truckStatus === 'Registered' || op.currentStatus === 'Awaiting Approval') {
                return 'border-blue-700'; // Dark Blue
            }
            if (op.truckStatus === 'Waiting' || op.truckStatus === 'Directed to Bay' || op.currentStatus === 'Waiting for Bay' || op.currentStatus === 'Directed to Bay') {
                return 'border-lime-500'; // Light Green
            }
        }
        
        // Fallback for other active states
        return 'border-blue-700';
    }
    // Priority 4: Default planned state
    if (op.status === 'planned') {
        return 'border-blue-400'; // Light Blue for planned
    }
    
    // Fallback
    return 'border-slate-300'; // Default to grey if status is unknown
};

export const naturalSort = (a: string, b: string): number => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

export const createDocklineToWharfMap = (terminalSettings: TerminalSettings): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const wharfMapping = terminalSettings.wharfDocklineMapping || {};
    Object.entries(wharfMapping).forEach(([wharf, docklines]) => {
        if (Array.isArray(docklines)) {
            docklines.forEach(id => { mapping[id] = wharf; });
        }
    });
    return mapping;
};