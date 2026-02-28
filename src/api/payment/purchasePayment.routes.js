import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import {
    getPurchasePayments,
    getPurchasePayment,
    createPurchasePayment,
    updatePurchasePayment,
    deletePurchasePayment,
    getPaymentsByPurchaseOrder,
    getPaymentsByVendor,
    updatePurchasePaymentStatus,
} from './purchasePayment.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: PurchasePayments
 *   description: Purchase Order payment management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PurchasePayment:
 *       type: object
 *       required:
 *         - purchaseOrderId
 *         - paymentMethod
 *         - amount
 *       properties:
 *         paymentNumber:
 *           type: string
 *           description: Auto-generated payment number
 *         purchaseOrderId:
 *           type: string
 *           description: Reference to Purchase Order
 *         poNumber:
 *           type: string
 *           description: PO number for reference
 *         vendorId:
 *           type: string
 *           description: Reference to Vendor
 *         vendorName:
 *           type: string
 *           description: Vendor name
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
 *         receivedItems:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unitPrice:
 *                 type: number
 *               totalPrice:
 *                 type: number
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
 */

/**
 * @swagger
 * /api/v1/purchase-payments:
 *   get:
 *     summary: Get all purchase payments
 *     tags: [PurchasePayments]
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
 *         name: vendorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: purchaseOrderId
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
router.get('/', authorize(ROLE_GROUPS.PAYMENT_READ), getPurchasePayments);

/**
 * @swagger
 * /api/v1/purchase-payments/{id}:
 *   get:
 *     summary: Get purchase payment by ID
 *     tags: [PurchasePayments]
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
router.get('/:id', authorize(ROLE_GROUPS.PAYMENT_READ), getPurchasePayment);

/**
 * @swagger
 * /api/v1/purchase-payments:
 *   post:
 *     summary: Create new purchase payment
 *     tags: [PurchasePayments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purchaseOrderId
 *               - paymentMethod
 *               - amount
 *             properties:
 *               purchaseOrderId:
 *                 type: string
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, CHEQUE, NEFT, RTGS, UPI, IMPS, BANK_TRANSFER, CREDIT_CARD, DEBIT_CARD, OTHER]
 *               amount:
 *                 type: number
 *               receivedItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     totalPrice:
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
router.post('/', authorize(ROLE_GROUPS.PAYMENT_CREATE), createPurchasePayment);

/**
 * @swagger
 * /api/v1/purchase-payments/{id}:
 *   put:
 *     summary: Update purchase payment
 *     tags: [PurchasePayments]
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
 *               receivedItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     totalPrice:
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
router.put('/:id', authorize(ROLE_GROUPS.PAYMENT_UPDATE), updatePurchasePayment);

/**
 * @swagger
 * /api/v1/purchase-payments/{id}/status:
 *   patch:
 *     summary: Update purchase payment status
 *     tags: [PurchasePayments]
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
 *                 enum: [PENDING, COMPLETED, CANCELLED]
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 *       404:
 *         description: Payment not found
 */
router.patch('/:id/status', authorize(ROLE_GROUPS.PAYMENT_UPDATE), updatePurchasePaymentStatus);

/**
 * @swagger
 * /api/v1/purchase-payments/{id}:
 *   delete:
 *     summary: Delete purchase payment
 *     tags: [PurchasePayments]
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
router.delete('/:id', authorize(ROLE_GROUPS.PAYMENT_DELETE), deletePurchasePayment);

/**
 * @swagger
 * /api/v1/purchase-payments/po/{poId}:
 *   get:
 *     summary: Get purchase payments by purchase order
 *     tags: [PurchasePayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 */
router.get('/po/:poId', authorize(ROLE_GROUPS.PAYMENT_READ), getPaymentsByPurchaseOrder);

// vendor-specific payment listing
router.get('/vendor/:vendorId', authorize(ROLE_GROUPS.PAYMENT_READ), getPaymentsByVendor);

export default router;