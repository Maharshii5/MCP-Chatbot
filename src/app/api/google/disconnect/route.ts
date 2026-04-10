import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const service = searchParams.get('service');

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (service) {
            // Granular Disconnect: Just update metadata
            const currentServices = user.user_metadata?.services || {};
            const newServices = { ...currentServices };
            delete newServices[service];

            await supabase.auth.updateUser({
                data: { services: newServices }
            });

            const response = NextResponse.json({ success: true, mode: 'granular' });
            response.cookies.set('demo-google-services', encodeURIComponent(JSON.stringify(newServices)), {
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
                sameSite: 'lax'
            });
            return response;
        } else {
            // Global Disconnect: Clear tokens and metadata
            const { error } = await supabase
                .from('profiles')
                .update({
                    google_access_token: null,
                    google_refresh_token: null,
                    google_token_expires_at: null
                })
                .eq('id', user.id);

            if (error) throw error;

            await supabase.auth.updateUser({
                data: { services: {} }
            });

            const response = NextResponse.json({ success: true, mode: 'global' });
            response.cookies.set('demo-google-access-token', '', { path: '/', maxAge: 0, sameSite: 'lax' });
            response.cookies.set('demo-google-refresh-token', '', { path: '/', maxAge: 0, sameSite: 'lax' });
            response.cookies.set('demo-google-token-expires-at', '', { path: '/', maxAge: 0, sameSite: 'lax' });
            response.cookies.set('demo-google-services', '', { path: '/', maxAge: 0, sameSite: 'lax' });
            response.cookies.set('demo-google-services-scopes', '', { path: '/', maxAge: 0, sameSite: 'lax' });
            return response;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to disconnect Google service';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
