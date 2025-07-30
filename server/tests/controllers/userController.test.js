import {jest, describe, it, expect, beforeAll, beforeEach, afterEach} from '@jest/globals';
import 'dotenv/config';

jest.unstable_mockModule('../../db.js', () => ({
    query: jest.fn()
}));

jest.unstable_mockModule('../../utils/helpers.js', () => ({
    isAdmin: jest.fn()
}));

import bcrypt from 'bcryptjs';

let query;
let isAdmin;
let userController;

beforeAll(async() => {
    const db = await import('../../db.js');
    query = db.query;

    const helpers = await import('../../utils/helpers.js');
    isAdmin = helpers.isAdmin;

    userController = await import('../../controllers/userController.js');
});

describe('User Controller Unit Tests', () => {
    let mockReq, mockRes;
    
    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            body: {},
            user: {id: 1, email: 'test@example.com', username: 'testuser'},
            params: {},
            query: {},
            ip: '127.0.0.1'
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    // Update profile
    describe('Update profile', () => {
        it('should update user profile successfully', async() => {
            mockReq.body = {
                username: 'newusername',
                email: 'newemail@example.com'
            };

            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: []});
            query.mockResolvedValueOnce({rows: []});
            query.mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    username: 'newusername',
                    email: 'newemail@example.com',
                    role: 'designer',
                    created_at: new Date(),
                    updated_at: new Date()
                }]
            });

            await userController.updateProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Profile updated successfully!',
                    user: expect.objectContaining({
                        id: 1,
                        username: 'newusername',
                        email: 'newemail@example.com',
                        role: 'designer'
                    })
                })
            );
        });

        it('should return 400 if no fields to update', async() => {
            mockReq.body = {};

            await userController.updateProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'No valid fields to update!'
            });
        });

        it('should return 404 if no user found', async() => {
            mockReq.body = {username: 'newusername'};
            
            query.mockResolvedValueOnce({rows: []});

            await userController.updateProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User not found!'
            });
        });

        it('should return 409 if username already taken', async() => {
            mockReq.body = {username: 'existingusername'};
            
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: [{id: 2}]});

            await userController.updateProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(409);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Username already taken!'
            });
        });

        it('should return 409 if email already taken', async() => {
            mockReq.body = {email: 'existing@example.com'};
            
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: [{id: 2}]});

            await userController.updateProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(409);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Email already taken!'
            });
        });
    });

    // Change password
    describe('Change password', () => {
        it('should change password successfully', async() => {
            mockReq.body = {
                currentPassword: 'oldpassword',
                newPassword: 'newpassword123'
            };

            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('oldpassword', 12)
            };

            query.mockResolvedValueOnce({rows: [mockUser]});
            query.mockResolvedValueOnce({rows: []});

            await userController.changePassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Password changed successfully!'
            });
        });

        it('should return 401 for incorrect current password', async() => {
            mockReq.body = {
                currentPassword: 'wrongpassword',
                newPassword: 'newpassword123'
            };

            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('oldpassword', 12)
            };

            query.mockResolvedValueOnce({rows: [mockUser]});

            await userController.changePassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Current password is incorrect!'
            });
        });

        it('should return 400 is new password same as the current one', async() => {
            mockReq.body = {
                currentPassword: 'oldpassword',
                newPassword: 'oldpassword'
            };

            const mockUser = {
                id: 1,
                username: 'testuser',
                password_hash: await bcrypt.hash('oldpassword', 12)
            };

            query.mockResolvedValueOnce({rows: [mockUser]});

            await userController.changePassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'New password must be different from current password!'
            });
        });
    });

    // Delete account
    describe('Delete account', () => {
        it('should delete account successfully', async() => {
            const mockUser = {
                id: 1,
                username: 'testuser'
            };

            query.mockResolvedValueOnce({rows: [mockUser]});
            query.mockResolvedValueOnce({});

            await userController.deleteAccount(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Account deleted successfully!'
            });
        });

        it('should return 404 if user not found', async() => {
            query.mockResolvedValueOnce({rows: []});

            await userController.deleteAccount(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User not found!'
            });
        });
    });

    // Get all users
    describe('Get all users', () => {
        beforeEach(() => {
            mockReq.user = {email: 'admin@example.com'};
        });

        it('should get all users successfully for admin', async() => {
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: [{count: '2'}]});
            query.mockResolvedValueOnce({
                rows: [
                    {id: 1, username: 'admin', email: 'admin@example.com', role: 'designer', created_at: new Date(), updated_at: new Date()},
                    {id: 2, username: 'user2', email: 'user2@example.com', role: 'viewer', created_at: new Date(), updated_at: new Date()}
                ]
            });

            isAdmin.mockReturnValueOnce(true).mockReturnValueOnce(false);
            
            await userController.getAllUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Users retrieved successfully!',
                    users: expect.arrayContaining([
                        expect.objectContaining({username: 'admin', isAdmin: true}),
                        expect.objectContaining({username: 'user2', isAdmin: false})
                    ]),
                    pagination: expect.objectContaining({
                        currentPage: 1,
                        totalPages: 1,
                        totalCount: 2
                    })
                })
            );
        });

        it('should return 404 if admin user not found', async() => {
            query.mockResolvedValueOnce({rows: []});

            await userController.getAllUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Admin user not found!'
            });
        });

        it('should return 400 for invalid limit', async() => {
            mockReq.query = {limit: '200'};

            query.mockResolvedValueOnce({rows: [{id: 1}]});
            
            await userController.getAllUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Limit must be between 1 and 100!'
            });
        });

        it('should return 400 for invalid role filter', async() => {
            mockReq.query = {role: 'invalid'};

            query.mockResolvedValueOnce({rows: [{id: 1}]});
            
            await userController.getAllUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid role filter! Must be "designer" or "viewer"!'
            });
        });

        it('should handle no users found case', async() => {
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: [{count: '0'}]});

            await userController.getAllUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'No users found matching your criteria!',
                    users: [],
                    pagination: expect.objectContaining({
                        totalPages: 0,
                        totalCount: 0
                    })
                })
            );
        });

        it('should handle out of bounds page', async() => {
            mockReq.query = {page: '10'};
            
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: [{count: '25'}]});
            query.mockResolvedValueOnce({
                rows: [
                    {id: 1, username: 'admin', email: 'admin@example.com', role: 'designer', created_at: new Date(), updated_at: new Date()}
                ]
            });

            isAdmin.mockReturnValueOnce(true).mockReturnValueOnce(false);

            await userController.getAllUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Users retrieved successfully!',
                    pagination: expect.objectContaining({
                        currentPage: 2,
                        totalPages: 2,
                    }),
                    info: expect.objectContaining({
                        message: expect.stringContaining('Requested page 10 is beyond available data'),
                        requestedPage: 10,
                        correctedTo: 2,
                        reason: 'out_of_bounds'
                    })
                })
            );
        });

        it('should handle negative page', async() => {
            mockReq.query = {page: '-1'};
            
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: [{count: '25'}]});
            query.mockResolvedValueOnce({
                rows: [
                    {id: 1, username: 'admin', email: 'admin@example.com', role: 'designer', created_at: new Date(), updated_at: new Date()}
                ]
            });

            isAdmin.mockReturnValueOnce(true).mockReturnValueOnce(false);

            await userController.getAllUsers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Users retrieved successfully!',
                    pagination: expect.objectContaining({
                        currentPage: 1
                    }),
                    info: expect.objectContaining({
                        message: expect.stringContaining('Invalid page number -1'),
                        requestedPage: -1,
                        correctedTo: 1,
                        reason: 'invalid_page'
                    })
                })
            );
        });
    });

    // Get user by id
    describe('Get user by id', () => {
        beforeEach(() => {
            mockReq.user = {email: 'admin@example.com'};
            mockReq.params = {id: '123'};
        });

        it('should get user by ID successfully for admin', async() => {
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({
                rows: [{
                    id: 123, 
                    username: 'targetuser', 
                    email: 'target@example.com', 
                    role: 'designer', 
                    created_at: new Date(), 
                    updated_at: new Date()
                }]
            });

            isAdmin.mockReturnValueOnce(false);
            
            await userController.getUserById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'User retrieved successfully!',
                    user: expect.objectContaining({
                        id: 123,
                        username: 'targetuser',
                        isAdmin: false
                    })
                })
            );
        });

        it('should return 404 if target user not found', async() => {
            isAdmin.mockReturnValueOnce(true);

            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({rows: []});

            await userController.getUserById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User not found!'
            });
        });
    });

    // Update user role
    describe('Update user role', () => {
        beforeEach(() => {
            mockReq.user = {email: 'admin@example.com'};
            mockReq.params = {id: '123'};
            mockReq.body = {role: 'viewer'};
        });

        it('should update user role successfully for admin', async() => {
            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({
                rows: [{
                    id: 123, 
                    username: 'targetuser', 
                    email: 'target@example.com', 
                    role: 'designer'
                }]
            });

            isAdmin.mockReturnValueOnce(false);

            query.mockResolvedValueOnce({
                rows: [{
                    id: 123, 
                    username: 'targetuser', 
                    email: 'target@example.com', 
                    role: 'viewer',
                    created_at: new Date(),
                    updated_at: new Date()
                }]
            });

            await userController.updateUserRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'User role updated successfully!',
                    user: expect.objectContaining({
                        id: 123,
                        role: 'viewer',
                        isAdmin: false
                    })
                })
            );
        });

        it('should return 400 for invalid role', async() => {
            mockReq.body = {role: 'invalid'};

            await userController.updateUserRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid role! Must be either "designer" or "viewer"!'
            });
        });

        it('should return 403 when trying to change admin role', async() => {
            isAdmin.mockReturnValueOnce(true);

            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({
                rows: [{
                    id: 123, 
                    username: 'targetuser', 
                    email: 'target@example.com', 
                    role: 'designer'
                }]
            });

            isAdmin.mockReturnValueOnce(true);

            await userController.updateUserRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Cannot change admin user role!'
            });
        });
    });

    // Get user stats
    describe('Get user stats', () => {
        beforeEach(() => {
            mockReq.user = {email: 'admin@example.com'};
        });

        it('should get user statistics successfully for admin', async() => {
            isAdmin.mockReturnValueOnce(true);

            query.mockResolvedValueOnce({rows: [{id: 1}]});
            query.mockResolvedValueOnce({
                rows: [{
                    total_users: '100', 
                    designers: '60', 
                    viewers: '40', 
                    new_users_30_days: '10',
                    new_users_7_days: '3'
                }]
            });

            await userController.getUserStats(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'User statistics retrieved successfully!',
                    stats:{
                        totalUsers: 100, 
                        designers: 60, 
                        viewers: 40, 
                        newUsers30Days: 10,
                        newUsers7Days: 3
                    }
                })
            );
        });
    });
});

