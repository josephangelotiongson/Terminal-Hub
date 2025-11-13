
import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Operation, Document } from '../types';
import { formatFileSize, formatDateTime } from '../utils/helpers';
import ConfirmModal from './ConfirmModal';

interface DocumentManagerProps {
    operation: Operation;
    onUpdate: (updatedOperation: Operation, auditDetails: { action: string; details: string }) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const DocumentManager: React.FC<DocumentManagerProps> = ({ operation, onUpdate }) => {
    const { currentUser, simulatedTime } = useContext(AppContext)!;
    const [isUploading, setIsUploading] = useState(false);
    const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const newDocuments: Document[] = [];
        const uploadedFileNames: string[] = [];

        // FIX: Use a traditional for loop to iterate over FileList for better type safety.
        for (let i = 0; i < files.length; i++) {
            const file = files.item(i);
            if (!file) continue;

            try {
                const base64Data = await fileToBase64(file);
                newDocuments.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    data: base64Data,
                    uploadedAt: simulatedTime.toISOString(),
                    uploadedBy: currentUser.name,
                });
                uploadedFileNames.push(file.name);
            } catch (error) {
                console.error("Error processing file:", file.name, error);
                alert(`Failed to upload ${file.name}.`);
            }
        }
        
        const updatedOperation = {
            ...operation,
            documents: [...(operation.documents || []), ...newDocuments],
        };

        const details = `Uploaded document(s): ${uploadedFileNames.join(', ')}`;
        onUpdate(updatedOperation, { action: 'DOCUMENT_UPLOAD', details });
        setIsUploading(false);
        // Reset file input
        e.target.value = '';
    };

    const handleDelete = (docToDelete: Document) => {
        setDeletingDoc(docToDelete);
    };
    
    const confirmDelete = () => {
        if (!deletingDoc) return;
        
        const updatedOperation = {
            ...operation,
            documents: (operation.documents || []).filter(doc => doc.uploadedAt !== deletingDoc.uploadedAt || doc.name !== deletingDoc.name), // Use a composite key for deletion
        };
        const details = `Deleted document: ${deletingDoc.name}`;
        onUpdate(updatedOperation, { action: 'DOCUMENT_DELETE', details });
        setDeletingDoc(null);
    };

    const handleView = (doc: Document) => {
        // Create a link and click it to download/view the file
        const link = document.createElement('a');
        link.href = doc.data;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <ConfirmModal
                isOpen={!!deletingDoc}
                onClose={() => setDeletingDoc(null)}
                onConfirm={confirmDelete}
                title="Delete Document"
                message={`Are you sure you want to delete "${deletingDoc?.name}"? This action cannot be undone.`}
            />
            <div className="flex justify-end mb-4">
                <label className={`btn-primary ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                    {isUploading ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>Uploading...</>
                    ) : (
                        <><i className="fas fa-upload mr-2"></i>Upload Documents</>
                    )}
                </label>
            </div>
            {(operation.documents && operation.documents.length > 0) ? (
                <div className="space-y-3">
                    {operation.documents.map((doc, index) => (
                        <div key={index} className="p-3 border rounded-lg flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <i className="fas fa-file-alt text-2xl text-text-secondary"></i>
                                <div>
                                    <p className="font-semibold text-base">{doc.name}</p>
                                    <p className="text-xs text-text-tertiary">
                                        {formatFileSize(doc.size)} | Uploaded by {doc.uploadedBy} on {formatDateTime(doc.uploadedAt)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleView(doc)} className="btn-secondary !text-xs !py-1 !px-2" title="View/Download">
                                    <i className="fas fa-eye mr-1"></i> View
                                </button>
                                <button onClick={() => handleDelete(doc)} className="btn-icon danger" title="Delete">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-8 border-2 border-dashed rounded-lg text-text-secondary">
                    <i className="fas fa-folder-open text-4xl mb-4"></i>
                    <p>No documents have been uploaded for this operation.</p>
                </div>
            )}
        </div>
    );
};

export default DocumentManager;
