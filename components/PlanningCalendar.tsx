
import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation } from '../types';
import { getOperationDurationHours, getOperationColorClass, getIcon } from '../utils/helpers';

// Helper to get dates for the calendar grid
const getCalendarDays = (currentDate: Date) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Pad start with days from previous month
    const startPadding = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    for (let i = startPadding; i > 0; i--) {
        const d = new Date(year, month, 1 - i);
        days.push({ date: d, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const d = new Date(year, month, i);
        days.push({ date: d, isCurrentMonth: true });
    }
    
    // Pad end with days from next month to fill the grid (6 rows x 7 cols = 42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: d, isCurrentMonth: false });
    }
    
    return days;
};

const PlanningCalendar: React.FC<{ onCardClick: (opId: string) => void }> = ({ onCardClick }) => {
    const { operations, workspaceFilter, planningCustomerFilter, selectedTerminal } = useContext(AppContext)!;
    const [viewDate, setViewDate] = useState(new Date());

    const calendarDays = useMemo(() => getCalendarDays(viewDate), [viewDate]);

    const filteredOps = useMemo(() => {
        return operations.filter(op => {
            if (op.terminal !== selectedTerminal) return false;
            // Exclude cancelled ops to reduce clutter in calendar view
            if (op.status === 'cancelled') return false;
            
            if (workspaceFilter !== 'all' && op.modality !== workspaceFilter) return false;
            
            // Customer Filter
            if (!planningCustomerFilter.includes('All')) {
                const hasMatchingCustomer = op.transferPlan.some(line => 
                    line.transfers.some(t => t.customer && planningCustomerFilter.includes(t.customer))
                );
                if (!hasMatchingCustomer) return false;
            }
            return true;
        });
    }, [operations, workspaceFilter, planningCustomerFilter, selectedTerminal]);

    // Function to get operations for a specific day
    const getOpsForDay = (day: Date) => {
        const dayStart = new Date(day); 
        dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(day); 
        dayEnd.setHours(23,59,59,999);
        
        return filteredOps.filter(op => {
            const opStart = new Date(op.eta);
            const duration = getOperationDurationHours(op);
            // If completed, use completedTime for visual end, otherwise estimated end
            const actualEnd = op.completedTime ? new Date(op.completedTime) : null;
            const estimatedEnd = new Date(opStart.getTime() + duration * 3600 * 1000);
            const opEnd = actualEnd || estimatedEnd;
            
            // Check for overlap
            return opStart < dayEnd && opEnd > dayStart;
        }).sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
    };

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    const handleToday = () => setViewDate(new Date());

    return (
        <div className="flex flex-col h-full bg-white border border-slate-200 rounded-b-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                <h2 className="text-xl font-bold text-gray-800">
                    {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                    <button onClick={handlePrevMonth} className="btn-icon bg-white border shadow-sm"><i className="fas fa-chevron-left"></i></button>
                    <button onClick={handleToday} className="btn-secondary text-sm shadow-sm">Today</button>
                    <button onClick={handleNextMonth} className="btn-icon bg-white border shadow-sm"><i className="fas fa-chevron-right"></i></button>
                </div>
            </div>

            {/* Grid Header (Weekdays) */}
            <div className="grid grid-cols-7 border-b bg-slate-100">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wider border-r last:border-r-0">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid Body */}
            <div className="grid grid-cols-7 flex-grow auto-rows-fr bg-slate-200 gap-px overflow-y-auto">
                {calendarDays.map((item, index) => {
                    const dayOps = getOpsForDay(item.date);
                    const isToday = new Date().toDateString() === item.date.toDateString();
                    
                    return (
                        <div 
                            key={index} 
                            className={`bg-white p-1 min-h-[100px] flex flex-col relative ${!item.isCurrentMonth ? 'bg-slate-50 text-gray-400' : ''}`}
                        >
                            <div className={`text-right text-xs font-bold p-1 mb-1 ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center ml-auto' : ''}`}>
                                {item.date.getDate()}
                            </div>
                            <div className="flex-grow overflow-y-auto space-y-1 custom-scrollbar px-1 pb-1">
                                {dayOps.map(op => {
                                    const colorClass = getOperationColorClass(op);
                                    const isPlanned = op.status === 'planned';
                                    
                                    return (
                                        <div 
                                            key={op.id}
                                            onClick={(e) => { e.stopPropagation(); onCardClick(op.id); }}
                                            className={`
                                                text-[10px] p-1 rounded cursor-pointer truncate flex items-center gap-1.5 shadow-sm
                                                ${colorClass}
                                                ${isPlanned ? 'opacity-90' : ''}
                                                hover:brightness-95 hover:scale-[1.02] transition-all
                                                border-l-2 border-black/10
                                            `}
                                            title={`${op.transportId} (${op.modality})\nStatus: ${op.currentStatus}\nETA: ${new Date(op.eta).toLocaleString()}`}
                                        >
                                            <i className={`fas ${getIcon(op.modality)} opacity-70 flex-shrink-0`}></i>
                                            <span className="font-semibold truncate">{op.transportId}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PlanningCalendar;
