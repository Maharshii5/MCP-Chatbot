'use client'

import { Plus, MessageSquare, Database, Trash2, Edit2, Check, X, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface Conversation {
    id: string;
    title: string;
}

interface SidebarProps {
    user: User | null;
    conversations: Conversation[];
    currentConvId: string | null;
    onSelect: (id: string | null) => void;
    view: 'chat' | 'rag';
    onViewChange: (view: 'chat' | 'rag') => void;
    onRefresh: () => void;
    onSignOut: () => void;
}

export default function Sidebar({ user, conversations, currentConvId, onSelect, view, onViewChange, onRefresh, onSignOut }: SidebarProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const router = useRouter();

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
                {!user ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Sign in to sync your chat history.</p>
                        <button 
                            onClick={() => router.push('/login')}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '8px 16px', 
                                background: 'white', 
                                color: 'black', 
                                border: 'none', 
                                borderRadius: '20px', 
                                fontSize: '0.75rem', 
                                fontWeight: '600',
                                cursor: 'pointer',
                                margin: '0 auto'
                            }}
                        >
                            <LogIn size={14} /> Sign In
                        </button>
                    </div>
                ) : conversations.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No recent chats found.</p>
                ) : (
                    conversations.map((conv) => (
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
                    ))
                )}
            </div>

            <div className="sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', padding: '1rem' }}>
                {user ? (
                    <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserIcon size={16} />
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || 'User'}</p>
                            <button 
                                onClick={onSignOut}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.65rem', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <LogOut size={10} /> Sign Out
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="sign-out-btn" style={{ cursor: 'default', color: 'var(--text-muted)' }}>
                        Local mode
                    </div>
                )}
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
