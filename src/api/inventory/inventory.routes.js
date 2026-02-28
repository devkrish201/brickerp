import express from 'express';
import mongoose from 'mongoose';
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
        const { page = 1, limit = 10, itemId, status, lowStock, categoryId, groupBy } = req.query;

        const query = {};
        if (itemId) query.itemId = itemId;
        if (status) query.status = status;
        if (lowStock === 'true' || lowStock === true) query.isLowStock = true;
        if (categoryId) query.categoryId = categoryId;

        // support aggregated view by item (ignore pagination for now)
        if (groupBy === 'item') {
            const docs = await Stock.aggregateByItem(query);
            return res.json({
                success: true,
                data: docs,
                pagination: {
                    total: docs.length,
                    pages: 1,
                    currentPage: 1,
                    limit: docs.length,
                },
            });
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            populate: ['itemId', 'categoryId'],
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
 * GET /api/v1/inventory/stock/item/:itemId
 * Return aggregated stock result for a single item (quantity, available, etc.)
 */
router.get('/stock/item/:itemId', async (req, res, next) => {
    try {
        const itemId = req.params.itemId;
        let objId;
        try {
            objId = new mongoose.Types.ObjectId(itemId);
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid itemId' });
        }
        const docs = await Stock.aggregateByItem({ itemId: objId });
        const data = docs.length ? docs[0] : null;
        res.json({ success: true, data });
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
            .populate('itemId')
            .populate('categoryId');

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
