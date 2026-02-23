import express from 'express';
import multer from 'multer';
import {
    getImportTemplates,
    downloadImportTemplate,
    importItems,
    importVendors,
    exportItems,
    exportVendors,
    exportStock,
    exportPurchaseOrders,
    exportProductionBatches,
    // exportTransportTrips, // Disabled - TransportTrip model not available
} from './excel.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'), false);
        }
    },
});

// All excel routes require authentication
router.use(authenticate);

// ============================================
// IMPORT TEMPLATES
// ============================================

/**
 * @swagger
 * /excel/templates:
 *   get:
 *     summary: Get import templates
 *     description: Retrieve available Excel templates for import
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 */
router.get('/templates', authorize(...ROLE_GROUPS.MANAGEMENT), getImportTemplates);

/**
 * @swagger
 * /excel/templates/{type}/download:
 *   get:
 *     summary: Download import template
 *     description: Download Excel template for bulk import
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [items, vendors]
 *     responses:
 *       200:
 *         description: Template file downloaded successfully
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/templates/:type/download', authorize(...ROLE_GROUPS.MANAGEMENT), downloadImportTemplate);

// ============================================
// IMPORT ENDPOINTS
// ============================================

/**
 * @swagger
 * /excel/import/items:
 *   post:
 *     summary: Import items from Excel
 *     description: Bulk import items using Excel file
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Items imported successfully
 */
router.post(
    '/import/items',
    authorize(...ROLE_GROUPS.MANAGEMENT),
    upload.single('file'),
    importItems
);

/**
 * @swagger
 * /excel/import/vendors:
 *   post:
 *     summary: Import vendors from Excel
 *     description: Bulk import vendors using Excel file
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Vendors imported successfully
 */
router.post(
    '/import/vendors',
    authorize(...ROLE_GROUPS.PROCUREMENT_TEAM),
    upload.single('file'),
    importVendors
);

// ============================================
// EXPORT ENDPOINTS
// ============================================

/**
 * @swagger
 * /excel/export/items:
 *   get:
 *     summary: Export items to Excel
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file generated
 */
router.get('/export/items', authorize(...ROLE_GROUPS.INTERNAL_STAFF), exportItems);

/**
 * @swagger
 * /excel/export/vendors:
 *   get:
 *     summary: Export vendors to Excel
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file generated
 */
router.get('/export/vendors', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM, ...ROLE_GROUPS.MANAGEMENT), exportVendors);

/**
 * @swagger
 * /excel/export/stock:
 *   get:
 *     summary: Export stock to Excel
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file generated
 */
router.get('/export/stock', authorize(...ROLE_GROUPS.WAREHOUSE_TEAM, ...ROLE_GROUPS.MANAGEMENT), exportStock);

/**
 * @swagger
 * /excel/export/purchase-orders:
 *   get:
 *     summary: Export purchase orders to Excel
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file generated
 */
router.get('/export/purchase-orders', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM, ...ROLE_GROUPS.MANAGEMENT), exportPurchaseOrders);

/**
 * @swagger
 * /excel/export/production-batches:
 *   get:
 *     summary: Export production batches to Excel
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file generated
 */
router.get('/export/production-batches', authorize(...ROLE_GROUPS.PRODUCTION_TEAM, ...ROLE_GROUPS.MANAGEMENT), exportProductionBatches);

/**
 * @swagger
 * /excel/export/transport-trips:
 *   get:
 *     summary: Export transport trips to Excel
 *     tags: [Excel]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel file generated
 */
// Transport trips export disabled - TransportTrip model not available
// router.get('/export/transport-trips', authorize('logistics_manager', ...ROLE_GROUPS.MANAGEMENT), exportTransportTrips);

export default router;

