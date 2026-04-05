'use client'

import { useState, useEffect } from 'react';
import { FileText, Trash2, Upload, Loader2, CheckCircle, AlertCircle, Database, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Document {
    id: string;
    file_name: string;
    file_type: string;
    created_at: string;
}

export default function RagManager() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchDocuments();
        // Load selected files from localStorage
        const saved = localStorage.getItem('selected_rag_files');
        if (saved) {
            try {
                setSelectedFiles(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load selected files');
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('selected_rag_files', JSON.stringify(selectedFiles));
    }, [selectedFiles]);

    const fetchDocuments = async () => {
        try {
            const res = await fetch('/api/documents');
            if (res.ok) {
                const data = await res.json();
                setDocuments(data);

                // Cleanup selection if files are deleted or don't exist anymore
                const docNames = data.map((d: Document) => d.file_name);
                setSelectedFiles(prev => prev.filter(name => docNames.includes(name)));
            }
        } catch (err) {
            console.error('Failed to fetch documents');
        } finally {
            setLoading(false);
        }
    };

    const toggleFileSelection = (fileName: string) => {
        setSelectedFiles(prev =>
            prev.includes(fileName)
                ? prev.filter(f => f !== fileName)
                : [...prev, fileName]
        );
    };

    const toggleAll = () => {
        if (selectedFiles.length === documents.length) {
            setSelectedFiles([]);
        } else {
            setSelectedFiles(documents.map(d => d.file_name));
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 10MB limit
        if (file.size > 10 * 1024 * 1024) {
            setNotification({ message: "File too large. Max 10MB allowed.", type: 'error' });
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setNotification({ message: `"${file.name}" indexed successfully!`, type: 'success' });
                // Automatically select newly uploaded file
                setSelectedFiles(prev => [...new Set([...prev, file.name])]);
                fetchDocuments();
            } else {
                setNotification({ message: data.error || 'Upload failed', type: 'error' });
            }
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
            setTimeout(() => setNotification(null), 5000);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string, fileName: string) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

        try {
            const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setDocuments(prev => prev.filter(doc => doc.id !== id));
                setSelectedFiles(prev => prev.filter(f => f !== fileName));
                setNotification({ message: 'Document removed', type: 'success' });
            }
        } catch (err) {
            setNotification({ message: 'Failed to delete', type: 'error' });
        } finally {
            setTimeout(() => setNotification(null), 3000);
        }
    };

    return (
        <div className="rag-manager">
            <div className="rag-header">
                <div className="header-title">
                    <Database className="title-icon" />
                    <h2>Knowledge Base</h2>
                </div>
                <p className="header-subtitle">Select specific documents to use for RAG. Only selected files will be used in chat.</p>
            </div>

            <div className="upload-section">
                <label className={`upload-card ${uploading ? 'uploading' : ''}`}>
                    <input type="file" accept=".txt,.md,.pdf,.docx" onChange={handleUpload} disabled={uploading} hidden />
                    {uploading ? (
                        <div className="upload-content">
                            <Loader2 className="animate-spin text-secondary" />
                            <span>Processing & Indexing...</span>
                        </div>
                    ) : (
                        <div className="upload-content">
                            <Upload className="text-secondary" />
                            <span>Click to upload PDF, Docx, or TXT</span>
                            <span className="upload-hint">Max file size: 10MB</span>
                        </div>
                    )}
                </label>
            </div>

            <div className="documents-section">
                <div className="section-header">
                    <h3>Your Documents ({documents.length})</h3>
                    {documents.length > 0 && (
                        <button className="select-all-btn" onClick={toggleAll}>
                            {selectedFiles.length === documents.length ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="doc-loading">
                        <Loader2 className="animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="empty-docs">
                        <FileText size={48} />
                        <p>No documents indexed yet.</p>
                    </div>
                ) : (
                    <div className="doc-grid">
                        <AnimatePresence>
                            {documents.map((doc) => (
                                <motion.div
                                    key={doc.id}
                                    layout
                                    className={`doc-card ${selectedFiles.includes(doc.file_name) ? 'selected' : ''}`}
                                    onClick={() => toggleFileSelection(doc.file_name)}
                                >
                                    <div className="doc-selection-indicator">
                                        {selectedFiles.includes(doc.file_name) && <Check size={14} />}
                                    </div>
                                    <div className="doc-info">
                                        <FileText className="doc-icon text-secondary" />
                                        <div className="doc-details">
                                            <span className="doc-name text-truncate">{doc.file_name}</span>
                                            <span className="doc-date">{new Date(doc.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button onClick={(e) => handleDelete(e, doc.id, doc.file_name)} className="delete-btn">
                                        <Trash2 size={16} />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <div className="selection-status">
                <div className="status-item">
                    <CheckCircle size={16} className={selectedFiles.length > 0 ? 'active' : ''} />
                    <span>{selectedFiles.length} files active for RAG</span>
                </div>
            </div>

            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className={`toast-notification ${notification.type}`}
                    >
                        {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <span>{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
