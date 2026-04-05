import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const isDemo = typeof document !== 'undefined' && document.cookie.includes('demo-session=true');

  if (isDemo) {
    // Return a mocked client to prevent fetch hangs
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: 'demo-user-123', email: 'demo@mcp.internal' } }, error: null }),
        getSession: async () => ({ data: { session: { user: { id: 'demo-user-123', email: 'demo@mcp.internal' } } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          }),
          order: () => Promise.resolve({ data: [], error: null })
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
      })
    } as any;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
