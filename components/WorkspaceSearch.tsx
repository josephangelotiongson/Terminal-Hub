import React from 'react';

interface WorkspaceSearchProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}

const WorkspaceSearch: React.FC<WorkspaceSearchProps> = ({ searchTerm, setSearchTerm }) => {
    return (
        <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <i className="fas fa-search text-text-tertiary"></i>
            </span>
            <input
                type="search"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-56 pl-10 !py-1.5 text-sm"
            />
        </div>
    );
};

export default WorkspaceSearch;