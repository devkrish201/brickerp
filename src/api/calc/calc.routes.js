import express from 'express';
import { asyncHandler } from '../../middleware/error.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import {
    calculateLabourCost,
    calculateBrickLabourCost,
    calculateTransportCost,
    calculateKilnProductionTime,
    calculateCementCost,
    calculateSandCost,
    calculateGypsumCost,
    calculateEstimateTotal,
} from '../../business-rules/calculators.js';

const router = express.Router();

// Public routes for calculation previews (no auth needed for estimates)
// These can be used by frontend for live preview

/**

 * @swagger

 * /calc/labour:

 *   post:

 *     summary: Calculate labour cost

 *     description: Calculate labour cost with min/max range

 *     tags: [Calculations]

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               minDays:


 *                 type: number


 *                 example: 21


 *               maxDays:


 *                 type: number


 *                 example: 34


 *               ratePerDay:


 *                 type: number


 *                 description: Rate in rupees


 *                 example: 400

 *     responses:

 *       200:

 *         description: Labour cost calculated successfully
 */
router.post('/labour', asyncHandler(async (req, res) => {
    const { minDays, maxDays, ratePerDay } = req.body;

    const result = calculateLabourCost(
        Number(minDays) || 21,
        Number(maxDays) || 34,
        Number(ratePerDay) || 400 // ₹400 in rupees
    );

    res.json({
        success: true,
        data: result,
    });
}));

/**

 * @swagger

 * /calc/brick-labour:

 *   post:

 *     summary: Calculate brick production labour cost

 *     description: Calculate labour cost for brick production

 *     tags: [Calculations]

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               totalBricks:


 *                 type: number


 *                 example: 10000


 *               costPer1000:


 *                 type: number


 *                 description: Cost per 1000 bricks in rupees


 *                 example: 550

 *     responses:

 *       200:

 *         description: Brick labour cost calculated successfully
 */
router.post('/brick-labour', asyncHandler(async (req, res) => {
    const { totalBricks, costPer1000 } = req.body;

    const result = calculateBrickLabourCost(
        Number(totalBricks) || 10000,
        Number(costPer1000) || 550 // ₹550 in rupees
    );

    res.json({
        success: true,
        data: result,
    });
}));

/**

 * @swagger

 * /calc/transport:

 *   post:

 *     summary: Calculate transport cost

 *     description: Calculate transport cost based on distance and vehicle type

 *     tags: [Calculations]

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               totalBricks:


 *                 type: number


 *               distanceKm:


 *                 type: number


 *               vehicleType:


 *                 type: string


 *                 enum: [truck, tempo, cart]

 *     responses:

 *       200:

 *         description: Transport cost calculated successfully
 */
router.post('/transport', asyncHandler(async (req, res) => {
    const { totalBricks, distanceKm, vehicleType } = req.body;

    const result = calculateTransportCost({
        totalBricks: Number(totalBricks) || 10000,
        distanceKm: Number(distanceKm) || 10,
        vehicleType: vehicleType || 'truck',
    });

    res.json({
        success: true,
        data: result,
    });
}));

/**

 * @swagger

 * /calc/kiln-time:

 *   post:

 *     summary: Calculate kiln production time

 *     description: Calculate production time based on kiln type and quantity

 *     tags: [Calculations]

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               kilnType:


 *                 type: string


 *                 enum: [Small, Medium, Large]


 *               brickQuantity:


 *                 type: number


 *                 example: 50000

 *     responses:

 *       200:

 *         description: Kiln production time calculated successfully
 */
router.post('/kiln-time', asyncHandler(async (req, res) => {
    const { kilnType, brickQuantity } = req.body;

    const result = calculateKilnProductionTime(
        kilnType || 'Small',
        Number(brickQuantity) || 50000
    );

    res.json({
        success: true,
        data: result,
    });
}));

/**
/**

 * @swagger

 * /calc/cement:

 *   post:

 *     summary: Calculate cement cost

 *     description: Calculate total cement cost

 *     tags: [Calculations]

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               quantity:


 *                 type: number


 *                 description: Quantity in bags


 *                 example: 10


 *               pricePerBag:


 *                 type: number


 *                 description: Price in rupees


 *                 example: 350

 *     responses:

 *       200:

 *         description: Cement cost calculated successfully
 */
router.post('/cement', asyncHandler(async (req, res) => {
    const { quantity, pricePerBag } = req.body;

    const result = calculateCementCost(
        Number(quantity) || 10,
        Number(pricePerBag) || 350 // ₹350 in rupees
    );

    res.json({
        success: true,
        data: result,
    });
}));

/**

 * @swagger

 * /calc/sand:

 *   post:

 *     summary: Calculate sand cost

 *     description: Calculate total sand cost

 *     tags: [Calculations]

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               quantity:


 *                 type: number


 *                 description: Quantity in CFT


 *                 example: 100


 *               pricePerCFT:


 *                 type: number


 *                 description: Price per CFT in rupees


 *                 example: 55

 *     responses:

 *       200:

 *         description: Sand cost calculated successfully
 */
