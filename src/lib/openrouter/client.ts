import { OpenAI } from "openai";

// Only initialize on server to prevent browser-side "Missing API Key" errors
export const getOpenRouterClient = () => {
  if (typeof window !== 'undefined') return null;
  
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "dummy",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "MCP Chatbot",
    }
  });
};

export const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta' },
  { id: 'mistralai/mistral-large-2407', name: 'Mistral Large 2', provider: 'Mistral' },
];
