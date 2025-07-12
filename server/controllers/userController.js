import bcrypt from 'bcryptjs';
import {query} from '../db.js';
import {isAdmin} from '../utils/helpers.js';
import 'dotenv/config';

// Note: getProfile - client should use JWT payload for profile data

// Update user profile (username and email)
const updateProfile = async(req, res) => {
    try {
        const id = req.user.id;
        const {username, email} = req.body;

        // check if no fields to update
        if (!username && !email) {
            return res.status(400).json({
                error: 'No valid fields to update!'
            });
        }
    
        // check if user still exists
        const checkUser = await query(
            `SELECT id FROM users WHERE id = $1`,
            [id]
        );

        if (checkUser.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found!'
            });
        }

        // Build dynamic update query
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (username) {
            // Check username conflict
            const usernameConflict = await query(
                `SELECT id FROM users WHERE username = $1 AND id != $2`,
                [username, id]
            );

            if (usernameConflict.rows.length > 0) {
                return res.status(409).json({
                    error: 'Username already taken!'
                });
            }

            updates.push(`username = $${paramCount}`);
            values.push(username);
            paramCount++;
        }

        if (email) {
            // Check email conflict
            const emailConflict = await query(
                `SELECT id FROM users WHERE email = $1 AND id != $2`,
                [email, id]
            );

            if (emailConflict.rows.length > 0) {
                return res.status(409).json({
                    error: 'Email already taken!'
                });
            }

            updates.push(`email = $${paramCount}`);
            values.push(email);
            paramCount++;
        }

        // Update user profile
        values.push(id);
        
        const result = await query(
            `UPDATE users SET ${updates.join(', ')} 
            WHERE id = $${paramCount} 
            RETURNING id, username, email, role, created_at, updated_at`,
            values
        );

        const updatedUser = result.rows[0];

        console.log(`PROFILE UPDATE SUCCESS: User ${updatedUser.username} (${updatedUser.id}) updated profile from ${req.ip}`);

        return res.status(200).json({
            message: 'Profile updated successfully!',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                createdAt: updatedUser.created_at,
                updatedAt: updatedUser.updated_at
            }
        });
    } catch (error) {
        console.error('Update profile error: ', error);
        res.status(500).json({
            error: 'Failed to update profile!',
            details: 'Server error occurred while updating profile!'
        });
    }
};

// Change user password
const changePassword = async(req, res) => {
    try {
        const id = req.user.id;
        const {currentPassword, newPassword} = req.body;

        // check if user still exists
        const checkUser = await query(
            `SELECT id, username, password_hash FROM users WHERE id = $1`,
            [id]
        );

        if (checkUser.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found!'
            });
        }

        const user = checkUser.rows[0];

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValidPassword) {
            console.warn(`PASSWORD CHANGE FAILED: Invalid current password for user ${user.username} (${user.id}) from ${req.ip}`);
            return res.status(401).json({
                error: 'Current password is incorrect!'
            });
        }

        // Check if the newPassword is different from the current one
        const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);

        if (isSamePassword) {
            return res.status(400).json({
                error: 'New password must be different from current password!'
            });
        }

        // Hash new password
        const saltRound = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRound);

        // Update password
        await query(
            `UPDATE users SET password_hash = $1 WHERE id = $2`,
            [newPasswordHash, id]
        );

        console.log(`PASSWORD CHANGE SUCCESS: User ${user.username} (${user.id}) changed password from ${req.ip}`);

        res.status(200).json({
            message: 'Password changed successfully!'
        });
    } catch (error) {
        console.error('Change password error: ', error);
        res.status(500).json({
            error: 'Failed to change password!',
            details: 'Server error occurred while changing password!'
        });
    }
};

// Delete user account
const deleteAccount = async(req, res) => {
    try {
        const id = req.user.id;
        
        // check if user still exists
        const checkUser = await query(
            `SELECT id, username FROM users WHERE id = $1`,
            [id]
        );

        if (checkUser.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found!'
            });
        }

        const user = checkUser.rows[0];

        // Delete user
        await query('DELETE FROM users WHERE id = $1', [id]);
        console.log(`ACCOUNT DELETION: User ${user.username} (${user.id}) deleted their account from ${req.ip}`);
        res.status(200).json({
            message: 'Account deleted successfully!'
        });
    } catch (error) {
        console.error('Delete account error: ', error);
        res.status(500).json({
            error: 'Failed to delete account!',
            details: 'Server error occurred while deleting account!'
        });
    }
};

