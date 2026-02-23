import express from 'express';
// Force reload comment 2
import {
    // Vendors
    getVendors,
    getVendor,
    createVendor,
    updateVendor,
    deleteVendor,
    // Estimates
    getEstimates,
    getEstimate,
    createEstimate,
    updateEstimate,
    approveEstimate,
    convertEstimateToPO,
    calculateEstimatePreview,
    // Purchase Orders
    getPurchaseOrders,
    getPurchaseOrder,
    createPurchaseOrder,
    updatePurchaseOrder,
    approvePurchaseOrder,
    cancelPurchaseOrder,
} from './procurement.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import { vendorValidation, estimateValidation, purchaseOrderValidation } from '../../middleware/validate.js';
import { ROLES } from '../../config/constants.js';

const router = express.Router();

// All procurement routes require authentication
router.use(authenticate);

// ============================================
// VENDOR ROUTES
// ============================================

/**

 * @swagger

 * /procurement/vendors:

 *   get:

 *     summary: Get all vendors

 *     description: Retrieve list of all vendors available for procurement

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: query

 *         name: page

 *         schema:

 *           type: integer

 *       - in: query

 *         name: limit

 *         schema:

 *           type: integer

 *       - in: query

 *         name: search

 *         schema:

 *           type: string

 *     responses:

 *       200:

 *         description: Vendors retrieved successfully

 *       401:

 *         description: Unauthorized
 */
router.get('/vendors', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getVendors);

/**

 * @swagger

 * /procurement/vendors/{id}:

 *   get:

 *     summary: Get single vendor

 *     description: Retrieve details of a specific vendor

 *     tags: [Procurement]

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

 *         description: Vendor retrieved successfully

 *       404:

 *         description: Vendor not found
 */
router.get('/vendors/:id', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getVendor);

/**

 * @swagger

 * /procurement/vendors:

 *   post:

 *     summary: Create vendor

 *     description: Create a new vendor for procurement

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             required: [name, contactPerson]


 *             properties:


 *               name:


 *                 type: string


 *               contactPerson:


 *                 type: string


 *               email:


 *                 type: string


 *               phone:


 *                 type: string


 *               address:


 *                 type: string

 *     responses:

 *       201:

 *         description: Vendor created successfully

 *       401:

 *         description: Unauthorized
 */
router.post('/vendors', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), vendorValidation, createVendor);

/**

 * @swagger

 * /procurement/vendors/{id}:

 *   put:

 *     summary: Update vendor

 *     description: Update vendor details

 *     tags: [Procurement]

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


 *               name:


 *                 type: string


 *               contactPerson:


 *                 type: string


 *               email:


 *                 type: string


 *               phone:


 *                 type: string


 *               address:


 *                 type: string

 *     responses:

 *       200:

 *         description: Vendor updated successfully

 *       404:

 *         description: Vendor not found
 */
router.put('/vendors/:id', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), updateVendor);

/**

 * @swagger

 * /procurement/vendors/{id}:

 *   delete:

 *     summary: Delete vendor

 *     description: Delete a vendor record

 *     tags: [Procurement]

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

 *         description: Vendor deleted successfully

 *       404:

 *         description: Vendor not found
 */
router.delete('/vendors/:id', authorize(...ROLE_GROUPS.MANAGEMENT), deleteVendor);

// ============================================
// ESTIMATE ROUTES
// ============================================

/**

 * @swagger

 * /procurement/estimates:

 *   get:

 *     summary: Get all estimates

 *     description: Retrieve all procurement estimates with status and details

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: query

 *         name: page

 *         schema:

 *           type: integer

 *       - in: query

 *         name: limit

 *         schema:

 *           type: integer

 *       - in: query

 *         name: status

 *         schema:

 *           type: string

 *     responses:

 *       200:

 *         description: Estimates retrieved successfully
 */
router.get('/estimates', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getEstimates);

/**

 * @swagger

 * /procurement/estimates/{id}:

 *   get:

 *     summary: Get single estimate

 *     description: Retrieve details of a specific estimate with line items

 *     tags: [Procurement]

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

 *         description: Estimate retrieved successfully

 *       404:

 *         description: Estimate not found
 */
router.get('/estimates/:id', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getEstimate);

/**

 * @swagger

 * /procurement/estimates:

 *   post:

 *     summary: Create estimate

 *     description: Create a new procurement estimate from vendor quote

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             required: [vendorId, items]


 *             properties:


 *               vendorId:


 *                 type: string


 *               items:


 *                 type: array


 *                 items:


 *                   type: object


 *               notes:


 *                 type: string

 *     responses:

 *       201:

 *         description: Estimate created successfully
 */
router.post('/estimates', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), estimateValidation, createEstimate);

