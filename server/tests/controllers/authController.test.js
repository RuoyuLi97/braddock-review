import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import 'dotenv/config';

jest.unstable_mockModule('../../db.js', () => ({
    query: jest.fn()
}));

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let query;
let authController;

beforeAll(async() => {
    const db = await import('../../db.js');
    query = db.query;
    authController = await import('../../controllers/authController.js');
})

describe('Auth Controller Unit Tests', () => {
    let mockReq, mockRes;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {body: {}, user: {}, ip: '127.0.0.1'};
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Register
    describe('Register', () => {
        it('should create user with password hashing', async() => {
            mockReq.body = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!',
                role: 'designer'
            };

            query.mockResolvedValueOnce({rows: []});
            query.mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    username: 'testuser',
                    email: 'test@example.com',
                    role: 'designer',
                    created_at: new Date()
                }]
            });

            await authController.register(mockReq, mockRes);

            const registerCall = query.mock.calls[1];
            const hashedPassword = registerCall[1][2];

            expect(hashedPassword).not.toBe('TestPass123!');
            expect(hashedPassword).toMatch(/^\$2[aby]\$\d+\$/);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            
            const responseCall = mockRes.json.mock.calls[0][0];
            expect(responseCall.token).toBeDefined();
            
            const decoded = jwt.verify(responseCall.token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe(1);
            expect(decoded.email).toBe('test@example.com');
            expect(decoded.role).toBe('designer');
        });

        it('should return 409 if user already exists', async() => {
            mockReq.body = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPass123!',
                role: 'designer'
            };

            query.mockResolvedValueOnce({rows: [{id: 1}]});

            await authController.register(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(409);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User already existing with this email or username!'
            });
        });
    });

    // Login
    describe('Login', () => {
        it('should login successfully with valid credentials', async() => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'TestPass123!'
            };

            const plainPassword = 'TestPass123!';
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
            const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                password_hash: hashedPassword,
                role: 'designer'
            };

            query.mockResolvedValueOnce({rows: [mockUser]});

            await authController.login(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Login successfully!',
                    token: expect.any(String),
                    user: expect.objectContaining({
                        id: 1,
                        username: 'testuser',
                        email: 'test@example.com',
                        role: 'designer'
                    })
                })
            );

            const responseCall = mockRes.json.mock.calls[0][0];
            const decoded = jwt.verify(responseCall.token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe(1);
            expect(decoded.username).toBe('testuser');
        });

        it('should return 401 for non-existent user', async() => {
            mockReq.body = {
                email: 'nonexistent@example.com',
                password: 'TestPass123!'
            };

            query.mockResolvedValueOnce({rows: []});

            await authController.login(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid email or password!'
            });
        });

        it('should return 401 for wrong password', async() => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'WrongPassword!'
            };

            const correctPassword = 'TestPass123!';
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
            const hashedPassword = await bcrypt.hash(correctPassword, saltRounds);

            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
                password_hash: hashedPassword,
                role: 'designer'
            };

            query.mockResolvedValueOnce({rows: [mockUser]});

            await authController.login(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid email or password!'
            });
        });
    });

    // Logout
    describe('Logout', () => {
        it('should logout successfully', async() => {
            mockReq.user = {
                id: 1,
                username: 'testuser'
            };

            await authController.logout(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Logout successfully!'
            });
            expect(console.log).toHaveBeenCalledWith(
                'LOGOUT SUCCESS: User testuser (1) logged out from 127.0.0.1'
            );
        });

        it('should handle logout without user', async() => {
            mockReq.user = null;

            await authController.logout(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Logout successfully!'
            });
        });
    });

    // Refresh JWT token
    describe('Refresh JWT token', () => {
        it('should refresh jwt token for authenticated user', async() => {
            mockReq.user = {
                userId: 1,
                username: 'testuser',
                email: 'test@example.com',
                role: 'designer'
            };

            await authController.refreshToken(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Token refreshed successfully!',
                    token: expect.any(String),
                    user: expect.objectContaining({
                        id: 1,
                        username: 'testuser',
                        email: 'test@example.com',
                        role: 'designer'
                    })
                })
            );

            const responseCall = mockRes.json.mock.calls[0][0];
            const decoded = jwt.verify(responseCall.token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe(1);
            expect(decoded.role).toBe('designer');
        });
    });

    // Verify token
    describe('Verify token', () => {
        it('should verify valid token', async() => {
            mockReq.user = {
                userId: 1,
                username: 'testuser',
                email: 'test@example.com',
                role: 'designer'
            };

            await authController.verifyToken(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Token is valid!',
                    user: expect.objectContaining({
                        id: 1,
                        username: 'testuser',
                        email: 'test@example.com',
                        role: 'designer'
                    })
                })
            );
        });
    });

    // Forgot password
    describe('Forgot password', () => {
        it('should handle forgot password for existing user', async() => {
            mockReq.body = {
                email: 'test@example.com',
            };

            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com'
            };

            query.mockResolvedValueOnce({rows: [mockUser]});

            await authController.forgotPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'If an account with this email exists, a password reset link has been sent!'
            });
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining(`Reset URL would be: ${process.env.CORS_ORGIN}/reset-password?token=`)
            );
        });

        it('should handle forgot password for non-existing user', async() => {
            mockReq.body = {
                email: 'nonexisting@example.com',
            };

            query.mockResolvedValueOnce({rows: []});

            await authController.forgotPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'If an account with this email exists, a password reset link has been sent!'
            });
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('PASSWORD RESET REQUESTED: No user found with email nonexisting@example.com from 127.0.0.1')
            );
        });
    });

    // Reset password
    describe('Reset password', () => {
        it('should reset password with valid token', async() => {
            const resetToken = jwt.sign(
                {
                    userId: 1,
                    email: 'test@example.com',
                    type: 'password_reset'
                },
                process.env.JWT_SECRET,
                {expiresIn: '1h'}
            );

            mockReq.body = {
                token: resetToken,
                newPassword: 'NewPassword123!'
            };

            const mockUser = {
                id: 1,
                username: 'testuser',
                email: 'test@example.com'
            };

            query.mockResolvedValueOnce({rows: [mockUser]});
            query.mockResolvedValueOnce({});

            await authController.resetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Password reset successfully! You can now login with your new password!'
            });

            const updateCall = query.mock.calls[1];
            const newHashedPassword = updateCall[1][0];
            expect(newHashedPassword).not.toBe('NewPassword123!');
            expect(newHashedPassword).toMatch(/^\$2[aby]\$\d+\$/);
        });

        it('should reject invalid token', async() => {
            mockReq.body = {
                token: 'invalid-token',
                newPassword: 'NewPassword123!'
            };

            await authController.resetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid or expired reset token!'
            });
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('PASSWORD RESET FAILED: Invalid token from 127.0.0.1')
            );
        });

        it('should reject wrong token type', async() => {
            const wrongToken = jwt.sign(
                {
                    userId: 1,
                    email: 'test@example.com',
                    type: 'access_token'
                },
                process.env.JWT_SECRET,
                {expiresIn: '1h'}
            );
            
            mockReq.body = {
                token: wrongToken,
                newPassword: 'NewPassword123!'
            };

            await authController.resetPassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid or expired reset token!'
            });
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('PASSWORD RESET FAILED: Invalid token from 127.0.0.1')
            );
        });
    });
});
