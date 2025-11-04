import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import WorkspaceSearch from './WorkspaceSearch';
import NewOperationModal from './NewOperationModal';

const Header: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { 
        online, lastUpdated, selectedTerminal, getOperationById, activeOpId, currentView, 
        setIsSidebarOpen, workspaceSearchTerm, setWorkspaceSearchTerm,
        activeLineIndex, activeTransferIndex,
        viewHistory, goBack
    } = context;
    
    const [isNewOpModalOpen, setIsNewOpModalOpen] = useState(false);

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
    
    const showSearch = ['dashboard', 'planning', 'active-operations-list', 'completed'].includes(currentView);

    return (
        <>
            <NewOperationModal isOpen={isNewOpModalOpen} onClose={() => setIsNewOpModalOpen(false)} />
            <header className="relative z-20 bg-background-card text-text-primary py-2 px-4 shadow-sm flex justify-between items-center border-b border-border-primary flex-shrink-0">
                <div className="flex items-center gap-x-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-xl text-text-secondary">
                        <i className="fas fa-bars"></i>
                    </button>
                    <div className="flex items-baseline gap-x-3">
                        <h2 className="text-xl font-bold text-brand-dark whitespace-nowrap">{getTitle()}</h2>
                        <p className="text-xs text-text-secondary hidden sm:block whitespace-nowrap">{terminalName} | Live View</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap justify-end">
                    {showSearch && <WorkspaceSearch searchTerm={workspaceSearchTerm} setSearchTerm={setWorkspaceSearchTerm} />}
                    <button onClick={() => setIsNewOpModalOpen(true)} className="btn-primary whitespace-nowrap">
                        <i className="fas fa-plus-circle mr-2"></i>New Order
                    </button>
                    <div className="hidden sm:flex items-center space-x-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                        <span className={`text-xs font-medium ${online ? 'text-green-500' : 'text-gray-400'}`}>{online ? 'Online' : 'Offline'}</span>
                    </div>
                    <span className="hidden md:inline text-xs text-secondary whitespace-nowrap">Last updated: {lastUpdated.toLocaleTimeString()}</span>
                    {viewHistory.length > 0 && (
                        <button 
                            onClick={goBack} 
                            title="Go Back" 
                            className="text-2xl text-text-secondary hover:text-text-primary p-4 rounded-full hover:bg-slate-100 active:bg-slate-200"
                            aria-label="Go back to previous page"
                        >
                            <i className="fas fa-arrow-left"></i>
                        </button>
                    )}
                </div>
            </header>
        </>
    );
};

export default Header;