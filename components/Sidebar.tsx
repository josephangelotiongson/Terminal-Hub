import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { View, User } from '../types';

const NavLink: React.FC<{
    view: View,
    icon: string,
    label: string,
    onClick: (e: React.MouseEvent) => void,
    isActive: boolean
}> = ({ view, icon, label, onClick, isActive }) => {
    const activeClass = isActive 
        ? 'bg-brand-primary text-white' 
        : 'text-slate-200 hover:text-white hover:bg-slate-700';

    return (
        <a href="#" onClick={onClick} className={`nav-link flex items-center space-x-4 py-3 px-4 rounded-lg transition-colors ${activeClass}`}>
            <i className={`fas ${icon} w-6 text-center text-lg`}></i>
            <span className="font-semibold text-sm sm:text-base">{label}</span>
        </a>
    );
};

const Sidebar: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { 
        switchView, currentView, selectedTerminal, setSelectedTerminal, 
        isSidebarOpen, setIsSidebarOpen, currentUser, users, setCurrentUser
    } = context;
    
    const isPlanningActive = ['planning', 'operation-plan', 'special-services'].includes(currentView);
    const isActiveOpsActive = ['active-operations-list', 'operation-details', 'product-transfer-details'].includes(currentView);

    const handleNav = (view: View) => (e: React.MouseEvent) => {
        e.preventDefault();
        switchView(view);
        setIsSidebarOpen(false);
    };
    
    const handleUserChange = (userName: string) => {
        const user = users.find(u => u.name === userName);
        if (user) {
            setCurrentUser(user);
        }
    };

    const sidebarClasses = `
        sidebar bg-brand-dark w-72 p-6 space-y-6 flex-shrink-0 flex flex-col
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    `;

    return (
        <div className={sidebarClasses}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold tracking-tight text-white">TERMINAL HUB</h1>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-300 hover:text-white">
                    <i className="fas fa-times text-xl"></i>
                </button>
            </div>
            <div className="mb-4">
                <label htmlFor="terminal-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Terminal</label>
                <select 
                    id="terminal-select" 
                    value={selectedTerminal} 
                    onChange={(e) => setSelectedTerminal(e.target.value)}
                    className="block w-full bg-slate-800 border-slate-600 rounded-md shadow-sm py-2 sm:py-3 px-3 text-sm sm:text-base text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                >
                    <option value="PAL">Port Alpha (PAL)</option>
                    <option value="CBY">Central Bay (CBY)</option>
                    <option value="RVE">Riverton East (RVE)</option>
                </select>
            </div>
            <nav className="space-y-4 flex-grow overflow-y-auto">
                <div>
                    <h3 className="px-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Workspace</h3>
                    <div className="space-y-1 mt-2">
                        <NavLink view="dashboard" isActive={currentView === 'dashboard'} icon="fa-tachometer-alt" label="Dashboard" onClick={handleNav('dashboard')} />
                        <NavLink view="outage-planning" isActive={currentView === 'outage-planning'} icon="fa-wrench" label="Outage Planning" onClick={handleNav('outage-planning')} />
                        <NavLink view="planning" isActive={isPlanningActive} icon="fa-calendar-alt" label="Planning" onClick={handleNav('planning')} />
                        <NavLink view="active-operations-list" isActive={isActiveOpsActive} icon="fa-tasks" label="Active Ops" onClick={handleNav('active-operations-list')} />
                        <NavLink view="completed" isActive={currentView === 'completed'} icon="fa-history" label="Completed" onClick={handleNav('completed')} />
                    </div>
                </div>
                 <div>
                    <h3 className="px-3 text-xs font-semibold text-slate-300 uppercase tracking-wider mt-4">Maintenance</h3>
                    <div className="space-y-1 mt-2">
                        <NavLink view="maintenance" isActive={currentView === 'maintenance'} icon="fa-tools" label="Work Orders" onClick={handleNav('maintenance')} />
                    </div>
                </div>
                <div>
                    <h3 className="px-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">System</h3>
                    <div className="space-y-1 mt-2">
                        <NavLink view="reports" isActive={currentView === 'reports'} icon="fa-file-csv" label="Reports" onClick={handleNav('reports')} />
                        <NavLink view="config-matrix" isActive={currentView === 'config-matrix'} icon="fa-table" label="System Configuration" onClick={handleNav('config-matrix')} />
                        <NavLink view="master-data" isActive={currentView === 'master-data'} icon="fa-database" label="Master Data" onClick={handleNav('master-data')} />
                    </div>
                </div>
            </nav>
            <div className="flex-shrink-0">
                 <div className="mb-4">
                    <label htmlFor="user-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Current User</label>
                    <div className="flex items-center space-x-3">
                         <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold text-xl">{currentUser.name.substring(0, 2).toUpperCase()}</div>
                        <select 
                            id="user-select" 
                            value={currentUser.name} 
                            onChange={(e) => handleUserChange(e.target.value)}
                            className="block w-full bg-slate-800 border-slate-600 rounded-md shadow-sm py-1.5 sm:py-2 px-3 text-sm sm:text-base text-white focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                        >
                            {users.map(user => (
                                <option key={user.name} value={user.name}>{user.name} ({user.role})</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button className="w-full mt-2 btn-primary">Logout</button>
            </div>
        </div>
    );
};

export default Sidebar;