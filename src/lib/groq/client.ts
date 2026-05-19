import { Groq } from "groq-sdk";

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export const getGroqClient = () => {
    if (typeof window !== 'undefined') return null;

    const primaryApiKey = process.env.GROQ_API_KEY || "dummy";
    const fallbackApiKey =
        process.env.GROQ_API_KEY_FALLBACK ||
        process.env.Groq_API_KEY_FALLBACK ||
        "";

    const primaryClient = new Groq({
        apiKey: primaryApiKey,
    });

    if (!fallbackApiKey || fallbackApiKey === primaryApiKey) {
        return primaryClient;
    }

    const fallbackClient = new Groq({
        apiKey: fallbackApiKey,
    });

    return {
        ...primaryClient,
        chat: {
            ...primaryClient.chat,
            completions: {
                ...primaryClient.chat.completions,
                create: async (...args: Parameters<typeof primaryClient.chat.completions.create>) => {
                    try {
                        return await primaryClient.chat.completions.create(...args);
                    } catch (error: any) {
                        const status = error?.status || error?.statusCode || error?.error?.status || 0;
                        const message = String(error?.message || error?.error?.message || '');
                        const shouldFallback =
                            status === 401 ||
                            status === 403 ||
                            status === 429 ||
                            message.toLowerCase().includes('rate limit') ||
                            message.toLowerCase().includes('quota') ||
                            message.toLowerCase().includes('insufficient') ||
                            message.toLowerCase().includes('invalid api key') ||
                            message.toLowerCase().includes('authentication');

                        if (!shouldFallback) {
                            throw error;
                        }

                        console.warn(`[Groq] Primary API key failed (status: ${status || 'unknown'}). Retrying with fallback key.`);
                        return await fallbackClient.chat.completions.create(...args);
                    }
                }
            }
        }
    };
};
