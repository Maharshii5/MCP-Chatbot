import { createBrowserClient } from '@supabase/ssr'

type BrowserClient = ReturnType<typeof createBrowserClient>
let browserClient: BrowserClient | null = null
const FORCE_DEMO_MODE = true
const demoUser = { id: 'demo-user-123', email: 'demo@mcp.internal' }

function createDemoBrowserClient(): BrowserClient {
  const makeSelectQuery = (rows: unknown[] = [], singleRow: unknown = null) => {
    const query = {
      eq: () => query,
      order: async () => ({ data: rows, error: null }),
      limit: async () => ({ data: rows, error: null }),
      single: async () => ({ data: singleRow, error: null }),
    }
    return query
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: demoUser }, error: null }),
      getSession: async () => ({ data: { session: { user: demoUser } }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: demoUser, session: { user: demoUser } }, error: null }),
    },
    from: (table: string) => ({
      select: () => {
        if (table === 'profiles') {
          return makeSelectQuery([], {
            id: demoUser.id,
            google_access_token: null,
            google_refresh_token: null,
            google_token_expires_at: null,
          })
        }
        return makeSelectQuery([])
      },
      insert: (payload: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({
            data: table === 'conversations'
              ? { id: `demo-conv-${Date.now()}`, ...payload }
              : payload,
            error: null
          })
        })
      }),
      update: () => ({
        eq: () => ({ eq: async () => ({ error: null }) })
      }),
      delete: () => ({
        eq: () => ({ eq: async () => ({ error: null }) })
      }),
      upsert: async () => ({ error: null })
    })
  } as unknown as BrowserClient
}

export function createClient() {
  const hasDemoCookie = typeof document !== 'undefined' && document.cookie.includes('demo-session=true');
  const isDemo = FORCE_DEMO_MODE || hasDemoCookie;

  if (isDemo) {
    return createDemoBrowserClient()
  }

  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return browserClient
}
