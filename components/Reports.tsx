import React from 'react';

const TRUCK_CYCLE_TIME_STEPS = [
    { key: 'arrivalToOnBay', name: 'Arrival to On Bay', startEvent: 'Arrived', endEvent: 'On Bay', color: '#374151' },
    { key: 'onBayToStartPump', name: 'On Bay to Start Pumping', startEvent: 'On Bay', endEvent: 'Pumping Started', color: '#6b7280' },
    { key: 'pumpDuration', name: 'Pumping Duration', startEvent: 'Pumping Started', endEvent: 'Pumping Stopped', color: '#9ca3be' },
    { key: 'stopToPaperwork', name: 'Stop to Paperwork Done', startEvent: 'Pumping Stopped', endEvent: 'Paperwork Done', color: '#d1d5db' },
];

// FIX: Add a placeholder Reports component with a default export to fix the import error.
const Reports: React.FC = () => {
  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold text-brand-dark">Reports</h2>
      <div className="card mt-4 p-8 text-center text-text-secondary">
        <p>Reports section is under construction.</p>
      </div>
    </div>
  );
};

export default Reports;
