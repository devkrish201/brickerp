import express from 'express';
import {
    // Kilns - DISABLED (models not available)
    // getKilns,
    // getKiln,
    // getAvailableKilns,
    // createKiln,
    // updateKiln,
    // updateKilnStatus,
    // Brick Batches
    getBrickBatches,
    getActiveBatches,
    getBrickBatch,
    createBrickBatch,
    updateBrickBatch,
    startBatchProduction,
    moveBatchToKiln,
    completeBatch,
    cancelBatch,
    deleteBatch,
    qualityCheckBatch,
    addRawMaterial,
    markBatchesPaid,
    // Calculations
    calculateLabourCostPreview,
    calculateProductionTimePreview,
    // Stats
    getManufacturingStats,
} from './manufacturing.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import { brickBatchValidation } from '../../middleware/validate.js';

const router = express.Router();

// All manufacturing routes require authentication
router.use(authenticate);

// ============================================
// KILN ROUTES - DISABLED (Kiln model not available)
// ============================================
// All kiln-related routes have been disabled as the Kiln model is not available in this configuration

// ============================================
// BRICK BATCH ROUTES
// ============================================

/**

 * @swagger

 * /manufacturing/batches:

 *   get:

 *     summary: Get all brick batches

 *     description: Retrieve list of all production batches

 *     tags: [Manufacturing]

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

 *         description: Batches retrieved successfully
 */
router.get('/batches', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getBrickBatches);
/**

 * @swagger

 * /manufacturing/batches/active:

 *   get:

 *     summary: Get active batches

 *     description: Retrieve currently active production batches

 *     tags: [Manufacturing]

 *     security:

 *       - bearerAuth: []

 *     responses:

 *       200:

 *         description: Active batches retrieved successfully
 */
router.get('/batches/active', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), getActiveBatches);
/**

 * @swagger

 * /manufacturing/batches/{id}:

 *   get:

 *     summary: Get single batch

 *     description: Retrieve details of a specific brick batch

 *     tags: [Manufacturing]

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

 *         description: Batch retrieved successfully

 *       404:

 *         description: Batch not found
 */
router.get('/batches/:id', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getBrickBatch);
router.put('/batches/:id', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), updateBrickBatch);
/**

 * @swagger

 * /manufacturing/batches:

 *   post:

 *     summary: Create batch

 *     description: Create a new brick production batch

 *     tags: [Manufacturing]

 *     security:

 *       - bearerAuth: []

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               plannedQty:
 *                 type: number
 *               unit:
 *                 type: string
 *               status:
 *                 type: string
 *               scheduledStartDate:
 *                 type: string
 *                 format: date
 *               rawMaterials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     unitCost:
 *                       type: number
 *               labourItemId:
 *                 type: string
 *               labourItemName:
 *                 type: string
 *               labourStatus:
 *                 type: string
 *               labourPaymentType:
 *                 type: string
 *               labourQuantity:
 *                 type: number
 *               labourRate:
 *                 type: number
 *               ratePerDay:
 *                 type: number
 *               notes:
 *                 type: string

 *     responses:

 *       201:

 *         description: Batch created successfully
 */
router.post('/batches', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), brickBatchValidation, createBrickBatch);

// Batch workflow

/**
 * @swagger
 * /manufacturing/batches/mark-paid:
 *   patch:
 *     summary: Mark multiple batches as paid for labour
 *     description: Bulk update of batches setting labourStatus to Paid
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Batches marked paid
 */
router.patch('/batches/mark-paid', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), markBatchesPaid);

/**

 * @swagger

 * /manufacturing/batches/{id}/start:

 *   post:

 *     summary: Start batch production

 *     description: Begin production for a batch

 *     tags: [Manufacturing]

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

 *         description: Batch production started successfully

 *       404:

 *         description: Batch not found
 */
router.post('/batches/:id/start', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), startBatchProduction);
/**

 * @swagger

 * /manufacturing/batches/{id}/move-to-kiln:

 *   post:

 *     summary: Move batch to kiln

 *     description: Transfer batch to kiln for drying/firing

 *     tags: [Manufacturing]

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


 *             required: [kilnId]


 *             properties:


 *               kilnId:


 *                 type: string

 *     responses:

 *       200:

 *         description: Batch moved to kiln successfully

 *       404:

 *         description: Batch or kiln not found
 */
