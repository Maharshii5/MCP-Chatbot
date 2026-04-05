import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamChat } from '@/services/chatService';
import { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { messages, conversationId: existingId, toolPreference, activeFileNames, model } = await req.json();
        let conversationId = existingId;
        // 1. Create conversation if it doesn't exist
        if (!conversationId) {
            const firstMsg = messages[messages.length - 1].content || 'New Conversation';
            const title = firstMsg.slice(0, 40) + (firstMsg.length > 40 ? '...' : '');
            const { data: conv, error: convError } = await supabase
                .from('conversations')
                .insert({ user_id: user.id, title })
                .select()
                .single();

            if (convError) throw convError;
            conversationId = conv.id;
        }

        // 2. Save the user's message
        const lastUserMessage = messages[messages.length - 1];
        await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: lastUserMessage.content,
        });

        const stream = await streamChat(user.id, messages as ChatCompletionMessageParam[], toolPreference, activeFileNames, undefined, model);

        let assistantContent = '';
        const responseStream = new ReadableStream({
            async start(controller) {
                try {
                    const encoder = new TextEncoder();
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || '';
                        if (content) {
                            console.log('Enqueuing chunk:', content);
                            assistantContent += content;
                            controller.enqueue(encoder.encode(content));
                        }
                    }

                    // 3. Save the assistant's response once finished
                    await supabase.from('messages').insert({
                        conversation_id: conversationId,
                        role: 'assistant',
                        content: assistantContent,
                    });

                    // 4. Update conversation updated_at
                    await supabase.from('conversations')
                        .update({ updated_at: new Date().toISOString() })
                        .eq('id', conversationId);
                } catch (error) {
                    console.error('Streaming Error:', error);
                    controller.error(error);
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(responseStream, {
            headers: {
                'x-conversation-id': conversationId,
            }
        });
    } catch (error: any) {
        console.error('Chat Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
