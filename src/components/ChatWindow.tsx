'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
    Send, Paperclip, Calendar, Mail, FileText,
    HardDrive, Globe, Database, Cpu,
    CheckCircle, AlertCircle, X, Loader2,
    Shield, ChevronRight, Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
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

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatWindowProps {
    conversationId: string | null;
    onConversationCreated: (id: string) => void;
}

interface ModelOption {
    id: string;
    name: string;
    provider: string;
}

interface ToolConfigEntry {
    color: string;
    label: string;
    icon: React.ReactNode;
}

type ToolConfig = Record<ToolType, ToolConfigEntry>;

export default function ChatWindow({ conversationId, onConversationCreated }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeTool] = useState<ToolType>('default');
    const [status, setStatus] = useState<ServiceStatus>({
        gmail: false,
        calendar: false,
        drive: false,
        docs: false,
        isGlobalConnected: false
    });
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
    const supabase = useMemo(() => createClient(), []);
    const loadedConvId = useRef<string | null>(null);

    // Color mapping for tools
    const toolConfig: ToolConfig = useMemo(() => ({
        default: { color: '#58a6ff', label: 'Ask anything...', icon: <Cpu size={16} /> },
        web: { color: '#3fb950', label: 'Search the web...', icon: <Globe size={16} /> },
        rag: { color: '#bc8cff', label: 'Ask your documents...', icon: <Database size={16} /> },
        gmail: { color: '#ff7b72', label: 'Manage emails...', icon: <Mail size={16} /> },
        calendar: { color: '#3fb950', label: 'Check calendar...', icon: <Calendar size={16} /> },
        drive: { color: '#d29922', label: 'Search Drive...', icon: <HardDrive size={16} /> },
        docs: { color: '#1f6feb', label: 'Read documents...', icon: <FileText size={16} /> },
    }), []);

    const [selectedRagFiles, setSelectedRagFiles] = useState<string[]>([]);

    const fetchStatus = async () => {
        const res = await fetch('/api/google/status');
        if (res.ok) {
            const data = await res.json();
            setStatus(data);
        }
    };

    const fetchSelectedRagFiles = () => {
        const saved = localStorage.getItem('selected_rag_files');
        if (saved) {
            try {
                setSelectedRagFiles(JSON.parse(saved));
            } catch {
                console.error('Failed to load selected files');
            }
        } else {
            setSelectedRagFiles([]);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchSelectedRagFiles();
        const interval = setInterval(fetchStatus, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    // Also refresh selected files when tool changes to RAG or when window gains focus
    useEffect(() => {
        if (activeTool === 'rag') {
            fetchSelectedRagFiles();
        }
    }, [activeTool]);

    useEffect(() => {
        const handleFocus = () => {
            if (activeTool === 'rag') {
                fetchSelectedRagFiles();
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [activeTool]);

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

    const loadMcpPermissions = () => {
        const saved = localStorage.getItem('mcp_permissions');
        if (saved) {
            try {
                setMcpPermissions(JSON.parse(saved));
            } catch {
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
    }, [activeTool, toolConfig]);

    const fetchMessages = useCallback(async () => {
        if (!conversationId) return;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (!error) {
            const normalized = ((data ?? []) as Array<{ role: string; content: string }>).map((msg): Message => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content ?? '',
            }));
            setMessages(normalized);
        }
    }, [conversationId, supabase]);

    useEffect(() => {
        if (conversationId && conversationId !== loadedConvId.current) {
            fetchMessages();
            loadedConvId.current = conversationId;
        } else if (!conversationId) {
            setMessages([]);
            loadedConvId.current = null;
        }
    }, [conversationId, fetchMessages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const allModels: ModelOption[] = [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq (Fast)' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'Groq (Flash)' },
        ...OPENROUTER_MODELS.map((model) => ({
            id: model.id,
            name: model.name,
            provider: model.provider ?? 'OpenRouter',
        }))
    ];

    const currentModelName = allModels.find(m => m.id === selectedModel)?.name || 'Select Model';

    const handleSend = async (customInput?: string) => {
        const textToSend = customInput || input;
        if (!textToSend.trim() || loading) return;

        playClick();
        const userMessage: Message = { role: 'user', content: textToSend };
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
            setMessages((prev) => [...prev, { role: 'assistant', content: '' } as Message]);
            let frameId: number | null = null;

            const flushAssistantContent = (content: string) => {
                setMessages((prev) => {
                    if (prev.length === 0) return prev;
                    const last = prev[prev.length - 1];
                    if (last.role !== 'assistant') return prev;
                    return [...prev.slice(0, -1), { ...last, content }];
                });
            };

            const scheduleFlush = () => {
                if (frameId !== null) return;
                frameId = window.requestAnimationFrame(() => {
                    flushAssistantContent(assistantContent);
                    frameId = null;
                });
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                assistantContent += decoder.decode(value, { stream: true });
                scheduleFlush();
            }

            assistantContent += decoder.decode();
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
                frameId = null;
            }
            flushAssistantContent(assistantContent);

            playSuccess();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Chat failed';
            alert(message);
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
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown upload error';
            setNotification({ message: `Upload error: ${message}`, type: 'error' });
        } finally {
            setUploading(false);
            if (e.target) e.target.value = ''; // Reset file input
            setTimeout(() => setNotification(null), 5000);
        }
    };

    const connectService = (service?: string) => {
        window.location.href = `/api/google/connect${service ? `?service=${service}` : ''}`;
    };

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
                        <div
                            key={`msg-${i}`}
                            className={`message ${m.role}`}
                        >
                            <div className="message-avatar">
                                {m.role === 'user' ? 'U' : 'AI'}
                            </div>
                            <div className="message-bubble">
                                <div className="message-content">
                                    <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
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
                                        <div className="setting-icon" style={{ color: toolConfig[service].color }}>
                                            {toolConfig[service].icon}
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
                                                '--active-color': toolConfig[service].color
                                            } as React.CSSProperties & Record<'--active-color', string>} />
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

interface ServiceIconProps {
    icon: React.ReactNode;
    label: string;
    connected: boolean;
    permission?: string;
    service: 'gmail' | 'calendar' | 'drive' | 'docs';
    onClick: (service?: string) => void;
}

function ServiceIcon({ icon, label, connected, permission, service, onClick }: ServiceIconProps) {
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
