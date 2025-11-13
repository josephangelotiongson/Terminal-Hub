import React, { useState, useEffect } from 'react';
import { MOCK_CURRENT_TIME } from '../constants';

const ElapsedTimeBadge: React.FC<{ startTime: string | null; className?: string }> = ({ startTime, className = '' }) => {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        if (!startTime) {
            setElapsed('');
            return;
        }

        const calculateElapsed = () => {
            const start = new Date(startTime).getTime();
            const now = MOCK_CURRENT_TIME.getTime();
            const diff = now - start;

            if (diff < 60000) { // Less than a minute
                setElapsed(''); // Don't show for very short times
                return;
            };
            
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) setElapsed(`${days}d ${hours % 24}h`);
            else if (hours > 0) setElapsed(`${hours}h ${minutes % 60}m`);
            else setElapsed(`${minutes}m`);
        };

        calculateElapsed();
        const interval = setInterval(calculateElapsed, 30000); // update every 30s
        return () => clearInterval(interval);
    }, [startTime]);
    
    if (!elapsed) return null;

    return (
        <span className={`text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}>
            <i className="far fa-clock mr-1"></i>
            {elapsed}
        </span>
    );
};

export default ElapsedTimeBadge;