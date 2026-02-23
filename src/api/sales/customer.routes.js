import { Router } from 'express';
import customerController from './customer.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import {
    createCustomerSchema,
    updateCustomerSchema,
    listCustomersSchema,
    getByIdSchema,
} from './customer.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer (buyer) management with credit/Udhaari tracking
 */

// All routes require authentication
router.use(authenticate);

/**
 * List all customers with pagination and filters
 */
router.get('/', validate(listCustomersSchema, 'query'), customerController.list);

/**
 * Quick search customers
 */
router.get('/search', customerController.quickSearch);

/**
 * Get all customers with outstanding balance
 */
router.get('/outstanding', customerController.getOutstanding);

/**
 * Get customer by ID
 */
router.get('/:id', validate(getByIdSchema, 'params'), customerController.getById);

/**
 * Get customer balance info
 */
router.get('/:id/balance', validate(getByIdSchema, 'params'), customerController.getBalance);

/**
 * Get customer ledger (transaction history)
 */
router.get('/:id/ledger', validate(getByIdSchema, 'params'), customerController.getLedger);

/**
 * Create a new customer
 */
router.post('/', validate(createCustomerSchema, 'body'), customerController.create);

/**
 * Update a customer
 */
router.put('/:id', validate(updateCustomerSchema, 'body'), customerController.update);

/**
 * Delete a customer (soft delete)
 */
router.delete('/:id', validate(getByIdSchema, 'params'), customerController.delete);

export default router;
