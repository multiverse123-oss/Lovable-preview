import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from './redis-client';
import { UserApp, PreviewSession } from '../shared/types';

const app = express();
const redis = createClient();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // For large app code

// 1. Endpoint to CREATE a real, working app preview
app.post('/api/preview/create', async (req, res) => {
    try {
        const { userId, html, css, js, backendCode } = req.body;
        
        // Generate unique IDs
        const appId = `app_${uuidv4().substr(0, 8)}`;
        const sessionId = `session_${uuidv4().substr(0, 8)}`;
        
        // Create the user app object
        const userApp: UserApp = {
            id: appId,
            userId,
            html,
            css,
            js,
            backendCode,
            createdAt: Date.now(),
            expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes
        };

        // Store app in Redis
        await redis.setex(`app:${appId}`, 1800, JSON.stringify(userApp));
        
        // Create preview session
        const previewUrl = `${process.env.WORKER_PUBLIC_URL}/preview/${appId}`;
        const session: PreviewSession = {
            sessionId,
            appId,
            publicUrl: previewUrl,
            status: 'creating'
        };
        
        await redis.setex(`session:${sessionId}`, 1800, JSON.stringify(session));
        
        // Notify worker to prepare this app (via Redis pub/sub)
        await redis.publish('app:create', JSON.stringify({
            appId,
            appData: userApp
        }));

        console.log(`🎬 Created REAL app: ${appId} for user: ${userId}`);
        console.log(`🔗 Public URL: ${previewUrl}`);

        res.json({
            success: true,
            sessionId,
            appId,
            previewUrl, // The REAL URL for the user's working app
            expiresAt: userApp.expiresAt,
            message: 'Your real, interactive app is being created...'
        });

    } catch (error) {
        console.error('Error creating app:', error);
        res.status(500).json({ success: false, error: 'Failed to create app' });
    }
});

// 2. Check app status
app.get('/api/preview/status/:sessionId', async (req, res) => {
    const session = await redis.get(`session:${req.params.sessionId}`);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(JSON.parse(session));
});

// 3. Extend app lifetime (if user keeps interacting)
app.post('/api/preview/extend/:appId', async (req, res) => {
    const app = await redis.get(`app:${req.params.appId}`);
    if (!app) return res.status(404).json({ error: 'App not found' });
    
    const appData: UserApp = JSON.parse(app);
    appData.expiresAt = Date.now() + 30 * 60 * 1000;
    
    await redis.setex(`app:${req.params.appId}`, 1800, JSON.stringify(appData));
    res.json({ success: true, newExpiresAt: appData.expiresAt });
});

app.listen(process.env.PORT || 10000, () => {
    console.log(`🚀 Preview API running on port ${process.env.PORT || 10000}`);
    console.log(`🔗 Worker URL: ${process.env.WORKER_PUBLIC_URL}`);
});
