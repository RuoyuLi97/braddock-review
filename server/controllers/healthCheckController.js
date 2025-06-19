const {testDatabaseConnection} = require('../db');
const {testS3Connection} = require('../utils//s3Client');

// Basic health check
const getHealthStatus = async (req, res) => {
    try {
        const healthData = {
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0'
        };
        res.status(200).json(healthData);
    } catch (error) {
        console.error('Health check failed: ', error);
        res.status(500).json({
            status: 'unhealthy', 
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }  
};

// Connection health check with database and s3
const getConnectionHealthStatus = async(req, res) => {
    try {
        const startTime = Date.now();
        const [dbHealth, s3Health] = await Promise.allSettled([
            testDatabaseConnection(),
            testS3Connection()
        ]);

        const responseTime = Date.now() - startTime;
        
        const healthData = {
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0',
            responseTime: `${responseTime}ms`,
            dependencies: {
                database: dbHealth.status === 'fulfilled' ? dbHealth.value : {
                    status: 'unhealthy',
                    error: dbHealth.reason?.message || 'Connection failed!'
                },
                s3: s3Health.status === 'fulfilled' ? s3Health.value : {
                    status: 'unhealthy',
                    error: s3Health.reason?.message || 'Connection failed!'
                }
            }
        };

        const isHealthy = healthData.dependencies.database.status === 'healthy' 
                            && healthData.dependencies.s3.status === 'healthy';
        healthData.status = isHealthy ? 'healthy' : 'unhealthy';
        
        const statusCode = isHealthy ? 200 : 503;
        res.status(statusCode).json(healthData);
    } catch (error) {
        console.error('Connection health check with database and s3 failed: ', error);
        res.status(500).json({
            status: 'unhealthy', 
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
};

module.exports = {
    getHealthStatus,
    getConnectionHealthStatus
};