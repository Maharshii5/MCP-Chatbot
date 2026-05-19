// Polyfills required by pdfjs-dist in Node.js / Next server environment.
if (typeof globalThis !== 'undefined') {
    (globalThis as any).DOMMatrix = (globalThis as any).DOMMatrix || class { };
    (globalThis as any).ImageData = (globalThis as any).ImageData || class { };
    (globalThis as any).Path2D = (globalThis as any).Path2D || class { };
    (globalThis as any).Canvas = (globalThis as any).Canvas || class { };
}

import mammoth from 'mammoth';

async function parsePdf(buffer: Buffer): Promise<string> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const documentParams: any = {
        data: new Uint8Array(buffer),
        disableWorker: true,
        useWorkerFetch: false,
        isEvalSupported: false,
    };
    const loadingTask = pdfjs.getDocument(documentParams);

    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => ('str' in item ? item.str : ''))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (pageText) {
            pages.push(pageText);
        }
    }

    await pdf.destroy();
    return pages.join('\n\n');
}

export async function parseDocument(buffer: Buffer, mimeType: string, fileName?: string): Promise<string> {
    try {
        const type = mimeType || (fileName?.endsWith('.pdf') ? 'application/pdf' : 
                                  fileName?.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 
                                  'text/plain');

        console.log(`[Parser] Attempting to parse ${fileName || 'unnamed'} as ${type}`);

        if (type === 'application/pdf') {
            console.log('Parsing PDF content...');
            const content = await parsePdf(buffer);
            if (content.trim().length === 0) {
                console.warn('PDF parsed but returned no text! (Might be an image-only PDF)');
                return "This PDF appears to be an image or scanned document without selectable text. MCP cannot read image-only PDFs yet.";
            }
            return content;
        } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log('Parsing DOCX content...');
            const res = await mammoth.extractRawText({ buffer });
            return res.value;
        } else if (type === 'text/plain' || type === 'text/markdown' || fileName?.endsWith('.md') || fileName?.endsWith('.txt')) {
            return buffer.toString('utf-8');
        } else {
            console.warn(`Fallback: Treating unknown type ${type} as plain text`);
            return buffer.toString('utf-8');
        }
    } catch (err: any) {
        console.error('Error in parseDocument:', err);
        throw new Error(`Parsing failed: ${err.message}`);
    }
}

export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
    if (!text || text.trim().length === 0) return ["(Empty Document)"];

    // Safety check: chunkSize must be greater than overlap
    const actualChunkSize = Math.max(chunkSize, 201);
    const actualOverlap = Math.min(overlap, actualChunkSize - 100);

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + actualChunkSize, text.length);
        chunks.push(text.slice(start, end));
        if (end === text.length) break;
        start += (actualChunkSize - actualOverlap);
    }

    return chunks;
}
