const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

function normalizeConfiguredOrigin(value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    try {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return new URL(trimmed).origin;
        }

        return new URL(`https://${trimmed}`).origin;
    } catch {
        return null;
    }
}

function isLocalhostUrl(value?: string | null) {
    if (!value) return false;

    try {
        return LOCALHOST_HOSTNAMES.has(new URL(value).hostname);
    } catch {
        return false;
    }
}

export function resolveAppOrigin(requestUrl?: string) {
    const requestOrigin = requestUrl ? new URL(requestUrl).origin : null;
    const configuredOrigin = normalizeConfiguredOrigin(
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.VERCEL_URL
    );

    if (!requestOrigin) {
        return configuredOrigin ?? undefined;
    }

    if (!configuredOrigin) {
        return requestOrigin;
    }

    const requestIsLocalhost = isLocalhostUrl(requestOrigin);
    const configuredIsLocalhost = isLocalhostUrl(configuredOrigin);

    if (requestIsLocalhost && !configuredIsLocalhost) {
        return requestOrigin;
    }

    if (!requestIsLocalhost && configuredIsLocalhost) {
        return requestOrigin;
    }

    return configuredOrigin;
}

export function resolveAbsoluteUrl(path: string, requestUrl?: string) {
    const origin = resolveAppOrigin(requestUrl);
    if (!origin) return path;
    return new URL(path, origin).toString();
}
