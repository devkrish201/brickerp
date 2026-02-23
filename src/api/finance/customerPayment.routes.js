import { Router } from 'express';
import customerPaymentController from './customerPayment.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import {
    createPaymentSchema,
    allocatePaymentSchema,
    updateChequeStatusSchema,
    listPaymentsSchema,
    getByIdSchema,
} from './customerPayment.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Customer Payments
 *   description: Receive and manage payments from customers
 */

// All routes require authentication
router.use(authenticate);

/**
 * List all payments with pagination and filters
 */
router.get('/', validate(listPaymentsSchema, 'query'), customerPaymentController.list);

/**
 * Get payment collection summary
 */
router.get('/summary', customerPaymentController.getSummary);

/**
 * Get pending cheques
 */
router.get('/pending-cheques', customerPaymentController.getPendingCheques);

/**
 * Get payments by customer
 */
router.get('/by-customer/:customerId', validate(getByIdSchema, 'params', 'customerId'), customerPaymentController.getByCustomer);

/**
 * Get payment by ID
 */
router.get('/:id', validate(getByIdSchema, 'params'), customerPaymentController.getById);

/**
 * Create a new payment
 */
router.post('/', validate(createPaymentSchema, 'body'), customerPaymentController.create);

/**
 * Allocate payment to invoices
 */
router.post('/:id/allocate', validate(allocatePaymentSchema, 'body'), customerPaymentController.allocate);

/**
 * Update cheque status
 */
router.patch('/:id/cheque-status', validate(updateChequeStatusSchema, 'body'), customerPaymentController.updateChequeStatus);

/**
 * Cancel a payment
 */
router.delete('/:id', validate(getByIdSchema, 'params'), customerPaymentController.cancel);

export default router;