/**

 * @swagger

 * /procurement/estimates/{id}:

 *   put:

 *     summary: Update estimate

 *     description: Update estimate details before approval

 *     tags: [Procurement]

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


 *               vendorId:


 *                 type: string


 *               items:


 *                 type: array


 *               notes:


 *                 type: string

 *     responses:

 *       200:

 *         description: Estimate updated successfully

 *       404:

 *         description: Estimate not found
 */
router.put('/estimates/:id', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), updateEstimate);

/**

 * @swagger

 * /procurement/estimates/{id}/approve:

 *   post:

 *     summary: Approve estimate

 *     description: Approve an estimate for conversion to purchase order

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: path

 *         name: id

 *         required: true

 *         schema:

 *           type: string

 *     requestBody:

 *       required: false

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               approvalNotes:


 *                 type: string

 *     responses:

 *       200:

 *         description: Estimate approved successfully

 *       404:

 *         description: Estimate not found
 */
router.post('/estimates/:id/approve', authorize(...ROLE_GROUPS.MANAGEMENT), approveEstimate);

/**

 * @swagger

 * /procurement/estimates/{id}/convert-to-po:

 *   post:

 *     summary: Convert estimate to PO

 *     description: Convert an approved estimate into a purchase order

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: path

 *         name: id

 *         required: true

 *         schema:

 *           type: string

 *     requestBody:

 *       required: false

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               poNumber:


 *                 type: string


 *               deliveryDate:


 *                 type: string


 *                 format: date

 *     responses:

 *       201:

 *         description: Purchase order created successfully

 *       404:

 *         description: Estimate not found
 */
router.post('/estimates/:id/convert-to-po', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), convertEstimateToPO);

/**

 * @swagger

 * /procurement/estimates/calculate:

 *   post:

 *     summary: Calculate estimate preview

 *     description: Calculate estimate totals and pricing preview

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             required: [items]


 *             properties:


 *               items:


 *                 type: array


 *                 items:


 *                   type: object


 *               discount:


 *                 type: number

 *     responses:

 *       200:

 *         description: Calculation completed successfully
 */
router.post('/estimates/calculate', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), calculateEstimatePreview);

// ============================================
// PURCHASE ORDER ROUTES
// ============================================

/**

 * @swagger

 * /procurement/purchase-orders:

 *   get:

 *     summary: Get all purchase orders

 *     description: Retrieve list of all purchase orders

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: query

 *         name: page

 *         schema:

 *           type: integer

 *       - in: query

 *         name: limit

 *         schema:

 *           type: integer

 *       - in: query

 *         name: status

 *         schema:

 *           type: string

 *     responses:

 *       200:

 *         description: Purchase orders retrieved successfully
 */
router.get('/purchase-orders', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getPurchaseOrders);

/**

 * @swagger

 * /procurement/purchase-orders/{id}:

 *   get:

 *     summary: Get single purchase order

 *     description: Retrieve details of a specific purchase order

 *     tags: [Procurement]

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

 *         description: Purchase order retrieved successfully

 *       404:

 *         description: Purchase order not found
 */
router.get('/purchase-orders/:id', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getPurchaseOrder);

/**

 * @swagger

 * /procurement/purchase-orders:

 *   post:

 *     summary: Create purchase order

 *     description: Create a new purchase order

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             required: [vendorId, items]


 *             properties:


 *               vendorId:


 *                 type: string


 *               items:


 *                 type: array


 *               deliveryDate:


 *                 type: string


 *                 format: date

 *     responses:

 *       201:

 *         description: Purchase order created successfully
 */
router.post('/purchase-orders', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), purchaseOrderValidation, createPurchaseOrder);

// Update existing purchase order (only allowed in Draft/Pending)
router.put('/purchase-orders/:id', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM), updatePurchaseOrder);

/**

 * @swagger

 * /procurement/purchase-orders/{id}/approve:

 *   post:

 *     summary: Approve purchase order

 *     description: Approve a purchase order and lock prices

 *     tags: [Procurement]

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

 *         description: Purchase order approved successfully

 *       404:

 *         description: Purchase order not found
 */
router.post('/purchase-orders/:id/approve', authorize(...ROLE_GROUPS.MANAGEMENT), approvePurchaseOrder);

/**

 * @swagger

 * /procurement/purchase-orders/{id}/cancel:

 *   post:

 *     summary: Cancel purchase order

 *     description: Cancel a purchase order

 *     tags: [Procurement]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: path

 *         name: id

 *         required: true

 *         schema:

 *           type: string

 *     requestBody:

 *       required: false

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               reason:


 *                 type: string

 *     responses:

 *       200:

 *         description: Purchase order cancelled successfully

 *       404:

 *         description: Purchase order not found
 */
router.post('/purchase-orders/:id/cancel', authorize(...ROLE_GROUPS.MANAGEMENT), cancelPurchaseOrder);

// ============================================
// PURCHASE INVOICE ROUTES
// ============================================

// (purchase-invoice endpoints removed because controller/model file was missing)
export default router;