router.post('/sand', asyncHandler(async (req, res) => {
    const { quantity, pricePerCFT } = req.body;

    const result = calculateSandCost(
        Number(quantity) || 100,
        Number(pricePerCFT) || 55 // ₹55 in rupees
    );

    res.json({
        success: true,
        data: result,
    });
}));

/**

 * @swagger

 * /calc/gypsum:

 *   post:

 *     summary: Calculate gypsum cost

 *     description: Calculate total gypsum cost

 *     tags: [Calculations]

 *     requestBody:

 *       required: true

 *       content:

 *         application/json:

 *           schema:


 *             type: object


 *             properties:


 *               quantity:


 *                 type: number


 *                 description: Quantity in bags


 *                 example: 10


 *               pricePerBag:


 *                 type: number


 *                 description: Price in rupees


 *                 example: 420

 *     responses:

 *       200:

 *         description: Gypsum cost calculated successfully
 */
router.post('/gypsum', asyncHandler(async (req, res) => {
    const { quantity, pricePerBag } = req.body;

    const result = calculateGypsumCost(
        Number(quantity) || 10,
        Number(pricePerBag) || 420 // ₹420 in rupees
    );

    res.json({
        success: true,
        data: result,
    });
}));

/**

 * @route   POST /api/v1/calc/estimate

 * @desc    Calculate full estimate with materials + labour + transport

 * @body    { materials: [], labour: {}, transport: {} }
 */
router.post('/estimate', asyncHandler(async (req, res) => {
    const { materials, labour, transport } = req.body;

    const result = calculateEstimateTotal({
        materials: materials || [],
        labour: labour || { minDays: 21, maxDays: 34, ratePerDay: 400 },
        transport: transport || null,
    });

    res.json({
        success: true,
        data: result,
    });
}));

// ============================================
// PROTECTED CALCULATION ROUTES (Need Auth)
// ============================================

router.use(authenticate);

/**

 * @route   POST /api/v1/calc/full-project

 * @desc    Calculate complete project cost with all components

 * @body    { 

 *   project: { name },

 *   materials: [...],

 *   labour: { type, minDays, maxDays, ratePerDay },

 *   production: { brickQty, labourCostPer1000, kilnType },

 *   transport: { distanceKm, vehicleType }

 * }
 */
router.post('/full-project', authorize(...ROLE_GROUPS.INTERNAL_STAFF), asyncHandler(async (req, res) => {
    const { project, materials, labour, production, transport } = req.body;

    // Calculate materials
    let materialTotal = 0;
    const materialBreakdown = [];

    if (materials && Array.isArray(materials)) {
        for (const m of materials) {
            let cost = 0;
            switch (m.type?.toLowerCase()) {
                case 'cement':
                    cost = calculateCementCost(m.quantity, m.unitPrice);
                    break;
                case 'sand':
                    cost = calculateSandCost(m.quantity, m.unitPrice);
                    break;
                case 'gypsum':
                    cost = calculateGypsumCost(m.quantity, m.unitPrice);
                    break;
                default:
                    cost = { quantity: m.quantity, unitPrice: m.unitPrice, totalCost: m.quantity * m.unitPrice };
            }
            materialBreakdown.push({ name: m.name || m.type, ...cost });
            materialTotal += cost.totalCost || 0;
        }
    }

    // Calculate labour
    let labourResult = null;
    if (labour) {
        labourResult = calculateLabourCost(
            labour.minDays || 21,
            labour.maxDays || 34,
            labour.ratePerDay || 400
        );
    }

    // Calculate production
    let productionResult = null;
    if (production) {
        const brickLabour = calculateBrickLabourCost(
            production.brickQty || 10000,
            production.labourCostPer1000 || 550
        );
        const kilnTime = calculateKilnProductionTime(
            production.kilnType || 'Small',
            production.brickQty || 10000
        );
        productionResult = {
            labour: brickLabour,
            kilnTime,
            totalProductionCost: brickLabour.totalCost,
        };
    }

    // Calculate transport
    let transportResult = null;
    if (transport && transport.distanceKm) {
        transportResult = calculateTransportCost({
            totalBricks: production?.brickQty || materials?.find(m => m.type === 'brick')?.quantity || 10000,
            distanceKm: transport.distanceKm,
            vehicleType: transport.vehicleType || 'truck',
        });
    }

    // Grand total
    const grandTotal = {
        materialCost: materialTotal,
        labourCostMin: labourResult?.minCost || 0,
        labourCostMax: labourResult?.maxCost || 0,
        labourCostAvg: labourResult?.avgCost || 0,
        productionCost: productionResult?.totalProductionCost || 0,
        transportCost: transportResult?.totalCost || 0,
        totalMin: materialTotal + (labourResult?.minCost || 0) + (productionResult?.totalProductionCost || 0) + (transportResult?.totalCost || 0),
        totalMax: materialTotal + (labourResult?.maxCost || 0) + (productionResult?.totalProductionCost || 0) + (transportResult?.totalCost || 0),
    };

    res.json({
        success: true,
        data: {
            project: project || {},
            materials: materialBreakdown,
            labour: labourResult,
            production: productionResult,
            transport: transportResult,
            summary: grandTotal,
        },
    });
}));

export default router;

