import {describe, beforeAll, it, expect, afterAll} from '@jest/globals';
import request from 'supertest';
import app from '../../index.js';
import * as db from '../../db.js';
import jwt from 'jsonwebtoken';

const cleanupTestData = async() => {
    try {
        await db.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
    } catch (error) {
        console.log('Cleanup error: ', error.message);
    }
};

const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPassword123!',
    role: 'viewer'
};

const testDesigner = {
    username: 'testdesigner',
    email: 'designer@test.com',
    password: 'DesignerPassword123!',
    role: 'designer'
};

describe('Auth Integration Tests', () => {
    let viewerToken;
    let designerToken;
    let testViewerId;
    let testDesignerId;

    beforeAll(async() => {
        await cleanupTestData();
    });

    afterAll(async() => {
        await cleanupTestData();
    });

    // Register
    describe('POST /api/auth/register', () => {
        it('should register a new viewer successfully', async() => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser);
            
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message', 'User registered successfully!');
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('id');
            expect(response.body.user).toHaveProperty('username', testUser.username);
            expect(response.body.user).toHaveProperty('email', testUser.email);
            expect(response.body.user).toHaveProperty('role', testUser.role);
            expect(response.body.user).not.toHaveProperty('password_hash');

            testViewerId = response.body.user.id;
            viewerToken = response.body.token;

            const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
            expect(decoded).toHaveProperty('id', testViewerId);
            expect(decoded).toHaveProperty('username', testUser.username);
        });

        it('should register a new designer successfully', async() => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testDesigner);
            
            expect(response.body.user).toHaveProperty('role', testDesigner.role);

            testDesignerId = response.body.user.id;
            designerToken = response.body.token;
        });

        it('should fail to register a user with duplicate email', async() => {
            const duplicateUser = {
                ...testUser,
                email: 'different@email.com'
            };
            
            const response = await request(app)
                .post('/api/auth/register')
                .send(duplicateUser);
            
            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('error', 'User already existing with this email or username!');
        });

        it('should fail to register a user with duplicate username', async() => {
            const duplicateUser = {
                ...testUser,
                username: 'differentusername'
            };
            
            const response = await request(app)
                .post('/api/auth/register')
                .send(duplicateUser);
            
            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('error', 'User already existing with this email or username!');
        });

        it('should fail to register a user with invalid email format', async() => {
            const invalidUser = {
                ...testUser,
                email: 'invalid-email',
                username: 'invalidUser'
            };
            
            const response = await request(app)
                .post('/api/auth/register')
                .send(invalidUser);
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
            expect(Array.isArray(response.body.details)).toBe(true);
        });

        it('should fail to register a user with weak password', async() => {
            const weakPasswordUser = {
                ...testUser,
                password: '123'
            };
            
            const response = await request(app)
                .post('/api/auth/register')
                .send(weakPasswordUser);
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });

        it('should fail to register a user with missing required fields', async() => {
            const incompleteUser = {
                username: 'incompleteUser'
            };
            
            const response = await request(app)
                .post('/api/auth/register')
                .send(incompleteUser);
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });
    });

    // Login
    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Login successfully!');
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('id', testViewerId);
            expect(response.body.user).toHaveProperty('username', testUser.username);
            expect(response.body.user).not.toHaveProperty('password_hash');

            const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
            expect(decoded).toHaveProperty('id', testViewerId);
        });

        it('should failt to login with invalid email', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'non-existing@example.com',
                    password: testUser.password
                });
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Invalid email or password!');
        });

        it('should failt to login with invalid password', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongPassword'
                });
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Invalid email or password!');
        });

        it('should failt to login with missing credentials', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email
                });
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });

        it('should failt to login with invalid email format', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'wrongEmailFormat',
                    password: testUser.password
                });
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });
    });

    // Logout
    describe('POST /api/auth/logout', () => {
        it('should logout successfully with valid token', async() => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${viewerToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Logout successfully!');
        });

        it('should logout successfully without token', async() => {
            const response = await request(app)
                .post('/api/auth/logout');
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Logout successfully!');
        });
    });

    // Verify token
    describe('GET /api/auth/verify', () => {
        it('should verify valid token', async() => {
            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', `Bearer ${viewerToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Token is valid!');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('id', testViewerId);
            expect(response.body.user).toHaveProperty('username', testUser.username);
        });

        it('should fail to verify with missing token', async() => {
            const response = await request(app)
                .get('/api/auth/verify');
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should fail to verify with invalid token', async() => {
            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer invalid-token');
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should fail to verify with expired token', async() => {
            const expiredToken = jwt.sign(
                {
                    id: testViewerId,
                    username: testUser.username
                },
                process.env.JWT_SECRET,
                {expiresIn: '-1h'}
            );
            
            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', `Bearer ${expiredToken}`);
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });

    // Refresh token
    describe('POST /api/auth/refresh', () => {
        it('should refresh token successfully', async() => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${viewerToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Token refreshed successfully!');
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('id', testViewerId);
            expect(response.body.user.token).not.toBe(viewerToken);
            
            const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
            expect(decoded).toHaveProperty('id', testViewerId);

            viewerToken = response.body.token;
        });

        it('should failt to refresh token without token', async() => {
            const response = await request(app)
                .post('/api/auth/refresh');
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should failt to refresh token with invalid token', async() => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', 'Bearer invalid-token');
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });

    // Forgot password
    describe('POST /api/auth/forgot-password', () => {
        it('should handle forgot password for existing user', async() => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({
                    email: testUser.email
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'If an account with this email exists, a password reset link has been sent!');
        });

        it('should handle forgot password for non-existing user', async() => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({
                    email: 'non-existing@example.com'
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'If an account with this email exists, a password reset link has been sent!');
        });

        it('should fail with invalid email format', async() => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({
                    email: 'invalid-email'
                });
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });

        it('should fail with missing email', async() => {
            const response = await request(app)
                .post('/api/auth/forgot-password')
                .send({});
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });
    });

    // Reset password
    describe('POST /api/auth/reset-password', () => {
        let resetToken;
        beforeAll(() => {
            resetToken = jwt.sign(
                {
                    id: testViewerId,
                    email: testUser.email,
                    type: 'password_reset'
                },
                process.env.JWT_SECRET,
                {expiresIn: '1h'}
            );
        });

        it('should reset password sccessfully with valid token', async() => {
            const newPassword = 'NewPassword123!';
            
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken,
                    newPassword: newPassword
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Password reset successfully! You can now login with your new password!');

            // Login with new password
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: newPassword
                });
            
            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body).toHaveProperty('token');

            testUser.password = newPassword;
        });

        it('should fail with invalid token', async() => {
            const newPassword = 'NewPassword123!';

            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: 'invalid-token',
                    newPassword: newPassword
                });
                
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Invalid or expired reset token!');
        });

        it('should fail with invalid token', async() => {
            const newPassword = 'NewPassword123!';

            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: 'invalid-token',
                    newPassword: newPassword
                });
                
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Invalid or expired reset token!');
        });

        it('should fail with expired token', async() => {
            const newPassword = 'NewPassword123!';

            const expiredToken = jwt.sign(
                {
                    id: testViewerId,
                    username: testUser.username
                },
                process.env.JWT_SECRET,
                {expiresIn: '-1h'}
            );
            
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: expiredToken,
                    newPassword: newPassword
                });
                
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Invalid or expired reset token!');
        });

        it('should fail with wrong token type', async() => {
            const newPassword = 'NewPassword123!';

            const wrongToken = jwt.sign(
                {
                    id: 1,
                    email: 'test@example.com',
                    type: 'access_token'
                },
                process.env.JWT_SECRET,
                {expiresIn: '1h'}
            );
            
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: wrongToken,
                    newPassword: newPassword
                });
                
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Invalid or expired reset token!');
        });

        it('should fail with weak password', async() => {
            const newPassword = '123';

            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken,
                    newPassword: newPassword
                });
                
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });
        
        it('should fail with missing fields', async() => {
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken,
                });
                
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
            expect(response.body).toHaveProperty('details');
        });
    });

    // Rate limiter
    describe('Rate limiting tests', () => {
        it('should respect registration rate limits', async() => {
            const promises = Array(5).fill().map((_,i) => 
                request(app)
                    .post('/api/auth/register')
                    .send({
                        username: `rateLimitTest${i}`,
                        email: `rateLimit${i}@test.com`,
                        password: 'TestPassword123!',
                        role: 'viewer'
                    })
            );

            const responses = await Promise.all(promises);

            const rateLimitResponses = responses.filter(res => res.status === 429);
            expect(rateLimitResponses.length).toBeGreaterThan(0);

            const rateLimitResponse = rateLimitResponses[0];
            expect(rateLimitResponse.body).toHaveProperty('error', 'Too many accounts created! Please try again in an hour!');
        });

        it('should respect auth rate limits', async() => {
            const promises = Array(7).fill().map(() => 
                request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'non-existing@example.com',
                        password: 'wrongPassword'
                    })
            );

            const responses = await Promise.all(promises);

            const rateLimitResponses = responses.filter(res => res.status === 429);
            expect(rateLimitResponses.length).toBeGreaterThan(0);

            const rateLimitResponse = rateLimitResponses[0];
            expect(rateLimitResponse.body).toHaveProperty('error', 'Too many authentication attempts! Please try again in 15 minutes!');
        });
    });

    // Error handler
    describe('Error handler tests', () => {
        it('should return 404 for non-existent routes', async() => {
            const response1 = await request(app)
                .get('/api/auth/non-existent-route');

            expect(response1.status).toBe(404);
            expect(response1.body).toHaveProperty('error', 'Route not found!');

            const response2 = await request(app)
                .get('/api/auth/register');

            expect(response2.status).toBe(404);
            expect(response2.body).toHaveProperty('error', 'Route not found!');

            const response3 = await request(app)
                .put('/api/auth/login');

            expect(response3.status).toBe(404);
            expect(response3.body).toHaveProperty('error', 'Route not found!');

            const response4 = await request(app)
                .delete('/api/auth/logout');

            expect(response4.status).toBe(404);
            expect(response4.body).toHaveProperty('error', 'Route not found!');

            const response5 = await request(app)
                .post('/api/auth/verify');

            expect(response5.status).toBe(404);
            expect(response5.body).toHaveProperty('error', 'Route not found!');

            const response6 = await request(app)
                .patch('/api/auth/forgot-password');

            expect(response6.status).toBe(404);
            expect(response6.body).toHaveProperty('error', 'Route not found!');
        });

        it('should handle malformed JSON', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application.json')
                .send('{"invalid": json}');
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });
});
