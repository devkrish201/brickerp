import Joi from 'joi';

/**
 * Validation schemas for Customer endpoints
 */

// Address sub-schema
const addressSchema = Joi.object({
    label: Joi.string().max(50).optional(),
    line1: Joi.string().max(200).required(),
    line2: Joi.string().max(200).optional(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).required(),
    pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).required()
        .messages({ 'string.pattern.base': 'Invalid pincode format' }),
    landmark: Joi.string().max(200).optional(),
    distance: Joi.number().min(0).optional(),
    zone: Joi.string().max(50).optional(),
    isDefault: Joi.boolean().default(false),
});

// Contact person sub-schema
const contactPersonSchema = Joi.object({
    name: Joi.string().max(100).required(),
    designation: Joi.string().max(100).optional(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required()
        .messages({ 'string.pattern.base': 'Invalid phone number' }),
    email: Joi.string().email().optional(),
    isPrimary: Joi.boolean().default(false),
});

/**
 * Create Customer validation
 */
export const createCustomerSchema = Joi.object({
    name: Joi.string().trim().max(200).required()
        .messages({ 'string.empty': 'Customer name is required' }),
    customerCode: Joi.string().trim().max(50).optional(),
    customerType: Joi.string().valid('Individual', 'Business', 'Contractor', 'Government', 'Dealer', 'Retailer').default('Individual'),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required()
        .messages({ 'string.pattern.base': 'Invalid phone number' }),
    alternatePhone: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
    email: Joi.string().email().optional(),
    gstin: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional()
        .messages({ 'string.pattern.base': 'Invalid GSTIN format' }),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional()
        .messages({ 'string.pattern.base': 'Invalid PAN format' }),
    billingAddress: addressSchema.optional(),
    deliveryAddresses: Joi.array().items(addressSchema).optional(),
    contactPersons: Joi.array().items(contactPersonSchema).optional(),
    creditLimit: Joi.number().min(0).default(0),
    paymentTerms: Joi.object({
        creditDays: Joi.number().min(0).default(0),
        discountPercent: Joi.number().min(0).max(100).default(0),
        discountDays: Joi.number().min(0).default(0),
    }).optional(),
    priceCategory: Joi.string().valid('Standard', 'Premium', 'Wholesale', 'Retail', 'Special').default('Standard'),
    tags: Joi.array().items(Joi.string().hex().length(24)).optional(),
    notes: Joi.string().max(2000).optional(),
    active: Joi.boolean().default(true),
    metadata: Joi.object().optional(),
});

/**
 * Update Customer validation
 */
export const updateCustomerSchema = Joi.object({
    name: Joi.string().trim().max(200).optional(),
    customerType: Joi.string().valid('Individual', 'Business', 'Contractor', 'Government', 'Dealer', 'Retailer').optional(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
    alternatePhone: Joi.string().pattern(/^[6-9]\d{9}$/).optional().allow(''),
    email: Joi.string().email().optional().allow(''),
    gstin: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional().allow(''),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional().allow(''),
    billingAddress: addressSchema.optional(),
    deliveryAddresses: Joi.array().items(addressSchema).optional(),
    contactPersons: Joi.array().items(contactPersonSchema).optional(),
    creditLimit: Joi.number().min(0).optional(),
    paymentTerms: Joi.object({
        creditDays: Joi.number().min(0).optional(),
        discountPercent: Joi.number().min(0).max(100).optional(),
        discountDays: Joi.number().min(0).optional(),
    }).optional(),
    priceCategory: Joi.string().valid('Standard', 'Premium', 'Wholesale', 'Retail', 'Special').optional(),
    tags: Joi.array().items(Joi.string().hex().length(24)).optional(),
    notes: Joi.string().max(2000).optional(),
    active: Joi.boolean().optional(),
    metadata: Joi.object().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

/**
 * List customers query validation
 */
export const listCustomersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(200).optional(),
    customerType: Joi.string().valid('Individual', 'Business', 'Contractor', 'Government', 'Dealer', 'Retailer').optional(),
    priceCategory: Joi.string().valid('Standard', 'Premium', 'Wholesale', 'Retail', 'Special').optional(),
    hasOutstanding: Joi.boolean().optional(),
    active: Joi.boolean().optional(),
    sortBy: Joi.string().valid('name', 'createdAt', 'currentBalance', 'totalSales').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Get by ID validation
 */
export const getByIdSchema = Joi.object({
    id: Joi.string().hex().length(24).required()
        .messages({ 'string.hex': 'Invalid customer ID format' }),
});

/**
 * Update balance validation
 */
export const updateBalanceSchema = Joi.object({
    amount: Joi.number().required()
        .messages({ 'number.base': 'Amount is required' }),
    type: Joi.string().valid('credit', 'debit').required(),
    reference: Joi.string().max(200).optional(),
});

export default {
    createCustomerSchema,
    updateCustomerSchema,
    listCustomersSchema,
    getByIdSchema,
    updateBalanceSchema,
};
