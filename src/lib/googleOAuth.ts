import { resolveAbsoluteUrl } from '@/lib/appOrigin';

export function getGoogleRedirectUrl(requestUrl?: string) {
    const configured = process.env.GOOGLE_REDIRECT_URL?.trim();

    if (!configured) {
        return resolveAbsoluteUrl('/api/google/callback', requestUrl);
    }

    try {
        const configuredUrl = new URL(configured);
        if (!requestUrl) {
            return configuredUrl.toString();
        }

        const requestOrigin = new URL(requestUrl).origin;
        const configuredIsLocalhost = ['localhost', '127.0.0.1'].includes(configuredUrl.hostname);
        const requestIsLocalhost = ['localhost', '127.0.0.1'].includes(new URL(requestUrl).hostname);

        if ((configuredIsLocalhost && !requestIsLocalhost) || (!configuredIsLocalhost && requestIsLocalhost)) {
            return resolveAbsoluteUrl('/api/google/callback', requestUrl);
        }

        return configuredUrl.toString();
    } catch {
        return resolveAbsoluteUrl('/api/google/callback', requestUrl);
    }
}
