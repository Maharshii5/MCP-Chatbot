import { getGroqClient, DEFAULT_MODEL } from '@/lib/groq/client';
import { getOpenRouterClient, OPENROUTER_MODELS } from '@/lib/openrouter/client';
import { MCP_TOOLS } from '@/lib/mcp/tools';
import { searchDocuments } from '@/lib/rag/pinecone'; // Added import
import { dispatchToolCall } from '@/lib/mcp/dispatcher';
import { ChatCompletionTool, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

/**
 * Sanitizes messages by removing unsupported properties like conversation_id
 */
function sanitizeMessages(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
    return messages.map(m => {
        const { role, content, name, tool_calls, tool_call_id } = m as any;
        const msg: any = { role };

        // Truncate huge base64 image strings in history to save tokens
        if (typeof content === 'string') {
            msg.content = content.replace(/!\[(.*?)\]\(data:image\/.*?;base64,.*?\)/g, '![Generated Image]([Image Data Truncated])');
        } else {
            msg.content = content;
        }

        if (name) msg.name = name;
        if (tool_calls) msg.tool_calls = tool_calls;
        if (tool_call_id) msg.tool_call_id = tool_call_id;
        return msg;
    });
}
// ... (rest of imports)

function parseMalformedFunctionTag(raw: string): { name: string; args: Record<string, unknown> } | null {
    let tag = raw.trim();
    if (!tag.startsWith('<function=')) return null;

    tag = tag.replace(/^<function=/i, '').replace(/<\/function>\s*$/i, '').trim();
    tag = tag.endsWith('>') ? tag.slice(0, -1).trim() : tag;

    const nameMatch = tag.match(/^([a-zA-Z0-9_]+)/);
    if (!nameMatch) return null;

    const name = nameMatch[1];
    let rest = tag.slice(name.length).trim();
    rest = rest.replace(/^,/, '').trim();

    if (!rest) {
        return { name, args: {} };
    }

    const jsonStart = rest.indexOf('{');
    const jsonEnd = rest.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
        return { name, args: {} };
    }

    const jsonPart = rest.slice(jsonStart, jsonEnd + 1);
    try {
        const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
        return { name, args: parsed };
    } catch {
        return { name, args: {} };
    }
}


/**
 * Resolves all tool calls in a conversation non-streaming.
 * Returns the conversation history including all assistant tool calls and their results,
 * but DOES NOT include the final text response.
 */
