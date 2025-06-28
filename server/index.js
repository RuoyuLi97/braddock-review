import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import {fileURLToPath} from 'url';

// Import routes
import healthRoutes from './routes/healthCheck.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/healthcheck', healthRoutes);

// Error handling middleware
app.use((req, res) => {
    res.status(404).json({error: 'Route not found!'});
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`API endpoints:`)
        console.log(`   Health check: http://localhost:${PORT}/api/healthcheck`);
    });
}

export default app;