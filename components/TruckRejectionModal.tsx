import React, { useState, useEffect, useContext, useRef } from 'react';
import Modal from './Modal';
import { Operation } from '../types';
import { AppContext } from '../context/AppContext';
import { TRUCK_REJECTION_REASONS } from '../constants';

interface TruckRejectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    operation: Operation | null;
    priority: 'high' | 'normal';
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const TruckRejectionModal: React.FC<TruckRejectionModalProps> = ({ isOpen, onClose, operation, priority }) => {
    const context = useContext(AppContext);
    const [reason, setReason] = useState(TRUCK_REJECTION_REASONS[0]);
    const [notes, setNotes] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);
    const [isTakingPhoto, setIsTakingPhoto] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        const startCamera = async () => {
            if (isTakingPhoto) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    alert("Could not access camera. Please check permissions and ensure you are on a secure (HTTPS) connection.");
                    setIsTakingPhoto(false);
                }
            }
        };
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isTakingPhoto, facingMode]);

    useEffect(() => {
        if (isOpen) {
            setReason(TRUCK_REJECTION_REASONS[0]);
            setNotes('');
            setPhoto(null);
            setIsTakingPhoto(false);
            setFacingMode('environment');
        } else {
            setIsTakingPhoto(false);
        }
    }, [isOpen]);

    const handleTakePhotoClick = () => {
        setIsTakingPhoto(true);
    };
    
    const handleSwitchCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setPhoto(dataUrl);
            }
        }
        setIsTakingPhoto(false);
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await blobToBase64(file);
                setPhoto(base64);
            } catch (error) {
                console.error("Error converting file to base64:", error);
                alert("Could not process the selected file.");
            }
        }
    };

    const handleSave = () => {
        if (!operation || !context) return;
        const finalReason = reason;
        context.requeueTruckOperation(operation.id, finalReason, { notes, photo: photo || undefined }, priority);
        onClose();
    };

    if (!operation) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Reschedule Reason: ${operation.transportId}`}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Confirm Reschedule</button>
                </>
            }
        >
            <div className="space-y-4">
                <div>
                    <label>Reason for Rejection</label>
                    <select value={reason} onChange={e => setReason(e.target.value)} className="mt-1">
                        {TRUCK_REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label>Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add any additional details..." />
                </div>

                <div>
                    <label>Supporting Photo (Optional)</label>
                    {isTakingPhoto ? (
                         <div className="mt-2 space-y-2">
                            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black"></video>
                            <div className="flex gap-2">
                                <button onClick={handleCapture} className="btn-primary flex-1">Capture</button>
                                <button onClick={handleSwitchCamera} className="btn-secondary !py-2 !px-3" title="Switch Camera">
                                    <i className="fas fa-sync-alt"></i>
                                </button>
                                <button onClick={() => setIsTakingPhoto(false)} className="btn-secondary flex-1">Cancel</button>
                            </div>
                        </div>
                    ) : photo ? (
                         <div className="mt-2 space-y-2">
                            <img src={photo} alt="Rejection evidence" className="max-h-60 w-auto rounded-lg border" />
                            <button onClick={() => setPhoto(null)} className="btn-secondary">Clear Photo</button>
                        </div>
                    ) : (
                        <div className="mt-2 flex gap-2">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex-1">
                                <i className="fas fa-upload mr-2"></i>Upload Photo
                            </button>
                            <button onClick={handleTakePhotoClick} className="btn-secondary flex-1">
                                <i className="fas fa-camera mr-2"></i>Take Photo
                            </button>
                        </div>
                    )}
                    <canvas ref={canvasRef} className="hidden"></canvas>
                </div>
            </div>
        </Modal>
    );
};

export default TruckRejectionModal;