import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseDocument, chunkText } from '@/lib/rag/parser';
import { upsertDocument } from '@/lib/rag/pinecone';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        console.log(`Received file: ${file.name} (${file.size} bytes)`);

        console.log('Step 1: Parsing document...');
        const text = await parseDocument(buffer, file.type, file.name);
        console.log(`Parsed text length: ${text.length}`);

        console.log('Step 2: Chunking text...');
        const chunks = chunkText(text);
        console.log(`Created ${chunks.length} chunks`);

        const formattedChunks = chunks.map(chunk => ({
            text: chunk,
            metadata: {
                fileName: file.name,
                fileType: file.type,
            },
        }));

        console.log('Step 3: Upserting to Pinecone...');
        await upsertDocument(user.id, file.name, formattedChunks);

        console.log('Step 4: Saving metadata to Supabase...');
        const { error } = await supabase.from('documents').insert({
            user_id: user.id,
            file_name: file.name,
            file_type: file.type,
        });

        if (error) {
            console.error('Supabase DB error:', error);
            throw error;
        }

        return NextResponse.json({ success: true, fileName: file.name });
    } catch (error) {
        console.error('Upload Error:', error);
        const message = error instanceof Error ? error.message : 'Upload failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
