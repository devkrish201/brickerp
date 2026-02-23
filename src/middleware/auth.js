import jwt from 'jsonwebtoken';
import User from '../api/iam/user.model.js';

/**
 * JWT Authentication Middleware
 * Verifies the JWT token and attaches user to request
 */
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.',
            });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user from database
            const user = await User.findById(decoded.userId).select('-passwordHash');

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'User not found. Token may be invalid.',
                });
            }

            if (!user.active) {
                return res.status(401).json({
                    success: false,
                    error: 'User account is deactivated.',
                });
            }

            // Attach user to request
            req.user = user;
            req.userId = user._id;
            next();
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token has expired.',
                    code: 'TOKEN_EXPIRED',
                });
            }

            return res.status(401).json({
                success: false,
                error: 'Invalid token.',
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication error.',
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-passwordHash');

            if (user && user.active) {
                req.user = user;
                req.userId = user._id;
            }
        } catch (err) {
            // Silently fail - user just won't be authenticated
        }

        next();
    } catch (error) {
        next();
    }
};

/**
 * Generate JWT token
 */
export const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

/**
 * Generate Refresh Token
 */
export const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
};

/**
 * Verify Refresh Token
 */
export const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (error) {
        throw error;
    }
};

export default { authenticate, optionalAuth, generateToken, generateRefreshToken, verifyRefreshToken };
