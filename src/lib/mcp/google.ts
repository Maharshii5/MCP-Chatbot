import { google } from 'googleapis';
import { createClient } from '../supabase/server';

export async function getGoogleAuthClient(userId: string) {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('google_access_token, google_refresh_token, google_token_expires_at')
        .eq('id', userId)
        .single();

    if (error || !profile) {
        throw new Error('User profile not found in database. Please try signing out and signing in again.');
    }

    if (!profile.google_access_token) {
        throw new Error('No Google Access Token found. Please click the "Connect Gmail" or "Connect Calendar" icon above to authorize access.');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URL
    );

    oauth2Client.setCredentials({
        access_token: profile.google_access_token,
        refresh_token: profile.google_refresh_token,
        expiry_date: profile.google_token_expires_at ? new Date(profile.google_token_expires_at).getTime() : undefined,
    });

    // Explicitly refresh if expired
    if (profile.google_token_expires_at && new Date(profile.google_token_expires_at) <= new Date()) {
        try {
            const res = await oauth2Client.refreshAccessToken();
            const tokens = res.credentials;
            const updateData: Record<string, string | null> = {
                google_access_token: tokens.access_token || null,
                updated_at: new Date().toISOString(),
            };
            if (tokens.expiry_date) {
                updateData.google_token_expires_at = new Date(tokens.expiry_date).toISOString();
            }
            await supabase.from('profiles').update(updateData).eq('id', userId);
        } catch (err) {
            console.error('Error refreshing token:', err);
        }
    }

    // Automatically refresh if needed
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
            await supabase.from('profiles').update({
                google_access_token: tokens.access_token,
                google_refresh_token: tokens.refresh_token,
                google_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            }).eq('id', userId);
        } else {
            await supabase.from('profiles').update({
                google_access_token: tokens.access_token,
                google_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            }).eq('id', userId);
        }
    });

    return oauth2Client;
}

export async function listCalendarEvents(userId: string, params: { timeMin?: string; maxResults?: number }) {
    const auth = await getGoogleAuthClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const timeMin = params.timeMin === 'now' ? new Date().toISOString() : (params.timeMin || new Date().toISOString());
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        maxResults: params.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime',
    });
    return res.data.items;
}

export async function createCalendarEvent(userId: string, event: { summary: string; description?: string; start: string; end: string }) {
    const auth = await getGoogleAuthClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.start },
            end: { dateTime: event.end },
        },
    });
    return res.data;
}

export async function listGmailMessages(userId: string, params: { maxResults?: number; q?: string }) {
    const auth = await getGoogleAuthClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });
    const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: params.maxResults || 5,
        q: params.q,
    });

    const messages = listRes.data.messages || [];
    const detailedMessages = await Promise.all(
        messages.map(async (msg) => {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'Date']
            });
            console.log(`Debug: Fetched detail for ${msg.id}`);
            const headers = detail.data.payload?.headers || [];
            const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

            return {
                id: msg.id,
                snippet: detail.data.snippet,
                subject: getHeader('Subject'),
                from: getHeader('From'),
                date: getHeader('Date'),
            };
        })
    );
    return detailedMessages;
}

export async function getGmailMessage(userId: string, id: string) {
    const auth = await getGoogleAuthClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.messages.get({
        userId: 'me',
        id,
    });
    return res.data;
}

export async function listDriveFiles(userId: string, params: { pageSize?: number; q?: string }) {
    const auth = await getGoogleAuthClient(userId);
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        pageSize: params.pageSize || 10,
        q: params.q,
        fields: 'files(id, name, mimeType)',
    });
    return res.data.files;
}

export async function getDocContent(userId: string, documentId: string) {
    const auth = await getGoogleAuthClient(userId);
    const docs = google.docs({ version: 'v1', auth });
    const res = await docs.documents.get({ documentId });

    // Basic content extraction
    let text = '';
    res.data.body?.content?.forEach(element => {
        if (element.paragraph) {
            element.paragraph.elements?.forEach(el => {
                if (el.textRun) {
                    text += el.textRun.content;
                }
            });
        }
    });
    return text;
}
export async function createDoc(userId: string, params: { title: string; content: string }) {
    const auth = await getGoogleAuthClient(userId);
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // 1. Ensure "MCP Chatbot" folder exists
    let folderId = '';
    const folderSearch = await drive.files.list({
        q: "name = 'MCP Chatbot' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id)',
    });

    if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id!;
    } else {
        const createFolder = await drive.files.create({
            requestBody: {
                name: 'MCP Chatbot',
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        });
        folderId = createFolder.data.id!;
    }

    // 2. Create the document
    const createRes = await docs.documents.create({
        requestBody: { title: params.title }
    });

    const documentId = createRes.data.documentId;
    if (!documentId) throw new Error('Failed to create document');

    // 3. Move document to the "MCP Chatbot" folder
    // Documents are created in root by default. We need to remove from root and add to folder.
    const file = await drive.files.get({
        fileId: documentId,
        fields: 'parents'
    });
    const previousParents = file.data.parents?.join(',') || '';

    await drive.files.update({
        fileId: documentId,
        addParents: folderId,
        removeParents: previousParents,
        fields: 'id, parents'
    });

    // 4. Insert content
    await docs.documents.batchUpdate({
        documentId,
        requestBody: {
            requests: [
                {
                    insertText: {
                        location: { index: 1 },
                        text: params.content
                    }
                }
            ]
        }
    });

    return {
        documentId,
        title: params.title,
        folderName: 'MCP Chatbot',
        location: 'My Drive → MCP Chatbot',
        webViewLink: `https://docs.google.com/document/d/${documentId}/edit`
    };
}
