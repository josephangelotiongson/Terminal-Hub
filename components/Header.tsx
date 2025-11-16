


import React, { useContext, useState, useRef, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import WorkspaceSearch from './WorkspaceSearch';
import ModalityFilter from './ModalityFilter';
import { formatInfraName, naturalSort, createDocklineToWharfMap, canCreateOperation } from '../utils/helpers';

const Header: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { 
        online, selectedTerminal, getOperationById, activeOpId, currentView, 
        setIsSidebarOpen, workspaceSearchTerm, setWorkspaceSearchTerm,
        activeLineIndex, activeTransferIndex,
        viewHistory, goBack,
        workspaceFilter, setWorkspaceFilter,
        visibleInfrastructure, updateColumnVisibility,
        currentTerminalSettings,
        openNewOpModal,
        isTimePlaying, setIsTimePlaying, simulatedTime,
        currentUser
    } = context;
    
    const [isInfraFilterOpen, setIsInfraFilterOpen] = useState(false);
    const infraFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isInfraFilterOpen && infraFilterRef.current && !infraFilterRef.current.contains(e.target as Node)) {
                setIsInfraFilterOpen(false);
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isInfraFilterOpen]);

    const { filteredInfrastructure, docklineToWharfMap } = useMemo(() => {
        const infraMap = currentTerminalSettings.infrastructureModalityMapping || {};
        const wharfMap = createDocklineToWharfMap(currentTerminalSettings);
        
        const allInfra = Object.keys(infraMap).sort((a, b) => {
            const wharfA = wharfMap[a] || 'zzz';
            const wharfB = wharfMap[b] || 'zzz';
            if (wharfA < wharfB) return -1;
            if (wharfA > wharfB) return 1;
            return naturalSort(a, b);
        });
        
        const modalityFiltered = workspaceFilter === 'all'
            ? allInfra
            : allInfra.filter(infra => currentTerminalSettings.infrastructureModalityMapping[infra] === workspaceFilter);

        return { filteredInfrastructure: modalityFiltered, docklineToWharfMap: wharfMap };
    }, [workspaceFilter, currentTerminalSettings]);

    const handleInfraVisibilityChange = (infraId: string, isChecked: boolean) => {
        const newSet = new Set(visibleInfrastructure);
        if (isChecked) {
            newSet.add(infraId);
        } else {
            newSet.delete(infraId);
        }
        const newVisibleCols = Array.from(newSet).sort((a, b) => filteredInfrastructure.indexOf(a) - filteredInfrastructure.indexOf(b));
        updateColumnVisibility(newVisibleCols);
    };

    const terminalNames: { [key: string]: string } = {
        PAL: 'Port Alpha',
        CBY: 'Central Bay',
        RVE: 'Riverton East'
    };
    const terminalName = terminalNames[selectedTerminal] || selectedTerminal;
    
    const getTitle = () => {
        const activeOp = getOperationById(activeOpId);
        switch (currentView) {
            case 'dashboard': return 'Dashboard';
            case 'planning': return 'Planning';
            case 'active-operations-list': return 'Active Operations';
            case 'completed': return 'Completed Operations';
            case 'reports': return 'Reports';
            case 'config-matrix': return 'System Configuration';
            case 'master-data': return 'Master Data';
            case 'outage-planning': return 'Outage Planning';
            case 'maintenance': return 'Maintenance Work Orders';
            case 'manpower': return 'Manpower';
            case 'operation-details': return `Op Details: ${activeOp?.transportId || '...'}`;
            case 'operation-plan': return `Edit Plan: ${activeOp?.transportId || 'New'}`;
            case 'special-services': return `Special Services: ${activeOp?.transportId || '...'}`;
            case 'product-transfer-details': {
                if (activeOp && activeLineIndex !== null && activeTransferIndex !== null) {
                    const transfer = activeOp.transferPlan[activeLineIndex]?.transfers[activeTransferIndex];
                    if (transfer) {
                        return `${activeOp.transportId}: ${transfer.product}`;
                    }
                }
                return `Transfer Details`;
            }
            default: return 'Terminal Hub';
        }
    };
    
    const showWorkspaceControls = ['dashboard', 'planning', 'active-operations-list', 'manpower'].includes(currentView);
    const showColumnFilter = ['planning', 'active-operations-list', 'manpower'].includes(currentView);
    const showModalityFilter = ['planning', 'active-operations-list', 'manpower'].includes(currentView);

    return (
        <header className="relative z-30 bg-background-card text-text-primary py-3 px-4 sm:px-6 shadow-sm flex justify-between items-center border-b border-border-primary flex-shrink-0 gap-4">
            {/* Left Section: Navigation & Title */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <button onClick={() => setIsSidebarOpen(true)} className="text-xl text-text-secondary lg:hidden">
                    <i className="fas fa-bars"></i>
                </button>
                {viewHistory.length > 0 && (
                    <button 
                        onClick={goBack} 
                        title="Go Back" 
                        className="btn-icon !p-2 text-text-secondary hover:text-text-primary"
                        aria-label="Go back to previous page"
                    >
                        <i className="fas fa-arrow-left text-lg"></i>
                    </button>
                )}
                <div className="flex items-baseline gap-x-3 min-w-0">
                    <h2 className="text-xl font-bold text-brand-dark truncate">{getTitle()}</h2>
                    <p className="text-xs text-text-secondary hidden md:block whitespace-nowrap">{terminalName}</p>
                </div>
            </div>

            {/* Right Section: Filters & Actions */}
            <div className="flex items-center justify-end gap-2 sm:gap-4">
                {showWorkspaceControls && (
                    <div className="hidden sm:flex items-center gap-2 sm:gap-4">
                        <div className="hidden lg:flex">
                           <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setWorkspaceSearchTerm} />
                        </div>
                        {showModalityFilter && <ModalityFilter filter={workspaceFilter} setFilter={setWorkspaceFilter} />}
                        <div ref={infraFilterRef} className={`relative ${!showColumnFilter ? 'invisible' : ''}`}>
                            <button onClick={() => setIsInfraFilterOpen(prev => !prev)} className="btn-secondary !py-2">
                                <i className="fas fa-columns mr-2"></i>
                                <span className="hidden lg:inline">Columns</span> ({visibleInfrastructure.length}/{filteredInfrastructure.length})
                            </button>
                            {isInfraFilterOpen && showColumnFilter && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white border rounded-lg shadow-xl z-30 p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <button onClick={() => updateColumnVisibility(filteredInfrastructure)} className="text-xs text-blue-600 hover:underline font-semibold">Select All</button>
                                        <button onClick={() => updateColumnVisibility([])} className="text-xs text-blue-600 hover:underline font-semibold">Select None</button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 border-t pt-2">
                                        {filteredInfrastructure.map(infraId => {
                                            const wharf = docklineToWharfMap[infraId];
                                            const displayName = wharf ? `${wharf} - ${formatInfraName(infraId)}` : formatInfraName(infraId);
                                            return (
                                            <label key={infraId} className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                    checked={visibleInfrastructure.includes(infraId)}
                                                    onChange={(e) => handleInfraVisibilityChange(infraId, e.target.checked)}
                                                />
                                                <span className="text-sm font-medium text-text-secondary">{displayName}</span>
                                            </label>
                                        );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {canCreateOperation(currentUser) && (
                    <button onClick={() => openNewOpModal()} className="btn-primary whitespace-nowrap !py-2 !px-3 sm:!px-4">
                        <i className="fas fa-plus-circle"></i>
                        <span className="hidden sm:inline ml-2">New Order</span>
                    </button>
                )}
                <div className="hidden sm:flex items-center space-x-3 pl-3 border-l border-border-primary">
                    <button onClick={() => setIsTimePlaying(p => !p)} className="btn-secondary !py-2 !px-3" title={isTimePlaying ? "Pause Time" : "Play Time"}>
                        {isTimePlaying ? <i className="fas fa-pause"></i> : <i className="fas fa-play"></i>}
                    </button>
                    <span className="text-sm text-text-secondary w-20 text-center font-mono font-semibold" title={`Simulated Time: ${simulatedTime.toLocaleString()}`}>
                        {simulatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} title={online ? 'Online' : 'Offline'}></div>
                    <span className={`hidden lg:inline text-xs font-medium ${online ? 'text-green-600' : 'text-gray-500'}`}>{online ? 'Online' : 'Offline'}</span>
                </div>
            </div>
        </header>
    );
};

export default Header;