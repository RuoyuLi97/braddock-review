const {Pool} = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Set up event listeners when new database client connected/failed
pool.on('connect', (client) => {
    console.log('New database client connected!');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle database client', err);
});

// Test database connection
const testDatabaseConnection = async() => {
    try {
        const client = await pool.connet();
        const result = await client.query('SELECT NOW()');
        client.release();
        return {
            status: 'healthy', 
            message: 'Database connection succeeded!',
            timestamp: result.rows[0].now
        };
    } catch (error) {
        console.error('Database connection failed!', error.message);
        return {
            status: 'unhealthy', 
            message: 'Database connection failed!', 
            error: error.message
        };
    }
};

// Shut down the pool
const closePool = async() => {
    try {
        await pool.end();
        console.log('Database pool closed');
    } catch (error) {
        console.error('Error closing database pool: ', error);
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
    pool,
    testDatabaseConnection,
    closePool
};