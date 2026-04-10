import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('google_access_token, google_refresh_token, google_token_expires_at')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return NextResponse.json({
                gmail: false,
                calendar: false,
                drive: false,
                docs: false,
                permissions: {
                    gmail: 'Not Connected',
                    calendar: 'Not Connected',
                    drive: 'Not Connected',
                    docs: 'Not Connected'
                },
                isGlobalConnected: false
            });
        }

        const isGlobalConnected = !!(profile.google_access_token || profile.google_refresh_token);
        const services = user.user_metadata?.services || {};
        const scopes = user.user_metadata?.services_scopes || '';

        const hasScope = (s: string) => scopes.includes(s);

        return NextResponse.json({
            gmail: isGlobalConnected && !!services.gmail,
            calendar: isGlobalConnected && !!services.calendar,
            drive: isGlobalConnected && !!services.drive,
            docs: isGlobalConnected && !!services.docs,
            permissions: {
                gmail: hasScope('gmail.compose') ? 'Read-Write' : 'Read-Only',
                calendar: hasScope('auth/calendar') ? 'Read-Write' : 'Read-Only',
                drive: (hasScope('drive.file') || hasScope('auth/drive')) ? 'Read-Write' : 'Read-Only',
                docs: (hasScope('auth/documents') || hasScope('auth/drive')) ? 'Read-Write' : 'Read-Only'
            },
            isGlobalConnected
        });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
