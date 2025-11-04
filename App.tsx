import React, { useContext } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import PlanningBoard from './components/PlanningBoard';
import ActiveOpsList from './components/ActiveOpsList';
import OperationDetails from './components/OperationDetails';
import OperationPlan from './components/OperationPlan';
import CompletedOps from './components/CompletedOps';
import Reports from './components/Reports';
import ConfigMatrix from './components/ConfigMatrix';
import MasterData from './components/MasterData';
import OutagePlanning from './components/OutagePlanning'; // Import the new component
import Maintenance from './components/Maintenance'; // Import the new component
import RescheduleDetailsModal from './components/RescheduleDetailsModal';
import ProductTransferDetails from './components/ProductTransferDetails'; // Import the new component
import ConflictResolutionModal from './components/ConflictResolutionModal';
import { AppProvider, AppContext } from './context/AppContext';

const AppContent: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null; // Should be wrapped in provider

    const { currentView, isSidebarOpen, setIsSidebarOpen, rescheduleModalData, closeRescheduleModal, getOperationById } = context;
    
    const rescheduleOp = getOperationById(rescheduleModalData.opId);

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <Dashboard />;
            case 'planning': return <PlanningBoard />;
            case 'active-operations-list': return <ActiveOpsList />;
            case 'operation-details': return <OperationDetails />;
            case 'product-transfer-details': return <ProductTransferDetails />;
            case 'operation-plan': return <OperationPlan />;
            case 'completed': return <CompletedOps />;
            case 'reports': return <Reports />;
            case 'config-matrix': return <ConfigMatrix />;
            case 'master-data': return <MasterData />;
            case 'outage-planning': return <OutagePlanning />; // Add new case for outage planning
            case 'maintenance': return <Maintenance />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="flex h-screen bg-background-body font-sans text-text-primary">
            <ConflictResolutionModal />
            {rescheduleOp && (
                <RescheduleDetailsModal
                    isOpen={!!rescheduleModalData.opId}
                    onClose={closeRescheduleModal}
                    operation={rescheduleOp}
                    viewDate={rescheduleModalData.viewDate}
                />
            )}
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0"> {/* Added min-w-0 to prevent content overflow */}
                <Header />
                <main className="main-content flex-1 overflow-y-auto">
                    {renderView()}
                </main>
            </div>
             {/* Mobile Sidebar Backdrop */}
             {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/80 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};


export default App;
