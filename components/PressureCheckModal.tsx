import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import { Transfer, PressureCheckLogEntry } from '../types';

interface PressureCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (logData: Omit<PressureCheckLogEntry, 'id' | 'transferId'>) => void;
    transfer: Transfer;
}

const PressureCheckModal: React.FC<PressureCheckModalProps> = ({ isOpen, onClose, onSave, transfer }) => {
    const [pressure, setPressure] = useState('');
    const [result, setResult] = useState<'Pass' | 'Fail' | ''>('Pass');
    const [initials, setInitials] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            setPressure('');
            setResult('Pass');
            setInitials('');
        }
    }, [isOpen]);
    
    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const parent = canvas.parentElement;
            if (!parent) return;

            const setupCanvas = () => {
                const rect = parent.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = 120;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    if (initials) {
                        const img = new Image();
                        img.src = initials;
                        img.onload = () => ctx.drawImage(img, 0, 0);
                    }
                }
            };
            setupCanvas();
            window.addEventListener('resize', setupCanvas);
            return () => window.removeEventListener('resize', setupCanvas);
        }
    }, [isOpen, initials]);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientX : e.nativeEvent.touches[0].clientX;
        let clientY = e.nativeEvent instanceof MouseEvent ? e.nativeEvent.clientY : e.nativeEvent.touches[0].clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); const { x, y } = getCoords(e); const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true); };
    const draw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); if (!isDrawing) return; const { x, y } = getCoords(e); const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; ctx.lineTo(x, y); ctx.stroke(); };
    const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return; ctx.closePath(); setIsDrawing(false);
        const dataUrl = canvasRef.current?.toDataURL('image/png') || '';
        const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height).data.buffer);
        setInitials(pixelBuffer.some(color => color !== 0) ? dataUrl : '');
    };
    const clearCanvas = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!ctx || !canvas) return; ctx.clearRect(0, 0, canvas.width, canvas.height); setInitials(''); };


    const handleSave = () => {
        onSave({ pressure, result, initials });
    };

    const isFormValid = pressure.trim() !== '' && result === 'Pass' && initials !== '';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Hose Leak & Pressure Check for ${transfer.product}`}
            footer={<>
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn-primary" disabled={!isFormValid}>Save & Complete Step</button>
            </>}
        >
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">Please log the pressure check results. The test must pass and be initialed to proceed.</p>
                {!isFormValid && <p className="text-xs text-center p-2 bg-yellow-100 text-yellow-800 rounded-md font-semibold">A pressure reading, a 'Pass' result, and operator initials are required to proceed.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label>Pressure Reading (kPa)</label>
                        <input type="text" value={pressure} onChange={e => setPressure(e.target.value)} placeholder="e.g., 150 kPa" />
                    </div>
                    <div>
                        <label>Test Result</label>
                        <select value={result} onChange={e => setResult(e.target.value as any)}>
                            <option value="">Select...</option><option value="Pass">Pass</option><option value="Fail">Fail</option>
                        </select>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label>Operator Initials</label>
                        <button type="button" onClick={clearCanvas} className="btn-secondary !text-xs !py-1">Clear</button>
                    </div>
                    <canvas
                        ref={canvasRef}
                        className="border border-slate-300 rounded-lg cursor-crosshair touch-none bg-white w-full"
                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default PressureCheckModal;