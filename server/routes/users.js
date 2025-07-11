import express from 'express';
import * as userController from '../controllers/userController.js';
import * as auth from '../middleware/authMiddleware.js';
import * as rateLimiter from '../middleware/rateLimiter.js';
import * as validation from '../middleware/validation.js';

const router = express.Router();

// All routes require valid token
router.use(auth.authenticateToken);

// User profile routes
// Update profile
router.put('/profile', 
    rateLimiter.apiLimiter,
    auth.requireRole(['designer', 'viewer']),
    validation.profileUpdateValidation,
    validation.validationErrorHandler,
    userController.updateProfile
);

// Change password
router.put('/change-password',
    rateLimiter.authLimiter,
    auth.requireRole(['designer', 'viewer']),
    validation.passwordChangeValidation,
    validation.validationErrorHandler,
    userController.changePassword
);

// Delete account
router.delete('/account',
    rateLimiter.apiLimiter,
    auth.requireRole(['designer', 'viewer']),
    userController.deleteAccount
);

// Admin routes
// Get all users
router.get('/',
    rateLimiter.apiLimiter,
    auth.requireAdmin,
    userController.getAllUsers
);

// Get user stats
router.get('/stats',
    rateLimiter.apiLimiter,
    auth.requireAdmin,
    userController.getUserStats
);

// Get user by id
router.get('/:id',
    rateLimiter.apiLimiter,
    auth.requireAdmin,
    userController.getUserById
);

// Update user role
router.put('/:id/role',
    rateLimiter.apiLimiter,
    auth.requireAdmin,
    validation.validators.enum('role', ['designer', 'viewer'], false),
    validation.validationErrorHandler,
    userController.updateUserRole
);

export default router;