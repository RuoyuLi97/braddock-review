const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

// Authentication
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'Access denied! No authentication token provided!'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;

        console.log(`AUTH SUCCESS: User ${decoded.username} (${decoded.userId}) accessed ${req.method} ${req.path}`);

        next();
    } catch (error) {
        console.warn(`AUTH FALIED: ${req.ip} - ${error.message}`);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired! Please login again!',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                error: 'Invalid token! Please login again!',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'NotBeforeError') {
            return res.status(403).json({
                error: 'Token not active yet!',
                code: 'TOKEN_NOT_ACTIVE'
            });
        }

        return res.status(500).json({
            error: 'Authentication Failed!',
            code: 'AUTH_ERROR'
        });
    }
};

// Check auth without blocking
const checkAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            req.isAuthenticated = true;
        } else {
            req.isAuthenticated = false;
        }

        next();
    } catch (error) {
        req.isAuthenticated = false;
        next();
    }
};

// Role-based auth
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required!'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            console.warn(`AUTHORIZATION FAILED: User ${req.user.username} (${req.user.userId}) role: ${req.user.role}, required ${allowedRoles.join(' or ')}`);
            return res.status(403).json({
                error: `Access denied! Required role: ${allowedRoles.join(' or ')}`,
                userRole: req.user.role,
                requiredRoles: allowedRoles
            });
        }
        next();
    };
};

// Ownership auth
const requireOwnership = (tableName) => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params.id;
            let query;

            // Validate table name
            const allowedTables = ['designs', 'design_tags', 'design_blocks', 'media', 'block_media', 'comments'];
            if (!allowedTables.includes(tableName)) {
                return res.status(400).json({error: 'Invalid resource type!'});
            }

            // Build query based on tableName
            switch(tableName) {
                case 'designs':
                case 'media':
                case 'comments':
                    query = `SELECT * FROM ${tableName} WHERE id = $1`;
                    break;
                
                case 'design_tags':
                    query = `SELECT dt.*, d.user_id
                            FROM design_tags dt
                            JOIN designs d ON dt.design_id = d.id
                            WHERE dt.id = $1`;
                    break;
            
                case 'design_blocks':
                    query = `SELECT db.*, d.user_id
                            FROM design_blocks db
                            JOIN designs d ON db.design_id = d.id
                            WHERE db.id = $1`;
                    break;

                case 'block_media':
                    query = `SELECT bm.*, d.user_id
                            FROM block_media bm
                            JOIN design_blocks db ON bm.design_block_id = db.id
                            JOIN designs d ON db.design_id = d.id
                            WHERE bm.id = $1`;
                    break;
            }

            const result = await db.query(query, [resourceId]);

            const resource = result.rows[0];

            if (!resource) {
                const resourceName = (tableName === 'media' || tableName === 'block_media') 
                                    ? tableName.replace('_', ' ') 
                                    : tableName.slice(0, -1).replace('_', ' ');
                return res.status(404).json({
                    error: `${resourceName.replace(/^\w/, c => c.toUpperCase())} not found or you don't have access to it!`
                });
            }

            if (resource.user_id.toString() !== req.user.userId.toString()) {
                console.warn(`OWNERSHIP FAILED: User ${req.user.userId} tried to access ${tableName} ${resourceId} owned by ${resource.user_id}`);
                return res.status(403).json({
                    error: 'You can only modify your own content!'
                });
            }

            req.resource = resource;
            next();
        } catch (error) {
            console.error('Ownership check failed:', error);
            res.status(500).json({error: 'Server error!'});
        }
    };
};

module.exports = {
    authenticateToken,
    checkAuth,
    requireRole,
    requireOwnership
};