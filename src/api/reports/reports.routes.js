import express from 'express';
import {
    getDashboardKPIs,
    getDashboardOverview,
    getStockLevelsReport,
    // getStockMovementReport, // Disabled - GoodsReceipt model not available
    getOpenPurchaseOrdersReport,
    getPurchaseHistoryReport,
    getProductionSummaryReport,
    // getKilnUtilizationReport, // Disabled - Kiln model not available
    // getTransportSummaryReport, // Disabled - TransportTrip model not available
    getVendorPerformanceReport,
} from './reports.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';

const router = express.Router();

// All reports require authentication
router.use(authenticate);

// ============================================
// DASHBOARD
// ============================================

/**

 * @swagger

 * /reports/dashboard:

 *   get:

 *     summary: Get dashboard overview

 *     description: Retrieve key business metrics for dashboard

 *     tags: [Reports]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: query

 *         name: period

 *         schema:

 *           type: string

 *           enum: [today, week, month]

 *     responses:

 *       200:

 *         description: Dashboard data retrieved successfully
 */
// Single-call KPI endpoint for the ERP dashboard
router.get('/dashboard-kpis', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getDashboardKPIs);

router.get('/dashboard', authorize(...ROLE_GROUPS.INTERNAL_STAFF), getDashboardOverview);

// ============================================
// STOCK REPORTS
// ============================================

/**

 * @swagger

 * /reports/stock/levels:

 *   get:

 *     summary: Get stock levels report

 *     description: Retrieve current stock levels across warehouses

 *     tags: [Reports]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: query

 *         name: warehouseId

 *         schema:

 *           type: string

 *       - in: query

 *         name: sort

 *         schema:

 *           type: string

 *     responses:

 *       200:

 *         description: Stock levels report retrieved successfully
 */
router.get('/stock/levels', authorize(...ROLE_GROUPS.WAREHOUSE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getStockLevelsReport);
/**

 * @swagger

 * /reports/stock/movement:

 *   get:

 *     summary: Get stock movement report

 *     description: Retrieve stock movements and transactions

 *     tags: [Reports]

 *     security:

 *       - bearerAuth: []

 *     parameters:

 *       - in: query

 *         name: itemId

 *         schema:

 *           type: string

 *       - in: query

 *         name: startDate

 *         schema:

 *           type: string

 *           format: date

 *       - in: query

 *         name: endDate

 *         schema:

 *           type: string

 *           format: date

 *     responses:

 *       200:

 *         description: Stock movement report retrieved successfully
 */
// router.get('/stock/movement', authorize(...ROLE_GROUPS.WAREHOUSE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getStockMovementReport);

// ============================================
// PURCHASE ORDER REPORTS
// ============================================

/**

 * @swagger

 * /reports/purchase-orders/open:

 *   get:

 *     summary: Get open purchase orders report

 *     description: Retrieve all open and pending purchase orders

 *     tags: [Reports]

 *     security:

 *       - bearerAuth: []

 *     responses:

 *       200:

 *         description: Open purchase orders report retrieved successfully
 */
router.get('/purchase-orders/open', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM, ...ROLE_GROUPS.MANAGEMENT), getOpenPurchaseOrdersReport);
router.get('/purchase-orders/history', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM, ...ROLE_GROUPS.MANAGEMENT), getPurchaseHistoryReport);

// ============================================
// PRODUCTION REPORTS
// ============================================

router.get('/production/summary', authorize(...ROLE_GROUPS.PRODUCTION_TEAM, ...ROLE_GROUPS.MANAGEMENT), getProductionSummaryReport);
// Kiln utilization report disabled - Kiln model not available
// router.get('/production/kiln-utilization', authorize(...ROLE_GROUPS.PRODUCTION_TEAM, ...ROLE_GROUPS.MANAGEMENT), getKilnUtilizationReport);

// ============================================
// TRANSPORT REPORTS
// ============================================

// Transport summary report disabled - TransportTrip model not available
// router.get('/transport/summary', authorize('logistics_manager', ...ROLE_GROUPS.MANAGEMENT), getTransportSummaryReport);

// ============================================
// VENDOR REPORTS
// ============================================

router.get('/vendors/performance', authorize(...ROLE_GROUPS.PROCUREMENT_TEAM, ...ROLE_GROUPS.MANAGEMENT), getVendorPerformanceReport);

export default router;

