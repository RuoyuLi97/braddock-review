import express from 'express';
import * as authController from '../controllers/authController.js';
import * as auth from '../middleware/authMiddleware.js';
import * as rateLimiter from '../middleware/rateLimiter.js';
import * as validation from '../middleware/validation.js';

const router = express.Router();

// Public routes
// Registration
router.post('/register',
    rateLimiter.registerLimiter,
    validation.registerValidation,
    validation.validationErrorHandler,
    authController.register
);

// Login
router.post('/login',
    rateLimiter.authLimiter,
    validation.loginValidation,
    validation.validationErrorHandler,
    authController.login
);

// Logout
router.post('/logout',
    authController.logout
);

// Reset password
router.post('/forgot-password',
    rateLimiter.apiLimiter,
    validation.validators.email(false),
    validation.validationErrorHandler,
    authController.forgotPassword
);

router.post('/reset-password',
    rateLimiter.apiLimiter,
    [
        validation.validators.simpleText('token', 1, 500, false),
        validation.validators.password('newPassword', 'full')
    ],
    validation.validationErrorHandler,
    authController.resetPassword
);

// Private routes
// Refresh token
router.post('/refresh',
    auth.authenticateToken,
    authController.refreshToken
);

// Verify token
router.get('/verify',
    auth.authenticateToken,
    authController.verifyToken
);

export default router;