import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

const FORCE_DEMO_MODE = true
type ServerClient = ReturnType<typeof createServerClient>

const demoUserBase = {
    id: 'demo-user-123',
    email: 'demo@mcp.internal',
}

const demoState: {
    userMetadata: Record<string, unknown>;
    profile: {
        id: string;
        google_access_token: string | null;
        google_refresh_token: string | null;
        google_token_expires_at: string | null;
        updated_at?: string;
    };
} = {
    userMetadata: { services: {}, services_scopes: '' },
    profile: {
        id: demoUserBase.id,
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
    },
}

function hydrateDemoStateFromCookies(cookieStore: ReadonlyRequestCookies) {
    const accessToken = cookieStore.get('demo-google-access-token')?.value ?? null
    const refreshToken = cookieStore.get('demo-google-refresh-token')?.value ?? null
    const expiresAt = cookieStore.get('demo-google-token-expires-at')?.value ?? null
    const servicesRawEncoded = cookieStore.get('demo-google-services')?.value ?? ''
    const scopes = cookieStore.get('demo-google-services-scopes')?.value ?? ''

    if (accessToken || refreshToken || expiresAt) {
        demoState.profile.google_access_token = accessToken
        demoState.profile.google_refresh_token = refreshToken
        demoState.profile.google_token_expires_at = expiresAt
    }

    if (servicesRawEncoded) {
        try {
            const servicesRaw = decodeURIComponent(servicesRawEncoded)
            const parsed = JSON.parse(servicesRaw)
            if (parsed && typeof parsed === 'object') {
                demoState.userMetadata.services = parsed
            }
        } catch {
            demoState.userMetadata.services = {}
        }
    }

    if (scopes) {
        demoState.userMetadata.services_scopes = scopes
    }
}

function createDemoServerClient(cookieStore: ReadonlyRequestCookies): ServerClient {
    hydrateDemoStateFromCookies(cookieStore)
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
            getUser: async () => ({
                data: {
                    user: {
                        ...demoUserBase,
                        user_metadata: demoState.userMetadata,
                    }
                },
                error: null
            }),
            getSession: async () => ({
                data: {
                    session: {
                        user: {
                            ...demoUserBase,
                            user_metadata: demoState.userMetadata,
                        }
                    }
                },
                error: null
            }),
            exchangeCodeForSession: async () => ({ data: { session: null, user: null }, error: null }),
            updateUser: async (payload?: { data?: Record<string, unknown> }) => {
                if (payload?.data) {
                    demoState.userMetadata = { ...demoState.userMetadata, ...payload.data }
                }
                return {
                    data: {
                        user: {
                            ...demoUserBase,
                            user_metadata: demoState.userMetadata,
                        }
                    },
                    error: null
                }
            },
        },
        from: (table: string) => ({
            select: () => {
                if (table === 'profiles') {
                    return makeSelectQuery([], demoState.profile)
                }
                return makeSelectQuery([])
            },
            delete: () => ({
                eq: () => ({
                    eq: async () => ({ error: null })
                })
            }),
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
            update: (values: Record<string, unknown>) => ({
                eq: () => {
                    if (table === 'profiles') {
                        demoState.profile = {
                            ...demoState.profile,
                            ...values,
                        }
                    }
                    return { eq: async () => ({ error: null }) }
                }
            }),
            upsert: async () => ({ error: null }),
        })
    } as unknown as ServerClient
}

export async function createClient() {
    const cookieStore = await cookies()
    const isDemo = FORCE_DEMO_MODE || cookieStore.has('demo-session')

    if (isDemo) {
        return createDemoServerClient(cookieStore)
    }

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch {
                        // Handle potential errors when setting cookies on server side components
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch {
                        // Handle potential errors when removing cookies on server side components
                    }
                },
            },
        }
    )
}
