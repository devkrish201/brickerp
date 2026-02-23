import { Router } from 'express';
import salesOrderController from './salesOrder.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import {
    createSalesOrderSchema,
    updateSalesOrderSchema,
    updateStatusSchema,
    recordPaymentSchema,
    listOrdersSchema,
    getByIdSchema,
} from './salesOrder.validation.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Sales Orders
 *   description: Sales order management with workflow and payment tracking
 */

// All routes require authentication
router.use(authenticate);

/**
 * List all sales orders with pagination and filters
 */
router.get('/', validate(listOrdersSchema, 'query'), salesOrderController.list);

/**
 * Get orders pending delivery
 */
router.get('/pending-delivery', salesOrderController.getPendingDelivery);

/**
 * Get orders by customer
 */
router.get('/by-customer/:customerId', validate(getByIdSchema, 'params', 'customerId'), salesOrderController.getByCustomer);

/**
 * Get sales order by ID
 */
router.get('/:id', validate(getByIdSchema, 'params'), salesOrderController.getById);

/**
 * Create a new sales order
 */
router.post('/', validate(createSalesOrderSchema, 'body'), salesOrderController.create);

/**
 * Update sales order status
 */
router.patch('/:id/status', validate(updateStatusSchema, 'body'), salesOrderController.updateStatus);

/**
 * Record payment for order
 */
router.post('/:id/payment', validate(recordPaymentSchema, 'body'), salesOrderController.recordPayment);

/**
 * Update a sales order
 */
router.put('/:id', validate(updateSalesOrderSchema, 'body'), salesOrderController.update);

/**
 * Create invoice from sales order
 */
router.post('/:id/invoice', validate(getByIdSchema, 'params'), salesOrderController.createInvoiceFromOrder);

/**
 * Cancel/delete a sales order
 */
router.delete('/:id', validate(getByIdSchema, 'params'), salesOrderController.delete);

export default router;
