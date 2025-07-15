import {describe, beforeAll, it, expect, afterAll} from '@jest/globals';
import request from 'supertest';
import app from '../../index.js';
import * as db from '../../db.js';
import 'dotenv/config';

const cleanupTestData = async() => {
    try {
        console.log('Sarting cleanup...')
        const result = await db.query('DELETE FROM users WHERE email ILIKE $1 OR username ILIKE $1', ['%test%']);
        console.log('Cleanup completed. Rows deleted: ', result.rowCount);
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

const testAdmin = {
    username: 'testadmin',
    email: process.env.ADMIN_EMAILS?.split(',')[0] || 'admin@test.com',
    password: 'AdminPassword123!',
    role: 'designer'
};

describe('User Integration Tests', () => {
    let viewerToken;
    let designerToken;
    let adminToken;
    let testViewerId;
    let testDesignerId;
    let testAdminId;

    beforeAll(async() => {
        const {isAdmin} = await import('../../utils/helpers.js');
        console.log('isAdmin result: ', isAdmin(testAdmin.email));

        const beforeCleanup = await db.query('SELECT id, email, username FROM users');
        console.log('Users before cleanup: ', beforeCleanup.rows);
        
        await cleanupTestData();

        const afterCleanup = await db.query('SELECT id, email, username FROM users');
        console.log('Users after cleanup: ', afterCleanup.rows);

        const viewerResponse = await request(app)
            .post('/api/auth/register')
            .send(testUser);

        if (viewerResponse.status !== 201) {
            throw new Error(`Failed to create viewer: ${JSON.stringify(viewerResponse.body)}`);
        }

        testViewerId = viewerResponse.body.user.id;
        viewerToken = viewerResponse.body.token;

        const designerResponse = await request(app)
            .post('/api/auth/register')
            .send(testDesigner);

        if (designerResponse.status !== 201) {
            throw new Error(`Failed to create designer: ${JSON.stringify(designerResponse.body)}`);
        }

        testDesignerId = designerResponse.body.user.id;
        designerToken = designerResponse.body.token;

        const adminResponse = await request(app)
            .post('/api/auth/register')
            .send(testAdmin);

        if (adminResponse.status !== 201) {
            throw new Error(`Failed to create admin: ${JSON.stringify(adminResponse.body)}`);
        }

        testAdminId = adminResponse.body.user.id;
        adminToken = adminResponse.body.token;

        console.log('Test users created successfully!');
        console.log('Admin email: ', testAdmin.email);
    });

    afterAll(async() => {
        await cleanupTestData();
    });
    
    // Update profile
    describe('PATCH /api/users/me/profile', () => {
        it('should update profile successfully for designer', async() => {
            const updateData = {
                username: 'newdesignername',
                email: 'newdesigner@test.com'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${designerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Profile updated successfully!');
            expect(response.body.user).toHaveProperty('username', updateData.username);
            expect(response.body.user).toHaveProperty('email', updateData.email);
            expect(response.body.user).toHaveProperty('id', testDesignerId);
        });

        it('should continue working with the same token after profile update', async() => {
            const updateData = {
                username: 'anotherdesignername'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${designerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(200);
            expect(response.body.user).toHaveProperty('username', updateData.username);
        });

        it('should update profile successfully for viewer', async() => {
            const updateData = {
                username: 'newviewername'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(200);
            expect(response.body.user).toHaveProperty('username', updateData.username);
        });

        it('should update only email successfully', async() => {
            const updateData = {
                email: 'onlyemail@test.com'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(200);
            expect(response.body.user).toHaveProperty('email', updateData.email);
            expect(response.body.user).toHaveProperty('username', 'newviewername');
        });
        
        it('should fail without authentication', async() => {
            const updateData = {
                username: 'newname'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .send(updateData);
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should fail with invalid token', async() => {
            const updateData = {
                username: 'newname'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer invalid-token`)
                .send(updateData);
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should fail with no fields to update', async() => {
            const updateData = {};

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${designerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'No valid fields to update!');
        });

        it('should fail with invalid email format', async() => {
            const updateData = {
                email: 'invalid-email'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${designerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
        });

        it('should fail with duplicate username', async() => {
            const updateData = {
                username: 'anotherdesignername'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('error', 'Username already taken!');
        });

        it('should fail with duplicate email', async() => {
            const updateData = {
                email: 'newdesigner@test.com'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(409);
            expect(response.body).toHaveProperty('error', 'Email already taken!');
        });
    });

    // Change password
    describe('PATCH /api/users/me/password', () => {
        it('should change password successfully for designer', async() => {
            const updateData = {
                currentPassword: 'DesignerPassword123!',
                newPassword: 'NewDesignerPassword123!',
                confirmPassword: 'NewDesignerPassword123!'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .set('Authorization', `Bearer ${designerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Password changed successfully!');
        });

        it('should change password successfully for viewer', async() => {
            const updateData = {
                currentPassword: 'TestPassword123!',
                newPassword: 'NewViewerPassword123!',
                confirmPassword: 'NewViewerPassword123!'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Password changed successfully!');
        });

        it('should continue working after password change', async() => {
            const updateData = {
                username: 'designerafter'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${designerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(200);
            expect(response.body.user).toHaveProperty('username', updateData.username);
        });

        it('should fail with incorrect current password', async() => {
            const updateData = {
                currentPassword: 'WrongPassword123!',
                newPassword: 'NewPassword123!',
                confirmPassword: 'NewPassword123!'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Current password is incorrect!');
        });

        it('should fail if new password same as current', async() => {
            const updateData = {
                currentPassword: 'NewViewerPassword123!',
                newPassword: 'NewViewerPassword123!',
                confirmPassword: 'NewViewerPassword123!'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'New password must be different from current password!');
        });

        it('should fail with weak password', async() => {
            const updateData = {
                currentPassword: 'NewViewerPassword123!',
                newPassword: '123',
                confirmPassword: '123'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
        });

        it('should fail with password confirmation mismatch', async() => {
            const updateData = {
                currentPassword: 'NewViewerPassword123!',
                newPassword: 'NewPassword123!',
                confirmPassword: 'DifferentPassword123!'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
        });

        it('should fail without authentication', async() => {
            const updateData = {
                currentPassword: 'TestPassword123!',
                newPassword: 'NewPassword123!',
                confirmPassword: 'NewPassword123!'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .send(updateData);
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should fail with missing required fields', async() => {
            const updateData = {
                currentPassword: 'NewViewerPassword123!',
                newPassword: 'NewPassword123!'
            };

            const response = await request(app)
                .patch('/api/users/me/password')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Validation failed!');
        });
    });

    // New Login Sessions
    describe('New login sessions', () => {
        it('should login with updated designer email & password in new sessions', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'newdesigner@test.com',
                    password: 'NewDesignerPassword123!'
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('email', 'newdesigner@test.com');
        });

        it('should login with updated viewer email & password in new session', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'onlyemail@test.com',
                    password: 'NewViewerPassword123!'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toHaveProperty('email', 'onlyemail@test.com');
        });

        it('should fail to login with old password', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'newdesigner@test.com',
                    password: 'DesignerPassword123!'
                });
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });

    // Delete account
    describe('DELETE /api/users/me', () => {
        it('should delete account successfully for viewer', async() => {
            const response = await request(app)
                .delete('/api/users/me')
                .set('Authorization', `Bearer ${viewerToken}`);
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Account deleted successfully!');
        });

        it('should fail to use deleted user token', async() => {
            const updateData = {
                username: 'shouldfail'
            };

            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send(updateData);
            
            expect(response.status).toBe(404);
        });

        it('should fail to login with deleted user credentials', async() => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'onlyemail@test.com',
                    password: 'NewViewerPassword123!'
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should fail without authentication', async() => {
            const response = await request(app)
                .delete('/api/users/me');
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });

    // Admin routes
    describe('Admin routes', () => {
        // Get all users
        describe('GET /api/users/', () => {
            it('should get all users successfully for admin', async() => {
                const response = await request(app)
                    .get('/api/users/')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('message', 'Users retrieved successfully!');
                expect(response.body).toHaveProperty('users');
                expect(response.body).toHaveProperty('pagination');
                expect(Array.isArray(response.body.users)).toBe(true);
                expect(response.body.pagination).toHaveProperty('currentPage');
                expect(response.body.pagination).toHaveProperty('totalPages');
                expect(response.body.pagination).toHaveProperty('totalCount');
            });

            it('should handle pagination parameters', async() => {
                const response = await request(app)
                    .get('/api/users/?page=1&limit=5')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(200);
                expect(response.body.pagination.currentPage).toBe(1);
                expect(response.body.pagination.limit).toBe(5);
            });

            it('should handle role filter', async() => {
                const response = await request(app)
                    .get('/api/users/?role=designer')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(200);
                expect(response.body.filters.role).toBe('designer');
            });

            it('should handle search filter', async() => {
                const response = await request(app)
                    .get('/api/users/?search=test')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(200);
                expect(response.body.filters.search).toBe('test');
            });

            it('should handle invalid pagination and limit', async() => {
                const response = await request(app)
                    .get('/api/users/?page=invalid&limit=invalid')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(200);
                expect(response.body.pagination.currentPage).toBe(1);
                expect(response.body.pagination.limit).toBe(20);
            });

            it('should fail for non-admin user', async() => {
                const response = await request(app)
                    .get('/api/users/')
                    .set('Authorization', `Bearer ${designerToken}`);
                
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('error', 'Admin access denied!');
            });
        });

        // Get user stats
        describe('Get /api/users/stats', () => {
            it('should get user statistics successfully for admin', async() => {
                const response = await request(app)
                    .get('/api/users/stats')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('message', 'User statistics retrieved successfully!');
                expect(response.body).toHaveProperty('stats');
                expect(response.body.stats).toHaveProperty('totalUsers');
                expect(response.body.stats).toHaveProperty('designers');
                expect(response.body.stats).toHaveProperty('viewers');
                expect(response.body.stats).toHaveProperty('newUsers30Days');
                expect(response.body.stats).toHaveProperty('newUsers7Days');
                expect(typeof response.body.stats.totalUsers).toBe('number');
                expect(typeof response.body.stats.designers).toBe('number');
                expect(typeof response.body.stats.viewers).toBe('number');
            });

            it('should fail for non-admin user', async() => {
                const response = await request(app)
                    .get('/api/users/stats')
                    .set('Authorization', `Bearer ${designerToken}`);
                
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('error', 'Admin access denied!');
            });
        });

        // Get user by id
        describe('GET /api/users/:id', () => {
            it('should get user by ID successfully for admin', async() => {
                const response = await request(app)
                    .get(`/api/users/${testDesignerId}`)
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('message', 'User retrieved successfully!');
                expect(response.body).toHaveProperty('user');
                expect(response.body.user).toHaveProperty('id', testDesignerId);
                expect(response.body.user).toHaveProperty('username');
                expect(response.body.user).toHaveProperty('email');
                expect(response.body.user).toHaveProperty('role');
                expect(response.body.user).toHaveProperty('isAdmin');
                expect(response.body.user).not.toHaveProperty('password_hash');
            });

            it('should return 404 for non-existent user', async() => {
                const response = await request(app)
                    .get('/api/users/99999')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(404);
                expect(response.body).toHaveProperty('error', 'User not found!');
            });

            it('should handle invalid user ID format', async() => {
                const response = await request(app)
                    .get('/api/users/invalid')
                    .set('Authorization', `Bearer ${adminToken}`);
                
                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error', 'Invalid user ID format! ID must be a positive integer!');
            });

            it('should fail for non-admin user', async() => {
                const response = await request(app)
                    .get(`/api/users/${testDesignerId}`)
                    .set('Authorization', `Bearer ${designerToken}`);
                
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('error', 'Admin access denied!');
            });
        });

        // Update user role
        describe('PATCH /api/users/:id/role', () => {
            it('should update user role successfully for admin', async() => {
                const updateData = {
                    role: 'viewer'
                };

                const response = await request(app)
                    .patch(`/api/users/${testDesignerId}/role`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);
                
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('message', 'User role updated successfully!');
                expect(response.body.user).toHaveProperty('id', testDesignerId);
                expect(response.body.user).toHaveProperty('role', 'viewer');
                expect(response.body.user).toHaveProperty('isAdmin', false);
            });

            it('should update user role back to designer', async() => {
                const updateData = {
                    role: 'designer'
                };

                const response = await request(app)
                    .patch(`/api/users/${testDesignerId}/role`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);
                
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('message', 'User role updated successfully!');
                expect(response.body.user).toHaveProperty('id', testDesignerId);
                expect(response.body.user).toHaveProperty('role', 'designer');
                expect(response.body.user).toHaveProperty('isAdmin', false);
            });

            it('should fail with invalid role', async() => {
                const updateData = {
                    role: 'invalid'
                };

                const response = await request(app)
                    .patch(`/api/users/${testDesignerId}/role`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);
                
                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
            });

            it('should fail without role field', async() => {
                const updateData = {};

                const response = await request(app)
                    .patch(`/api/users/${testDesignerId}/role`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);
                
                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
            });

            it('should fail to change admin role', async() => {
                const updateData = {
                    role: 'viewer'
                };

                const response = await request(app)
                    .patch(`/api/users/${testAdminId}/role`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);
                
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('error', 'Cannot change admin user role!');
            });

            it('should return 404 for non-existent user', async() => {
                const updateData = {
                    role: 'viewer'
                };
                
                const response = await request(app)
                    .patch('/api/users/99999/role')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(updateData);
                
                expect(response.status).toBe(404);
                expect(response.body).toHaveProperty('error', 'User not found!');
            });
            
            it('should fail for non-admin user', async() => {
                const updateData = {
                    role: 'viewer'
                };
                
                const response = await request(app)
                    .patch(`/api/users/${testDesignerId}/role`)
                    .set('Authorization', `Bearer ${designerToken}`)
                    .send(updateData);
                
                expect(response.status).toBe(403);
                expect(response.body).toHaveProperty('error', 'Admin access denied!');
            });
        });
    });

    // Rate Limiting Tests
    describe('Rate limiting', () => {
        it('should respect rate limits for profile updates', async() => {
            const promises = Array(15).fill().map((_ ,index) => 
                request(app)
                    .patch('/api/users/me/profile')
                    .set('Authorization', `Bearer ${designerToken}`)
                    .send({username: `user${Date.now()}-${index}`})
            );

            const responses = await Promise.all(promises);
            const rateLimitResponses = responses.filter(res => res.status === 429);
            
            expect(rateLimitResponses.length).toBeGreaterThan(0);
        });

        it('should respect rate limits for password change', async() => {
            const promises = Array(5).fill().map(() => 
                request(app)
                    .patch('/api/users/me/password')
                    .set('Authorization', `Bearer ${designerToken}`)
                    .send({
                        currentPassword: 'WrongPassword123!',
                        newPassword: 'NewDesignerPassword123!',
                        confirmPassword: 'NewDesignerPassword123!'
                    })
            );

            const responses = await Promise.all(promises);
            const rateLimitResponses = responses.filter(res => res.status === 429);
            
            expect(rateLimitResponses.length).toBeGreaterThan(0);
        });
    });

    // Error handler
    describe('Error handler', () => {
        it('should return 404 for non-existent routes', async() => {
            const response = await request(app)
                .put('/api/users/nonexistent')
                .set('Authorization', `Bearer ${adminToken}`);
            
            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle missing authorization header', async() => {
            const response = await request(app)
                .get('/api/users/stats');
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        it('should handle malformed authorization header', async() => {
            const response = await request(app)
                .patch('/api/users/me/profile')
                .set('Authorization', 'InvalidFormat');
            
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });
});