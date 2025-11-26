import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { User } from '../types';
import ConfirmModal from './ConfirmModal';

const UserPermissions: React.FC = () => {
    const context = useContext(AppContext);
    
    const [actionState, setActionState] = useState<{
        action: 'delegate' | 'revoke';
        user: User;
    } | null>(null);

    if (!context) return null;

    const { currentUser, users, delegateRole, revokeDelegation } = context;

    if (currentUser.role !== 'Operations Lead') {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="text-text-secondary mt-2">You do not have permission to view this page.</p>
            </div>
        );
    }

    const handleConfirm = () => {
        if (!actionState) return;
        if (actionState.action === 'delegate') {
            delegateRole(actionState.user.name);
        } else {
            revokeDelegation(actionState.user.name);
        }
        setActionState(null);
    };

    return (
        <>
            <ConfirmModal
                isOpen={!!actionState}
                onClose={() => setActionState(null)}
                onConfirm={handleConfirm}
                title={actionState?.action === 'delegate' ? 'Delegate Role' : 'Revoke Delegation'}
                message={
                    actionState?.action === 'delegate'
                        ? `Are you sure you want to delegate your 'Operations Lead' role to ${actionState?.user.name}? They will have full access until you revoke it.`
                        : `Are you sure you want to revoke the 'Operations Lead' role from ${actionState?.user.name}? Their permissions will revert to their original role.`
                }
            />
            <div>
                <div className="sticky top-0 z-10 bg-background-body p-4 sm:p-6 border-b border-border-primary">
                    <h2 className="text-2xl font-bold text-brand-dark">User Permissions</h2>
                    <p className="text-sm text-text-secondary mt-1">Delegate your lead role to another operator when you are unavailable.</p>
                </div>

                <div className="p-4 sm:p-6">
                    <div className="card p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left bg-slate-50">
                                    <tr>
                                        <th className="p-3 font-semibold">User</th>
                                        <th className="p-3 font-semibold">Current Role</th>
                                        <th className="p-3 font-semibold">Status</th>
                                        <th className="p-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.filter(user => user.name !== currentUser.name).map(user => (
                                        <tr key={user.name} className={`transition-colors ${user.delegatedBy ? 'bg-yellow-50 shadow-sm' : 'border-b hover:bg-slate-50'}`}>
                                            <td className={`p-3 font-medium ${user.delegatedBy ? 'border-l-4 border-yellow-400' : ''}`}>
                                                {user.name}
                                            </td>
                                            <td className="p-3">
                                                <div>
                                                    <p className="font-semibold">{user.role}</p>
                                                    {user.originalRole && <p className="text-xs text-slate-500">(Original: {user.originalRole})</p>}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {user.delegatedBy ? (
                                                    <span className="px-2 inline-flex items-center gap-1.5 text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        <i className="fas fa-user-shield text-yellow-600"></i>
                                                        Delegated by {user.delegatedBy}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                                                        Standard
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                {user.delegatedBy ? (
                                                    <button onClick={() => setActionState({ action: 'revoke', user })} className="btn-secondary !text-yellow-800 !border-yellow-300 hover:!bg-yellow-100 !text-xs !py-1.5 !px-3">
                                                        <i className="fas fa-undo mr-2"></i>
                                                        Revoke Delegation
                                                    </button>
                                                ) : (user.role === 'Operator' || user.role === 'Dispatch') ? (
                                                    <button onClick={() => setActionState({ action: 'delegate', user })} className="btn-primary !text-xs !py-1.5 !px-3">
                                                        <i className="fas fa-user-shield mr-2"></i>
                                                        Delegate Role
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UserPermissions;