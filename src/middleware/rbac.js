import { ROLES } from '../config/constants.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks if user has required role(s) to access a route
 */

/**
 * Check if user has any of the specified roles
 * @param  {...string} allowedRoles - Roles that are allowed to access the route
 */
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.',
            });
        }

        const userRoles = req.user.roles || [];

        // Admin has access to everything
        if (userRoles.includes(ROLES.ADMIN)) {
            return next();
        }

        // Check if user has any of the allowed roles
        const hasRole = userRoles.some(role => allowedRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.',
                required: allowedRoles,
                userRoles: userRoles,
            });
        }

        next();
    };
};

/**
 * Check if user has ALL of the specified roles
 * @param  {...string} requiredRoles - All roles that are required
 */
export const authorizeAll = (...requiredRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.',
            });
        }

        const userRoles = req.user.roles || [];

        // Admin has access to everything
        if (userRoles.includes(ROLES.ADMIN)) {
            return next();
        }

        // Check if user has ALL required roles
        const hasAllRoles = requiredRoles.every(role => userRoles.includes(role));

        if (!hasAllRoles) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.',
                required: requiredRoles,
                userRoles: userRoles,
            });
        }

        next();
    };
};

/**
 * Check if user owns the resource or is admin/manager
 * @param {Function} getResourceOwnerId - Function to extract owner ID from request
 */
export const authorizeOwner = (getResourceOwnerId) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.',
            });
        }

        const userRoles = req.user.roles || [];

        // Admin and Manager can access any resource
        if (userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.MANAGER)) {
            return next();
        }

        try {
            const ownerId = await getResourceOwnerId(req);

            if (!ownerId) {
                return res.status(404).json({
                    success: false,
                    error: 'Resource not found.',
                });
            }

            if (ownerId.toString() === req.user._id.toString()) {
                return next();
            }

            return res.status(403).json({
                success: false,
                error: 'Access denied. You do not own this resource.',
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: 'Authorization check failed.',
            });
        }
    };
};

/**
 * Predefined role groups for common scenarios
 */
export const ROLE_GROUPS = {
    // Can manage all aspects of the system
    MANAGEMENT: [ROLES.ADMIN, ROLES.MANAGER],

    // Can manage procurement (estimates, POs, vendors)
    PROCUREMENT_TEAM: [ROLES.ADMIN, ROLES.MANAGER, ROLES.PROCUREMENT],

    // Can manage inventory and warehouse
    WAREHOUSE_TEAM: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE],

    // Can manage production and manufacturing
    PRODUCTION_TEAM: [ROLES.ADMIN, ROLES.MANAGER, ROLES.PRODUCTION],

    // Can manage transport and logistics
    LOGISTICS_TEAM: [ROLES.ADMIN, ROLES.MANAGER, ROLES.TRANSPORT],

    // Can manage finance-related operations (payments, expenses, ledger)
    FINANCE_TEAM: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OFFICER, ROLES.PROCUREMENT],

    // All internal staff
    INTERNAL_STAFF: [ROLES.ADMIN, ROLES.MANAGER, ROLES.PROCUREMENT, ROLES.WAREHOUSE, ROLES.PRODUCTION, ROLES.TRANSPORT],

    // External partners
    EXTERNAL: [ROLES.VENDOR, ROLES.WORKER],
};

export default { authorize, authorizeAll, authorizeOwner, ROLE_GROUPS };
