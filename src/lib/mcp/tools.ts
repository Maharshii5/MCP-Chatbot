import { ChatCompletionTool } from "groq-sdk/resources/chat/completions";

export const MCP_TOOLS: ChatCompletionTool[] = [
    // Google Calendar
    {
        type: "function",
        function: {
            name: "google_calendar_list_events",
            description: "List upcoming events from Google Calendar",
            parameters: {
                type: "object",
                properties: {
                    timeMin: { type: "string", description: "ISO string for the minimum time to search from" },
                    maxResults: { type: "number", description: "Maximum number of events to return" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "google_calendar_create_event",
            description: "Create a new event in Google Calendar",
            parameters: {
                type: "object",
                required: ["summary", "start", "end"],
                properties: {
                    summary: { type: "string", description: "Event title" },
                    description: { type: "string", description: "Event description" },
                    start: { type: "string", description: "Start time (ISO string)" },
                    end: { type: "string", description: "End time (ISO string)" },
                },
            },
        },
    },
    // Google Gmail
    {
        type: "function",
        function: {
            name: "google_gmail_list_messages",
            description: "List recent emails from Gmail",
            parameters: {
                type: "object",
                properties: {
                    maxResults: { type: "number", description: "Maximum number of messages to return" },
                    q: { type: "string", description: "Query string for searching emails" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "google_gmail_get_message",
            description: "Get the content of a specific email by ID",
            parameters: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string", description: "The ID of the Gmail message" },
                },
            },
        },
    },
    // Google Drive
    {
        type: "function",
        function: {
            name: "google_drive_list_files",
            description: "List files from Google Drive",
            parameters: {
                type: "object",
                properties: {
                    pageSize: { type: "number", description: "Maximum number of files to return" },
                    q: { type: "string", description: "Query string for searching files" },
                },
            },
        },
    },
    // Google Docs
    {
        type: "function",
        function: {
            name: "google_docs_get_content",
            description: "Get the text content of a Google Doc",
            parameters: {
                type: "object",
                required: ["documentId"],
                properties: {
                    documentId: { type: "string", description: "The ID of the Google Doc" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "google_docs_create",
            description: "Create a new Google Doc with specified title and content",
            parameters: {
                type: "object",
                required: ["title", "content"],
                properties: {
                    title: { type: "string", description: "Title of the new document" },
                    content: { type: "string", description: "Initial text content of the document" },
                },
            },
        },
    },
    // Web Search
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for real-time information, latest news, current stock prices, weather, or any data beyond the model's training cutoff. Use this whenever the user asks for 'today's' or 'current' information.",
            parameters: {
                type: "object",
                required: ["query"],
                properties: {
                    query: { type: "string", description: "The search query (e.g., 'Nvidia stock price today')" },
                },
            },
        },
    },
    // RAG Search
    {
        type: "function",
        function: {
            name: "document_search",
            description: "Search inside the user's uploaded documents",
            parameters: {
                type: "object",
                required: ["query"],
                properties: {
                    query: { type: "string", description: "The query to search in documents" },
                },
            },
        },
    },
    // Local Shell MCP (Autonomous Engineer)
    {
        type: "function",
        function: {
            name: "fs_read_file",
            description: "Read the content of a local file in the workspace. Use this to examine code before editing.",
            parameters: {
                type: "object",
                required: ["filePath"],
                properties: {
                    filePath: { type: "string", description: "Relative path to the file (e.g., 'src/app/page.tsx')" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "fs_write_file",
            description: "Write content to a local file. Use this to implement new features, fix bugs, or add comments.",
            parameters: {
                type: "object",
                required: ["filePath", "content"],
                properties: {
                    filePath: { type: "string", description: "Relative path to the file" },
                    content: { type: "string", description: "Complete content to write to the file" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "fs_list_dir",
            description: "List the contents of a directory in the workspace.",
            parameters: {
                type: "object",
                properties: {
                    dirPath: { type: "string", description: "Relative path to the directory (default: '.')" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "shell_execute",
            description: "Execute a shell command in the workspace terminal (e.g., 'npm test', 'git status', 'ls -la').",
            parameters: {
                type: "object",
                required: ["command"],
                properties: {
                    command: { type: "string", description: "The shell command to run" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "image_generate",
            description: "Generate a synthetic image from a text description. Use this when the user asks for an image, drawing, or visual representation.",
            parameters: {
                type: "object",
                required: ["prompt"],
                properties: {
                    prompt: { type: "string", description: "Detailed description of the image to generate" },
                    aspectRatio: { 
                        type: "string", 
                        description: "The aspect ratio of the image",
                        enum: ["1:1", "16:9", "4:3", "3:4"]
                    },
                },
            },
        },
    }
];
