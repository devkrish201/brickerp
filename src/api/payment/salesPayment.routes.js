import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import {
    getSalesPayments,
    getSalesPayment,
    createSalesPayment,
    updateSalesPayment,
    deleteSalesPayment,
    getPaymentsBySalesOrder,
    getPaymentsByCustomer,
    updateSalesPaymentStatus,
} from './salesPayment.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: SalesPayments
 *   description: Sales Order payment management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SalesPayment:
 *       type: object
 *       required:
 *         - salesOrderId
 *         - paymentMethod
 *         - amount
 *       properties:
 *         paymentNumber:
 *           type: string
 *           description: Auto-generated payment number
 *         salesOrderId:
 *           type: string
 *           description: Reference to Sales Order
 *         soNumber:
 *           type: string
 *           description: SO number for reference
 *         customerId:
 *           type: string
 *           description: Reference to Customer
 *         customerName:
 *           type: string
 *           description: Customer name
 *         paymentDate:
 *           type: string
 *           format: date
 *           description: Payment date
 *         paymentMethod:
 *           type: string
 *           enum: [CASH, CHEQUE, NEFT, RTGS, UPI, IMPS, BANK_TRANSFER, CREDIT_CARD, DEBIT_CARD, OTHER]
 *         paymentStatus:
 *           type: string
 *           enum: [PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REFUNDED]
 *           default: PENDING
 *         amount:
 *           type: number
 *           description: Payment amount
 *         currency:
 *           type: string
 *           default: INR
 *         transactionId:
 *           type: string
 *         referenceNumber:
 *           type: string
 *         bankName:
 *           type: string
 *         chequeNumber:
 *           type: string
 *         chequeDate:
 *           type: string
 *           format: date
 *         upiId:
 *           type: string
 *         remarks:
 *           type: string
 *         internalNotes:
 *           type: string
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               type:
 *                 type: string
 *         deliveredItems:
 *           type: array
 *           description: "Quantities delivered/shipped in this payment. backend will update order deliveredQty accordingly."
 *           items:
 *             type: object
 *             required:
 *               - itemId
 *               - quantity
 *             properties:
 *               itemId:
 *                 type: string
 *               quantity:
 *                 type: number
 */

/**
 * @swagger
 * /api/v1/sales-payments:
 *   get:
 *     summary: Get all sales payments
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: salesOrderId
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', authorize(ROLE_GROUPS.PAYMENT_READ), getSalesPayments);

/**
 * @swagger
 * /api/v1/sales-payments/{id}:
 *   get:
 *     summary: Get sales payment by ID
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment retrieved successfully
 *       404:
 *         description: Payment not found
 */
router.get('/:id', authorize(ROLE_GROUPS.PAYMENT_READ), getSalesPayment);

/**
 * @swagger
 * /api/v1/sales-payments:
 *   post:
 *     summary: Create new sales payment
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - salesOrderId
 *               - paymentMethod
 *               - amount
 *             properties:
 *               salesOrderId:
 *                 type: string
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, CHEQUE, NEFT, RTGS, UPI, IMPS, BANK_TRANSFER, CREDIT_CARD, DEBIT_CARD, OTHER]
 *               amount:
 *                 type: number
 *               deliveredItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               transactionId:
 *                 type: string
 *               referenceNumber:
 *                 type: string
 *               bankName:
 *                 type: string
 *               chequeNumber:
 *                 type: string
 *               chequeDate:
 *                 type: string
 *                 format: date
 *               upiId:
 *                 type: string
 *               remarks:
 *                 type: string
 *               internalNotes:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     url:
 *                       type: string
 *                     type:
 *                       type: string
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Bad request
 */
router.post('/', authorize(ROLE_GROUPS.PAYMENT_CREATE), createSalesPayment);

/**
 * @swagger
 * /api/v1/sales-payments/{id}:
 *   put:
 *     summary: Update sales payment
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *     content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, CHEQUE, NEFT, RTGS, UPI, IMPS, BANK_TRANSFER, CREDIT_CARD, DEBIT_CARD, OTHER]
 *               paymentStatus:
 *                 type: string
 *                 enum: [PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REFUNDED]
 *               amount:
 *                 type: number
 *               deliveredItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *               transactionId:
 *                 type: string
 *               referenceNumber:
 *                 type: string
 *               bankName:
 *                 type: string
 *               chequeNumber:
 *                 type: string
 *               chequeDate:
 *                 type: string
 *                 format: date
 *               upiId:
 *                 type: string
 *               remarks:
 *                 type: string
 *               internalNotes:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     url:
 *                       type: string
 *                     type:
 *                       type: string
 *               approvedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment updated successfully
 *       404:
 *         description: Payment not found
 */
router.put('/:id', authorize(ROLE_GROUPS.PAYMENT_UPDATE), updateSalesPayment);

/**
 * @swagger
 * /api/v1/sales-payments/{id}/status:
 *   patch:
 *     summary: Update sales payment status
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentStatus
 *             properties:
 *               paymentStatus:
 *                 type: string
 *                 enum: [PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REFUNDED]
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 *       404:
 *         description: Payment not found
 */
router.patch('/:id/status', authorize(ROLE_GROUPS.PAYMENT_UPDATE), updateSalesPaymentStatus);

/**
 * @swagger
 * /api/v1/sales-payments/{id}:
 *   delete:
 *     summary: Delete sales payment
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment deleted successfully
 *       404:
 *         description: Payment not found
 */
router.delete('/:id', authorize(ROLE_GROUPS.PAYMENT_DELETE), deleteSalesPayment);

/**
 * @swagger
 * /api/v1/sales-payments/so/{soId}:
 *   get:
 *     summary: Get sales payments by sales order
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: soId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 */
router.get('/so/:soId', authorize(ROLE_GROUPS.PAYMENT_READ), getPaymentsBySalesOrder);

/**
 * @swagger
 * /api/v1/sales-payments/customer/{customerId}:
 *   get:
 *     summary: Get sales payments by customer (with per-order summary)
 *     tags: [SalesPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 *       404:
 *         description: No payments found
 */
router.get('/customer/:customerId', authorize(ROLE_GROUPS.PAYMENT_READ), getPaymentsByCustomer);

// customer-specific summary
router.get('/customer/:customerId', authorize(ROLE_GROUPS.PAYMENT_READ), getPaymentsByCustomer);

export default router;