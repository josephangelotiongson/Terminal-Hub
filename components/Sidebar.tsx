

import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { View, User } from '../types';

const NavLink: React.FC<{
    view: View,
    icon: string,
    label: string,
    onClick: (e: React.MouseEvent) => void,
    isActive: boolean,
    isCollapsed: boolean,
}> = ({ view, icon, label, onClick, isActive, isCollapsed }) => {
    const activeClass = isActive 
        ? 'bg-indigo-100 text-slate-900' 
        : 'text-text-secondary hover:text-text-primary hover:bg-slate-100';

    const collapsedClasses = isCollapsed ? 'lg:justify-center lg:px-2' : 'space-x-4 px-4';

    return (
        <a href="#" onClick={onClick} className={`nav-link flex items-center py-3 rounded-lg transition-colors ${activeClass} ${collapsedClasses}`}>
            <i className={`fas ${icon} w-6 text-center text-lg`}></i>
            <span className={`font-semibold text-sm sm:text-base ${isCollapsed ? 'lg:hidden' : ''}`}>{label}</span>
        </a>
    );
};

const Sidebar: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { 
        switchView, currentView, selectedTerminal, setSelectedTerminal, 
        isSidebarOpen, setIsSidebarOpen, currentUser, users, setCurrentUser,
        isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed
    } = context;
    
    const isPlanningActive = ['planning', 'operation-plan', 'special-services'].includes(currentView);
    const isActiveOpsActive = ['active-operations-list', 'operation-details', 'product-transfer-details'].includes(currentView);
    const isTankStatusActive = ['tank-status', 'tank-status-details'].includes(currentView);

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
        sidebar bg-white border-r border-slate-200 w-72 flex-shrink-0 flex flex-col shadow-lg
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
        lg:transition-[width,padding] lg:duration-300
        ${isDesktopSidebarCollapsed ? 'lg:w-20 lg:p-3' : 'lg:w-72 lg:p-6'}
    `;

    return (
        <div className={sidebarClasses}>
            <div className={`flex items-center mb-4 ${isDesktopSidebarCollapsed ? 'lg:justify-center' : 'justify-between'}`}>
                <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold tracking-tight text-brand-dark">
                        <span className={`${isDesktopSidebarCollapsed && 'lg:hidden'}`}>TERMINAL HUB</span>
                        <span className={`hidden ${isDesktopSidebarCollapsed && 'lg:inline'}`}>TH</span>
                    </h1>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-slate-800 lg:hidden">
                    <i className="fas fa-times text-xl"></i>
                </button>
            </div>
            <div className="mb-4">
                <label htmlFor="terminal-select" className={`block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 ${isDesktopSidebarCollapsed && 'lg:hidden'}`}>Terminal</label>
                <select 
                    id="terminal-select" 
                    value={selectedTerminal} 
                    onChange={(e) => setSelectedTerminal(e.target.value)}
                    className={`block w-full bg-slate-100 border-slate-300 rounded-md shadow-sm py-2 sm:py-3 px-3 text-sm sm:text-base text-text-primary focus:outline-none focus:ring-brand-primary focus:border-brand-primary ${isDesktopSidebarCollapsed && 'lg:hidden'}`}
                >
                    <option value="PAL">Port Alpha (PAL)</option>
                    <option value="CBY">Central Bay (CBY)</option>
                    <option value="RVE">Riverton East (RVE)</option>
                </select>
                {isDesktopSidebarCollapsed && (
                    <div className="hidden lg:flex items-center justify-center flex-col text-center">
                        <i className="fas fa-map-marker-alt text-text-tertiary mb-1"></i>
                        <span className="font-bold text-sm">{selectedTerminal}</span>
                    </div>
                )}
            </div>
            <nav className="space-y-4 flex-grow overflow-y-auto">
                <div>
                    <h3 className={`px-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider ${isDesktopSidebarCollapsed && 'lg:hidden'}`}>Workspace</h3>
                    {isDesktopSidebarCollapsed && <hr className="hidden lg:block my-2 mx-2" />}
                    <div className="space-y-1 mt-2">
                        <NavLink view="dashboard" isActive={currentView === 'dashboard'} icon="fa-tachometer-alt" label="Dashboard" onClick={handleNav('dashboard')} isCollapsed={isDesktopSidebarCollapsed} />
                        <NavLink view="planning" isActive={isPlanningActive} icon="fa-calendar-alt" label="Planning" onClick={handleNav('planning')} isCollapsed={isDesktopSidebarCollapsed} />
                        <NavLink view="active-operations-list" isActive={isActiveOpsActive} icon="fa-cogs" label="Operations" onClick={handleNav('active-operations-list')} isCollapsed={isDesktopSidebarCollapsed} />
                        <NavLink view="completed" isActive={currentView === 'completed'} icon="fa-history" label="Completed" onClick={handleNav('completed')} isCollapsed={isDesktopSidebarCollapsed} />
                    </div>
                </div>
                <div>
                    <h3 className={`px-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider mt-4 ${isDesktopSidebarCollapsed && 'lg:hidden'}`}>Monitoring & Planning</h3>
                    {isDesktopSidebarCollapsed && <hr className="hidden lg:block my-2 mx-2" />}
                    <div className="space-y-1 mt-2">
                        <NavLink view="tank-status" isActive={isTankStatusActive} icon="fa-oil-can" label="Tank Status" onClick={handleNav('tank-status')} isCollapsed={isDesktopSidebarCollapsed} />
                        <NavLink view="manpower" isActive={currentView === 'manpower'} icon="fa-users" label="Manpower" onClick={handleNav('manpower')} isCollapsed={isDesktopSidebarCollapsed} />
                        <NavLink view="outage-planning" isActive={currentView === 'outage-planning'} icon="fa-wrench" label="Outage Planning" onClick={handleNav('outage-planning')} isCollapsed={isDesktopSidebarCollapsed} />
                    </div>
                </div>
                 <div>
                    <h3 className={`px-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider mt-4 ${isDesktopSidebarCollapsed && 'lg:hidden'}`}>Maintenance</h3>
                    {isDesktopSidebarCollapsed && <hr className="hidden lg:block my-2 mx-2" />}
                    <div className="space-y-1 mt-2">
                        <NavLink view="maintenance" isActive={currentView === 'maintenance'} icon="fa-tools" label="Work Orders" onClick={handleNav('maintenance')} isCollapsed={isDesktopSidebarCollapsed} />
                    </div>
                </div>
                <div>
                    <h3 className={`px-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider ${isDesktopSidebarCollapsed && 'lg:hidden'}`}>System</h3>
                    {isDesktopSidebarCollapsed && <hr className="hidden lg:block my-2 mx-2" />}
                    <div className="space-y-1 mt-2">
                        <NavLink view="reports" isActive={currentView === 'reports'} icon="fa-file-csv" label="Reports" onClick={handleNav('reports')} isCollapsed={isDesktopSidebarCollapsed} />
                        {currentUser.role === 'Operations Lead' && (
                            <NavLink view="user-permissions" isActive={currentView === 'user-permissions'} icon="fa-user-shield" label="User Permissions" onClick={handleNav('user-permissions')} isCollapsed={isDesktopSidebarCollapsed} />
                        )}
                        <NavLink view="config-matrix" isActive={currentView === 'config-matrix'} icon="fa-table" label="System Configuration" onClick={handleNav('config-matrix')} isCollapsed={isDesktopSidebarCollapsed} />
                        <NavLink view="master-data" isActive={currentView === 'master-data'} icon="fa-database" label="Master Data" onClick={handleNav('master-data')} isCollapsed={isDesktopSidebarCollapsed} />
                    </div>
                </div>
            </nav>
            <div className="flex-shrink-0 pt-6 mt-auto border-t border-slate-200">
                 <div className="mb-4">
                    <label htmlFor="user-select" className={`block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 ${isDesktopSidebarCollapsed && 'lg:hidden'}`}>Current User</label>
                    <div className={`flex items-center ${isDesktopSidebarCollapsed ? 'lg:flex-col lg:items-center lg:gap-2' : 'space-x-3'}`}>
                         <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0" title={currentUser.name}>
                            {currentUser.name.substring(0, 2).toUpperCase()}
                         </div>
                        
                        <div className={`relative flex-grow ${isDesktopSidebarCollapsed && 'lg:hidden'}`}>
                            <select 
                                id="user-select" 
                                value={currentUser.name} 
                                onChange={(e) => handleUserChange(e.target.value)}
                                className="block w-full appearance-none bg-slate-100 border-slate-300 rounded-md shadow-sm py-1.5 sm:py-2 pl-3 pr-10 text-sm sm:text-base text-text-primary focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                            >
                                {users.map(user => (
                                    <option key={user.name} value={user.name}>
                                        {user.name} ({user.originalRole ? `as ${user.role}` : user.role})
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                                <i className="fas fa-chevron-down text-xs"></i>
                            </div>
                        </div>

                        {currentUser.originalRole && (
                            <div 
                                title={`Temporarily acting as ${currentUser.role}. Original role: ${currentUser.originalRole}. Delegated by ${currentUser.delegatedBy}.`}
                                className={`flex-shrink-0 ${isDesktopSidebarCollapsed && 'lg:hidden'}`}
                            >
                                <i className="fas fa-user-shield text-yellow-500 text-2xl"></i>
                            </div>
                        )}
                    </div>
                </div>
                <button className={`w-full mt-2 btn-primary ${isDesktopSidebarCollapsed && 'lg:p-3'}`}>
                    <span className={`${isDesktopSidebarCollapsed && 'lg:hidden'}`}>Logout</span>
                    <i className={`fas fa-sign-out-alt hidden ${isDesktopSidebarCollapsed && 'lg:inline'}`}></i>
                </button>
                <div className="mt-4 text-center hidden lg:block">
                    <button onClick={() => setIsDesktopSidebarCollapsed(prev => !prev)} className="btn-icon" title={isDesktopSidebarCollapsed ? "Expand" : "Collapse"}>
                        <i className={`fas ${isDesktopSidebarCollapsed ? 'fa-angle-double-right' : 'fa-angle-double-left'}`}></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;