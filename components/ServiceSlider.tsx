
import React, { useRef, useEffect, useState } from 'react';
import { SpecialServiceData } from '../types';

interface ServiceSliderProps {
    service: SpecialServiceData;
    context: string;
    onStatusChange: (status: 'pending' | 'complete') => void;
}

const ServiceSlider: React.FC<ServiceSliderProps> = ({ service, context, onStatusChange }) => {
    const status = service.data?.status === 'complete' ? 'complete' : 'pending';
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!thumbRef.current || !trackRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        thumbRef.current.setPointerCapture(e.pointerId);
        thumbRef.current.style.transition = 'none';
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !trackRef.current || !thumbRef.current) return;
        e.preventDefault();

        const trackRect = trackRef.current.getBoundingClientRect();
        const thumbWidth = thumbRef.current.offsetWidth;
        const maxTranslate = trackRect.width - thumbWidth;
        
        // Calculate position relative to track start
        // e.clientX is viewport x. trackRect.left is viewport x of track start.
        // Center the thumb under pointer
        let newX = e.clientX - trackRect.left - (thumbWidth / 2);
        
        // Clamp
        newX = Math.max(0, Math.min(newX, maxTranslate));

        thumbRef.current.style.transform = `translateX(${newX}px)`;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging || !trackRef.current || !thumbRef.current) return;
        
        setIsDragging(false);
        thumbRef.current.releasePointerCapture(e.pointerId);
        thumbRef.current.style.transition = 'transform 0.2s ease-out';

        const trackRect = trackRef.current.getBoundingClientRect();
        const thumbWidth = thumbRef.current.offsetWidth;
        const maxTranslate = trackRect.width - thumbWidth;
        
        let currentX = e.clientX - trackRect.left - (thumbWidth / 2);
        currentX = Math.max(0, Math.min(currentX, maxTranslate));

        const threshold = maxTranslate * 0.7;

        if (status === 'pending') {
            // Slide right to complete
            if (currentX > threshold) {
                onStatusChange('complete');
                // Final position handled by useEffect
            } else {
                thumbRef.current.style.transform = 'translateX(0px)';
            }
        } else {
            // Slide left to undo (starts at maxTranslate)
            if (currentX < maxTranslate - threshold) {
                onStatusChange('pending');
            } else {
                thumbRef.current.style.transform = `translateX(${maxTranslate}px)`;
            }
        }
    };

    useEffect(() => {
        if (thumbRef.current && trackRef.current) {
            const maxTranslate = trackRef.current.offsetWidth - thumbRef.current.offsetWidth;
            thumbRef.current.style.transform = status === 'complete' ? `translateX(${maxTranslate}px)` : 'translateX(0px)';
        }
    }, [status]);

    return (
        <div className={`sof-item ${status === 'complete' ? 'complete' : 'pending'}`}>
            <div className="sof-icon">
                <i className="fas fa-concierge-bell"></i>
            </div>
            
            <div
                className="sof-slider-track touch-none"
                ref={trackRef}
            >
                {status === 'complete' && <i className="fas fa-undo sof-slider-target-icon"></i>}
                <div 
                    ref={thumbRef} 
                    className="sof-slider-thumb cursor-grab active:cursor-grabbing"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <i className={`fas ${status === 'pending' ? 'fa-arrow-right' : 'fa-check'} sof-slider-icon`}></i>
                </div>
                {status === 'pending' && <i className="fas fa-check sof-slider-target-icon"></i>}
            </div>

            <div className="flex-1 ml-2">
                <h5 className="font-semibold text-sm">{service.name}</h5>
                <p className="text-xs text-text-tertiary">{context}</p>
                {status === 'complete' && (
                    <p className="text-xs text-green-700 font-medium mt-0.5">
                        <i className="fas fa-check-circle mr-1"></i>Service Completed
                    </p>
                )}
            </div>
        </div>
    );
};

export default ServiceSlider;
