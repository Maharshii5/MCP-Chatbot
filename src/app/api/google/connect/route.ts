import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getGoogleRedirectUrl } from '@/lib/googleOAuth';
import { resolveAbsoluteUrl } from '@/lib/appOrigin';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const service = searchParams.get('service') || 'all';
    const redirectUrl = getGoogleRedirectUrl(req.url);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(resolveAbsoluteUrl('/login?error=login-required', req.url));
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUrl
    );

    const scopes = [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/documents'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'select_account',
        scope: scopes,
        state: `${user.id}:${service}` // Pass both user ID and target service
    });

    return NextResponse.redirect(url);
}
