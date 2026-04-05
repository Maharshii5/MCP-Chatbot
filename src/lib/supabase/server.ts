import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
    const cookieStore = await cookies()
    const isDemo = cookieStore.has('demo-session')

    if (isDemo) {
        return {
            auth: {
                getUser: async () => ({ data: { user: { id: 'demo-user-123', email: 'demo@mcp.internal' } }, error: null }),
                getSession: async () => ({ data: { session: { user: { id: 'demo-user-123' } } }, error: null }),
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        order: () => Promise.resolve({ data: [], error: null })
                    }),
                    order: () => Promise.resolve({ data: [], error: null })
                }),
                delete: () => ({
                    eq: () => ({
                        eq: () => Promise.resolve({ error: null })
                    })
                }),
                insert: () => Promise.resolve({ error: null })
            })
        } as any;
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
                    } catch (error) {
                        // Handle potential errors when setting cookies on server side components
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                        // Handle potential errors when removing cookies on server side components
                    }
                },
            },
        }
    )
}
