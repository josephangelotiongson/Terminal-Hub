import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Modality, SpecialServiceData, Transfer } from '../types';
import Modal from './Modal';

interface SpecialServicesProps {
    isOpen: boolean;
    onClose: () => void;
    transfer: Transfer;
    modality: Modality;
    onUpdate: (updatedServices: SpecialServiceData[]) => void;
}

const SpecialServices: React.FC<SpecialServicesProps> = ({ isOpen, onClose, transfer, modality, onUpdate }) => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { settings } = context;
    // FIX: Initialize state directly from props using a lazy initializer.
    // This is a more robust pattern for components that mount/unmount, like modals.
    const [selectedServices, setSelectedServices] = useState<string[]>(
        () => (transfer.specialServices || []).map(s => s.name)
    );

    const availableServices = settings.specialServices?.[modality] || [];

    const handleCheckboxChange = (serviceName: string, isChecked: boolean) => {
        if (isChecked) {
            setSelectedServices(prev => [...prev, serviceName]);
        } else {
            setSelectedServices(prev => prev.filter(name => name !== serviceName));
        }
    };

    const handleSave = () => {
        const updatedServiceData = selectedServices.map(name => {
            // Preserve existing data if service was already selected
            const existing = (transfer.specialServices || []).find(s => s.name === name);
            return existing || { name, data: {} };
        });
        onUpdate(updatedServiceData);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Services for ${transfer.product} (${transfer.tonnes}T)`}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-md">Cancel</button>
                    <button onClick={handleSave} className="btn-primary px-4 py-2 text-sm rounded-md">Done</button>
                </>
            }
        >
            <div className="space-y-2">
                {availableServices.map(serviceName => (
                    <label key={serviceName} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                        <input
                            type="checkbox"
                            className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                            checked={selectedServices.includes(serviceName)}
                            onChange={(e) => handleCheckboxChange(serviceName, e.target.checked)}
                        />
                        <span className="text-sm font-medium text-gray-700">{serviceName}</span>
                    </label>
                ))}
                {availableServices.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No special services defined for {modality} modality.</p>
                )}
            </div>
        </Modal>
    );
};

export default SpecialServices;
