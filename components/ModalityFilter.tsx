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
            {options.map(f => {
                const label = f.charAt(0).toUpperCase() + f.slice(1);
                // If 'all' isn't an option, and the global filter is 'all', default the UI to 'vessel' being active.
                const isActive = filter === f || (filter === 'all' && showAllOption === false && f === 'vessel');

                return (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`filter-btn ${isActive ? 'active' : ''} ${f !== 'all' ? '!px-3' : ''}`}
                        title={label}
                    >
                        {f === 'all' ? (
                            'All'
                        ) : (
                            <i className={`fas ${getIcon(f as Modality)}`}></i>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default ModalityFilter;
