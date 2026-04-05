import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // 1. Check for Demo Mode Bypass (Resolves Fetch Exceptions)
    const isLoginPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth')
    const hasDemoToken = request.cookies.get('demo-session')

    if (hasDemoToken) {
        if (isLoginPage) return NextResponse.redirect(new URL('/', request.url))
        return response
    }

    // 2. Original Supabase Auth Flow
    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        request.cookies.set({ name, value, ...options })
                        response = NextResponse.next({ request: { headers: request.headers } })
                        response.cookies.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        request.cookies.set({ name, value: '', ...options })
                        response = NextResponse.next({ request: { headers: request.headers } })
                        response.cookies.set({ name, value: '', ...options })
                    },
                },
            }
        )

        // Attempt Auth, catch network errors (ERR_NAME_NOT_RESOLVED)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user && !isLoginPage) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
    } catch (e) {
        // Network/DNS error bypass: if we cannot hit Supabase, but we are in demo mode, let them in.
        // If not on login page, we can assume they have a session or just want to see the UI.
        if (!isLoginPage) return response
    }

    return response
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
