import User from './user.model.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../../middleware/auth.js';
import { asyncHandler, ApiError } from '../../middleware/error.js';
import { ROLES } from '../../config/constants.js';

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export const register = asyncHandler(async (req, res) => {
    const { name, email, password, roles, profile } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, 'User with this email already exists');
    }

    // Validate roles (only Admin can assign Admin role)
    let assignedRoles = roles || [ROLES.WORKER];
    if (assignedRoles.includes(ROLES.ADMIN)) {
        // If trying to assign Admin role, check if requester is Admin
        if (!req.user || !req.user.roles.includes(ROLES.ADMIN)) {
            assignedRoles = assignedRoles.filter(r => r !== ROLES.ADMIN);
        }
    }

    // Create user
    const user = new User({
        name,
        email,
        passwordHash: password, // Will be hashed in pre-save hook
        roles: assignedRoles,
        profile: profile || {},
    });

    if (req.user) {
        user._auditUser = req.user._id;
    }

    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshTokens.push({
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    await user.save();

    res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
            user,
            accessToken,
            refreshToken,
        },
    });
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findByEmailWithPassword(email);

    if (!user) {
        throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.active) {
        throw new ApiError(401, 'Account is deactivated. Please contact admin.');
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token (keep only last 5)
    user.refreshTokens.push({
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    if (user.refreshTokens.length > 5) {
        user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                profile: user.profile,
            },
            accessToken,
            refreshToken,
        },
    });
});

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export const refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
    }

    try {
        // Verify refresh token
        const decoded = verifyRefreshToken(refreshToken);

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user || !user.active) {
            throw new ApiError(401, 'Invalid refresh token');
        }

        // Check if refresh token exists in user's tokens
        const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
        if (!tokenExists) {
            throw new ApiError(401, 'Refresh token not found');
        }

        // Generate new access token
        const newAccessToken = generateToken(user._id);

        res.json({
            success: true,
            data: {
                accessToken: newAccessToken,
            },
        });
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired refresh token');
    }
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (refreshToken && req.user) {
        // Remove refresh token
        req.user.refreshTokens = req.user.refreshTokens.filter(
            t => t.token !== refreshToken
        );
        await req.user.save();
    }

    res.json({
        success: true,
        message: 'Logged out successfully',
    });
});

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: req.user,
    });
});

/**
 * Update current user profile
 * PUT /api/v1/auth/me
 */
export const updateMe = asyncHandler(async (req, res) => {
    const { name, profile, password } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash');

    if (name) user.name = name;
    if (profile) user.profile = { ...user.profile, ...profile };
    if (password) user.passwordHash = password;

    user._auditUser = req.user._id;
    await user.save();

    res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
    });
});

/**
 * Change password
 * PUT /api/v1/auth/change-password
 */
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+passwordHash');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new ApiError(400, 'Current password is incorrect');
    }

    user.passwordHash = newPassword;
    user._auditUser = req.user._id;
    await user.save();

    // Invalidate all refresh tokens (force re-login on other devices)
    user.refreshTokens = [];
    await user.save();

    res.json({
        success: true,
        message: 'Password changed successfully. Please login again.',
    });
});

/**
 * Get all users (Admin only)
 * GET /api/v1/auth/users
 */
export const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, active, search } = req.query;

    const filter = {};
    if (role) filter.roles = role;
    if (active !== undefined) filter.active = active === 'true';
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }

    const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        sort: { createdAt: -1 },
    };

    const result = await User.paginate(filter, options);

    res.json({
        success: true,
        data: result.docs,
        pagination: {
            currentPage: result.page,
            pageSize: result.limit,
            totalCount: result.totalDocs,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
        },
    });
});

/**
 * Update user (Admin only)
 * PUT /api/v1/auth/users/:id
 */
export const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, roles, active, profile } = req.body;

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (roles) user.roles = roles;
    if (active !== undefined) user.active = active;
    if (profile) user.profile = { ...user.profile, ...profile };

    user._auditUser = req.user._id;
    await user.save();

    res.json({
        success: true,
        message: 'User updated successfully',
        data: user,
    });
});

/**
 * Delete user (Admin only)
 * DELETE /api/v1/auth/users/:id
 */
export const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Soft delete
    await user.softDelete(req.user._id);

    res.json({
        success: true,
        message: 'User deleted successfully',
    });
});

export default {
    register,
    login,
    refresh,
    logout,
    getMe,
    updateMe,
    changePassword,
    getAllUsers,
    updateUser,
    deleteUser,
};
