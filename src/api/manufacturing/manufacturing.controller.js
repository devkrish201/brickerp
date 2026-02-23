import mongoose from 'mongoose';
// import Kiln from './kiln.model.js'; // Kiln model not available
import BrickBatch from './batch.model.js';
import Stock from '../inventory/stock.model.js';
import { asyncHandler, ApiError } from '../../middleware/error.js';
import { simplePaginate } from '../../utils/paginatePlugin.js';
import { BATCH_STATUS } from '../../config/constants.js';
import { calculateBrickLabourCost, calculateKilnProductionTime } from '../../business-rules/calculators.js';

// ============================================
// KILN CONTROLLERS (DISABLED - Model not available)
// ============================================

// Kiln-related controllers commented out as kiln.model.js is not available

// ============================================
// BRICK BATCH CONTROLLERS
// ============================================

export const getBrickBatches = asyncHandler(async (req, res) => {
    const { status, itemId, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (itemId) filter.itemId = itemId;
    if (search) {
        filter.batchCode = { $regex: search, $options: 'i' };
    }

    const result = await simplePaginate(BrickBatch, filter, req, {
        sort: { createdAt: -1 },
        populate: [
            { path: 'itemId', select: 'name sku' },
            { path: 'createdBy', select: 'name' },
        ],
    });

    res.json(result);
});

export const getActiveBatches = asyncHandler(async (req, res) => {
    const batches = await BrickBatch.getActive(); // pending only
    res.json({ success: true, data: batches });
});

export const getBrickBatch = asyncHandler(async (req, res) => {
    const batch = await BrickBatch.findById(req.params.id)
        .populate('itemId', 'name sku specifications')
        .populate('kilnId', 'name code kilnType capacity')
        .populate('createdBy', 'name email')
        .populate('rawMaterials.itemId', 'name sku')
        .populate('labourEntries.workerId', 'name')
        .populate('transportTripId');

    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    res.json({ success: true, data: batch });
});

// Update batch
export const updateBrickBatch = asyncHandler(async (req, res) => {
    const data = { ...req.body, updatedBy: req.user?._id };
    // ignore any client-sent stockAdded flag
    delete data.stockAdded;

    // fetch existing batch to compare status before update
    const existing = await BrickBatch.findById(req.params.id);
    if (!existing) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    const wasCompleted = existing.status === BATCH_STATUS.COMPLETED;

    // apply updates and save so pre/post hooks run
    Object.assign(existing, data);
    const batch = await existing.save();

    // when batch is complete ensure stock exists (handles missing-flag and stale batches)
    if (batch.status === BATCH_STATUS.COMPLETED) {
        // calculate quantity that *should* be in stock for this batch
        const desiredQty =
            (batch.qualityPassedQty && batch.qualityPassedQty > 0)
                ? batch.qualityPassedQty
                : (batch.producedQty || batch.plannedQty || 0);

        const existingStock = await Stock.findOne({ itemId: batch.itemId, batch: batch.batchCode });
        if (!existingStock) {
            if (desiredQty > 0) {
                await Stock.updateQuantity(
                    batch.itemId,
                    desiredQty,
                    {
                        unit: 'piece',
                        batch: batch.batchCode,
                    }
                );
            }
        } else {
            // if record exists but quantity is lower than desired, top it up
            if (desiredQty > existingStock.quantity) {
                const diff = desiredQty - existingStock.quantity;
                await Stock.updateQuantity(
                    batch.itemId,
                    diff,
                    {
                        unit: 'piece',
                        batch: batch.batchCode,
                    }
                );
            }
        }

        // always mark flag true once status is completed
        if (!batch.stockAdded) {
            batch.stockAdded = true;
            await batch.save();
        }
    }

    res.json({ success: true, message: 'Brick Batch updated successfully', data: batch });
});

export const createBrickBatch = asyncHandler(async (req, res) => {
    const {
        itemId,
        plannedQty,
        brickSize,
        rawMaterials,
        startDate,
        status,
        producedQty,
        qualityPassedQty,
    } = req.body;


    const batch = new BrickBatch({
        itemId,
        plannedQty,
        brickSize: brickSize || { type: 'standard' },
        rawMaterials: rawMaterials || [],
        startDate,
        status: status || BATCH_STATUS.DRAFT,
        producedQty: producedQty || 0,
        qualityPassedQty: qualityPassedQty || 0,
        createdBy: req.user._id,
        _auditUser: req.user._id,
    });

    await batch.save();

    // if client created batch already completed, post to stock immediately
    if (batch.status === BATCH_STATUS.COMPLETED) {
        const qty =
            (batch.qualityPassedQty && batch.qualityPassedQty > 0)
                ? batch.qualityPassedQty
                : (batch.producedQty || batch.plannedQty || 0);
        if (qty > 0) {
            await Stock.updateQuantity(
                batch.itemId,
                qty,
                {
                    unit: 'piece',
                    batch: batch.batchCode,
                }
            );
        }
        batch.stockAdded = true;
        await batch.save();
    }

    res.status(201).json({
        success: true,
        message: 'Brick Batch created successfully',
        data: batch,
    });
});

export const startBatchProduction = asyncHandler(async (req, res) => {
    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    // transition from draft -> pending
    await batch.startProduction(req.body.startDate || new Date());

    // Deduct raw materials from stock (no warehouse)
    if (req.body.deductStock !== false && batch.rawMaterials.length > 0) {
        // simply deduct without transactions (transactions require replica set)
        for (const material of batch.rawMaterials) {
            if (!material.stockDeducted) {
                await Stock.updateQuantity(
                    material.itemId,
                    -material.quantity,
                );
                material.stockDeducted = true;
            }
        }
        await batch.save();
    }

    res.json({
        success: true,
        message: 'Batch production started',
        data: batch,
    });
});

export const moveBatchToKiln = asyncHandler(async (req, res) => {
    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    // status remains pending under simplified model
    await batch.moveToKiln();

    // Kiln status update disabled as Kiln model is not available
    // if (batch.kilnId) {
    //     const kiln = await Kiln.findById(batch.kilnId);
    //     if (kiln) {
    //         kiln.status = 'Firing';
    //         await kiln.save();
    //     }
    // }

    res.json({
        success: true,
        message: 'Batch moved to kiln',
        data: batch,
    });
});

export const completeBatch = asyncHandler(async (req, res) => {
    const { producedQty, qualityPassedQty, rejectedQty, qualityGrade, qualityNotes } = req.body;

    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    await batch.complete(producedQty, qualityPassedQty, rejectedQty || 0);

    batch.qualityGrade = qualityGrade;
    batch.qualityNotes = qualityNotes;
    batch.qualityCheckedBy = req.user._id;
    batch.qualityCheckDate = new Date();

    // if stock not yet added and we are completing
    const stockQty =
        qualityPassedQty > 0
            ? qualityPassedQty
            : (producedQty || batch.plannedQty || 0);
    if (!batch.stockAdded && stockQty > 0) {
        await Stock.updateQuantity(
            batch.itemId,
            stockQty,
            {
                unit: 'piece',
                batch: batch.batchCode,
            }
        );
        batch.stockAdded = true;
    }

    await batch.save();

    res.json({
        success: true,
        message: 'Batch completed successfully',
        data: batch,
    });
});

export const addLabourEntry = asyncHandler(async (req, res) => {
    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    await batch.addLabourEntry(req.body);

    res.json({
        success: true,
        message: 'Labour entry added',
        data: batch.labourEntries,
    });
});

export const addRawMaterial = asyncHandler(async (req, res) => {
    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    batch.rawMaterials.push(req.body);
    await batch.save();

    res.json({
        success: true,
        message: 'Raw material added',
        data: batch.rawMaterials,
    });
});

// ============================================
// CALCULATION PREVIEWS
// ============================================

export const calculateLabourCostPreview = asyncHandler(async (req, res) => {
    const { totalBricks, costPer1000 } = req.body;

    const result = calculateBrickLabourCost(totalBricks, costPer1000);

    res.json({
        success: true,
        data: result,
    });
});

export const calculateProductionTimePreview = asyncHandler(async (req, res) => {
    const { kilnType, brickQuantity } = req.body;

    const result = calculateKilnProductionTime(kilnType, brickQuantity);

    res.json({
        success: true,
        data: result,
    });
});

// ============================================
// MANUFACTURING STATS
// ============================================

export const getManufacturingStats = asyncHandler(async (req, res) => {
    const { dateFrom, dateTo } = req.query;

    const matchStage = {};
    if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
        if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
    }

    const stats = await BrickBatch.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalBatches: { $sum: 1 },
                completedBatches: { $sum: { $cond: [{ $eq: ['$status', BATCH_STATUS.COMPLETED] }, 1, 0] } },
                activeBatches: { $sum: { $cond: [{ $eq: ['$status', BATCH_STATUS.PENDING] }, 1, 0] } },
                totalQuantity: { $sum: '$plannedQty' },
                totalProducedQty: { $sum: { $ifNull: ['$producedQty', 0] } },
                avgProductionCost: { $avg: '$totalCost' },
                totalLabourCost: { $sum: { $ifNull: ['$labourCost', 0] } },
            },
        },
    ]);

    // Kiln utilization - disabled as Kiln model is not available
    // const kilnStats = await Kiln.aggregate([...]);

    res.json({
        success: true,
        data: {
            batchStats: stats[0] || {},
            kilnStats: {},
        },
    });
});

export default {
    // Kilns - disabled, model not available
    // Brick Batches
    getBrickBatches,
    getActiveBatches,
    getBrickBatch,
    createBrickBatch,
    startBatchProduction,
    moveBatchToKiln,
    completeBatch,
    addLabourEntry,
    addRawMaterial,
    // Calculations
    calculateLabourCostPreview,
    calculateProductionTimePreview,
    // Stats
    getManufacturingStats,
};

