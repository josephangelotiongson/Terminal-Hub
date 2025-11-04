import React, { useRef, useEffect, useState } from 'react';
import Modal from './Modal';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
    initialSignature?: string; // data URL
}

const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave, initialSignature }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

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
        if (canvas) {
            const context = canvas.getContext('2d');
            if (!context) return;
            const pixelBuffer = new Uint32Array(context.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
            const isEmpty = !pixelBuffer.some(color => color !== 0);

            if (isEmpty) {
                onSave('');
            } else {
                onSave(canvas.toDataURL('image/png'));
            }
            onClose();
        }
    };
    
    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const parent = canvas.parentElement;
            if (!parent) return;

            const setupCanvas = () => {
                const rect = parent.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = 200;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.strokeStyle = '#0f172a'; // slate-900
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    // Clear and redraw initial signature
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    if (initialSignature) {
                        const img = new Image();
                        img.src = initialSignature;
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0);
                        };
                    }
                }
            };
            
            // Setup canvas on open and on resize
            setupCanvas();
            window.addEventListener('resize', setupCanvas);

            return () => {
                window.removeEventListener('resize', setupCanvas);
            };
        }
    }, [isOpen, initialSignature]);


    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Provide Signature / Initials"
            zIndex={80}
            footer={<>
                <button onClick={clearCanvas} className="btn-secondary">Clear</button>
                <button onClick={handleSave} className="btn-primary">Save Signature</button>
            </>}
        >
            <canvas
                ref={canvasRef}
                className="border border-slate-300 rounded-lg cursor-crosshair touch-none bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </Modal>
    );
};

export default SignatureModal;