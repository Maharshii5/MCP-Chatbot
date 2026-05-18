'use client'

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LogIn, UserPlus, Key, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'signup' | 'reset-password' | 'update-password';

export default function LoginPage() {
    const supabase = createClient();
    const router = useRouter();
    const [mode, setMode] = useState<AuthMode>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const getFriendlyAuthError = (rawMessage: string) => {
        const message = rawMessage.toLowerCase();

        if (message.includes('email not confirmed')) {
            return 'Your account exists, but the email is not verified yet. Please verify it from your inbox before signing in.';
        }

        if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
            return 'Invalid email or password. If you just signed up, confirm the email first or reset your password.';
        }

        if (message.includes('user already registered')) {
            return 'An account with this email already exists. Try signing in or use reset password.';
        }

        if (message.includes('signup is disabled')) {
            return 'Email signup is currently disabled in Supabase Auth settings.';
        }

        if (message.includes('provider is not enabled')) {
            return 'This auth provider is not enabled in Supabase yet.';
        }

        return rawMessage;
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const modeParam = params.get('mode');
        const errorParam = params.get('error');

        if (modeParam === 'signup' || modeParam === 'reset-password' || modeParam === 'update-password') {
            setMode(modeParam);
        } else {
            setMode('login');
        }

        if (errorParam === 'auth-callback-failed') {
            setError('Authentication callback failed. Please try again.');
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                router.push('/');
            } else if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
                    }
                });
                if (error) throw error;

                if (!data.user) {
                    throw new Error('Signup did not complete. Please check your Supabase email signup settings.');
                }

                if (data.session) {
                    setMessage('Account created successfully. You are now signed in.');
                    router.push('/');
                    return;
                }

                setMessage(`Account created for ${email}. Check your inbox and spam folder for the verification email before signing in.`);
                setMode('signup');
            } else if (mode === 'reset-password') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/login?mode=update-password`,
                });
                if (error) throw error;
                setMessage(`If an account exists for ${email}, a password reset email has been sent. Check inbox and spam.`);
                setMode('reset-password');
            } else if (mode === 'update-password') {
                if (password.length < 6) {
                    throw new Error('Password must be at least 6 characters long.');
                }
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match.');
                }

                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                setMessage('Password updated successfully. You can sign in now.');
                setMode('login');
                router.replace('/login');
            }
        } catch (err: unknown) {
            const rawMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(getFriendlyAuthError(rawMessage));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/api/auth/callback`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d1117',
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(88, 166, 255, 0.05) 0%, transparent 50%)',
            color: 'white',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden'
        }}>
            <AnimatePresence mode="wait">
                <motion.div 
                    key={mode}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="login-card" 
                    style={{
                        width: '100%',
                        maxWidth: '420px',
                        padding: '2.5rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        position: 'relative',
                        zIndex: 1
                    }}
                >
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: 'linear-gradient(135deg, #58a6ff 0%, #3fb950 100%)',
                            borderRadius: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.25rem',
                            boxShadow: '0 8px 32px rgba(88, 166, 255, 0.3)'
                        }}>
                            {mode === 'signup' ? <UserPlus size={32} color="white" /> : 
                             mode === 'reset-password' || mode === 'update-password' ? <Key size={32} color="white" /> :
                             <LogIn size={32} color="white" />}
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                            {mode === 'login' ? 'Welcome Back' : 
                             mode === 'signup' ? 'Create Account' : 
                             mode === 'reset-password' ? 'Reset Password' :
                             'Choose a New Password'}
                        </h1>
                        <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>
                            {mode === 'login' ? 'Access your AI workstation' : 
                             mode === 'signup' ? 'Join the future of automation' : 
                             mode === 'reset-password' ? 'We will send you a recovery link' :
                             'Set a new password for your account'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {mode !== 'update-password' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255, 255, 255, 0.3)' }} />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        placeholder="admin@nexus.ai"
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem 1rem 0.8rem 2.5rem',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '10px',
                                            color: 'white',
                                            outline: 'none',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {mode !== 'reset-password' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Password</label>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    minLength={6}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '10px',
                                        color: 'white',
                                        outline: 'none',
                                        fontSize: '0.9rem'
                                    }}
                                />
                                {mode === 'update-password' && (
                                    <input
                                        name="confirmPassword"
                                        type="password"
                                        required
                                        minLength={6}
                                        placeholder="Confirm new password"
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem 1rem',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '10px',
                                            color: 'white',
                                            outline: 'none',
                                            fontSize: '0.9rem',
                                            marginTop: '0.75rem'
                                        }}
                                    />
                                )}
                                {mode === 'login' && (
                                    <button 
                                        type="button" 
                                        onClick={() => setMode('reset-password')}
                                        style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: '0.75rem', marginTop: '0.5rem', cursor: 'pointer', padding: 0 }}
                                    >
                                        Forgot password?
                                    </button>
                                )}
                            </div>
                        )}

                        {error && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#ff7b72', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(248, 81, 73, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(248, 81, 73, 0.2)' }}>
                                {error}
                            </motion.div>
                        )}

                        {message && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#3fb950', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(63, 185, 80, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(63, 185, 80, 0.2)' }}>
                                {message}
                            </motion.div>
                        )}

                        <button
                            disabled={loading}
                            type="submit"
                            style={{
                                width: '100%',
                                padding: '0.85rem',
                                background: mode === 'signup' ? '#238636' : '#1f6feb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '700',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                marginTop: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : 
                             mode === 'login' ? 'Sign In' : 
                             mode === 'signup' ? 'Create Account' : 
                             mode === 'reset-password' ? 'Send Reset Link' :
                             'Update Password'}
                        </button>
                        
                        {(mode === 'login' || mode === 'signup') && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                                    <span style={{ padding: '0 1rem', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.3)', fontWeight: '600' }}>OR CONTINUE WITH</span>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    style={{
                                        width: '100%',
                                        padding: '0.85rem',
                                        background: 'transparent',
                                        color: 'white',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <img src="https://www.google.com/favicon.ico" style={{ width: '18px', height: '18px' }} alt="Google" />
                                    Google Account
                                </button>
                            </>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            {mode === 'login' ? (
                                <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                                    Don't have an account? <button type="button" onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: '#58a6ff', fontWeight: '600', cursor: 'pointer' }}>Sign up</button>
                                </p>
                            ) : (
                                <button 
                                    type="button" 
                                    onClick={() => setMode('login')}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                                >
                                    <ArrowLeft size={14} /> Back to Login
                                </button>
                            )}
                        </div>
                    </form>
                </motion.div>
            </AnimatePresence>
            
            {/* Visual Blobs */}
            <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '40%', height: '50%', background: 'rgba(88, 166, 255, 0.03)', filter: 'blur(100px)', borderRadius: '50%', zIndex: 0 }}></div>
            <div style={{ position: 'fixed', bottom: '-10%', right: '-5%', width: '40%', height: '50%', background: 'rgba(63, 185, 80, 0.03)', filter: 'blur(100px)', borderRadius: '50%', zIndex: 0 }}></div>
        </div>
    );
}
