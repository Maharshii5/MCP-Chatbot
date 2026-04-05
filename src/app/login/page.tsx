"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. DEMO LOGIC: Universal Login for ANY username with password 123456
        if (password === '123456') {
            try {
                document.cookie = `demo-session=true; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
                document.cookie = `demo-user-email=${encodeURIComponent(email)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
                
                setTimeout(() => {
                    router.push('/');
                    router.refresh();
                }, 800);
                return;
            } catch (cookieErr) {
                console.error('Bypass error:', cookieErr);
            }
        }

        // 2. Standard Supabase Flow
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) {
                setError(signInError.message);
            } else {
                router.refresh();
                router.push('/');
            }
        } catch (err: any) {
            if (password === '123456') {
                document.cookie = `demo-session=true; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
                router.push('/');
            } else {
                setError('SYSTEM_NETWORK_ERROR: UNREACHABLE');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-workstation">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="login-overlay" 
            />
            
            <div className="login-content">
                <header className="login-header">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h1 className="workstation-logo">MCP_STATION</h1>
                        <p className="workstation-status">TERMINAL_READY // SECURE_AUTH_V4</p>
                    </motion.div>
                </header>

                <motion.main 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="login-form-container"
                >
                    <form onSubmit={handleAuth} className="workstation-form">
                        <div className="input-group">
                            <div className="input-field">
                                <label>IDENTIFIER</label>
                                <input 
                                    type="email" 
                                    placeholder="user@mcp.internal"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required 
                                />
                            </div>
                            
                            <div className="input-field">
                                <label>ACCESS_KEY</label>
                                <input 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required 
                                />
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="system-error"
                                >
                                    {error.toUpperCase()}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="workstation-button"
                        >
                            {loading ? (
                                <span className="loading-text">INITIALIZING...</span>
                            ) : (
                                <span className="button-text">AUTHORIZE_SESSION</span>
                            )}
                        </button>
                    </form>

                    <footer className="form-footer">
                        <p>PRIVATE WORKSTATION. UNAUTHORIZED ACCESS PROHIBITED.</p>
                        <div className="footer-links">
                            <span>V9.4.0_LATEST</span>
                            <span className="separator">/</span>
                            <span className="demo-hint" title="Bypass enabled for 123456">DEMO_MODE_ACTIVE</span>
                        </div>
                    </footer>
                </motion.main>
            </div>

            <style jsx>{`
                .login-workstation {
                    height: 100vh;
                    width: 100vw;
                    background: #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-family: 'Inter', -apple-system, sans-serif;
                    overflow: hidden;
                }

                .login-overlay {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 100%);
                    pointer-events: none;
                }

                .login-content {
                    width: 100%;
                    max-width: 420px;
                    padding: 40px;
                    z-index: 10;
                }

                .login-header {
                    margin-bottom: 48px;
                    text-align: center;
                }

                .workstation-logo {
                    font-family: 'Inter', sans-serif;
                    font-size: 14px;
                    font-weight: 800;
                    letter-spacing: 4px;
                    margin-bottom: 8px;
                    opacity: 0.9;
                }

                .workstation-status {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 10px;
                    letter-spacing: 1px;
                    color: #666;
                }

                .login-form-container {
                    background: rgba(10, 10, 10, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 1px;
                    padding: 32px;
                    backdrop-filter: blur(20px);
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    margin-bottom: 32px;
                }

                .input-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .input-field label {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    color: #555;
                }

                .input-field input {
                    background: transparent;
                    border: 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 8px 0;
                    color: #fff;
                    font-size: 15px;
                    outline: none;
                    transition: border-color 0.3s ease;
                }

                .input-field input:focus {
                    border-color: rgba(255, 255, 255, 0.5);
                }

                .workstation-button {
                    width: 100%;
                    padding: 14px;
                    background: #fff;
                    color: #000;
                    border: none;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 2px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin-bottom: 24px;
                }

                .workstation-button:hover {
                    background: #ccc;
                }

                .workstation-button:disabled {
                    background: #222;
                    color: #555;
                    cursor: not-allowed;
                }

                .system-error {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 10px;
                    color: #ff4d4d;
                    background: rgba(255, 77, 77, 0.05);
                    padding: 12px;
                    border-left: 2px solid #ff4d4d;
                    margin-bottom: 24px;
                }

                .form-footer {
                    text-align: center;
                    opacity: 0.3;
                    transition: opacity 0.3s ease;
                }
                
                .form-footer:hover {
                    opacity: 0.6;
                }

                .form-footer p {
                    font-size: 9px;
                    margin-bottom: 12px;
                    letter-spacing: 0.5px;
                }

                .footer-links {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 8px;
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                }

                .separator { color: #333; }
                
                .demo-hint {
                    cursor: help;
                }

                @keyframes blink {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }

                .loading-text {
                    animation: blink 1s infinite;
                }
            `}</style>
        </div>
    );
}