router.post('/batches/:id/move-to-kiln', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), moveBatchToKiln);
/**

 * @swagger

 * /manufacturing/batches/{id}/complete:

 *   post:

 *     summary: Complete batch

 *     description: Mark batch as complete and ready for dispatch

 *     tags: [Manufacturing]

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

 *         description: Batch completed successfully

 *       404:

 *         description: Batch not found
 */
// the original path used incorrect prefix and POST method. the frontend now issues a PATCH to /batches/:id/complete
router.patch('/batches/:id/complete', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), completeBatch);
// legacy support (optional) - keep old path but respond as well
router.post('/brick-batches/:id/complete', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), completeBatch);

// Batch delete/cancel
/**
 * @swagger
 * /manufacturing/batches/{id}:
 *   delete:
 *     summary: Delete a brick batch (soft delete)
 *     tags: [Manufacturing]
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
 *         description: Batch deleted successfully
 */
router.delete('/batches/:id', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), deleteBatch);

/**
 * @swagger
 * /manufacturing/batches/{id}/cancel:
 *   patch:
 *     summary: Cancel a brick batch
 *     description: Soft-delete the batch and optionally revert stock
 *     tags: [Manufacturing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Batch cancelled successfully
 */
router.patch('/batches/:id/cancel', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), cancelBatch);

/**
 * @swagger
 * /manufacturing/batches/{id}/quality-check:
 *   patch:
 *     summary: Record a quality check result for a batch
 *     tags: [Manufacturing]
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
 *               grade:
 *                 type: string
 *               passRate:
 *                 type: number
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quality check recorded
 */
router.patch('/batches/:id/quality-check', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), qualityCheckBatch);

// Batch details
/**

 * @swagger

 * /manufacturing/batches/{id}/labour:

 *   post:

 *     summary: Add labour entry to batch

 *     description: Record labour cost entry for batch production

 *     tags: [Manufacturing]

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


 *             required: [workers, days, rate]


 *             properties:


 *               workers:


 *                 type: number


 *               days:


 *                 type: number


 *               rate:


 *                 type: number

 *     responses:

 *       201:

 *         description: Labour entry created successfully
 */
/**

 * @swagger

 * /manufacturing/batches/{id}/raw-materials:

 *   post:

 *     summary: Add raw material entry to batch

 *     description: Record raw material usage for batch production

 *     tags: [Manufacturing]

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


 *             required: [materialId, quantity, cost]


 *             properties:


 *               materialId:


 *                 type: string


 *               quantity:


 *                 type: number


 *               cost:


 *                 type: number

 *     responses:

 *       201:

 *         description: Raw material entry created successfully
 */
router.post('/batches/:id/raw-materials', authorize(...ROLE_GROUPS.PRODUCTION_TEAM), addRawMaterial);

// ============================================
// CALCULATION PREVIEWS
// ============================================

/**

 * @swagger

 * /manufacturing/calculate/labour-cost:

 *   post:

 *     summary: Calculate labour cost preview

 *     description: Preview labour cost calculations

 *     tags: [Manufacturing]

 *     security:

 *       - bearerAuth: []

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             required: [workers, days, rate]


 *             properties:


 *               workers:


 *                 type: number


 *               days:


 *                 type: number


 *               rate:


 *                 type: number

 *     responses:

 *       200:

 *         description: Labour cost calculated successfully
 */
router.post('/calculate/labour-cost', authorize(...ROLE_GROUPS.INTERNAL_STAFF), calculateLabourCostPreview);
/**

 * @swagger

 * /manufacturing/calculate/production-time:

 *   post:

 *     summary: Calculate production time preview

 *     description: Preview production time calculations

 *     tags: [Manufacturing]

 *     security:

 *       - bearerAuth: []

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             required: [kilnType, quantity]


 *             properties:


 *               kilnType:


 *                 type: string


 *               quantity:


 *                 type: number

 *     responses:

 *       200:

 *         description: Production time calculated successfully
 */
router.post('/calculate/production-time', authorize(...ROLE_GROUPS.INTERNAL_STAFF), calculateProductionTimePreview);

// ============================================
// MANUFACTURING STATS
// ============================================

router.get('/stats', authorize(...ROLE_GROUPS.MANAGEMENT), getManufacturingStats);

export default router;

