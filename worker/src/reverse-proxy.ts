import { createProxyMiddleware } from 'http-proxy-middleware';
import { RequestHandler } from 'express';
import { AppManager } from './app-manager';

export function createPreviewProxy(appManager: AppManager): RequestHandler {
    return (req, res, next) => {
        // Extract appId from URL: /preview/{appId}/...
        const pathParts = req.path.split('/');
        if (pathParts[1] === 'preview' && pathParts[2]) {
            const appId = pathParts[2];
            const port = appManager.getAppPort(appId);
            
            if (port) {
                // Proxy to the specific app's server
                return createProxyMiddleware({
                    target: `http://localhost:${port}`,
                    changeOrigin: true,
                    pathRewrite: (path) => {
                        // Remove /preview/{appId} prefix
                        return path.replace(`/preview/${appId}`, '');
                    }
                })(req, res, next);
            }
        }
        
        // No matching app, return 404
        res.status(404).json({ error: 'Preview app not found or expired' });
    };
}
