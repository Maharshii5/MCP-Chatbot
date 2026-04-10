import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    const isLoginRoute = request.nextUrl.pathname.startsWith('/login')

    if (isLoginRoute) {
        const redirectResponse = NextResponse.redirect(new URL('/', request.url))
        redirectResponse.cookies.set('demo-session', 'true', {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        })
        return redirectResponse
    }

    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    response.cookies.set('demo-session', 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
    })

    return response
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
