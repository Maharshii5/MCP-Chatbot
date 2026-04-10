import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in search params, use it as the redirection URL
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.session) {
            const { user, provider_token, provider_refresh_token } = data.session;
            console.log('OAuth Callback - User:', user.id);
            console.log('OAuth Callback - Has Token:', !!provider_token);
            console.log('OAuth Callback - Has Refresh Token:', !!provider_refresh_token);

            // Fetch current profile to preserve refresh token
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('google_refresh_token')
                .eq('id', user.id)
                .single();

            const profileData: Record<string, string | undefined> = {
                id: user.id,
                full_name: user.user_metadata.full_name,
                avatar_url: user.user_metadata.avatar_url,
                google_access_token: provider_token,
                updated_at: new Date().toISOString(),
            };

            // Only update refresh token if Google provided a new one
            if (provider_refresh_token) {
                profileData.google_refresh_token = provider_refresh_token;
            } else if (existingProfile?.google_refresh_token) {
                profileData.google_refresh_token = existingProfile.google_refresh_token;
            }

            await supabase.from('profiles').upsert(profileData);

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/?error=auth-failed`);
}
