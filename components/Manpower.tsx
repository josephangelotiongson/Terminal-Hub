

import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { User, Modality, ManpowerSchedule } from '../types';
import { formatInfraName, createDocklineToWharfMap, naturalSort } from '../utils/helpers';
import Modal from './Modal';
import PlanningBoard from './PlanningBoard';

// #region -------- ASSIGNMENT MODAL --------

const AssignmentModal: React.FC<{ user: User; onClose: () => void }> = ({ user, onClose }) => {
    const { currentTerminalSettings, updateUserAssignments } = useContext(AppContext)!;
  
    const [selectedAreas, setSelectedAreas] = useState<string[]>(user.assignedAreas || []);
  
    const handleAreaToggle = (area: string) => {
      setSelectedAreas(prev =>
        prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
      );
    };
  
    const handleSave = () => {
      const infraModalityMap = currentTerminalSettings.infrastructureModalityMapping || {};
      const derivedModalities = Array.from(
        new Set(selectedAreas.map(area => infraModalityMap[area]).filter(Boolean))
      ) as Modality[];

      updateUserAssignments(user.name, { modalities: derivedModalities, areas: selectedAreas });
      onClose();
    };
  
    const infrastructuresByModality = useMemo(() => {
      const grouped: { [key in Modality]?: string[] } = {};
      const mapping = currentTerminalSettings.infrastructureModalityMapping || {};
      for (const infraId in mapping) {
        const modality = mapping[infraId];
        if (!grouped[modality]) {
          grouped[modality] = [];
        }
        grouped[modality]!.push(infraId);
      }
      for (const mod in grouped) {
        grouped[mod as Modality]!.sort(naturalSort);
      }
      return grouped;
    }, [currentTerminalSettings]);
  
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`Assign Work Areas for ${user.name}`}
        footer={
          <>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">Save Assignments</button>
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-text-primary mb-2">Specific Infrastructure / Areas</h4>
            <div className="space-y-4">
              {Object.keys(infrastructuresByModality).map(modality => {
                const areas = infrastructuresByModality[modality as Modality];
                if (!areas) return null;
                return (
                  <div key={modality}>
                    <h5 className="font-bold text-sm text-text-secondary capitalize mb-1">{modality}</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {areas.map(area => (
                        <label key={area} className="flex items-center space-x-2 p-1.5 border rounded-md cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selectedAreas.includes(area)}
                            onChange={() => handleAreaToggle(area)}
                            className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                          />
                          <span className="text-xs font-medium">{formatInfraName(area)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    );
};

// #endregion

// #region -------- OPERATOR CARD --------

const OperatorCard: React.FC<{ user: User; isLead: boolean; onAssignClick: (user: User) => void }> = ({ user, isLead, onAssignClick }) => {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isLead) return e.preventDefault();
        e.dataTransfer.setData('userName', user.name);
    };

    const assignedWork = useMemo(() => {
        const modalities = user.assignedModalities || [];
        const areas = user.assignedAreas || [];
        
        if (areas.length > 0) {
            return areas.map(formatInfraName).join(', ');
        }
        if (modalities.length > 0) {
            return modalities.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
        }
        return 'Not assigned';

    }, [user.assignedModalities, user.assignedAreas]);

    return (
        <div
            draggable={isLead}
            onDragStart={handleDragStart}
            className={`card p-2 m-1 bg-white border-l-4 ${user.delegatedBy ? 'border-yellow-400' : 'border-slate-300'} ${isLead ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-sm">{user.name}</p>
                    <p className="text-xs text-text-secondary">{user.role}</p>
                </div>
                {isLead && <button onClick={() => onAssignClick(user)} className="btn-secondary !py-1 !px-2 !text-xs">Assign</button>}
            </div>
             <div className="mt-2 pt-2 border-t text-xs">
                <p className="font-semibold text-slate-500">Work Areas:</p>
                <p className="text-slate-700 truncate" title={assignedWork}>{assignedWork}</p>
            </div>
        </div>
    );
};
// #endregion

// #region -------- SWIMLANE --------

type Shift = 'Off' | 'Day' | 'Swing' | 'Night';
type ShiftTimes = { [key in 'Day' | 'Swing' | 'Night']: { start: string, end: string } };

const Swimlane: React.FC<{
    shift: Shift;
    users: User[];
    onDrop: (userName: string, shift: Shift) => void;
    isLead: boolean;
    onAssignClick: (user: User) => void;
    shiftTimes: { start: string, end: string };
    onTimeChange: (shift: Shift, type: 'start' | 'end', value: string) => void;
}> = ({ shift, users, onDrop, isLead, onAssignClick, shiftTimes, onTimeChange }) => {
    const [isOver, setIsOver] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isLead) return;
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isLead) return;
        e.preventDefault();
        const userName = e.dataTransfer.getData('userName');
        if (userName) {
            onDrop(userName, shift);
        }
        setIsOver(false);
    };

    return (
        <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 min-w-[280px] bg-slate-100 border rounded-lg flex flex-col transition-colors ${isOver ? 'bg-indigo-100' : ''}`}
        >
            <div className="p-3 border-b bg-slate-200 rounded-t-lg">
                <h3 className="font-bold text-lg">{shift} <span className="text-sm font-normal text-slate-600">({users.length})</span></h3>
                {shift !== 'Off' && (
                    <div className="flex items-center gap-2 text-sm mt-1">
                        <input type="time" value={shiftTimes.start} disabled={!isLead} onChange={(e) => onTimeChange(shift, 'start', e.target.value)} className="!p-1 !text-sm w-24" step="3600"/>
                        <span>-</span>
                        <input type="time" value={shiftTimes.end} disabled={!isLead} onChange={(e) => onTimeChange(shift, 'end', e.target.value)} className="!p-1 !text-sm w-24" step="3600"/>
                    </div>
                )}
            </div>
            <div className="flex-grow p-1 overflow-y-auto min-h-[200px]">
                {users.map(user => <OperatorCard key={user.name} user={user} isLead={isLead} onAssignClick={onAssignClick} />)}
            </div>
        </div>
    );
};

// #endregion

// #region -------- ROSTER COMPONENT --------
const OperatorRoster = () => {
    const { users } = useContext(AppContext)!;
    return (
        <div className="card p-4">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-left bg-slate-50">
                        <tr>
                            <th className="p-2 font-semibold">Name</th>
                            <th className="p-2 font-semibold">Role</th>
                            <th className="p-2 font-semibold">Delegated By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.name} className="border-b">
                                <td className="p-2">{user.name}</td>
                                <td className="p-2">{user.role}</td>
                                <td className="p-2">{user.delegatedBy || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
// #endregion

// #region -------- ASSIGNMENTS COMPONENT --------
interface OperatorAssignmentsProps {
    shiftTimes: ShiftTimes;
    setShiftTimes: React.Dispatch<React.SetStateAction<ShiftTimes>>;
}

const OperatorAssignments: React.FC<OperatorAssignmentsProps> = ({ shiftTimes, setShiftTimes }) => {
    const { users, currentUser, updateUserShift } = useContext(AppContext)!;
    const [isLead] = useState(currentUser.role === 'Operations Lead' || !!currentUser.delegatedBy);
    const [assigningUser, setAssigningUser] = useState<User | null>(null);

    const handleTimeChange = (shift: Shift, type: 'start' | 'end', value: string) => {
        if (shift === 'Off') return;
        setShiftTimes(prev => ({
            ...prev,
            [shift]: { ...prev[shift], [type]: value }
        }));
    };

    const usersByShift = useMemo(() => {
        const grouped: { [key in Shift]: User[] } = { Off: [], Day: [], Swing: [], Night: [] };
        users.forEach(user => {
            if (user.role === 'Operator') {
                const shift = user.shift || 'Off';
                if (grouped[shift]) {
                    grouped[shift].push(user);
                }
            }
        });
        return grouped;
    }, [users]);

    const handleDrop = (userName: string, shift: Shift) => {
        updateUserShift(userName, shift);
    };

    const handleAssignClick = (user: User) => {
        setAssigningUser(user);
    };

    return (
        <div className={`p-4 ${!isLead ? 'pointer-events-none opacity-80' : ''}`}>
             {assigningUser && <AssignmentModal user={assigningUser} onClose={() => setAssigningUser(null)} />}
            <div className="flex flex-col lg:flex-row gap-4">
                <Swimlane shift="Off" users={usersByShift.Off} onDrop={handleDrop} isLead={isLead} onAssignClick={handleAssignClick} shiftTimes={{start:'', end:''}} onTimeChange={()=>{}} />
                <Swimlane shift="Day" users={usersByShift.Day} onDrop={handleDrop} isLead={isLead} onAssignClick={handleAssignClick} shiftTimes={shiftTimes.Day} onTimeChange={handleTimeChange} />
                <Swimlane shift="Swing" users={usersByShift.Swing} onDrop={handleDrop} isLead={isLead} onAssignClick={handleAssignClick} shiftTimes={shiftTimes.Swing} onTimeChange={handleTimeChange} />
                <Swimlane shift="Night" users={usersByShift.Night} onDrop={handleDrop} isLead={isLead} onAssignClick={handleAssignClick} shiftTimes={shiftTimes.Night} onTimeChange={handleTimeChange} />
            </div>
        </div>
    );
};
// #endregion

// #region -------- MAIN MANPOWER COMPONENT --------
const Manpower: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'roster' | 'assignments' | 'planning-board'>('assignments');
    const { users } = useContext(AppContext)!;
    
    const [shiftTimes, setShiftTimes] = useState<ShiftTimes>({
        Day: { start: '06:00', end: '14:00' },
        Swing: { start: '14:00', end: '22:00' },
        Night: { start: '22:00', end: '06:00' },
    });

    const [selectedOperators, setSelectedOperators] = useState<string[]>(['All']);
    const [isOperatorFilterOpen, setIsOperatorFilterOpen] = useState(false);
    const operatorFilterRef = useRef<HTMLDivElement>(null);

    const operatorUsers = useMemo(() => users.filter(u => u.role === 'Operator'), [users]);
    const allOperatorNames = useMemo(() => operatorUsers.map(u => u.name).sort(), [operatorUsers]);

    const filteredOperatorUsers = useMemo(() => {
        if (selectedOperators.includes('All')) {
            return operatorUsers;
        }
        return operatorUsers.filter(u => selectedOperators.includes(u.name));
    }, [operatorUsers, selectedOperators]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isOperatorFilterOpen && operatorFilterRef.current && !operatorFilterRef.current.contains(e.target as Node)) {
                setIsOperatorFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOperatorFilterOpen]);

    const handleOperatorFilterChange = (operatorName: string) => {
        setSelectedOperators(prev => {
            if (operatorName === 'All') {
                return prev.includes('All') ? [] : ['All'];
            }
    
            const currentSelection = prev.includes('All') ? allOperatorNames : prev;
            const newSelection = new Set(currentSelection);
    
            if (newSelection.has(operatorName)) {
                newSelection.delete(operatorName);
            } else {
                newSelection.add(operatorName);
            }
            
            const finalSelection = Array.from(newSelection);
    
            if (finalSelection.length === allOperatorNames.length || finalSelection.length === 0) {
                return ['All'];
            }
    
            return finalSelection;
        });
    };

    const isAllOperatorsSelected = selectedOperators.includes('All');


    return (
        <div>
            <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6">
                <div className="border-b border-border-primary flex justify-between items-center">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('roster')} className={`tab ${activeTab === 'roster' ? 'active' : ''}`}>Operator Roster</button>
                        <button onClick={() => setActiveTab('assignments')} className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}>Operator Assignments</button>
                        <button onClick={() => setActiveTab('planning-board')} className={`tab ${activeTab === 'planning-board' ? 'active' : ''}`}>Manpower Planning Board</button>
                    </nav>

                    {activeTab === 'planning-board' && (
                        <div ref={operatorFilterRef} className="relative">
                            <button onClick={() => setIsOperatorFilterOpen(prev => !prev)} className="btn-secondary !py-2">
                                <i className="fas fa-user-cog mr-2"></i>
                                Operators ({isAllOperatorsSelected ? 'All' : selectedOperators.length})
                            </button>
                            {isOperatorFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 w-60 bg-white border rounded-lg shadow-xl z-30 p-3">
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        <label className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer font-semibold">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                checked={isAllOperatorsSelected}
                                                onChange={() => handleOperatorFilterChange('All')}
                                            />
                                            <span>All Operators</span>
                                        </label>
                                        <hr/>
                                        {allOperatorNames.map(name => (
                                            <label key={name} className="flex items-center space-x-3 p-1 rounded hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                    checked={isAllOperatorsSelected || selectedOperators.includes(name)}
                                                    onChange={() => handleOperatorFilterChange(name)}
                                                />
                                                <span className="text-sm">{name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {activeTab === 'roster' && <div className="p-3 sm:p-6"><OperatorRoster /></div>}
            {activeTab === 'assignments' && <div className="p-3 sm:p-6"><OperatorAssignments shiftTimes={shiftTimes} setShiftTimes={setShiftTimes} /></div>}
            {activeTab === 'planning-board' && <PlanningBoard isReadOnly={true} operatorUsers={filteredOperatorUsers} shiftTimes={shiftTimes} />}
        </div>
    );
};

export default Manpower;