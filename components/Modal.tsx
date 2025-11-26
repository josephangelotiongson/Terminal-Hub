
import React, { ReactNode, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    zIndex?: number;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, zIndex = 70 }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) {
        return null;
    }

    return ReactDOM.createPortal(
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: zIndex - 10 }} onClick={onClose}></div>
            <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
                <div className="card responsive-modal bg-white shadow-2xl text-slate-800 flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 transition-colors" aria-label="Close">
                            <i className="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <div className="p-6 text-slate-800 overflow-y-auto flex-grow">
                        {children}
                    </div>
                    {footer && (
                        <div className="bg-gray-50 px-6 py-3 flex justify-end items-center space-x-3 rounded-b-lg border-t border-slate-200 flex-shrink-0">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
};

export default Modal;
