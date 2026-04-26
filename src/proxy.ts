import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function proxy(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const isLoginRoute = request.nextUrl.pathname.startsWith('/login')
    const isAuthApi = request.nextUrl.pathname.startsWith('/api/auth')
    const isPublicStatic = request.nextUrl.pathname.match(/\.(.*)$/)

    // If user is logged in and tries to go to login, send to home
    if (user && isLoginRoute) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    // If user is NOT logged in and tries to access protected pages, we could redirect to /login
    // But for this app, we'll allow the home page to load in 'guest' mode and just show the sidebar state.
    
    return NextResponse.next({
        request: {
            headers: request.headers,
        },
    })
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
