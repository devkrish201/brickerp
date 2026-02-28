import Joi from 'joi';
import { UNITS } from '../../config/constants.js';

/**
 * Validation schemas for SalesOrder endpoints
 */

// Line item sub-schema
const lineItemSchema = Joi.object({
    itemId: Joi.string().hex().length(24).required(),
    itemName: Joi.string().max(200).allow('').optional(),
    description: Joi.string().max(500).allow('').optional(),
    quantity: Joi.number().positive().required(),
    unit: Joi.string().valid(...Object.values(UNITS)).insensitive().required(),
    unitPrice: Joi.number().min(0).required(),
    discountPercent: Joi.number().min(0).max(100).default(0),
    taxRate: Joi.number().min(0).max(100).default(0),
    hsnCode: Joi.string().max(20).allow('').optional(),
    // delivery tracking fields (frontend may send)
    deliveredQty: Joi.number().min(0).max(Joi.ref('quantity')).optional(),
    pendingQty: Joi.number().min(0).max(Joi.ref('quantity')).optional(),
    fullyDelivered: Joi.boolean().optional(),
});

// Transport details sub-schema
const transportSchema = Joi.object({
    transportItemId: Joi.string().hex().length(24).optional(),
    vehicleNumber: Joi.string().max(20).allow('').optional(),
    driverName: Joi.string().max(100).allow('').optional(),
    driverPhone: Joi.string().pattern(/^[6-9]\d{9}$/).allow('').optional(),
    // accept both legacy `distance` and `distanceKm`
    distance: Joi.number().min(0).optional(),
    distanceKm: Joi.number().min(0).optional(),
    zone: Joi.string().max(50).optional(),
    rateCardId: Joi.string().hex().length(24).optional(),
    // Server-calculated or flat-rate / manual override
    calculatedCost: Joi.number().min(0).optional(),
    transportCost: Joi.number().min(0).optional(),
    paidStatus: Joi.string().valid('Unpaid', 'Paid').default('Unpaid'),
    notes: Joi.string().max(500).allow('').optional(),
});

/**
 * Create SalesOrder validation
 */
export const createSalesOrderSchema = Joi.object({
    customerId: Joi.string().hex().length(24).required()
        .messages({ 'string.empty': 'Customer is required' }),
    deliveryAddressIndex: Joi.number().integer().min(0).default(0),
    orderDate: Joi.date().default(Date.now),
    expectedDeliveryDate: Joi.date().optional(),
    lineItems: Joi.array().items(lineItemSchema).min(1).required()
        .messages({ 'array.min': 'At least one item is required' }),
    includeTransport: Joi.boolean().default(false),
    transportDetails: transportSchema.optional(),
    notes: Joi.string().max(2000).allow('').optional(),
    internalNotes: Joi.string().max(2000).allow('').optional(),
    paymentTerms: Joi.object({
        creditDays: Joi.number().min(0).default(0),
        advanceRequired: Joi.number().min(0).default(0),
        paymentMode: Joi.string().valid('Cash', 'UPI', 'Bank_Transfer', 'Cheque', 'Credit').default('Cash'),
    }).optional(),
    metadata: Joi.object().optional(),
});

/**
 * Update SalesOrder validation
 */
export const updateSalesOrderSchema = Joi.object({
    deliveryAddressIndex: Joi.number().integer().min(0).optional(),
    expectedDeliveryDate: Joi.date().optional(),
    lineItems: Joi.array().items(lineItemSchema).min(1).optional(),
    includeTransport: Joi.boolean().optional(),
    transportDetails: transportSchema.optional(),
    notes: Joi.string().max(2000).allow('').optional(),
    internalNotes: Joi.string().max(2000).allow('').optional(),
    status: Joi.string().valid(
        'Draft',
        'Confirmed',
        'Processing',
        'Ready',
        'Ready_For_Dispatch',
        'Dispatched',
        'Partially_Delivered',
        'Delivered',
        'Invoiced',
        'Cancelled'
    ).optional(),
    paymentTerms: Joi.object({
        creditDays: Joi.number().min(0).optional(),
        advanceRequired: Joi.number().min(0).optional(),
        paymentMode: Joi.string().valid('Cash', 'UPI', 'Bank_Transfer', 'Cheque', 'Credit').optional(),
    }).optional(),
    metadata: Joi.object().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

/**
 * Update status validation
 */
export const updateStatusSchema = Joi.object({
    status: Joi.string().valid(
        'Draft',
        'Confirmed',
        'Processing',
        'Ready',
        'Ready_For_Dispatch',
        'Dispatched',
        'Partially_Delivered',
        'Delivered',
        'Invoiced',
        'Cancelled'
    ).required(),
    reason: Joi.string().max(500).optional(),
});

/**
 * Record payment validation
 */
export const recordPaymentSchema = Joi.object({
    amount: Joi.number().positive().required(),
    paymentMode: Joi.string().valid('Cash', 'UPI', 'Bank_Transfer', 'Cheque').required(),
    reference: Joi.string().max(100).optional(),
    notes: Joi.string().max(500).optional(),
});

/**
 * List orders query validation
 */
export const listOrdersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(200).optional(),
    customerId: Joi.string().hex().length(24).optional(),
    status: Joi.string().valid('Draft', 'Confirmed', 'Processing', 'Ready', 'Ready_For_Dispatch', 'Dispatched', 'Partially_Delivered', 'Delivered', 'Invoiced', 'Cancelled').optional(),
    transportItemId: Joi.string().hex().length(24).optional(),
    transportPaidStatus: Joi.string().valid('Unpaid', 'Paid').optional(),
    driverName: Joi.string().max(100).optional(),
    fromDate: Joi.date().optional(),
    toDate: Joi.date().optional(),
    sortBy: Joi.string().valid('orderNumber', 'orderDate', 'grandTotal', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Get by ID validation
 */
export const getByIdSchema = Joi.object({
    id: Joi.string().hex().length(24).required()
        .messages({ 'string.hex': 'Invalid order ID format' }),
});

export default {
    createSalesOrderSchema,
    updateSalesOrderSchema,
    updateStatusSchema,
    recordPaymentSchema,
    listOrdersSchema,
    getByIdSchema,
};
