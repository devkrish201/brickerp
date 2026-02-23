import { validationResult, body, param, query } from 'express-validator';
import { COST_TYPES, UNITS, ROLES, ESTIMATE_STATUS, PO_STATUS } from '../config/constants.js';

/**
 * Validation middleware - checks for validation errors (for express-validator)
 */
export const validate = (req, res, next) => {
    // Check if this is a Joi schema validation call (schema passed as first argument)
    if (req && typeof req.validateAsync === 'function') {
        // This is a Joi schema, return a middleware function
        const schema = req;
        const source = res || 'body'; // res is actually the source in this context
        const paramName = next; // next is actually the paramName for 'params' source

        return (request, response, nextFn) => {
            let dataToValidate;

            if (source === 'params' && paramName) {
                // Validate specific param
                dataToValidate = { [paramName]: request.params[paramName] };
            } else if (source === 'params') {
                dataToValidate = request.params;
            } else if (source === 'query') {
                dataToValidate = request.query;
            } else {
                dataToValidate = request.body;
            }

            const { error, value } = schema.validate(dataToValidate, { abortEarly: false, stripUnknown: true });

            if (error) {
                const errors = error.details.reduce((acc, err) => {
                    acc[err.path.join('.')] = err.message;
                    return acc;
                }, {});

                return response.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    errors,
                });
            }

            // Replace request data with validated/sanitized data
            if (source === 'params') {
                Object.assign(request.params, value);
            } else if (source === 'query') {
                request.query = value;
            } else {
                request.body = value;
            }

            nextFn();
        };
    }

    // Original express-validator behavior
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            errors: errors.array().reduce((acc, err) => {
                acc[err.path] = err.msg;
                return acc;
            }, {}),
        });
    }
    next();
};

/**
 * Common validation rules
 */
export const commonValidators = {
    // MongoDB ObjectId validation
    objectId: (field, location = 'params') => {
        const validator = location === 'params' ? param(field) :
            location === 'query' ? query(field) : body(field);
        return validator
            .isMongoId()
            .withMessage(`${field} must be a valid MongoDB ObjectId`);
    },

    // Pagination
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
    ],

    // Email validation
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),

    // Password validation
    password: body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),

    // Name validation
    name: body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ max: 100 })
        .withMessage('Name must not exceed 100 characters'),
};

/**
 * User registration validation
 */
export const registerValidation = [
    commonValidators.name,
    commonValidators.email,
    commonValidators.password,
    body('roles')
        .optional()
        .isArray()
        .withMessage('Roles must be an array'),
    body('roles.*')
        .optional()
        .isIn(Object.values(ROLES))
        .withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}`),
    validate,
];

/**
 * Login validation
 */
export const loginValidation = [
    commonValidators.email,
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    validate,
];

/**
 * Item validation
 */
export const itemValidation = [
    commonValidators.name,
    body('sku')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('SKU must not exceed 50 characters'),
    body('costType')
        .isIn(Object.values(COST_TYPES))
        .withMessage(`Cost type must be one of: ${Object.values(COST_TYPES).join(', ')}`),
    body('defaultUnitPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Default unit price must be a non-negative number (0 or above)'),
    body('units')
        .optional()
        .isArray()
        .withMessage('Units must be an array'),
    body('units.*')
        .optional()
        .isIn(Object.values(UNITS))
        .withMessage(`Unit must be one of: ${Object.values(UNITS).join(', ')}`),
    validate,
];

/**
 * Category validation
 */
export const categoryValidation = [
    commonValidators.name,
    body('parentId')
        .optional()
        .isMongoId()
        .withMessage('Parent ID must be a valid MongoDB ObjectId'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    validate,
];

/**
 * Vendor validation
 */
export const vendorValidation = [
    commonValidators.name,
    body('contact.phone')
        .optional({ checkFalsy: true })
        .isMobilePhone('any')
        .withMessage('Please provide a valid phone number'),
    body('contact.email')
        .optional({ checkFalsy: true })
        .isEmail()
        .withMessage('Please provide a valid email'),
    body('gst')
        .optional()
        .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
        .withMessage('Please provide a valid GST number'),
    validate,
];

/**
 * Estimate validation
 */
export const estimateValidation = [
    body('clientName')
        .trim()
        .notEmpty()
        .withMessage('Client name is required'),
    body('items')
        .isArray({ min: 1 })
        .withMessage('At least one item is required'),
    body('items.*.itemId')
        .isMongoId()
        .withMessage('Item ID must be a valid MongoDB ObjectId'),
    body('items.*.qty')
        .isFloat({ min: 0.01 })
        .withMessage('Quantity must be greater than 0'),
    body('items.*.unit')
        .isIn(Object.values(UNITS))
        .withMessage(`Unit must be one of: ${Object.values(UNITS).join(', ')}`),
    body('items.*.unitPrice')
        .isInt({ min: 0 })
        .withMessage('Unit price must be a non-negative integer (in rupees)'),
    validate,
];

/**
 * Purchase Order validation
 */
export const purchaseOrderValidation = [
    body('vendorId')
        .isMongoId()
        .withMessage('Vendor ID is required'),
    body('items')
        .isArray({ min: 1 })
        .withMessage('At least one item is required'),
    body('items.*.itemId')
        .isMongoId()
        .withMessage('Item ID must be a valid MongoDB ObjectId'),
    body('items.*.qty')
        .isFloat({ min: 0.01 })
        .withMessage('Quantity must be greater than 0'),
    body('expectedDeliveryDate')
        .optional()
        .isISO8601()
        .withMessage('Expected delivery date must be a valid ISO date'),
    validate,
];

/**
 * Goods Receipt validation
 */
export const goodsReceiptValidation = [
    body('poId')
        .isMongoId()
        .withMessage('Purchase Order ID is required'),
    body('items')
        .isArray({ min: 1 })
        .withMessage('At least one item is required'),
    body('items.*.itemId')
        .isMongoId()
        .withMessage('Item ID must be a valid MongoDB ObjectId'),
    body('items.*.receivedQty')
        .isFloat({ min: 0.01 })
        .withMessage('Received quantity must be greater than 0'),
    body('warehouseId')
        .isMongoId()
        .withMessage('Warehouse ID is required'),
    validate,
];

/**
 * Brick Batch validation
 */
export const brickBatchValidation = [
    body('itemId')
        .isMongoId()
        .withMessage('Item ID (brick product) is required'),
    body('producedQty')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Produced quantity must be at least 1'),
    body('kilnId')
        .optional()
        .isMongoId()
        .withMessage('Kiln ID must be a valid MongoDB ObjectId'),
    validate,
];

/**
 * Transport Trip validation
 */
export const transportTripValidation = [
    // body('vehicleType')
    //     .isIn(['Small', 'Medium', 'Large', 'Custom'])
    //     .withMessage('Vehicle type must be Small, Medium, Large, or Custom'),
    body('origin')
        .trim()
        .notEmpty()
        .withMessage('Origin is required'),
    body('destination')
        .trim()
        .notEmpty()
        .withMessage('Destination is required'),
    body('distanceKm')
        .isFloat({ min: 0.1 })
        .withMessage('Distance must be greater than 0'),
    validate,
];

export default {
    validate,
    commonValidators,
    registerValidation,
    loginValidation,
    itemValidation,
    categoryValidation,
    vendorValidation,
    estimateValidation,
    purchaseOrderValidation,
    goodsReceiptValidation,
    brickBatchValidation,
    transportTripValidation,
};
