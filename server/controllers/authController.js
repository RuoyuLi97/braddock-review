import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {query} from '../db.js';
import 'dotenv/config';

// Register
const register = async(req, res) => {
    try {
        const {username, email, password, role} = req.body;

        // Check existing user
        const existingUser = await query(
            `SELECT id FROM users WHERE email = $1 OR username = $2`,
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'User already existing with this email or username!'
            });
        }

        // Hash password
        const saltRound = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRound);

        // Create user
        const result = await query(
            `INSERT INTO users (username, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, role, created_at`,
            [username, email, passwordHash, role]
        );

        const user = result.rows[0];

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {expiresIn: process.env.JWT_EXPIRES_IN || '24h'}
        );

        console.log(`REGISTRATION SUCCESS: User ${user.username} (${user.id}) registered with role ${user.role} from ${req.ip}`);

        res.status(201).json({
            message: 'User resgistered successfully!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                createdAt: user.created_at
            },
            token
        });
    } catch (error) {
        console.error('Registration failed: ', error);
        res.status(500).json({
            error: 'Registration failed!',
            details: process.env.LOG_LEVEL === 'debug' ? error.message: 'Server error occurred during registration!'
        });
    }
};

// Login
const login = async(req, res) => {
    try {
        const {email, password} = req.body;

        const result = await query(
            `SELECT id, username, email, password_hash, role FROM users WHERE email = $1`,
            [email]
        );

        const user = result.rows[0];

        // Check existing user
        if (!user) {
            console.warn(`LOGIN FAILED: No user found with email ${email} from ${req.ip}`);
            return res.status(401).json({
                error: 'Invalid email or password!'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            console.warn(`LOGIN FAILED: Invalid password for user ${user.username} (${user.id}) from ${req.ip}`);
            return res.status(401).json({
                error: 'Invalid email or password!'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {expiresIn: process.env.JWT_EXPIRES_IN || '24h'}
        );

        console.log(`LOGIN SUCCESS: User ${user.username} (${user.id}) logged in from ${req.ip}`);

        res.status(200).json({
            message: 'Login successfully!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                createdAt: user.created_at
            },
            token
        });
    } catch (error) {
        console.error('Login failed: ', error);
        res.status(500).json({
            error: 'Login failed!',
            details: process.env.LOG_LEVEL === 'debug' ? error.message: 'Server error occurred during login!'
        });
    }
};

// Logout
const logout = async(req, res) => {
    try {
        // Check the logged in user
        if (req.user) {
            console.log(`LOGOUT SUCCESS: User ${req.user.username} (${req.user.id}) logged out from ${req.ip}`);
        }

        res.status(200).json({
            message: 'Logout successfully!'
        });
    } catch (error) {
        console.error('Logout failed!');
        res.status(500).json({
            error: 'Logout failed!',
            details: process.env.LOG_LEVEL === 'debug' ? error.message: 'Server error occurred during logout!'
        });
    }
};

// Refresh JWT token
const refreshToken = async(req, res) => {
    try {
        // Check the logged in user
        const {userId, username, email, role} = req.user;

        const newToken = jwt.sign(
            {
                userId,
                username,
                email,
                role
            },
            process.env.JWT_SECRET,
            {expiresIn: process.env.JWT_EXPIRES_IN || '24h'}
        );

        console.log(`TOKEN REFRESH SUCCESS: User ${username} (${userId}) refreshed token from ${req.ip}`);
        
        res.status(200).json({
            message: 'Token refreshed successfully!',
            user: {
                id: userId,
                username,
                email,
                role
            },
            token: newToken
        });
    } catch (error) {
        console.error('Token refresh failed!');
        res.status(500).json({
            error: 'Token refresh failed!',
            details: process.env.LOG_LEVEL === 'debug' ? error.message: 'Server error occurred during token refresh!'
        });
    }
};

// Verify token
const verifyToken = async(req, res) => {
    try {
        const {userId, username, email, role} = req.user;

        res.status(200).json({
            message: 'Token is valid!',
            user: {
                id: userId,
                username, 
                email,
                role
            }
        });
    } catch (error) {
        console.error('Token verification failed: ', error);
        res.status(500).json({
            error: 'Token verification failed!',
            details: process.env.LOG_LEVEL === 'debug' ? error.message: 'Server error occurred during token verification'
        });
    }
};

// Forgot password
const forgotPassword = async(req, res) => {
    try {
        const {email} = req.body;
        
        // Check existing user
        const result = await query(
            `SELECT id, username, email FROM users WHERE email = $1`,
            [email]
        );

        // Always return success to prevent email enumeration
        res.status(200).json({
            message: 'If an account with this email exists, a password reset link has been sent!'
        });

        // Generate reset token
        if (result.rows.length > 0) {
            const user = result.rows[0];
            
            const resetToken = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    type: 'password_reset'
                },
                process.env.JWT_SECRET,
                {expiresIn: '1h'}
            );

            // TODO: Create a password_resets table for store reset token in database
            console.log(`PASSWORD RESET REQUESTED: User ${user.username} (${user.id}) - Token: ${resetToken}`);
            console.log(`Reset URL would be: ${process.env.CORS_ORGIN}/reset-password?token=${resetToken}`);

            // TODO: Send actual email with reset link using AWS SES with AWS credentials
            // await sendPasswordResetEmail(user.email, user.username, resetToken);
        } else {
            console.warn(`PASSWORD RESET REQUESTED: No user found with email ${email} from ${req.ip}`);
        }
    } catch (error) {
        console.error('Forgot password failed: ', error);
        res.status(500).json({
            error: 'Forgot password failed!',
            details: process.env.LOG_LEVEL === 'debug' ? error.message: 'Server error occurred during password reset request'
        });
    }
};

// Reset password
const resetPassword = async(req, res) => {
    try {
        const {token, newPassword} = req.body;

        // Verify decoded
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Verify reset token
            if (decoded.type !== 'password_reset') {
                throw new Error('Invalid token type!');
            }
        } catch (jwtError) {
            console.warn(`PASSWORD RESET FAILED: Invalid token from ${req.ip}`);
            return res.status(400).json({
                error: 'Invalid or expired reset token!'
            });
        }

        // Check existing user
        const userResult = await query(
            `SELECT id, username, email FROM users WHERE id = $1 AND email = $2`,
            [decoded.userId, decoded.email]
        );

        if (userResult.rows.length === 0) {
            console.warn(`PASSWORD RESET FAILED: User not found for token from ${req.ip}`);
            return res.status(400).json({
                error: 'Invalid reset token!'
            });
        }

        const user = userResult.rows[0];

        // Hash new password
        const saltRound = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRound);
        
        // Update user password
        await query(
            `UPDATE users SET password_hash = $1 WHERE id = $2`,
            [newPasswordHash, user.id]
        );

        console.log(`PASSWORD RESET SUCCESS: User ${user.username} (${user.id}) reset password from ${req.ip}`);

        res.status(200).json({
            message: 'Password reset successfully! You can now login with your new password!'
        });
    } catch (error) {
        console.error('Reset password failed: ', error);
        res.status(500).json({
            error: 'Password reset failed!',
            details: process.env.LOG_LEVEL === 'debug' ? error.message: 'Server error occurred during password reset'
        });
    }
};

export {
    register,
    login,
    logout,
    refreshToken,
    verifyToken,
    forgotPassword,
    resetPassword
};