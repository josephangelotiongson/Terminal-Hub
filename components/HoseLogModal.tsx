
import React, { useState, useEffect, useRef, useContext } from 'react';
import Modal from './Modal';
import { AppContext } from '../context/AppContext';

interface HoseLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (logEntry: any) => void;
    product: string;
}

const HoseLogModal: React.FC<HoseLogModalProps> = ({ isOpen, onClose, onSave, product }) => {
    const { simulatedTime } = useContext(AppContext)!;
    const [hoseNumber, setHoseNumber] = useState('');
    const [testDate, setTestDate] = useState('');
    const [pressureTestPassed, setPressureTestPassed] = useState<'Y' | 'N' | ''>('');
    const [newGasketUsed, setNewGasketUsed] = useState<'Y' | 'N' | ''>('');
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset form on open and set defaults for "less clicks"
            setHoseNumber('');
            setTestDate(simulatedTime.toISOString().split('T')[0]); // Default to current simulated day
            setPressureTestPassed('Y'); // Default to Yes
            setNewGasketUsed('Y'); // Default to Yes
        }
    }, [isOpen, simulatedTime]);

    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const parent = canvas.parentElement;
            if (!parent) return;

            const setupCanvas = () => {
                const rect = parent.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = 120; // A good height for signing

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.strokeStyle = '#0f172a'; // slate-900
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    // Clear canvas when setting up
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            };
            
            setupCanvas();
            window.addEventListener('resize', setupCanvas);

            return () => {
                window.removeEventListener('resize', setupCanvas);
            };
        }
    }, [isOpen]);

    const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if (e.nativeEvent instanceof MouseEvent) {
            clientX = e.nativeEvent.clientX;
            clientY = e.nativeEvent.clientY;
        } else if (e.nativeEvent instanceof TouchEvent && e.nativeEvent.touches.length > 0) {
            clientX = e.nativeEvent.touches[0].clientX;
            clientY = e.nativeEvent.touches[0].clientY;
        } else {
            return { x: 0, y: 0 };
        }
        
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;
        
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;
        ctx.closePath();
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;
        const pixelBuffer = new Uint32Array(context.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
        const isEmpty = !pixelBuffer.some(color => color !== 0);
        const signatureDataUrl = isEmpty ? '' : canvas.toDataURL('image/png');

        if (!hoseNumber || !pressureTestPassed || !newGasketUsed || !signatureDataUrl) {
            alert('Please complete all fields, including initials.');
            return;
        }
        onSave({
            hoseNumber,
            product,
            testDate,
            pressureTestPassed,
            newGasketUsed,
            initials: signatureDataUrl,
        });
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Hose Connection Log"
            footer={<>
                <button onClick={onClose} className="btn-secondary">Skip</button>
                <button onClick={handleSave} className="btn-primary">Save Log</button>
            </>}
        >
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">Please log the details for the hose connected for <span className="font-bold">{product}</span>.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label>Hose Number</label><input type="text" value={hoseNumber} onChange={e => setHoseNumber(e.target.value)} /></div>
                    <div><label>Test Date</label><input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} /></div>
                    <div><label>Pressure Test Passed?</label><select value={pressureTestPassed} onChange={e => setPressureTestPassed(e.target.value as any)}><option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option></select></div>
                    <div><label>New Gasket Used?</label><select value={newGasketUsed} onChange={e => setNewGasketUsed(e.target.value as any)}><option value="">Select...</option><option value="Y">Yes</option><option value="N">No</option></select></div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label>Operator Initials</label>
                        <button type="button" onClick={clearCanvas} className="btn-secondary !text-xs !py-1">Clear</button>
                    </div>
                    <canvas
                        ref={canvasRef}
                        className="border border-slate-300 rounded-lg cursor-crosshair touch-none bg-white w-full"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default HoseLogModal;
