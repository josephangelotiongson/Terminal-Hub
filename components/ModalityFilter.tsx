import React from 'react';
import { Modality } from '../types';

interface ModalityFilterProps {
    filter: Modality | 'all';
    setFilter: (filter: Modality | 'all') => void;
    showAllOption?: boolean;
}

const ModalityFilter: React.FC<ModalityFilterProps> = ({ filter, setFilter, showAllOption = true }) => {
    const getIcon = (modality: Modality) => {
        switch (modality) {
            case 'vessel': return 'fa-ship';
            case 'truck': return 'fa-truck';
            case 'rail': return 'fa-train';
            default: return '';
        }
    };
    
    const options = (showAllOption ? ['all', 'vessel', 'truck', 'rail'] : ['vessel', 'truck', 'rail']) as (Modality | 'all')[];

    return (
        <div className="planning-board-filters">
            {options.map(f => (
                <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`filter-btn ${filter === f ? 'active' : ''}`}
                >
                    {f !== 'all' && <i className={`fas ${getIcon(f as Modality)} mr-2`}></i>}
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
            ))}
        </div>
    );
};

export default ModalityFilter;