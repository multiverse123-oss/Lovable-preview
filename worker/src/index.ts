import express from 'express';
import { createClient } from './redis-client';
import { AppManager } from './app-manager';
import { createPreviewProxy } from './reverse-proxy';
import { UserApp } from '../../shared/types';

const app = express();
const redis = createClient();
const appManager = new AppManager();

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        runningApps: Array.from(appManager['apps'].keys()),
        timestamp: new Date().toISOString()
    });
});

// Use the reverse proxy for all preview requests
app.use(createPreviewProxy(appManager));

// Listen for new app creation requests from Redis
redis.subscribe('app:create', (err, count) => {
    if (err) console.error('Failed to subscribe:', err);
    else console.log(`Subscribed to app:create, ${count} total subscriptions`);
});

redis.on('message', async (channel, message) => {
    if (channel === 'app:create') {
        try {
            const { appId, appData } = JSON.parse(message);
            console.log(`📦 Received app to create: ${appId}`);
            
            // Create the real app server
            await appManager.createAppServer(appId, appData);
            
            // Notify API that app is ready
            await redis.publish(`app:ready:${appId}`, JSON.stringify({
                status: 'live',
                url: `${process.env.WORKER_PUBLIC_URL}/preview/${appId}`
            }));
        } catch (error) {
            console.error('Error creating app from message:', error);
        }
    }
});

// Cleanup expired apps every 5 minutes
setInterval(() => {
    appManager.cleanupExpiredApps();
}, 5 * 60 * 1000);

// Start the main worker server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`👷 Preview Worker running on port ${PORT}`);
    console.log(`🌍 Public URL: ${process.env.WORKER_PUBLIC_URL}`);
    console.log(`⚡ Max concurrent apps: ${process.env.MAX_CONCURRENT_APPS || 5}`);
});