// Get all users (Admin only)
const getAllUsers = async(req, res) => {
    try {
        const currentUserEmail = req.user.email;

        // Check if current user is admin
        if (!isAdmin(currentUserEmail)) {
            return res.status(403).json({
                error: 'Access denied! Admin privileges required!'
            });
        }
        
        // check if admin still exists
        const checkAdmin = await query(
            `SELECT id FROM users WHERE email = $1`,
            [currentUserEmail]
        );

        if (checkAdmin.rows.length === 0) {
            return res.status(404).json({
                error: 'Admin user not found!'
            });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Filters
        const role = req.query.role;
        const search = req.query.search;

        // Query the database
        let queryText = 'SELECT id, username, email, role, created_at, updated_at FROM users';
        let countQuery = 'SELECT COUNT(*) FROM users';
        const conditions = [];
        const values = [];
        let paramCount = 1;

        if (role && ['designer', 'viewer'].includes(role)) {
            conditions.push(`role = $${paramCount}`);
            values.push(role);
            paramCount++;
        }

        if (search) {
            conditions.push(`(username ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
            values.push(`%${search}%`);
            paramCount++;
        }

        if (conditions.length > 0) {
            const whereClause = ` WHERE ${conditions.join(' AND ')}`;
            queryText += whereClause;
            countQuery += whereClause;
        }

        // Get total count
        const countResult = await query(countQuery, values);
        const totalCount = parseInt(countResult.rows[0].count);

        // Get users with pagination
        queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);

        const result = await query(queryText, values);

        const users = result.rows.map(user => ({
            ...user,
            isAdmin: isAdmin(user.email)
        }));

        res.status(200).json({
            message: 'Users retrieved successfully!',
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                limit,
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            },
            filters: {
                role: role || null,
                search: search || null
            }
        });
    } catch (error) {
        console.error('Get all users error: ', error);
        res.status(500).json({
            error: 'Failed to retrieve users!',
            details: 'Server error occurred while fetching users!'
        });
    }
};

// Get user by ID (Admin only)
const getUserById = async(req, res) => {
    try {
        const currentUserEmail = req.user.email;
        const targetUserId = req.params.id;

        // Check if current user is admin
        if (!isAdmin(currentUserEmail)) {
            return res.status(403).json({
                error: 'Access denied! Admin privileges required!'
            });
        }
        
        // check if admin still exists
        const checkAdmin = await query(
            `SELECT id FROM users WHERE email = $1`,
            [currentUserEmail]
        );

        if (checkAdmin.rows.length === 0) {
            return res.status(404).json({
                error: 'Admin user not found!'
            });
        }

        // Check if target user exists
        const result = await query(
            `SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = $1`,
            [targetUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found!'
            });
        }

        const targetUser = result.rows[0];
        const userIsAdmin = isAdmin(targetUser.email);

        res.status(200).json({
            message: 'User retrieved successfully!',
            user: {
                ...targetUser,
                isAdmin: userIsAdmin
            }
        });
    } catch (error) {
        console.error('Get user by ID error: ', error);
        res.status(500).json({
            error: 'Failed to retrieve user!',
            details: 'Server error occurred while fetching user!'
        });
    }
};

// Update user role (Admin only)
const updateUserRole = async(req, res) => {
    try {
        const currentUserEmail = req.user.email;
        const targetUserId = req.params.id;
        const {role} = req.body;

        // Validate role
        if (!['designer', 'viewer'].includes(role)) {
            return res.status(400).json({
                error: 'Invalid role! Must be either "designer" or "viewer"!'
            });
        }
        
        // Check if current user is admin
        if (!isAdmin(currentUserEmail)) {
            return res.status(403).json({
                error: 'Access denied! Admin privileges required!'
            });
        }
        
        // check if admin still exists
        const checkAdmin = await query(
            `SELECT id FROM users WHERE email = $1`,
            [currentUserEmail]
        );

        if (checkAdmin.rows.length === 0) {
            return res.status(404).json({
                error: 'Admin user not found!'
            });
        }

        // Check if target user exists
        const result = await query(
            `SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = $1`,
            [targetUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found!'
            });
        }

        const targetUser = result.rows[0];
        
        // Prevent changing admin's role
        if (isAdmin(targetUser.email)) {
            return res.status(403).json({
                error: 'Cannot change admin user role!'
            });
        }

        // Update user role
        const updateResult = await query(
            `UPDATE users SET role = $1 
            WHERE id = $2 
            RETURNING id, username, email, role, created_at, updated_at`,
            [role, targetUserId]
        );

        const updatedUser = updateResult.rows[0];
        console.log(`ROLE UPDATE SUCCESS: Admin ${req.user.username} changed user ${updatedUser.username} (${updatedUser.id}) role from ${targetUser.role} to ${role}`);

        res.status(200).json({
            message: 'User role updated successfully!',
            user: {
                ...updatedUser,
                isAdmin: false
            }
        });
    } catch (error) {
        console.error('Update user role error: ', error);
        res.status(500).json({
            error: 'Failed to update user role!',
            details: 'Server error occurred while updating user role!'
        });
    }
};

// Get user statistics (Admin only)
const getUserStats = async(req, res) => {
    try {
        const currentUserEmail = req.user.email;

        // Check if current user is admin
        if (!isAdmin(currentUserEmail)) {
            return res.status(403).json({
                error: 'Access denied! Admin privileges required!'
            });
        }
        
        // check if admin still exists
        const checkAdmin = await query(
            `SELECT id FROM users WHERE email = $1`,
            [currentUserEmail]
        );

        if (checkAdmin.rows.length === 0) {
            return res.status(404).json({
                error: 'Admin user not found!'
            });
        }

        // Get user statistics
        const statsResult = await query(
            `SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'designer' THEN 1 END) as designers,
                COUNT(CASE WHEN role = 'viewer' THEN 1 END) as viewers,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_30_days,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_7_days
            FROM users`
        );

        const stats = statsResult.rows[0];

        res.status(200).json({
            message: 'User statistics retrieved successfully!',
            stats: {
                totalUsers: parseInt(stats.total_users),
                designers: parseInt(stats.designers),
                viewers: parseInt(stats.viewers),
                newUsers30Days: parseInt(stats.new_users_30_days),
                newUsers7Days: parseInt(stats.new_users_7_days)
            }
        });
    } catch (error) {
        console.error('Get user stats error: ', error);
        res.status(500).json({
            error: 'Failed to retrieve user stats!',
            details: 'Server error occurred while fetching user statistics!'
        });
    }
};

export {
    updateProfile,
    changePassword,
    deleteAccount,
    getAllUsers,
    getUserById,
    updateUserRole,
    getUserStats
};