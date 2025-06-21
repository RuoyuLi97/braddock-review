const rateLimit = require('express-rate-limit');

// Auth limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many authentication attempts! Please try again in 15 minutes!',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`AUTH RATE LIMIT: ${req.ip} exeeded login attempts!`);
        res.status(429).json({
            error: 'Too many authentication attempts! Please try again in 15 minutes!'
        });
    }
});

// API limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests! Please try again in 15 minutes!',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Upload attempts limiter
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        error: 'Upload attempts limit exceeded! Please try again in an hour!',
        retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`UPLOAD RATE LIMIT: ${req.ip} exeeded upload attempts!`);
        res.status(429).json({
            error: 'Upload attempts limit exceeded! Please try again in an hour!'
        });
    }
});

// Registration rate limiter
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: {
        error: 'Too many accounts created! Please try again in an hour!',
        retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    authLimiter,
    apiLimiter,
    uploadLimiter,
    registerLimiter
};