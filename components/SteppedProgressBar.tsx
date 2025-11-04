import React from 'react';
import { Operation, SOFItem } from '../types';
import { SOF_EVENTS_MODALITY } from '../constants';

interface SteppedProgressBarProps {
    op: Operation;
}

const SteppedProgressBar: React.FC<SteppedProgressBarProps> = ({ op }) => {
    const allPossibleSteps = SOF_EVENTS_MODALITY[op.modality] || [];
    
    // Find the first transfer to represent progress, common for trucks/rail
    const firstTransfer = op.transferPlan?.[0]?.transfers?.[0];
    const sof = firstTransfer?.sof || [];
    
    const completedSteps = sof.filter(s => s.status === 'complete').map(s => {
        // Strip loop prefix for matching, e.g., "Rework #2: Arrived" -> "Arrived"
        const match = s.event.match(/^(?:Rework #\d+: )?(.*)$/);
        return match ? match[1] : s.event;
    });

    if (op.status === 'completed') {
        // For completed, show all steps as green
         return (
            <div className="stepped-progress-bar">
                {allPossibleSteps.map((stepName) => (
                    <div key={stepName} className="progress-step step-complete">
                        <span>{stepName}</span>
                    </div>
                ))}
            </div>
        );
    }
    
    let activeStepSet = false;

    return (
        <div className="stepped-progress-bar">
            {allPossibleSteps.map((stepName) => {
                let statusClass = 'step-pending';
                if (completedSteps.includes(stepName)) {
                    statusClass = 'step-complete';
                } else if (!activeStepSet) {
                    statusClass = 'step-active';
                    activeStepSet = true;
                }

                return (
                    <div key={stepName} className={`progress-step ${statusClass}`}>
                        <span>{stepName}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default SteppedProgressBar;
