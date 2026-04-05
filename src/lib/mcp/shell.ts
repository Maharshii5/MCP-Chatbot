import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const workspaceRoot = process.cwd();

export async function shellExecute(command: string) {
    console.log(`[Shell Tool] Executing: ${command}`);
    try {
        const { stdout, stderr } = await execAsync(command, { cwd: workspaceRoot });
        return { stdout, stderr };
    } catch (error: any) {
        return { error: error.message, stderr: error.stderr, stdout: error.stdout };
    }
}

export async function fsReadFile(filePath: string) {
    const absolutePath = path.resolve(workspaceRoot, filePath);
    if (!absolutePath.startsWith(workspaceRoot)) {
        throw new Error('Forbidden: Path outside workspace');
    }
    console.log(`[Shell Tool] Reading: ${filePath}`);
    const content = await fs.readFile(absolutePath, 'utf-8');
    return { content };
}

export async function fsWriteFile(filePath: string, content: string) {
    const absolutePath = path.resolve(workspaceRoot, filePath);
    if (!absolutePath.startsWith(workspaceRoot)) {
        throw new Error('Forbidden: Path outside workspace');
    }
    console.log(`[Shell Tool] Writing: ${filePath}`);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    
    await fs.writeFile(absolutePath, content, 'utf-8');
    return { success: true };
}

export async function fsListDir(dirPath: string = '.') {
    const absolutePath = path.resolve(workspaceRoot, dirPath);
    if (!absolutePath.startsWith(workspaceRoot)) {
        throw new Error('Forbidden: Path outside workspace');
    }
    console.log(`[Shell Tool] Listing: ${dirPath}`);
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    return {
        entries: entries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file'
        }))
    };
}
