

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
import NewOperationModal from './components/NewOperationModal';
import TankStatus from './components/TankStatus';
import TankStatusDetails from './components/TankStatusDetails';
import ScadaModal from './components/ScadaModal'; // New import
import UserPermissions from './components/UserPermissions';
import Manpower from './components/Manpower';
import DirectToBayModal from './components/DirectToBayModal';
import DelayModal from './components/DelayModal';
import RedirectBayModal from './components/RedirectBayModal';
import AcceptNoShowModal from './components/AcceptNoShowModal';
import { AppProvider, AppContext } from './context/AppContext';
import PlanningList from './components/PlanningList';

const AppContent: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null; // Should be wrapped in provider

    const { currentView, isSidebarOpen, setIsSidebarOpen, rescheduleModalData, closeRescheduleModal, getOperationById, isNewOpModalOpen, closeNewOpModal, directToBayModalState, closeDirectToBayModal, handleConfirmBayAction, noShowDelayModalState, closeNoShowDelayModal, handleConfirmNoShowDelay, acceptNoShowModalState, closeAcceptNoShowModal, handleConfirmAcceptNoShow } = context;
    
    const rescheduleOp = getOperationById(rescheduleModalData.opId);
    const acceptNoShowOp = getOperationById(acceptNoShowModalState.opId);
    
    const showScada = ['active-operations-list', 'operation-details', 'product-transfer-details'].includes(currentView);

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
            case 'tank-status': return <TankStatus />;
            case 'tank-status-details': return <TankStatusDetails />;
            case 'user-permissions': return <UserPermissions />;
            case 'manpower': return <Manpower />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="flex h-screen bg-background-body font-sans text-text-primary">
            <NewOperationModal isOpen={isNewOpModalOpen} onClose={closeNewOpModal} />
            <ConflictResolutionModal />
            <RedirectBayModal />
            {directToBayModalState.op && (
                <DirectToBayModal
                    isOpen={directToBayModalState.isOpen}
                    onClose={closeDirectToBayModal}
                    onConfirm={handleConfirmBayAction}
                    operation={directToBayModalState.op}
                    isRevert={directToBayModalState.isRevert}
                />
            )}
            {rescheduleOp && (
                <RescheduleDetailsModal
                    isOpen={!!rescheduleModalData.opId}
                    onClose={closeRescheduleModal}
                    operation={rescheduleOp}
                    viewDate={rescheduleModalData.viewDate}
                />
            )}
            {noShowDelayModalState.isOpen && noShowDelayModalState.opId && (
                <DelayModal
                    isOpen={noShowDelayModalState.isOpen}
                    onClose={closeNoShowDelayModal}
                    opId={noShowDelayModalState.opId}
                    onSave={(reason, notes) => handleConfirmNoShowDelay(noShowDelayModalState.opId!, reason, notes)}
                    title="Log Delay for Overdue Truck"
                />
            )}
            {acceptNoShowOp && (
                <AcceptNoShowModal
                    isOpen={acceptNoShowModalState.isOpen}
                    onClose={closeAcceptNoShowModal}
                    onConfirm={(reason) => handleConfirmAcceptNoShow(acceptNoShowOp.id, reason)}
                    operation={acceptNoShowOp}
                />
            )}
            {showScada && <ScadaModal />}
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="main-content flex-1 overflow-y-auto">
                    {renderView()}
                </main>
            </div>
             {/* Mobile Sidebar Backdrop */}
             {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/80 z-40 lg:hidden"
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
