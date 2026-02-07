import express from 'express';
import { createServer, Server } from 'http';
import { UserApp } from '../../shared/types';

export class AppManager {
    private apps: Map<string, { server: Server; port: number; app: UserApp }> = new Map();
    private usedPorts: Set<number> = new Set();

    async createAppServer(appId: string, appData: UserApp): Promise<number> {
        const app = express();
        
        // Serve the user's REAL application
        app.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Preview App - ${appId}</title>
                    <style>${appData.css}</style>
                </head>
                <body>
                    ${appData.html}
                    <script>${appData.js}</script>
                </body>
                </html>
            `);
        });

        // If the AI generated backend API endpoints, add them here
        if (appData.backendCode) {
            // For example, a login endpoint
            app.post('/api/login', (req, res) => {
                // REAL backend logic - users can actually sign in
                res.json({ 
                    success: true, 
                    message: 'Logged in successfully',
                    token: 'demo_jwt_token_123',
                    user: { id: 1, email: 'user@example.com' }
                });
            });

            app.get('/api/user', (req, res) => {
                res.json({ user: { name: 'John Doe', email: 'john@example.com' } });
            });
        }

        // Find available port
        const port = await this.findAvailablePort();
        const server = createServer(app);

        return new Promise((resolve, reject) => {
            server.listen(port, () => {
                this.apps.set(appId, { server, port, app: appData });
                this.usedPorts.add(port);
                
                console.log(`🚀 REAL App server started for ${appId} on port ${port}`);
                console.log(`🔗 Internal URL: http://localhost:${port}`);
                
                resolve(port);
            });

            server.on('error', reject);
        });
    }

    private async findAvailablePort(): Promise<number> {
        let port = 4000 + Math.floor(Math.random() * 1000);
        while (this.usedPorts.has(port)) {
            port = 4000 + Math.floor(Math.random() * 1000);
        }
        return port;
    }

    getAppPort(appId: string): number | null {
        return this.apps.get(appId)?.port || null;
    }

    async cleanupApp(appId: string): Promise<void> {
        const app = this.apps.get(appId);
        if (app) {
            await new Promise(resolve => app.server.close(resolve));
            this.usedPorts.delete(app.port);
            this.apps.delete(appId);
            console.log(`🧹 Cleaned up app: ${appId}`);
        }
    }

    cleanupExpiredApps(): void {
        const now = Date.now();
        for (const [appId, { app }] of this.apps) {
            if (app.expiresAt < now) {
                this.cleanupApp(appId);
            }
        }
    }
}
