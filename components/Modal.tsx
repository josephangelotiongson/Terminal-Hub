import React, { ReactNode } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    zIndex?: number;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, zIndex = 70 }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: zIndex - 10 }} onClick={onClose}></div>
            <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
                <div className="card responsive-modal">
                    <div className="p-6 border-b border-border-primary flex justify-between items-center">
                        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
                        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors" aria-label="Close">
                            <i className="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <div className="p-6">
                        {children}
                    </div>
                    {footer && (
                        <div className="bg-gray-50 px-6 py-3 flex justify-end items-center space-x-3 rounded-b-lg">
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Modal;