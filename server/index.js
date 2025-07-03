import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import {fileURLToPath} from 'url';

// import middleware
import securityMiddleware from './middleware/security.js';
import {apiLimiter} from './middleware/rateLimiter.js';

// Import routes
import healthRoutes from './routes/healthCheck.js';
import routes from './routes/routes.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Apply security middleware first
securityMiddleware(app);

app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// API routes
app.use('/api/healthcheck', healthRoutes);
app.use('/api', routes);

// Error handling middleware
app.use((req, res) => {
    res.status(404).json({error: 'Route not found!'});
});

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`API endpoints:`)
        console.log(`   Health check: http://localhost:${PORT}/api/healthcheck`);
        console.log(`   Authentication: http://localhost:${PORT}/api/auth`);
        console.log(`   Users: http://localhost:${PORT}/api/users`);
        console.log(`   Designs: http://localhost:${PORT}/api/designs`);
        console.log(`   Design Blocks: http://localhost:${PORT}/api/design-blocks`);
        console.log(`   Media: http://localhost:${PORT}/api/media`);
        console.log(`   Block Media: http://localhost:${PORT}/api/block-media`);
        console.log(`   Tags: http://localhost:${PORT}/api/tags`);
        console.log(`   Comments: http://localhost:${PORT}/api/comments`);
    });
}

export default app;