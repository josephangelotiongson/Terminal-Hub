import React, { useState, useEffect, useMemo } from 'react';

interface DateTimePickerProps {
    value: string; // ISO string
    onChange: (isoString: string) => void;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange }) => {
    const [datePart, setDatePart] = useState('');
    const [timePart, setTimePart] = useState('');

    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const hour = String(h).padStart(2, '0');
                const minute = String(m).padStart(2, '0');
                options.push(`${hour}:${minute}`);
            }
        }
        return options;
    }, []);

    useEffect(() => {
        if (value) {
            try {
                const d = new Date(value);
                
                // New rounding logic to nearest 30 mins
                const MS_PER_30_MINS = 30 * 60 * 1000;
                const roundedTime = new Date(Math.round(d.getTime() / MS_PER_30_MINS) * MS_PER_30_MINS);

                const localRoundedISO = new Date(roundedTime.getTime() - roundedTime.getTimezoneOffset() * 60000).toISOString();
                
                setDatePart(localRoundedISO.split('T')[0]);
                const roundedHours = String(roundedTime.getHours()).padStart(2, '0');
                const roundedMinutesStr = String(roundedTime.getMinutes()).padStart(2, '0');
                setTimePart(`${roundedHours}:${roundedMinutesStr}`);

            } catch (e) {
                // Handle invalid date string gracefully
                const now = new Date();
                const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
                setDatePart(localISO.split('T')[0]);
                setTimePart('12:00');
            }
        } else {
             const now = new Date();
             const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
             setDatePart(localISO.split('T')[0]);
             setTimePart('12:00');
        }
    }, [value]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDatePart = e.target.value;
        setDatePart(newDatePart);
        if (newDatePart && timePart) {
            const combined = new Date(`${newDatePart}T${timePart}:00`);
            onChange(combined.toISOString());
        }
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTimePart = e.target.value;
        setTimePart(newTimePart);
        if (datePart && newTimePart) {
            const combined = new Date(`${datePart}T${newTimePart}:00`);
            onChange(combined.toISOString());
        }
    };

    return (
        <div className="flex gap-2">
            <input
                type="date"
                value={datePart}
                onChange={handleDateChange}
                className="w-1/2"
            />
            <select
                value={timePart}
                onChange={handleTimeChange}
                className="w-1/2"
            >
                {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                ))}
            </select>
        </div>
    );
};

export default DateTimePicker;