
import React from 'react';

const FeatureItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start">
        <i className="fas fa-check-circle text-green-500 mr-3 mt-1 flex-shrink-0"></i>
        <span>{children}</span>
    </li>
);

const Dashboard: React.FC = () => {
    return (
        <div className="p-4 sm:p-8 flex items-center justify-center bg-background-body min-h-full">
            <div className="w-full max-w-4xl card p-8 sm:p-12 bg-background-card">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-brand-dark mb-2">Terminal Hub Demo</h1>
                    <p className="text-lg text-text-secondary">
                        This is a demonstration application showcasing a comprehensive terminal operations management system.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 bg-slate-50 border border-slate-200">
                        <h2 className="text-xl font-semibold text-brand-dark mb-4 border-b pb-2 flex items-center">
                            <i className="fas fa-calendar-alt mr-3 text-brand-primary"></i>
                            Integrated Planning & Scheduling
                        </h2>
                        <ul className="space-y-3 text-text-secondary">
                            <FeatureItem>
                                <strong>Multi-Modal Planning Board:</strong> Visually schedule Vessel, Truck, and Rail operations with Grid, List, and Kanban views.
                            </FeatureItem>
                            <FeatureItem>
                                <strong>Automated Conflict Resolution:</strong> System automatically detects scheduling conflicts with maintenance outages and product compatibility rules.
                            </FeatureItem>
                            <FeatureItem>
                                <strong>Intelligent Rescheduling:</strong> Handle exceptions like delays, rejections, and no-shows with smart slot suggestions and a visual placement mode.
                            </FeatureItem>
                            <FeatureItem>
                                <strong>Outage & Maintenance Management:</strong> Plan infrastructure outages which automatically flags conflicting operations for rescheduling.
                            </FeatureItem>
                            <FeatureItem>
                                <strong>Manpower Assignment:</strong> Manage operator shifts and assign specific work areas with visibility on the planning board.
                            </FeatureItem>
                        </ul>
                    </div>

                    <div className="p-6 bg-slate-50 border border-slate-200">
                        <h2 className="text-xl font-semibold text-brand-dark mb-4 border-b pb-2 flex items-center">
                            <i className="fas fa-cogs mr-3 text-brand-primary"></i>
                            Live Operations & Digital Execution
                        </h2>
                        <ul className="space-y-3 text-text-secondary">
                            <FeatureItem>
                                <strong>Real-Time Operations Cockpit:</strong> Monitor active operations with live SCADA data simulation for flow rates and pump statuses.
                            </FeatureItem>
                             <FeatureItem>
                                <strong>Digital Statement of Facts (SOF):</strong> Execute tasks with a glove-friendly slider interface, providing a full digital audit trail.
                            </FeatureItem>
                            <FeatureItem>
                                <strong>Comprehensive Digital Logs:</strong> Replace paper with integrated forms for Hoses, Samples (with signature capture), Pressure Checks, and Observations.
                            </FeatureItem>
                            <FeatureItem>
                                <strong>Automated Dip Sheet & Volume Tracking:</strong> Live dip sheet calculations with automatic SCADA-based entries for in-progress transfers.
                            </FeatureItem>
                            <FeatureItem>
                                <strong>Financial Reporting & Cycle Time Analysis:</strong> Automatically calculate cycle times and operation value upon completion for commercial reporting.
                            </FeatureItem>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 text-center">
                    <p className="text-text-secondary">
                        Use the sidebar to navigate and explore these features.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
