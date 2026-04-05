'use client'

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import RagManager from '@/components/RagManager';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'rag'>('chat');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        fetchConversations(session.user.id);
      }
    };
    checkUser();
  }, [supabase, router]);

  const fetchConversations = async (userId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error) setConversations(data as any || []);
    setLoading(false);
  };

  const handleConversationCreated = (id: string) => {
    setCurrentConvId(id);
    fetchConversations(user?.id);
  };

  if (loading) return <div style={{ background: '#0d1117', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <main className="main-layout">
      <Sidebar
        conversations={conversations}
        currentConvId={currentConvId}
        onSelect={(id: string | null) => {
          setCurrentConvId(id);
          setView('chat');
        }}
        view={view}
        onViewChange={setView}
        onRefresh={() => user && fetchConversations(user.id)}
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
