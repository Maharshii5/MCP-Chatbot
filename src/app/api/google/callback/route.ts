import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getGoogleRedirectUrl } from '@/lib/googleOAuth';
import { resolveAbsoluteUrl } from '@/lib/appOrigin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '';
    const [userId, targetService] = state.split(':');
    const redirectUrl = getGoogleRedirectUrl(request.url);

    if (!code || !userId) {
        return NextResponse.redirect(resolveAbsoluteUrl('/?error=invalid-callback', request.url));
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUrl
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);
        const supabase = await createClient();
        let connectedServices: Record<string, boolean> = {};

        // 1. Update Profile Tokens
        const updateData: Record<string, string | null> = {
            google_access_token: tokens.access_token || null,
            updated_at: new Date().toISOString(),
        };

        if (tokens.refresh_token) updateData.google_refresh_token = tokens.refresh_token;
        if (tokens.expiry_date) updateData.google_token_expires_at = new Date(tokens.expiry_date).toISOString();

        const { error: profileError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (profileError) throw profileError;

        // 2. Update Auth Metadata for granular service status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const currentServices = user.user_metadata?.services || {};
            const newServices = { ...currentServices };

            if (targetService === 'all') {
                ['gmail', 'calendar', 'drive', 'docs'].forEach(s => newServices[s] = true);
            } else if (targetService) {
                newServices[targetService] = true;
            }
            connectedServices = newServices;

            await supabase.auth.updateUser({
                data: {
                    services: newServices,
                    services_scopes: tokens.scope || ''
                }
            });
        }

        const response = NextResponse.redirect(resolveAbsoluteUrl('/?success=google-connected', request.url));
        response.cookies.set('demo-google-access-token', tokens.access_token || '', {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        });
        response.cookies.set('demo-google-refresh-token', tokens.refresh_token || '', {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        });
        response.cookies.set('demo-google-token-expires-at', tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : '', {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        });
        const encodedServices = encodeURIComponent(JSON.stringify(connectedServices));
        response.cookies.set('demo-google-services', encodedServices, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        });
        response.cookies.set('demo-google-services-scopes', tokens.scope || '', {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
        });

        return response;
    } catch (error) {
        console.error('Google OAuth Callback Error:', error);
        return NextResponse.redirect(resolveAbsoluteUrl('/?error=google-auth-failed', request.url));
    }
}
