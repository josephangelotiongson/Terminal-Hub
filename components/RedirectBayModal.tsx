
import React, { useContext } from 'react';
import Modal from './Modal';
import { AppContext } from '../context/AppContext';
import { formatInfraName } from '../utils/helpers';

const RedirectBayModal: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;

    const { redirectBayModalState, closeRedirectBayModal, handleScheduleForLater } = context;
    const { isOpen, op, occupiedByOp } = redirectBayModalState;

    if (!isOpen || !op || !occupiedByOp) return null;

    const originalBay = op.transferPlan[0]?.infrastructureId;

    return (
        <Modal
            isOpen={isOpen}
            onClose={closeRedirectBayModal}
            title="Bay Occupied"
            footer={<button onClick={closeRedirectBayModal} className="btn-secondary">Cancel</button>}
        >
            <div className="space-y-4">
                <p className="text-text-secondary mb-2">
                    <strong className="text-text-primary">{formatInfraName(originalBay)}</strong> is currently occupied by truck <strong className="text-text-primary">{occupiedByOp.licensePlate}</strong> ({occupiedByOp.currentStatus}).
                </p>
                <p className="text-text-secondary mb-4">
                    This truck must be rescheduled. You will be taken to the planning board to visually select a new time and a compatible bay for truck <strong className="text-text-primary">{op.licensePlate}</strong>.
                </p>
                <button
                    onClick={() => handleScheduleForLater(op.id)}
                    className="btn-primary w-full"
                >
                    <i className="fas fa-th mr-2"></i>Go to Planning Board
                </button>
            </div>
        </Modal>
    );
};

export default RedirectBayModal;
