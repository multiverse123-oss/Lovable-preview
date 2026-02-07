export interface UserApp {
    id: string;
    userId: string;
    html: string;
    css: string;
    js: string;
    backendCode?: string; // For Node.js backend if your AI generates it
    createdAt: number;
    expiresAt: number; // Auto-cleanup after 30 minutes
}

export interface PreviewSession {
    sessionId: string;
    appId: string;
    publicUrl: string; // The REAL URL users access
    status: 'creating' | 'live' | 'expired' | 'failed';
}