export async function resolveToolCalls(
    userId: string,
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    activeFileNames?: string[],
    onToolCall?: (tool: string, args: any) => void,
    model: string = DEFAULT_MODEL
): Promise<ChatCompletionMessageParam[]> {
    const conversation = [...messages];
    let retryCount = 0;

    while (retryCount < 5) {
        let responseMessage: any;
        const isOpenRouter = OPENROUTER_MODELS.some(m => m.id === model);
        const openrouter = getOpenRouterClient();
        const groq = getGroqClient();
        const llm = (isOpenRouter ? (openrouter as any) : (groq as any)) as any;

        try {
            const response = await llm.chat.completions.create({
                model: model,
                messages: sanitizeMessages(conversation),
                tools: tools,
                tool_choice: 'auto',
            });
            responseMessage = response.choices[0].message;
        } catch (error: any) {
            console.error(`FULL ${isOpenRouter ? 'OPENROUTER' : 'GROQ'} ERROR:`, JSON.stringify(error, null, 2));

            const status = error.status || error.statusCode || (error.error?.status) || 0;
            const errorBody = error.error || error.body?.error || error;

            let malformed = errorBody?.failed_generation;

            // Deep Search for failed_generation
            if (!malformed && typeof error.message === 'string') {
                // Try parsing potential JSON in message
                try {
                    const start = error.message.indexOf('{');
                    const end = error.message.lastIndexOf('}');
                    if (start !== -1 && end !== -1) {
                        const jsonPart = error.message.substring(start, end + 1);
                        const parsed = JSON.parse(jsonPart);
                        malformed = parsed.error?.failed_generation || parsed.failed_generation;
                    }
                } catch (e) { }

                // Direct tag Regex
                if (!malformed) {
                    const match = error.message.match(/(<function=[\s\S]*?(?:<\/function>|>|$))/);
                    if (match) malformed = match[1];
                }
            }

            // Fallback for string errorBody
            if (!malformed && typeof errorBody === 'string' && errorBody.includes('<function=')) {
                malformed = errorBody;
            }

            console.log(`[Groq Error] Status: ${status}, Found Malformed Tag: ${!!malformed}`);

            if (status === 400 && malformed) {
                console.log('RECOVERYING TOOL CALL:', malformed);
                const parsed = parseMalformedFunctionTag(malformed);

                if (parsed) {
                    const cleanContent = malformed.replace(/<function=[\s\S]*?(?:<\/function>|>|$)/gi, '').trim();

                    responseMessage = {
                        role: 'assistant',
                        content: cleanContent || 'Processing request...',
                        tool_calls: [{
                            id: `call_${Math.random().toString(36).substr(2, 10)}`,
                            type: 'function',
                            function: { name: parsed.name, arguments: JSON.stringify(parsed.args) }
                        }]
                    };
                } else {
                    // Failed to parse tag, swallow error to prevent crash
                    console.error("Failed to parse malformed tag.");
                    return conversation;
                }
            } else {
                // If it's a 400 but we couldn't find the tag, or another error
                console.error("Unrecoverable error. Returning conversation state.");
                // Inject a system error note so the AI knows it failed
                conversation.push({
                    role: 'system',
                    content: `[System Error] The previous tool call failed with status ${status}. Please ask the user to rephrase.`
                } as any);
                return conversation;
            }
        }

        console.log('LLM Response Choice:', JSON.stringify(responseMessage));
        let toolCalls = responseMessage.tool_calls || [];

        // BACKUP: Check for raw XML-like function tags if native call failed
        if (toolCalls.length === 0 && responseMessage.content?.includes('<function=')) {
            console.log('Detected raw function tag in content. Attempting to parse...');
            const matches = responseMessage.content.matchAll(/<function=([^,>]+),?([^>]+)?><\/function>/g);
            for (const match of matches) {
                const name = match[1].trim();
                let args = {};
                try {
                    args = match[2] ? JSON.parse(match[2].trim()) : {};
                } catch (e) {
                    console.error('Failed to parse args for manual tool call:', match[2]);
                }

                toolCalls.push({
                    id: `manual_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'function',
                    function: { name, arguments: JSON.stringify(args) }
                } as any);
            }
        }

        if (toolCalls.length > 0) {
            conversation.push(responseMessage as ChatCompletionMessageParam);
            let shouldStop = false;

            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                if (onToolCall) onToolCall(functionName, functionArgs);

                try {
                    const toolResult = await dispatchToolCall(userId, functionName, functionArgs, activeFileNames);
                    console.log(`TOOL SUCCESS [${functionName}]:`, toolResult);

                    if (functionName === 'image_generate') {
                        shouldStop = true;
                    }

                    conversation.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult),
                    } as any);
                } catch (error: any) {
                    console.error(`TOOL ERROR [${functionName}]:`, error.message);
                    conversation.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: error.message }),
                    } as any);

                    if (typeof error.message === 'string' && error.message.startsWith('Unknown tool:')) {
                        shouldStop = true;
                    }
                }
            }

            if (shouldStop) {
                return conversation;
            }

            retryCount++;
            continue;
        }

        console.log('No tool calls in this turn.');
        return conversation;
    }

    throw new Error('Tool call iteration limit exceeded');
}

export async function streamChat(
    userId: string,
    messages: ChatCompletionMessageParam[],
    toolPreference?: string,
    activeFileNames?: string[],
    onToolCall?: (tool: string, args: any) => void,
    model: string = DEFAULT_MODEL
) {
    let contextInjection: ChatCompletionMessageParam | null = null;
    let currentTools = MCP_TOOLS; // Use a new variable for tools

    // 1. Proactive RAG Mode
    if (toolPreference === 'rag') {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
            try {
                const query = lastUserMsg.content as string;
                console.log(`[Proactive RAG] Searching for: "${query}" in files: ${activeFileNames?.join(', ') || 'all'}`);

                // Execute search directly
                const results = await searchDocuments(userId, query, activeFileNames);

                if (results.length > 0) {
                    const contextText = results.map(r => `[Source: ${r.fileName}]\n${r.content}`).join('\n\n');
                    contextInjection = {
                        role: 'system',
                        content: `CONTEXT FROM USER DOCUMENTS:\n${contextText}\n\nINSTRUCTION: Answer the user's question using ONLY the context above. If the answer is not in the context, say you don't know.`
                    };
                    console.log(`[Proactive RAG] Injected ${results.length} chunks.`);
                } else {
                    console.log(`[Proactive RAG] No results found.`);
                    contextInjection = {
                        role: 'system',
                        content: `CONTEXT FROM USER DOCUMENTS: No relevant documents found using query "${query}".`
                    };
                }

                // IMPORTANT: Remove document_search from tools to prevent LLM from trying to call it again
                currentTools = MCP_TOOLS.filter(t => t.function?.name !== 'document_search');
            } catch (err) {
                console.error('[Proactive RAG] Search failed:', err);
            }
        }
    }

    // 2. Tool Resolution Phase Prompt
    // No need for "CRITICAL" instruction injection anymore, context speaks for itself
    const toolSystemPrompt: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are a helpful AI assistant.
        
        Current Time: ${new Date().toLocaleString()}
        
        CRITICAL RULES:
        1. Never output raw XML/HTML tags like '<function=...'. Use the official 'tool_calls' format.
        2. Document Saving: If the user asks to save/create a Google Doc and you do NOT call 'google_docs_create', then say: "I can generate the content, but I cannot upload/save it yet." THIS DOES NOT APPLY TO IMAGES.
        3. Successful Uploads: If 'google_docs_create' is successful, you MUST provide the title, the location (My Drive -> MCP Chatbot), and the Document ID.
        4. Image Generation: You ARE capable of generating images. When 'image_generate' succeeds, output the Markdown image string immediately. Do NOT say you cannot upload images.
        
        Available Tools:
        - google_gmail_list_messages, google_gmail_get_message
        - google_calendar_list_events
        - web_search
        - document_search (Auto-active in 'My Docs' mode)
        - google_docs_create (Save text into a new Google Doc)
        - image_generate (Generate images from text)
        - fs_read_file, fs_write_file, fs_list_dir (Edit and explore local codebase)
        - shell_execute (Run terminal commands like 'npm test' or 'git status')`
    };

    // Context Trimming (Keep last 10 messages)
    const conversation = messages.slice(-10);
    conversation.unshift(toolSystemPrompt);

    // Inject RAG context if available
    if (contextInjection) {
        conversation.push(contextInjection);
    }

    // 3. Tool Phase
    const conversationWithTools = await resolveToolCalls(userId, conversation, currentTools, activeFileNames, onToolCall, model);

    // 4. Final Summary Pass
    const summaryPrompt: ChatCompletionMessageParam = {
        role: 'system',
        content: `Summarize the results for the user. 
        - If a tool failed, explain why.
        - If a document was created, confirm with: "I created a Google Doc titled [Title]. It's located in My Drive → MCP Chatbot. Document ID: [ID]".
        - If you didn't execute an upload tool requested by the user, say: "I can generate the content, but I cannot upload it yet."
        - DO NOT call any more tools.`
    };

    // CHECK FOR IMAGE GENERATION
    // If we generated an image, we bypass the LLM for the final response to:
    // 1. Save tokens (Base64 is huge)
    // 2. Prevent truncation (LLM context window limits)
    // 3. Ensure exact markdown delivery
    // 3. Ensure exact markdown delivery
    // Search entire conversation for the generated image tag, regardless of role (just to be safe)
    const imageToolResult = conversationWithTools.find((m: any) =>
        (typeof m.content === 'string' && m.content.includes('![Generated Image]'))
    );

    if (imageToolResult) {
        console.log('[StreamChat] Detected generated image. returning synthetic stream.');

        let content = imageToolResult.content as string;
        // Clean up JSON stringification if present (e.g. remove surrounding quotes)
        if (content.startsWith('"') && content.endsWith('"')) {
            try { content = JSON.parse(content); } catch (e) { }
        }
        // Create a synthetic stream that mimics Groq's structure
        const imageStream = (async function* () {
            // Yield a specific introduction
            yield { choices: [{ delta: { content: "Here is your generated image:\n\n" } }] };

            // Yield the image data in chunks (though one big chunk is fine for local buffer)
            yield { choices: [{ delta: { content: content } }] };
        })();

        return imageStream as any; // Cast to satisfy return type
    }

    const finalMessages: ChatCompletionMessageParam[] = [
        summaryPrompt,
        ...conversationWithTools.filter((m: any) => m.role !== 'system'),
        // Re-inject context for final pass if it exists, so the summarizer sees it
        ...(contextInjection ? [contextInjection] : [])
    ];

    // 3. Final streaming pass
    const lastMessage = finalMessages[finalMessages.length - 1];
    if (lastMessage && lastMessage.role === 'user' && toolPreference === 'rag') {
        lastMessage.content += "\n(Remember: Use the 'document_search' tool to answer this based on my uploaded docs.)";
    }

    const isOpenRouter = OPENROUTER_MODELS.some(m => m.id === model);
    const openrouter = getOpenRouterClient();
    const groq = getGroqClient();
    const llm = isOpenRouter ? (openrouter as any) : (groq as any);

    return await llm.chat.completions.create({
        model: model,
        messages: sanitizeMessages(finalMessages),
        stream: true,
    });
}
