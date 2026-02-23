import Joi from 'joi';

/**
 * Validation schemas for CustomerPayment endpoints
 */

// Allocation sub-schema
const allocationSchema = Joi.object({
    invoiceId: Joi.string().hex().length(24).required(),
    amount: Joi.number().positive().required(),
});

/**
 * Create CustomerPayment validation
 */
export const createPaymentSchema = Joi.object({
    customerId: Joi.string().hex().length(24).required()
        .messages({ 'string.empty': 'Customer is required' }),
    paymentDate: Joi.date().default(Date.now),
    amount: Joi.number().positive().required()
        .messages({ 'number.positive': 'Amount must be positive' }),
    paymentMethod: Joi.string().valid('Cash', 'UPI', 'Bank_Transfer', 'Cheque', 'Card', 'NEFT', 'RTGS', 'IMPS').required(),
    reference: Joi.string().max(100).optional(),
    chequeDetails: Joi.when('paymentMethod', {
        is: 'Cheque',
        then: Joi.object({
            chequeNumber: Joi.string().max(20).required(),
            bankName: Joi.string().max(100).required(),
            chequeDate: Joi.date().required(),
            status: Joi.string().valid('Pending', 'Cleared', 'Bounced').default('Pending'),
        }).required(),
        otherwise: Joi.object().optional(),
    }),
    bankDetails: Joi.object({
        bankName: Joi.string().max(100).optional(),
        accountNumber: Joi.string().max(50).optional(),
        transactionId: Joi.string().max(100).optional(),
    }).optional(),
    allocations: Joi.array().items(allocationSchema).optional(),
    tdsAmount: Joi.number().min(0).default(0),
    tdsPercent: Joi.number().min(0).max(100).default(0),
    notes: Joi.string().max(2000).optional(),
    metadata: Joi.object().optional(),
});

/**
 * Update CustomerPayment validation
 */
export const updatePaymentSchema = Joi.object({
    paymentDate: Joi.date().optional(),
    paymentMethod: Joi.string().valid('Cash', 'UPI', 'Bank_Transfer', 'Cheque', 'Card', 'NEFT', 'RTGS', 'IMPS').optional(),
    reference: Joi.string().max(100).optional(),
    chequeDetails: Joi.object({
        chequeNumber: Joi.string().max(20).optional(),
        bankName: Joi.string().max(100).optional(),
        chequeDate: Joi.date().optional(),
        status: Joi.string().valid('Pending', 'Cleared', 'Bounced').optional(),
    }).optional(),
    bankDetails: Joi.object({
        bankName: Joi.string().max(100).optional(),
        accountNumber: Joi.string().max(50).optional(),
        transactionId: Joi.string().max(100).optional(),
    }).optional(),
    allocations: Joi.array().items(allocationSchema).optional(),
    tdsAmount: Joi.number().min(0).optional(),
    notes: Joi.string().max(2000).optional(),
    metadata: Joi.object().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

/**
 * Allocate payment validation
 */
export const allocatePaymentSchema = Joi.object({
    allocations: Joi.array().items(allocationSchema).min(1).required()
        .messages({ 'array.min': 'At least one allocation is required' }),
});

/**
 * Update cheque status validation
 */
export const updateChequeStatusSchema = Joi.object({
    status: Joi.string().valid('Cleared', 'Bounced').required(),
    remarks: Joi.string().max(500).optional(),
});

/**
 * List payments query validation
 */
export const listPaymentsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().max(200).optional(),
    customerId: Joi.string().hex().length(24).optional(),
    paymentMethod: Joi.string().valid('Cash', 'UPI', 'Bank_Transfer', 'Cheque', 'Card', 'NEFT', 'RTGS', 'IMPS').optional(),
    status: Joi.string().valid('Draft', 'Completed', 'Cancelled', 'Bounced').optional(),
    fromDate: Joi.date().optional(),
    toDate: Joi.date().optional(),
    sortBy: Joi.string().valid('paymentDate', 'amount', 'createdAt').default('paymentDate'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

/**
 * Get by ID validation
 */
export const getByIdSchema = Joi.object({
    id: Joi.string().hex().length(24).required()
        .messages({ 'string.hex': 'Invalid payment ID format' }),
});

export default {
    createPaymentSchema,
    updatePaymentSchema,
    allocatePaymentSchema,
    updateChequeStatusSchema,
    listPaymentsSchema,
    getByIdSchema,
};
