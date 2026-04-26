'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import RagManager from '@/components/RagManager';
import type { User } from '@supabase/supabase-js';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'rag'>('chat');
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const fetchConversations = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (!error) setConversations((data as Conversation[]) || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.user) {
        setUser(session.user);
        await fetchConversations(session.user.id);
      } else {
        setUser(null);
        setConversations([]);
        setLoading(false);
      }
    };

    checkUser();
    return () => {
      cancelled = true;
    };
  }, [fetchConversations, supabase]);

  const handleConversationCreated = useCallback((id: string) => {
    setCurrentConvId(id);
    if (user?.id) {
      fetchConversations(user.id);
    }
  }, [fetchConversations, user?.id]);

  if (loading) return <div style={{ background: '#0d1117', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <main className="main-layout">
      <Sidebar
        user={user}
        conversations={conversations}
        currentConvId={currentConvId}
        onSelect={(id: string | null) => {
          setCurrentConvId(id);
          setView('chat');
        }}
        view={view}
        onViewChange={setView}
        onRefresh={() => user && fetchConversations(user.id)}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setUser(null);
          setConversations([]);
          setCurrentConvId(null);
        }}
      />

      {view === 'chat' ? (
        <ChatWindow
          conversationId={currentConvId}
          onConversationCreated={handleConversationCreated}
        />
      ) : (
        <RagManager />
      )}
    </main>
  );
}
