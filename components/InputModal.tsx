import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (value: string) => void;
    title: string;
    label: string;
    initialValue?: string;
}

const InputModal: React.FC<InputModalProps> = ({ isOpen, onClose, onSave, title, label, initialValue = '' }) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
        }
    }, [isOpen, initialValue]);

    const handleSave = () => {
        if (value.trim()) {
            onSave(value.trim());
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save</button>
                </>
            }
        >
            <div className="space-y-2">
                <label htmlFor="input-modal-field">{label}</label>
                <input
                    id="input-modal-field"
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    autoFocus
                />
            </div>
        </Modal>
    );
};

export default InputModal;