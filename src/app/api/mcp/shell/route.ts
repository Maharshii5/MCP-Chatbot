import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { createClient } from '@/lib/supabase/server';

const execAsync = promisify(exec);

/**
 * API Route for the Local Shell MCP.
 * Allows reading, writing, and executing commands in the local codebase.
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { type, payload } = body;

        const workspaceRoot = process.cwd();

        switch (type) {
            case 'shell_execute': {
                const { command } = payload;
                console.log(`[Shell MCP] Executing: ${command}`);
                const { stdout, stderr } = await execAsync(command, { cwd: workspaceRoot });
                return NextResponse.json({ stdout, stderr });
            }

            case 'fs_read_file': {
                const { filePath } = payload;
                const absolutePath = path.resolve(workspaceRoot, filePath);
                
                // Security check to prevent reading outside workspace
                if (!absolutePath.startsWith(workspaceRoot)) {
                    throw new Error('Forbidden: Path outside workspace');
                }

                console.log(`[Shell MCP] Reading: ${filePath}`);
                const content = await fs.readFile(absolutePath, 'utf-8');
                return NextResponse.json({ content });
            }

            case 'fs_write_file': {
                const { filePath, content } = payload;
                const absolutePath = path.resolve(workspaceRoot, filePath);

                if (!absolutePath.startsWith(workspaceRoot)) {
                    throw new Error('Forbidden: Path outside workspace');
                }

                console.log(`[Shell MCP] Writing: ${filePath}`);
                await fs.writeFile(absolutePath, content, 'utf-8');
                return NextResponse.json({ success: true });
            }

            case 'fs_list_dir': {
                const { dirPath = '.' } = payload;
                const absolutePath = path.resolve(workspaceRoot, dirPath);

                if (!absolutePath.startsWith(workspaceRoot)) {
                    throw new Error('Forbidden: Path outside workspace');
                }

                console.log(`[Shell MCP] Listing: ${dirPath}`);
                const entries = await fs.readdir(absolutePath, { withFileTypes: true });
                const list = entries.map(entry => ({
                    name: entry.name,
                    type: entry.isDirectory() ? 'directory' : 'file'
                }));
                return NextResponse.json({ entries: list });
            }

            default:
                return NextResponse.json({ error: 'Invalid operation type' }, { status: 400 });
        }
    } catch (err: any) {
        console.error('[Shell MCP Error]:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
