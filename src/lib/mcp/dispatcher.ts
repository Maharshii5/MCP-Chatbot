import {
    listCalendarEvents,
    createCalendarEvent,
    listGmailMessages,
    getGmailMessage,
    listDriveFiles,
    getDocContent,
    createDoc
} from './google';
import { searchWeb } from '../search/tavily';
import { searchDocuments } from '../rag/pinecone';
import { generateImage } from './image';
import { fsReadFile, fsWriteFile, fsListDir, shellExecute } from './shell';

export async function dispatchToolCall(userId: string, functionName: string, args: any, activeFileNames?: string[]) {
    console.log(`Dispatching tool call: ${functionName}`, args);

    switch (functionName) {
        case 'google_calendar_list_events':
            return await listCalendarEvents(userId, args);
        case 'google_calendar_create_event':
            return await createCalendarEvent(userId, args);
        case 'google_gmail_list_messages':
            return await listGmailMessages(userId, args);
        case 'google_gmail_get_message':
            return await getGmailMessage(userId, args.id);
        case 'google_drive_list_files':
            return await listDriveFiles(userId, args);
        case 'google_docs_get_content':
            return await getDocContent(userId, args.documentId);
        case 'google_docs_create':
            return await createDoc(userId, args);
        case 'web_search':
            return await searchWeb(args.query);
        case 'document_search':
            return await searchDocuments(userId, args.query, activeFileNames);
        case 'image_generate':
            return await generateImage(args.prompt, args.aspectRatio);
        case 'fs_read_file':
            return await fsReadFile(args.filePath);
        case 'fs_write_file':
            return await fsWriteFile(args.filePath, args.content);
        case 'fs_list_dir':
            return await fsListDir(args.dirPath);
        case 'shell_execute':
            return await shellExecute(args.command);
        default:
            throw new Error(`Unknown tool: ${functionName}`);
    }
}
