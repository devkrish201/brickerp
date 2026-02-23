import express from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import Stock from './stock.model.js';

const router = express.Router();

// Middleware
router.use(authenticate);

/**
 * GET /api/v1/inventory/stock
 * Get all stock with pagination
 */
router.get('/stock', async (req, res, next) => {
    try {
        const { page = 1, limit = 10, itemId, status, lowStock } = req.query;

        const query = {};
        if (itemId) query.itemId = itemId;
        if (status) query.status = status;
        if (lowStock === 'true' || lowStock === true) query.isLowStock = true;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            populate: ['itemId'],
            lean: true,
        };



        const result = await Stock.paginate(query, options);

        console.log("rejult", result);

        // debug logging
        console.log('GET /inventory/stock query=', query, 'returned', result.totalDocs ?? (result.pagination && result.pagination.totalCount), 'records');

        // normalize response structure (plugin may return {data,pagination} or {docs,...})
        const docs = result.data || result.docs || [];
        const pag = result.pagination || {
            total: result.totalDocs,
            pages: result.totalPages,
            currentPage: result.page,
            limit: result.limit,
        };

        res.json({
            success: true,
            data: docs,
            pagination: pag,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/inventory/stock/alerts
 * Low stock alerts (backwards compatibility)
 */
router.get('/stock/alerts', async (req, res, next) => {
    try {
        const low = await Stock.find({ isLowStock: true }).populate('itemId').lean();
        res.json({ success: true, data: low });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/inventory/stock/:id
 * Get single stock record
 */
router.get('/stock/:id', async (req, res, next) => {
    try {
        const stock = await Stock.findById(req.params.id)
            .populate('itemId');

        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock record not found',
            });
        }

        res.json({ success: true, data: stock });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/v1/inventory/stock
 * Create new stock
 */
router.post('/stock', async (req, res, next) => {
    try {
        const { itemId, quantity, unit, unitCost, reorderLevel } = req.body;

        const stock = new Stock({
            itemId,
            quantity,
            unit,
            unitCost,
            reorderLevel,
        });

        await stock.save();

        res.status(201).json({
            success: true,
            message: 'Stock record created',
            data: stock,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/v1/inventory/stock/:id
 * Update stock
 */
router.put('/stock/:id', async (req, res, next) => {
    try {
        const stock = await Stock.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock record not found',
            });
        }

        res.json({
            success: true,
            message: 'Stock updated',
            data: stock,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/v1/inventory/stock/:id
 * Delete stock
 */
router.delete('/stock/:id', async (req, res, next) => {
    try {
        const stock = await Stock.findByIdAndDelete(req.params.id);

        if (!stock) {
            return res.status(404).json({
                success: false,
                message: 'Stock record not found',
            });
        }

        res.json({
            success: true,
            message: 'Stock deleted',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/v1/inventory/low-stock
 * Get low stock items
 */
router.get('/low-stock', async (req, res, next) => {
    try {
        const lowStockItems = await Stock.getLowStock();

        res.json({
            success: true,
            data: lowStockItems,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
