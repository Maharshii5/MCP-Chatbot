'use client'

import { useState, useRef, useEffect, useMemo } from 'react';
import {
    Send, Paperclip, Calendar, Mail, FileText,
    HardDrive, Search, Globe, Database, Cpu,
    Lock, CheckCircle, AlertCircle, RefreshCw, X, Loader2,
    Settings, Shield, ChevronRight, Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { OPENROUTER_MODELS } from '@/lib/openrouter/client';
import { DEFAULT_MODEL } from '@/lib/groq/client';
import { useAudio } from './Effects/WorkstationAudio';
import CommandPalette from './CommandPalette';

type ToolType = 'default' | 'web' | 'rag' | 'gmail' | 'calendar' | 'drive' | 'docs';

interface ServicePermissions {
    gmail: { enabled: boolean; writeAccess: boolean };
    calendar: { enabled: boolean; writeAccess: boolean };
    drive: { enabled: boolean; writeAccess: boolean };
    docs: { enabled: boolean; writeAccess: boolean };
}

interface ServiceStatus {
    gmail: boolean;
    calendar: boolean;
    drive: boolean;
    docs: boolean;
    permissions?: {
        gmail: string;
        calendar: string;
        drive: string;
        docs: string;
    };
    isGlobalConnected: boolean;
}

export default function ChatWindow({ conversationId, onConversationCreated }: any) {
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeTool, setActiveTool] = useState<ToolType>('default');
    const [status, setStatus] = useState<ServiceStatus>({
        gmail: false,
        calendar: false,
        drive: false,
        docs: false,
        isGlobalConnected: false
    });
    const [documents, setDocuments] = useState<any[]>([]);
    const [showRagSelector, setShowRagSelector] = useState(false);
    const [showMcpSettings, setShowMcpSettings] = useState(false);
    const [mcpPermissions, setMcpPermissions] = useState<ServicePermissions>({
        gmail: { enabled: true, writeAccess: false },
        calendar: { enabled: true, writeAccess: false },
        drive: { enabled: true, writeAccess: false },
        docs: { enabled: true, writeAccess: false }
    });
    const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

    const { playClick, playSuccess, playDataHum } = useAudio();

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();
    const loadedConvId = useRef<string | null>(null);

    // Color mapping for tools
    const toolConfig = {
        default: { color: '#58a6ff', label: 'Ask anything...', icon: <Cpu size={16} /> },
        web: { color: '#3fb950', label: 'Search the web...', icon: <Globe size={16} /> },
        rag: { color: '#bc8cff', label: 'Ask your documents...', icon: <Database size={16} /> },
        gmail: { color: '#ff7b72', label: 'Manage emails...', icon: <Mail size={16} />, service: 'gmail' },
        calendar: { color: '#3fb950', label: 'Check calendar...', icon: <Calendar size={16} />, service: 'calendar' },
        drive: { color: '#d29922', label: 'Search Drive...', icon: <HardDrive size={16} />, service: 'drive' },
        docs: { color: '#1f6feb', label: 'Read documents...', icon: <FileText size={16} />, service: 'docs' },
    };

    const [selectedRagFiles, setSelectedRagFiles] = useState<string[]>([]);

    const fetchStatus = async () => {
        const res = await fetch('/api/google/status');
        if (res.ok) {
            const data = await res.json();
            setStatus(data);
        }
    };

    const fetchDocuments = async () => {
        try {
            const res = await fetch('/api/documents');
            if (res.ok) {
                const data = await res.json();
                setDocuments(data);
            }
        } catch (err) {
            console.error('Failed to fetch documents');
        }
    };

    const fetchSelectedRagFiles = () => {
        const saved = localStorage.getItem('selected_rag_files');
        if (saved) {
            try {
                setSelectedRagFiles(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load selected files');
            }
        } else {
            setSelectedRagFiles([]);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchSelectedRagFiles();
        fetchDocuments();
        const interval = setInterval(fetchStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    // Also refresh selected files when tool changes to RAG or when window gains focus
    useEffect(() => {
        if (activeTool === 'rag') {
            fetchSelectedRagFiles();
            fetchDocuments();
        }
    }, [activeTool]);

    useEffect(() => {
        const handleFocus = () => {
            fetchSelectedRagFiles();
            fetchDocuments();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const toggleRagFile = (fileName: string) => {
        playClick();
        setSelectedRagFiles(prev => {
            const newSelection = prev.includes(fileName)
                ? prev.filter(f => f !== fileName)
                : [...prev, fileName];
            localStorage.setItem('selected_rag_files', JSON.stringify(newSelection));
            return newSelection;
        });
    };

    const toggleAllRagFiles = () => {
        const allFileNames = documents.map(d => d.file_name);
        if (selectedRagFiles.length === allFileNames.length) {
            setSelectedRagFiles([]);
            localStorage.setItem('selected_rag_files', JSON.stringify([]));
        } else {
            setSelectedRagFiles(allFileNames);
            localStorage.setItem('selected_rag_files', JSON.stringify(allFileNames));
        }
    };

    const loadMcpPermissions = () => {
        const saved = localStorage.getItem('mcp_permissions');
        if (saved) {
            try {
                setMcpPermissions(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load MCP permissions');
            }
        }
    };

    const saveMcpPermissions = (newPerms: ServicePermissions) => {
        setMcpPermissions(newPerms);
        localStorage.setItem('mcp_permissions', JSON.stringify(newPerms));
    };

    useEffect(() => {
        loadMcpPermissions();
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--active-accent', toolConfig[activeTool].color);
    }, [activeTool]);

    useEffect(() => {
        if (conversationId && conversationId !== loadedConvId.current) {
            fetchMessages();
            loadedConvId.current = conversationId;
        } else if (!conversationId) {
            setMessages([]);
            loadedConvId.current = null;
        }
    }, [conversationId]);

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        if (!error) setMessages(data || []);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const allModels = [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq (Fast)' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'Groq (Flash)' },
        ...OPENROUTER_MODELS
    ];

    const currentModelName = allModels.find(m => m.id === selectedModel)?.name || 'Select Model';

    const handleSend = async (customInput?: string) => {
        const textToSend = customInput || input;
        if (!textToSend.trim() || loading) return;

        playClick();
        const userMessage = { role: 'user', content: textToSend };
        setMessages((prev) => [...prev, userMessage]);
        if (!customInput) setInput('');
        setLoading(true);
        playDataHum(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    conversationId,
                    toolPreference: activeTool,
                    activeFileNames: activeTool === 'rag' ? selectedRagFiles : [],
                    mcpConfig: mcpPermissions,
                    model: selectedModel
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Chat failed');
            }

            const newId = response.headers.get('x-conversation-id');
            if (newId && newId !== conversationId) {
                loadedConvId.current = newId;
                onConversationCreated(newId);
            }

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let assistantContent = '';
            setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                assistantContent += decoder.decode(value);
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    return [...prev.slice(0, -1), { ...last, content: assistantContent }];
                });
            }
            playSuccess();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
            playDataHum(false);
        }
    };

    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setNotification({ message: "File too large (Max 10MB)", type: 'error' });
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                setNotification({ message: `File "${file.name}" indexed successfully!`, type: 'success' });
            } else {
                setNotification({ message: `Failed: ${data.error || 'Unknown error'}`, type: 'error' });
            }
        } catch (err: any) {
            setNotification({ message: `Upload error: ${err.message}`, type: 'error' });
        } finally {
            setUploading(false);
            if (e.target) e.target.value = ''; // Reset file input
            setTimeout(() => setNotification(null), 5000);
        }
    };

    const connectService = (service?: string) => {
        window.location.href = `/api/google/connect${service ? `?service=${service}` : ''}`;
    };

    const suggestedPrompts = [
        { label: "Analyze my recent emails", icon: <Mail size={16} />, tool: 'gmail' },
        { label: "Schedule a meeting for tomorrow", icon: <Calendar size={16} />, tool: 'calendar' },
        { label: "Quick-search my docs", icon: <Database size={16} />, tool: 'rag' },
        { label: "What's in my recent Drive files?", icon: <HardDrive size={16} />, tool: 'drive' }
    ];

    const toggleServicePermission = (service: keyof ServicePermissions) => {
        const newPerms = { ...mcpPermissions, [service]: { ...mcpPermissions[service], enabled: !mcpPermissions[service].enabled } };
        saveMcpPermissions(newPerms);
    };

    const toggleServiceWriteAccess = (service: keyof ServicePermissions) => {
        const newPerms = { ...mcpPermissions, [service]: { ...mcpPermissions[service], writeAccess: !mcpPermissions[service].writeAccess } };
        saveMcpPermissions(newPerms);
    };

    return (
        <div className="chat-interface-wrapper">
            <div className={`chat-container glass-container ${showMcpSettings ? 'with-sidebar' : ''}`}>
                {/* Header / Monitor Bar */}
                <div className="chat-header-bar">
                    <div className="ai-status">
                        <div className={`ai-orb ${loading ? 'thinking' : ''}`}>
                            <div className="orb-inner" />
                            <div className="orb-glow" />
                        </div>
                        <span className="ai-name">MCP Assistant</span>

                        <div className="service-monitor-glass flex items-center ml-4 gap-2 border-l border-white/5 pl-4">
                            <button
                                className={`header-tool-btn ${showMcpSettings ? 'active' : ''}`}
                                onClick={() => setShowMcpSettings(!showMcpSettings)}
                                title="MCP Controls"
                            >
                                <Shield size={16} />
                            </button>
                            <div className="h-4 w-[1px] bg-white/10 mx-1" />
                            <ServiceIcon icon={<Mail size={14} />} label="Gmail" connected={status.gmail} permission={status.permissions?.gmail} service="gmail" onClick={connectService} />
                            <ServiceIcon icon={<Calendar size={14} />} label="Calendar" connected={status.calendar} permission={status.permissions?.calendar} service="calendar" onClick={connectService} />
                            <ServiceIcon icon={<HardDrive size={14} />} label="Drive" connected={status.drive} permission={status.permissions?.drive} service="drive" onClick={connectService} />
                            <ServiceIcon icon={<FileText size={14} />} label="Docs" connected={status.docs} permission={status.permissions?.docs} service="docs" onClick={connectService} />
                        </div>
                    </div>

                    <div className="header-actions">
                        {/* Right side kept for potential future persistent actions */}
                    </div>
                </div>

                {/* Messages Area */}
                <div className="messages-list" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="welcome-container">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                                className="welcome-hero"
                            >
                                <div className="hero-badge">Professional Workstation</div>
                                <h1 className="hero-title">Personal <span className="text-outline">MCP</span></h1>
                                <p className="hero-subtitle">Intelligent multi-model agent connected to your Google Workspace and Local Knowledge Base.</p>
                                
                                <div className="hero-features">
                                    <div className="feature-item">
                                        <div className="feature-icon"><Database size={16} /></div>
                                        <span>Full RAG Knowledge</span>
                                    </div>
                                    <div className="feature-item">
                                        <div className="feature-icon"><Mail size={16} /></div>
                                        <span>Google Services</span>
                                    </div>
                                    <div className="feature-item">
                                        <div className="feature-icon"><Cpu size={16} /></div>
                                        <span>Multi-Model Intelligence</span>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <motion.div 
                            key={`msg-${i}`} 
                            initial={{ opacity: 0, y: 30, rotateX: -10 }}
                            animate={{ opacity: 1, y: 0, rotateX: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.05 }}
                            className={`message ${m.role}`}
                            style={{ perspective: 1000 }}
                        >
                            <div className="message-avatar">
                                {m.role === 'user' ? 'U' : 'AI'}
                            </div>
                            <motion.div 
                                className="message-bubble"
                                whileHover={m.role === 'assistant' ? { rotateY: 2, rotateX: -2, translateZ: 10 } : {}}
                            >
                                <div className="message-content">
                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                            </motion.div>
                        </motion.div>
                    ))}

                    {loading && (
                        <div className="thinking-chip">
                            <div className="thinking-dots">
                                <span></span><span></span><span></span>
                            </div>
                            <span>AI is thinking with {currentModelName}...</span>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="input-area">
                    <div className="input-top-bar">
                        <div className="model-selector-container">
                            <button 
                                className={`current-model-btn ${showModelSelector ? 'active' : ''}`}
                                onClick={() => setShowModelSelector(!showModelSelector)}
                            >
                                <Cpu size={14} />
                                <span>{currentModelName}</span>
                                <ChevronRight size={14} className={showModelSelector ? 'rotate-90' : ''} />
                            </button>
                            
                            <AnimatePresence>
                                {showModelSelector && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="model-dropdown"
                                    >
                                        <div className="dropdown-label">Select Model</div>
                                        <div className="model-grid">
                                            {allModels.map(m => (
                                                <button 
                                                    key={m.id}
                                                    className={`model-item ${selectedModel === m.id ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setSelectedModel(m.id);
                                                        setShowModelSelector(false);
                                                    }}
                                                >
                                                    <div className="model-name">{m.name}</div>
                                                    <div className="model-provider">{m.provider}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="input-wrapper focus-glow">
                        <button className="input-action-btn" title="Attach File" onClick={() => fileInputRef.current?.click()}>
                            {uploading ? <Loader2 className="animate-spin" size={18} /> : <Paperclip size={18} />}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder={`Message ${currentModelName}...`}
                            rows={1}
                        />
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="send-btn"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || loading}
                        >
                            <Send size={18} />
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Sidebar Settings Integration */}
            <AnimatePresence>
                {showMcpSettings && (
                    <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 100 }}
                        className="chat-settings-sidebar glass-container"
                    >
                        <div className="sidebar-header">
                            <Shield size={20} />
                            <h3>MCP Controls</h3>
                            <button onClick={() => setShowMcpSettings(false)} className="close-btn">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="settings-list">
                            {(Object.keys(mcpPermissions) as Array<keyof ServicePermissions>).map(service => (
                                <div key={service} className="setting-item-glass">
                                    <div className="setting-info">
                                        <div className="setting-icon" style={{ color: (toolConfig as any)[service].color }}>
                                            {(toolConfig as any)[service].icon}
                                        </div>
                                        <span>{service.charAt(0).toUpperCase() + service.slice(1)}</span>
                                    </div>
                                    <div className="setting-controls">
                                        <button
                                            className={`write-toggle-btn ${mcpPermissions[service].writeAccess ? 'active' : ''}`}
                                            onClick={() => toggleServiceWriteAccess(service)}
                                            title={mcpPermissions[service].writeAccess ? "Write Access Enabled" : "Enable Write Access"}
                                        >
                                            <Zap size={14} fill={mcpPermissions[service].writeAccess ? "currentColor" : "none"} />
                                        </button>
                                        <label className="toggle-glass" title="Enable Service">
                                            <input
                                                type="checkbox"
                                                checked={mcpPermissions[service].enabled}
                                                onChange={() => toggleServicePermission(service)}
                                            />
                                            <span className="slider" style={{
                                                '--active-color': (toolConfig as any)[service].color
                                            } as any} />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="sidebar-footer">
                            <p>Enabled: AI can read data from this service.</p>
                            <p>Zap: AI can create/delete data in this service.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Notification Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`toast-notification ${notification.type}`}
                    >
                        {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <span>{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <CommandPalette 
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                onSelectModel={setSelectedModel}
                onToggleSettings={setShowMcpSettings}
            />
        </div>
    );
}

function ServiceIcon({ icon, label, connected, permission, service, onClick }: any) {
    const handleToggle = async (e: React.MouseEvent) => {
        if (connected) {
            e.preventDefault();
            if (confirm(`Disconnect ${label}?`)) {
                await fetch(`/api/google/disconnect?service=${service}`, { method: 'POST' });
                window.location.reload();
            }
        } else {
            onClick(service);
        }
    };

    return (
        <button
            className={`service-icon ${connected ? 'connected' : ''}`}
            onClick={handleToggle}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            title={`${label}: ${connected ? `Connected (${permission})` : 'Disconnected'}`}
        >
            {icon}
            <div className="tooltip">
                {label}: {connected ? (
                    <span style={{ color: permission === 'Read-Write' ? '#3fb950' : '#d29922' }}>
                        {permission}
                    </span>
                ) : 'Click to connect'}
            </div>
        </button>
    );
}

function ToolButton({ type, active, icon, label, connected, onClick, config }: any) {
    const isLocked = connected === false;

    // Convert hex color to RGB for the CSS variable
    const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    };

    return (
        <button
            className={`tool-btn ${active ? 'active' : ''} ${isLocked ? 'disabled' : ''}`}
            onClick={onClick}
            style={{ '--accent-rgb': hexToRgb(config?.color || '#58a6ff') } as any}
        >
            {isLocked ? <Lock size={12} /> : icon}
            <span>{label}</span>
            {connected && <div className="status-dot connected" style={{ width: 4, height: 4 }} />}
        </button>
    );
}
