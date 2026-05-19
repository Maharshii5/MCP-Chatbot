import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) console.warn('Missing PINECONE_API_KEY');
if (!process.env.PINECONE_INDEX) console.warn('Missing PINECONE_INDEX');
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) console.warn('Missing GOOGLE_GENERATIVE_AI_API_KEY');

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
});

const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || "gemini-embedding-001";
const DEFAULT_EMBEDDING_DIMENSION = Number(process.env.RAG_EMBEDDING_DIMENSION || 768);
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
let indexDimensionPromise: Promise<number> | null = null;

function getIndex() {
    const indexName = process.env.PINECONE_INDEX!;
    return pc.Index(indexName);
}

async function getIndexDimension() {
    if (!indexDimensionPromise) {
        indexDimensionPromise = pc.describeIndex(process.env.PINECONE_INDEX!).then(indexDescription => {
            if (!indexDescription.dimension) {
                throw new Error(`Pinecone index "${process.env.PINECONE_INDEX}" does not expose a dimension.`);
            }

            return indexDescription.dimension;
        });
    }

    return indexDimensionPromise;
}

async function createEmbedding(text: string, taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY') {
    const outputDimensionality = await getIndexDimension();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`, {
        method: 'POST',
        headers: {
            'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            content: {
                parts: [{ text }],
            },
            output_dimensionality: outputDimensionality || DEFAULT_EMBEDDING_DIMENSION,
            ...(taskType ? { task_type: taskType } : {}),
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini embedding request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const embedding = data?.embedding?.values;
    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(`Gemini embedding response was empty for model ${EMBEDDING_MODEL}.`);
    }

    if (embedding.length !== outputDimensionality) {
        throw new Error(`Gemini embedding dimension mismatch: expected ${outputDimensionality}, got ${embedding.length}.`);
    }

    return embedding;
}

export async function deleteDocumentVectors(userId: string, fileName: string) {
    const index = getIndex();
    await index.deleteMany({
        user_id: userId,
        fileName,
    });
}

export async function searchDocuments(userId: string, query: string, activeFileNames?: string[]) {
    const index = getIndex();

    console.log(`Searching documents for user ${userId} with query: "${query}"`);
    if (activeFileNames && activeFileNames.length > 0) {
        console.log(`Filtering to active files: ${activeFileNames.join(', ')}`);
    }

    const queryEmbedding = await createEmbedding(query, 'RETRIEVAL_QUERY');
    console.log('Query embedding generated.');

    const filter: Record<string, unknown> = { user_id: { '$eq': userId } };
    if (activeFileNames?.length === 1) {
        filter.fileName = { '$eq': activeFileNames[0] };
    } else if (activeFileNames && activeFileNames.length > 1) {
        filter.fileName = { '$in': activeFileNames };
    }

    const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 10,
        filter,
        includeMetadata: true,
    });

    console.log(`Pinecone search returned ${queryResponse.matches.length} matches.`);

    let results = queryResponse.matches.map(match => ({
        content: (match.metadata as any).text,
        fileName: (match.metadata as any).fileName,
        score: match.score,
    }));

    // Take top 5 after filtering
    results = results.slice(0, 5);

    // Get unique file names that contributed to results
    const usedFiles = [...new Set(results.map(r => r.fileName))];
    console.log(`Results came from files: ${usedFiles.join(', ')}`);

    return results;
}

export async function upsertDocument(userId: string, fileName: string, chunks: { text: string; metadata: any }[]) {
    const index = getIndex();

    console.log(`Indexing document "${fileName}" for user ${userId} (${chunks.length} chunks)...`);
    const expectedDimension = await getIndexDimension();
    await deleteDocumentVectors(userId, fileName);
    console.log(`[RAG] Cleared any existing vectors for "${fileName}" before re-indexing.`);

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
                        const embedding = await createEmbedding(chunk.text, 'RETRIEVAL_DOCUMENT');
                        console.log(`[RAG] Embedding chunk ${i + j} took ${Date.now() - start}ms`);
                        if (embedding.length !== expectedDimension) {
                            throw new Error(`Embedding dimension changed mid-run: expected ${expectedDimension}, got ${embedding.length}`);
                        }

                        return {
                            id: `${userId}_${fileName}_${i + j}`.replace(/[^a-zA-Z0-9]/g, '_'),
                            values: embedding,
                            metadata: {
                                ...chunk.metadata,
                                text: chunk.text,
                                user_id: userId,
                                fileName,
                                embeddingModel: EMBEDDING_MODEL,
                                embeddingDimension: embedding.length,
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
