import React, { useContext, useState, useEffect, useMemo } from 'react';
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
    const [selectedServices, setSelectedServices] = useState<string[]>([]);

    // FIX: Use useEffect to sync state with props when the modal opens.
    // This prevents showing stale data from a previously edited transfer.
    useEffect(() => {
        if (isOpen) {
            setSelectedServices((transfer.specialServices || []).map(s => s.name));
        }
    }, [isOpen, transfer]);

    const availableServices = useMemo(() => {
        const modServices = settings.modalityServices?.[modality] || [];
        const prodServices = settings.productServices || [];
        // Combine modality-specific and product-specific services for all modalities.
        const services = [...modServices, ...prodServices];
        return [...new Set(services)].sort();
    }, [modality, settings]);


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