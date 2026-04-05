import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

if (!process.env.PINECONE_API_KEY) console.warn('Missing PINECONE_API_KEY');
if (!process.env.PINECONE_INDEX) console.warn('Missing PINECONE_INDEX');
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) console.warn('Missing GOOGLE_GENERATIVE_AI_API_KEY');

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
});

export const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    modelName: "gemini-embedding-001", // Use working model
});

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function searchDocuments(userId: string, query: string, activeFileNames?: string[]) {
    const indexName = process.env.PINECONE_INDEX!;
    const index = pc.Index(indexName);

    console.log(`Searching documents for user ${userId} with query: "${query}"`);
    if (activeFileNames && activeFileNames.length > 0) {
        console.log(`Filtering to active files: ${activeFileNames.join(', ')}`);
    }

    const queryEmbedding = await embeddings.embedQuery(query);
    console.log('Query embedding generated.');

    const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 10, // Get more results to filter
        filter: { user_id: { '$eq': userId } },
        includeMetadata: true,
    });

    console.log(`Pinecone search returned ${queryResponse.matches.length} matches.`);

    let results = queryResponse.matches.map(match => ({
        content: (match.metadata as any).text,
        fileName: (match.metadata as any).fileName,
        score: match.score,
    }));

    // Filter by active files if specified
    if (activeFileNames && activeFileNames.length > 0) {
        results = results.filter(r => activeFileNames.includes(r.fileName));
        console.log(`Filtered to ${results.length} results from active files.`);
    }

    // Take top 5 after filtering
    results = results.slice(0, 5);

    // Get unique file names that contributed to results
    const usedFiles = [...new Set(results.map(r => r.fileName))];
    console.log(`Results came from files: ${usedFiles.join(', ')}`);

    return results;
}

export async function upsertDocument(userId: string, fileName: string, chunks: { text: string; metadata: any }[]) {
    const indexName = process.env.PINECONE_INDEX!;
    const index = pc.Index(indexName);

    console.log(`Indexing document "${fileName}" for user ${userId} (${chunks.length} chunks)...`);

    const vectors = [];
    const BATCH_SIZE = 2; // Reduced batch size for stability on free tier

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        console.log(`[RAG] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);

        try {
            const batchVectors = await Promise.all(batch.map(async (chunk, j) => {
                let retries = 0;
                while (retries < 3) {
                    try {
                        const start = Date.now();
                        const embedding = await embeddings.embedQuery(chunk.text);
                        console.log(`[RAG] Embedding chunk ${i + j} took ${Date.now() - start}ms`);
                        return {
                            id: `${userId}_${fileName}_${i + j}`.replace(/[^a-zA-Z0-9]/g, '_'),
                            values: embedding,
                            metadata: {
                                ...chunk.metadata,
                                text: chunk.text,
                                user_id: userId,
                                fileName,
                            },
                        };
                    } catch (e: any) {
                        if (e.message.includes('429') || e.message.includes('Quota')) {
                            const delay = Math.pow(2, retries) * 2000;
                            console.warn(`[RAG] Rate limited. Retrying in ${delay / 1000}s...`);
                            await wait(delay);
                            retries++;
                        } else {
                            throw e;
                        }
                    }
                }
                throw new Error('Max retries exceeded for embedding');
            }));
            vectors.push(...batchVectors);

            // Artificial delay between batches to stay under RPM limits
            if (i + BATCH_SIZE < chunks.length) {
                await wait(1000);
            }
        } catch (err: any) {
            console.error(`[RAG] Critical Error in embedding batch:`, err.message);
            throw new Error(`Embedding failed: ${err.message}`);
        }
    }

    console.log(`[RAG] All embeddings generated. Starting Pinecone upsert for ${vectors.length} vectors...`);
    // Upsert in chunks to Pinecone as well if needed (Pinecone limits are high but let's be safe)
    const PINECONE_UPSERT_BATCH = 100;
    for (let i = 0; i < vectors.length; i += PINECONE_UPSERT_BATCH) {
        const slice = vectors.slice(i, i + PINECONE_UPSERT_BATCH);
        await index.upsert(slice);
        console.log(`[RAG] Upserted ${i + slice.length}/${vectors.length} to Pinecone.`);
    }

    console.log(`Successfully indexed ${vectors.length} vectors for "${fileName}".`);
}
