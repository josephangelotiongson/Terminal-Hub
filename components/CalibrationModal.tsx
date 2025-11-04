import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { CalibrationPoint } from '../types';

interface CalibrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CalibrationPoint[]) => void;
    tankName: string;
    initialData: CalibrationPoint[];
}

const CalibrationModal: React.FC<CalibrationModalProps> = ({ isOpen, onClose, onSave, tankName, initialData }) => {
    const [data, setData] = useState<CalibrationPoint[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Sort initial data for consistent display
            setData([...(initialData || [])].sort((a, b) => a.dip - b.dip));
        }
    }, [isOpen, initialData]);

    const handleUpdate = (index: number, field: 'dip' | 'volume', value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) && value !== '') return;
        const newData = [...data];
        (newData[index] as any)[field] = value === '' ? '' : numValue;
        setData(newData);
    };

    const handleAddRow = () => {
        const lastPoint = data[data.length - 1] || { dip: 0, volume: 0 };
        setData([...data, { dip: lastPoint.dip + 10, volume: lastPoint.volume + 100 }]); // Add a sensible default
    };

    const handleRemoveRow = (index: number) => {
        setData(data.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const validatedData = data.filter(p => typeof p.dip === 'number' && typeof p.volume === 'number' && p.dip >= 0 && p.volume >= 0);
        const sortedData = [...validatedData].sort((a, b) => a.dip - b.dip);
        onSave(sortedData);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Calibration Matrix for Tank ${tankName}`}
            footer={<>
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary">Save Matrix</button>
            </>}
        >
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">Enter dip readings and their corresponding tank innage volumes. The system will interpolate between these points.</p>
                <div className="max-h-96 overflow-y-auto pr-2 border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-100">
                            <tr>
                                <th className="p-2 text-left font-semibold">Dip Reading</th>
                                <th className="p-2 text-left font-semibold">Volume (MT)</th>
                                <th className="p-2 w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((point, index) => (
                                <tr key={index} className="border-t hover:bg-slate-50">
                                    <td className="p-1">
                                        <input type="number" value={point.dip} onChange={e => handleUpdate(index, 'dip', e.target.value)} className="!py-1.5" />
                                    </td>
                                    <td className="p-1">
                                        <input type="number" value={point.volume} onChange={e => handleUpdate(index, 'volume', e.target.value)} className="!py-1.5" />
                                    </td>
                                    <td className="p-1 text-center">
                                        <button onClick={() => handleRemoveRow(index)} className="btn-icon danger" title="Remove Point"><i className="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {data.length === 0 && <p className="text-sm text-center text-slate-400 italic py-8">No calibration points. Add one to start.</p>}
                </div>
                <button onClick={handleAddRow} className="btn-secondary"><i className="fas fa-plus mr-2"></i>Add Point</button>
            </div>
        </Modal>
    );
};

export default CalibrationModal;