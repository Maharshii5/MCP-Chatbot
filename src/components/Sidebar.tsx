'use client'

import { Plus, MessageSquare, Database, Trash2, Edit2, Check, X } from 'lucide-react';
import { useState } from 'react';

interface Conversation {
    id: string;
    title: string;
}

interface SidebarProps {
    conversations: Conversation[];
    currentConvId: string | null;
    onSelect: (id: string | null) => void;
    view: 'chat' | 'rag';
    onViewChange: (view: 'chat' | 'rag') => void;
    onRefresh: () => void;
}

export default function Sidebar({ conversations, currentConvId, onSelect, view, onViewChange, onRefresh }: SidebarProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this conversation?')) return;

        try {
            const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
            if (res.ok) {
                if (currentConvId === id) onSelect(null);
                onRefresh();
            }
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const startRename = (id: string, title: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(id);
        setEditTitle(title);
    };

    const handleRename = async (id: string) => {
        if (!editTitle.trim()) return;
        try {
            const res = await fetch(`/api/conversations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editTitle })
            });
            if (res.ok) {
                setEditingId(null);
                onRefresh();
            }
        } catch (err) {
            console.error('Failed to rename:', err);
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <button className="new-chat-btn" onClick={() => {
                    onSelect(null);
                    onViewChange('chat');
                }}>
                    <Plus size={18} /> New chat
                </button>
            </div>

            <div className="sidebar-nav">
                <button
                    className={`nav-item ${view === 'rag' ? 'active' : ''}`}
                    onClick={() => onViewChange('rag')}
                >
                    <Database size={18} /> Knowledge Base
                </button>
            </div>

            <div className="conv-list">
                <h3 style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 0.75rem', marginBottom: '1rem', marginTop: '1rem', letterSpacing: '0.05em' }}>Recent Tool Chats</h3>
                {conversations.map((conv) => (
                    <div
                        key={conv.id}
                        className={`conv-item ${currentConvId === conv.id && view === 'chat' ? 'active' : ''}`}
                        onClick={() => onSelect(conv.id)}
                    >
                        <MessageSquare size={14} style={{ flexShrink: 0 }} />
                        {editingId === conv.id ? (
                            <div className="edit-wrapper" onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                <input
                                    autoFocus
                                    className="edit-input"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRename(conv.id)}
                                    style={{ background: 'transparent', border: 'none', color: 'inherit', fontSize: 'inherit', width: '100%', outline: 'none' }}
                                />
                                <Check size={14} className="icon-btn" onClick={() => handleRename(conv.id)} />
                                <X size={14} className="icon-btn" onClick={() => setEditingId(null)} />
                            </div>
                        ) : (
                            <>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.title}</span>
                                <div className="actions" style={{ display: 'none', gap: '8px' }}>
                                    <Edit2 size={12} className="icon-btn" onClick={(e) => startRename(conv.id, conv.title, e)} />
                                    <Trash2 size={12} className="icon-btn" onClick={(e) => handleDelete(conv.id, e)} />
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className="sign-out-btn" style={{ cursor: 'default', color: 'var(--text-muted)' }}>
                Local mode
            </div>
            <style jsx>{`
                .conv-item:hover .actions {
                    display: flex !important;
                }
                .icon-btn {
                    cursor: pointer;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                }
                .icon-btn:hover {
                    opacity: 1;
                }
            `}</style>
        </aside>
    );
}
