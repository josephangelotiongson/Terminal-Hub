
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { AppSettings, LineSegment, Lineup } from '../types';
import { formatInfraName, naturalSort } from '../utils/helpers';

type ViewMode = 'segments' | 'lineups' | 'intermediates';

const SegmentsView: React.FC = () => {
    const { currentTerminalSettings, setSettings, selectedTerminal } = useContext(AppContext)!;
    const [newSegment, setNewSegment] = useState<Partial<LineSegment>>({ status: 'active' });

    const allNodes = useMemo(() => {
        const tanks = Object.keys(currentTerminalSettings.masterTanks || {});
        const infra = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {});
        const intermediates = currentTerminalSettings.masterIntermediates || [];
        return [...tanks, ...infra, ...intermediates].sort(naturalSort);
    }, [currentTerminalSettings]);

    const segments = currentTerminalSettings.lineSegments || [];

    const handleAdd = () => {
        if (!newSegment.sourceId || !newSegment.targetId) {
            alert("Source and Target are required.");
            return;
        }
        const id = `seg-${newSegment.sourceId.slice(0,3)}-${newSegment.targetId.slice(0,3)}-${Date.now().toString().slice(-4)}`;
        const name = newSegment.name || `${newSegment.sourceId} to ${newSegment.targetId}`;
        
        const segment: LineSegment = {
            id,
            name,
            sourceId: newSegment.sourceId,
            targetId: newSegment.targetId,
            lengthMeters: newSegment.lengthMeters || 0,
            volumeBarrels: newSegment.volumeBarrels || 0,
            diameterInches: newSegment.diameterInches || 0,
            status: 'active'
        };

        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            if (!newSettings[selectedTerminal].lineSegments) newSettings[selectedTerminal].lineSegments = [];
            newSettings[selectedTerminal].lineSegments!.push(segment);
            return newSettings;
        });
        setNewSegment({ status: 'active' });
    };

    const handleDelete = (id: string) => {
         setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            newSettings[selectedTerminal].lineSegments = newSettings[selectedTerminal].lineSegments?.filter(s => s.id !== id);
            return newSettings;
        });
    };

    return (
        <div className="space-y-6">
            <div className="card p-4 bg-slate-50 border-slate-200">
                <h4 className="font-bold mb-4">Add New Segment</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                    <div className="col-span-1 md:col-span-2">
                         <label className="block text-xs font-bold text-gray-700 mb-1">Name (Optional)</label>
                         <input type="text" value={newSegment.name || ''} onChange={e => setNewSegment({...newSegment, name: e.target.value})} placeholder="e.g. Main Line A" className="w-full p-2 border rounded" />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Source</label>
                        <select value={newSegment.sourceId || ''} onChange={e => setNewSegment({...newSegment, sourceId: e.target.value})} className="w-full p-2 border rounded">
                            <option value="">Select Source...</option>
                            {allNodes.map(n => <option key={n} value={n}>{formatInfraName(n)}</option>)}
                        </select>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Target</label>
                        <select value={newSegment.targetId || ''} onChange={e => setNewSegment({...newSegment, targetId: e.target.value})} className="w-full p-2 border rounded">
                            <option value="">Select Target...</option>
                            {allNodes.map(n => <option key={n} value={n}>{formatInfraName(n)}</option>)}
                        </select>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-gray-700 mb-1">Length (m)</label>
                         <input type="number" value={newSegment.lengthMeters || ''} onChange={e => setNewSegment({...newSegment, lengthMeters: parseFloat(e.target.value)})} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-gray-700 mb-1">Volume (bbl)</label>
                         <input type="number" value={newSegment.volumeBarrels || ''} onChange={e => setNewSegment({...newSegment, volumeBarrels: parseFloat(e.target.value)})} className="w-full p-2 border rounded" />
                    </div>
                     <div>
                         <label className="block text-xs font-bold text-gray-700 mb-1">Diameter (in)</label>
                         <input type="number" value={newSegment.diameterInches || ''} onChange={e => setNewSegment({...newSegment, diameterInches: parseFloat(e.target.value)})} className="w-full p-2 border rounded" />
                    </div>
                    <button onClick={handleAdd} className="btn-primary h-10">Add Segment</button>
                </div>
            </div>

            <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-600">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Source</th>
                            <th className="p-3 text-center"><i className="fas fa-arrow-right"></i></th>
                            <th className="p-3">Target</th>
                            <th className="p-3">Specs</th>
                            <th className="p-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {segments.map(seg => (
                            <tr key={seg.id} className="hover:bg-slate-50">
                                <td className="p-3 font-medium">{seg.name}</td>
                                <td className="p-3">{formatInfraName(seg.sourceId)}</td>
                                <td className="p-3 text-center text-slate-400"><i className="fas fa-long-arrow-alt-right"></i></td>
                                <td className="p-3">{formatInfraName(seg.targetId)}</td>
                                <td className="p-3 text-xs text-slate-500">
                                    {seg.lengthMeters}m / {seg.volumeBarrels}bbl / {seg.diameterInches}"
                                </td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleDelete(seg.id)} className="btn-icon danger"><i className="fas fa-trash text-xs"></i></button>
                                </td>
                            </tr>
                        ))}
                        {segments.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No segments defined.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const LineupsView: React.FC = () => {
    const { currentTerminalSettings, setSettings, selectedTerminal } = useContext(AppContext)!;
    const [isEditing, setIsEditing] = useState(false);
    const [currentLineup, setCurrentLineup] = useState<Partial<Lineup>>({ segmentIds: [] });
    
    const segments = currentTerminalSettings.lineSegments || [];
    const lineups = currentTerminalSettings.lineups || [];
    
    const allNodes = useMemo(() => {
        const tanks = Object.keys(currentTerminalSettings.masterTanks || {});
        const infra = Object.keys(currentTerminalSettings.infrastructureModalityMapping || {});
        const intermediates = currentTerminalSettings.masterIntermediates || [];
        return [...tanks, ...infra, ...intermediates].sort(naturalSort);
    }, [currentTerminalSettings]);

    const handleSave = () => {
        if (!currentLineup.name || !currentLineup.sourceId || !currentLineup.destinationId || (currentLineup.segmentIds?.length || 0) === 0) {
            alert("Name, Source, Destination, and at least one Segment are required.");
            return;
        }
        
        const newLineup: Lineup = {
            id: currentLineup.id || `lineup-${Date.now()}`,
            name: currentLineup.name!,
            sourceId: currentLineup.sourceId!,
            destinationId: currentLineup.destinationId!,
            segmentIds: currentLineup.segmentIds!,
            valid: true // Simplified validation for now
        };

        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            if (!newSettings[selectedTerminal].lineups) newSettings[selectedTerminal].lineups = [];
            
            if (currentLineup.id) {
                const idx = newSettings[selectedTerminal].lineups!.findIndex(l => l.id === currentLineup.id);
                if (idx > -1) newSettings[selectedTerminal].lineups![idx] = newLineup;
            } else {
                newSettings[selectedTerminal].lineups!.push(newLineup);
            }
            return newSettings;
        });
        setIsEditing(false);
        setCurrentLineup({ segmentIds: [] });
    };

    const handleDelete = (id: string) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            newSettings[selectedTerminal].lineups = newSettings[selectedTerminal].lineups?.filter(l => l.id !== id);
            return newSettings;
        });
    };
    
    // Helper to find next possible segments based on current end of chain
    const getNextPossibleSegments = () => {
        let currentEndNode = currentLineup.sourceId;
        if (currentLineup.segmentIds && currentLineup.segmentIds.length > 0) {
            const lastSegId = currentLineup.segmentIds[currentLineup.segmentIds.length - 1];
            const lastSeg = segments.find(s => s.id === lastSegId);
            if (lastSeg) currentEndNode = lastSeg.targetId;
        }
        
        if (!currentEndNode) return [];
        return segments.filter(s => s.sourceId === currentEndNode);
    };
    
    const addSegmentToChain = (segId: string) => {
        setCurrentLineup(prev => ({ ...prev, segmentIds: [...(prev.segmentIds || []), segId] }));
    };

    const removeLastSegment = () => {
        setCurrentLineup(prev => {
            const newSegs = [...(prev.segmentIds || [])];
            newSegs.pop();
            return { ...prev, segmentIds: newSegs };
        });
    };
    
    const totalVolume = (currentLineup.segmentIds || []).reduce((sum, id) => {
        const seg = segments.find(s => s.id === id);
        return sum + (seg?.volumeBarrels || 0);
    }, 0);

    if (isEditing) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Lineup Editor</h3>
                    <div className="space-x-2">
                        <button onClick={() => setIsEditing(false)} className="btn-secondary">Cancel</button>
                        <button onClick={handleSave} className="btn-primary">Save Lineup</button>
                    </div>
                </div>
                
                <div className="card p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1">Lineup Name</label>
                            <input type="text" value={currentLineup.name || ''} onChange={e => setCurrentLineup({...currentLineup, name: e.target.value})} className="w-full p-2 border rounded" placeholder="e.g. Wharf 1 to Fuel Farm A" />
                        </div>
                         <div>
                            <label className="block text-xs font-bold mb-1">Source Asset</label>
                            <select value={currentLineup.sourceId || ''} onChange={e => setCurrentLineup({...currentLineup, sourceId: e.target.value, segmentIds: []})} className="w-full p-2 border rounded">
                                <option value="">Select Source...</option>
                                {allNodes.map(n => <option key={n} value={n}>{formatInfraName(n)}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-xs font-bold mb-1">Destination Asset</label>
                            <select value={currentLineup.destinationId || ''} onChange={e => setCurrentLineup({...currentLineup, destinationId: e.target.value})} className="w-full p-2 border rounded">
                                <option value="">Select Destination...</option>
                                {allNodes.map(n => <option key={n} value={n}>{formatInfraName(n)}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Visual Builder */}
                    <div className="bg-slate-50 border rounded-lg p-6">
                        <div className="flex items-center flex-wrap gap-2">
                            {/* Start Node */}
                            <div className="px-4 py-2 bg-blue-100 text-blue-800 border border-blue-300 rounded-lg font-bold text-sm flex items-center">
                                <i className="fas fa-play-circle mr-2"></i>
                                {currentLineup.sourceId ? formatInfraName(currentLineup.sourceId) : 'Start'}
                            </div>
                            
                            {/* Segments Chain */}
                            {(currentLineup.segmentIds || []).map((segId, idx) => {
                                const seg = segments.find(s => s.id === segId);
                                return (
                                    <React.Fragment key={idx}>
                                        <i className="fas fa-arrow-right text-slate-400"></i>
                                        <div className="px-3 py-1.5 bg-white border border-slate-300 rounded shadow-sm text-sm">
                                            <div className="font-semibold">{seg?.name}</div>
                                            <div className="text-xs text-slate-500">{seg?.lengthMeters}m / {seg?.volumeBarrels}bbl</div>
                                        </div>
                                    </React.Fragment>
                                )
                            })}

                            {/* Next Segment Slot */}
                            {currentLineup.sourceId && (
                                <>
                                    <i className="fas fa-arrow-right text-slate-400"></i>
                                    <div className="relative group">
                                        <button className="px-3 py-1.5 bg-green-50 border border-green-300 border-dashed rounded text-green-700 text-sm hover:bg-green-100">
                                            + Add Segment
                                        </button>
                                        {/* Dropdown for next segments */}
                                        <div className="absolute top-full left-0 mt-2 w-64 bg-white border shadow-lg rounded-md z-10 hidden group-hover:block">
                                            <div className="p-2 text-xs font-bold text-slate-500 bg-slate-50 border-b">Available Segments</div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {getNextPossibleSegments().map(s => (
                                                    <button key={s.id} onClick={() => addSegmentToChain(s.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0">
                                                        <div className="font-bold">{s.name}</div>
                                                        <div className="text-xs text-slate-500">To: {formatInfraName(s.targetId)}</div>
                                                    </button>
                                                ))}
                                                {getNextPossibleSegments().length === 0 && (
                                                    <div className="p-3 text-xs text-center text-slate-400 italic">No connecting segments found.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {/* Undo Button */}
                            {(currentLineup.segmentIds || []).length > 0 && (
                                <button onClick={removeLastSegment} className="ml-2 text-red-500 hover:text-red-700" title="Remove last segment">
                                    <i className="fas fa-backspace"></i>
                                </button>
                            )}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                            <div className="text-sm text-text-secondary">
                                <strong>Total Line Pack:</strong> {totalVolume.toFixed(2)} bbls
                            </div>
                             {currentLineup.destinationId && (currentLineup.segmentIds || []).length > 0 && (
                                 <div className={`text-sm font-bold ${segments.find(s => s.id === currentLineup.segmentIds![currentLineup.segmentIds!.length-1])?.targetId === currentLineup.destinationId ? 'text-green-600' : 'text-red-600'}`}>
                                     Status: {segments.find(s => s.id === currentLineup.segmentIds![currentLineup.segmentIds!.length-1])?.targetId === currentLineup.destinationId ? 'Connected' : 'Incomplete Path'}
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={() => { setIsEditing(true); setCurrentLineup({ segmentIds: [] }); }} className="btn-primary">
                    <i className="fas fa-plus mr-2"></i>New Lineup
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {lineups.map(lineup => (
                    <div key={lineup.id} className="card p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-lg text-brand-dark">{lineup.name}</h4>
                            <div className="space-x-1">
                                <button onClick={() => { setCurrentLineup(lineup); setIsEditing(true); }} className="btn-icon"><i className="fas fa-pen text-xs"></i></button>
                                <button onClick={() => handleDelete(lineup.id)} className="btn-icon danger"><i className="fas fa-trash text-xs"></i></button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
                            <span className="font-medium">{formatInfraName(lineup.sourceId)}</span>
                            <i className="fas fa-long-arrow-alt-right"></i>
                            <span className="font-medium">{formatInfraName(lineup.destinationId)}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                            <p>{lineup.segmentIds.length} Segments</p>
                            <p className="truncate mt-1 opacity-70">{lineup.segmentIds.map(id => segments.find(s => s.id === id)?.name).join(' → ')}</p>
                        </div>
                    </div>
                ))}
                 {lineups.length === 0 && (
                    <div className="col-span-full text-center p-8 text-slate-500 bg-slate-50 rounded border-2 border-dashed">
                        No lineups defined. Create one to define a valid flow path.
                    </div>
                )}
            </div>
        </div>
    );
};

const IntermediatesView: React.FC = () => {
    const { currentTerminalSettings, setSettings, selectedTerminal } = useContext(AppContext)!;
    const [newItem, setNewItem] = useState('');
    
    const items = currentTerminalSettings.masterIntermediates || [];

    const handleAdd = () => {
        if (newItem.trim()) {
             setSettings(prev => {
                const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
                if (!newSettings[selectedTerminal].masterIntermediates) newSettings[selectedTerminal].masterIntermediates = [];
                newSettings[selectedTerminal].masterIntermediates!.push(newItem.trim());
                newSettings[selectedTerminal].masterIntermediates!.sort();
                return newSettings;
            });
            setNewItem('');
        }
    };

    const handleDelete = (item: string) => {
         setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev)) as AppSettings;
            newSettings[selectedTerminal].masterIntermediates = newSettings[selectedTerminal].masterIntermediates?.filter(i => i !== item);
            return newSettings;
        });
    };

    return (
        <div className="card p-6 max-w-2xl mx-auto">
             <h3 className="text-xl font-semibold text-text-primary mb-2">Intermediate Assets</h3>
             <p className="text-sm text-text-secondary mb-4">Define manifolds, pumps, and other junctions that serve as connection points for line segments.</p>
            
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    placeholder="New Manifold/Pump Name..."
                    className="flex-grow"
                />
                <button onClick={handleAdd} className="btn-primary">Add</button>
            </div>

             <div className="space-y-2 max-h-96 overflow-y-auto p-1 border-t pt-4">
                {items.map(item => (
                    <div key={item} className="p-2 rounded-md flex justify-between items-center hover:bg-gray-50 border border-transparent hover:border-slate-200">
                        <span className="text-base font-medium">{item}</span>
                        <button onClick={() => handleDelete(item)} className="btn-icon danger"><i className="fas fa-trash text-xs"></i></button>
                    </div>
                ))}
                 {items.length === 0 && <p className="text-center text-slate-400 italic">No intermediates defined.</p>}
            </div>
        </div>
    );
};

const LineupManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ViewMode>('lineups');

    return (
        <div>
             <div className="sticky top-0 z-10 bg-background-body p-3 sm:p-6 border-b border-border-primary">
                <h2 className="text-2xl font-bold text-brand-dark mb-4">Network Connectivity Manager</h2>
                <div className="border-b border-border-primary">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('lineups')} className={`tab ${activeTab === 'lineups' ? 'active' : ''}`}>Lineups (Paths)</button>
                        <button onClick={() => setActiveTab('segments')} className={`tab ${activeTab === 'segments' ? 'active' : ''}`}>Line Segments</button>
                        <button onClick={() => setActiveTab('intermediates')} className={`tab ${activeTab === 'intermediates' ? 'active' : ''}`}>Intermediates</button>
                    </nav>
                </div>
            </div>
            <div className="p-3 sm:p-6">
                {activeTab === 'lineups' && <LineupsView />}
                {activeTab === 'segments' && <SegmentsView />}
                {activeTab === 'intermediates' && <IntermediatesView />}
            </div>
        </div>
    );
};

export default LineupManager;
