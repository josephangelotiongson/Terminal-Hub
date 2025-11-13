import React from 'react';

interface OperationProgressBarProps {
    percentage: number;
    title: string;
}

const OperationProgressBar: React.FC<OperationProgressBarProps> = ({ percentage, title }) => {
    return (
        <div className="flex items-center gap-2 w-full max-w-[150px]" title={title}>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                ></div>
            </div>
            <span className="text-xs font-semibold text-text-secondary w-10 text-right">{percentage.toFixed(0)}%</span>
        </div>
    );
};

export default OperationProgressBar;
