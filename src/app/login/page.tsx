'use client'

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogIn, Github, Mail } from 'lucide-react';

export default function LoginPage() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push('/');
        }
    };

    const handleGoogleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/api/google/callback`,
            },
        });
    };

    return (
        <div className="login-container" style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d1117',
            color: 'white',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div className="login-card" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'linear-gradient(135deg, #58a6ff 0%, #3fb950 100%)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        boxShadow: '0 0 20px rgba(88, 166, 255, 0.3)'
                    }}>
                        <LogIn size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>Nexus CORE AI</h1>
                    <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>Workstation Access Required</p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Email Address</label>
                        <input
                            name="email"
                            type="email"
                            required
                            placeholder="admin@mcp.internal"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                color: 'white',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                color: 'white',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{ color: '#ff7b72', fontSize: '0.875rem', textAlign: 'center', background: 'rgba(255, 123, 114, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                            {error}
                        </div>
                    )}

                    <button
                        disabled={loading}
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: '#238636',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginTop: '0.5rem',
                            transition: 'background 0.2s'
                        }}
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                        <span style={{ padding: '0 0.75rem', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.3)' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'white',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Mail size={18} /> Continue with Google
                    </button>
                </form>
            </div>
        </div>
    );
}
