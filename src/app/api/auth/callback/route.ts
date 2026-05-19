import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { resolveAbsoluteUrl } from '@/lib/appOrigin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    // next is the path to redirect to after successful login
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(resolveAbsoluteUrl(next, request.url));
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(resolveAbsoluteUrl('/login?error=auth-callback-failed', request.url));
}
