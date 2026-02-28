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
    const { status, itemId, search, labourItemId, fromDate, toDate, labourStatus } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (itemId) filter.itemId = itemId;
    if (labourItemId) filter.labourItemId = labourItemId;
    if (labourStatus) filter.labourStatus = labourStatus;

    // date filtering: filter batches by startDate range
    if (fromDate || toDate) {
        const startCond = {};
        if (fromDate) {
            startCond.$gte = new Date(fromDate + 'T00:00:00.000Z');
        }
        if (toDate) {
            startCond.$lte = new Date(toDate + 'T23:59:59.999Z');
        }
        filter.startDate = startCond;
    }

    if (search) {
        filter.batchCode = { $regex: search, $options: 'i' };
    }

    const result = await simplePaginate(BrickBatch, filter, req, {
        sort: { createdAt: -1 },
        populate: [
            { path: 'itemId', select: 'name sku' },
            // bring back labour item specs so we can show the labour's actual name
            { path: 'labourItemId', select: 'name sku specifications' },
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
        .populate('labourItemId', 'name sku')
        .populate('kilnId', 'name code kilnType capacity')
        .populate('createdBy', 'name email')
        .populate('rawMaterials.itemId', 'name sku')
        .populate('transportTripId');

    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    // convert to plain object so we can attach derived props
    const result = batch.toObject({ virtuals: true });
    result.qualityCheck = {
        grade: result.qualityGrade,
        passRate: result.metadata?.qualityPassRate,
        remarks: result.qualityNotes,
        checkedBy: result.qualityCheckedBy,
        date: result.qualityCheckDate,
    };

    res.json({ success: true, data: result });
});

// Update batch
export const updateBrickBatch = asyncHandler(async (req, res) => {
    const data = { ...req.body, updatedBy: req.user?._id };
    // ignore any client-sent stockAdded flag
    delete data.stockAdded;
    // remove labourItemName because model will compute it
    delete data.labourItemName;
    // normalize notes if necessary
    if (typeof data.notes === 'string') {
        try {
            data.notes = JSON.parse(data.notes);
        } catch (e) {
            data.notes = [];
        }
    }
    // map scheduledStartDate → startDate if frontend sends it
    if (data.scheduledStartDate && !data.startDate) {
        data.startDate = data.scheduledStartDate;
    }
    delete data.scheduledStartDate;

    // if updating to completed and producedQty isn't supplied, set it from plannedQty
    if (data.status === BATCH_STATUS.COMPLETED && (data.producedQty === undefined || data.producedQty === 0)) {
        if (data.plannedQty) {
            data.producedQty = data.plannedQty;
        }
    }

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
        if (desiredQty > 0) {
            try {
                const Stock = mongoose.model('Stock');
                const existingStock = await Stock.findOne({ itemId: batch.itemId, batch: batch.batchCode });
                if (!existingStock) {
                    await Stock.updateQuantity(
                        batch.itemId,
                        desiredQty,
                        { unit: 'piece', batch: batch.batchCode }
                    );
                } else if (desiredQty > existingStock.quantity) {
                    const diff = desiredQty - existingStock.quantity;
                    await Stock.updateQuantity(
                        batch.itemId,
                        diff,
                        { unit: 'piece', batch: batch.batchCode }
                    );
                }
            } catch (err) {
                // log but don't block
                console.error('Stock update failed during batch update', err.message || err);
            }
        }
        batch.stockAdded = true;
    }

    await batch.save();
    res.json({ success: true, message: 'Brick Batch updated successfully', data: batch });
});

export const createBrickBatch = asyncHandler(async (req, res) => {
    const {
        itemId,
        plannedQty,
        brickSize,
        rawMaterials,
        labourItemId,
        labourItemName,
        labourStatus,
        labourPaymentType,
        labourQuantity,
        labourRate,
        startDate,
        scheduledStartDate,
        endDate,
        plannedEndDate,
        unit,
        notes,
        status,
        producedQty,
        qualityPassedQty,
    } = req.body;
    // ensure notes is array/object not string
    let normalizedNotes = notes;
    if (typeof notes === 'string') {
        if (notes.trim() === '') {
            normalizedNotes = [];
        } else {
            try {
                normalizedNotes = JSON.parse(notes);
            } catch (e) {
                normalizedNotes = [];
            }
        }
    }

    // scheduledStartDate is the frontend field name; map it to startDate
    const resolvedStartDate = startDate || scheduledStartDate || undefined;

    // ignore any labourItemName supplied by client; pre-save hook will resolve from item
    const batch = new BrickBatch({
        itemId,
        plannedQty,
        unit: unit || 'piece',
        brickSize: brickSize || { type: 'standard' },
        rawMaterials: rawMaterials || [],
        labourItemId,
        labourStatus,
        labourPaymentType,
        labourQuantity,
        labourRate,
        startDate: resolvedStartDate,
        endDate,
        plannedEndDate,
        notes: normalizedNotes,
        status: status || BATCH_STATUS.DRAFT,
        producedQty: producedQty || 0,
        qualityPassedQty: qualityPassedQty || 0,
        createdBy: req.user._id,
        _auditUser: req.user._id,
    });

    // if the batch is already completed but producedQty wasn't given, default it
    if (batch.status === BATCH_STATUS.COMPLETED && (!batch.producedQty || batch.producedQty === 0)) {
        batch.producedQty = batch.plannedQty || 0;
    }

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
    // note: route now supports PATCH to align with frontend service (was previously POST to /brick-batches)
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

// hard/soft delete a batch (standard DELETE endpoint)
export const deleteBatch = asyncHandler(async (req, res) => {
    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }
    if (typeof batch.softDelete === 'function') {
        await batch.softDelete(req.user?._id || null);
    } else {
        await batch.remove();
    }
    res.json({ success: true, message: 'Batch deleted successfully' });
});

// cancel/soft-delete a batch (used by frontend "delete" action)
export const cancelBatch = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    // revert any raw material stock deductions that were done
    if (batch.rawMaterials && batch.rawMaterials.length) {
        for (const material of batch.rawMaterials) {
            if (material.stockDeducted) {
                await Stock.updateQuantity(material.itemId, material.quantity);
                material.stockDeducted = false;
            }
        }
    }

    // if finished goods were added to inventory, remove them
    if (batch.stockAdded) {
        const qty = batch.qualityPassedQty > 0 ? batch.qualityPassedQty : (batch.producedQty || batch.plannedQty || 0);
        if (qty > 0) {
            await Stock.updateQuantity(batch.itemId, -qty, { unit: batch.unit || 'piece', batch: batch.batchCode });
        }
    }

    // store cancel reason in metadata so it can be audited later
    if (reason) {
        if (!batch.metadata) batch.metadata = {};
        batch.metadata.cancelReason = reason;
    }

    // perform soft delete if plugin available
    if (typeof batch.softDelete === 'function') {
        await batch.softDelete(req.user?._id || null);
    } else {
        await batch.remove();
    }

    res.json({ success: true, message: 'Batch cancelled successfully' });
});

// quality check endpoint separate from completion
export const qualityCheckBatch = asyncHandler(async (req, res) => {
    const { grade, passRate, remarks } = req.body;
    const batch = await BrickBatch.findById(req.params.id);
    if (!batch) {
        throw new ApiError(404, 'Brick Batch not found');
    }

    if (grade) batch.qualityGrade = grade;
    if (typeof passRate !== 'undefined') {
        // no explicit field for passRate, store under metadata
        batch.metadata = batch.metadata || {};
        batch.metadata.qualityPassRate = passRate;
    }
    if (remarks) batch.qualityNotes = remarks;

    batch.qualityCheckedBy = req.user._id;
    batch.qualityCheckDate = new Date();

    await batch.save();
    res.json({ success: true, message: 'Quality check recorded', data: batch });
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
// BULK OPERATIONS
// ============================================

export const markBatchesPaid = asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'No batch IDs provided');
    }

    const result = await BrickBatch.updateMany(
        { _id: { $in: ids } },
        { $set: { labourStatus: 'Paid' } }
    );

    res.json({ success: true, message: 'Batches marked paid', modifiedCount: result.nModified || result.modifiedCount });
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
    cancelBatch,
    deleteBatch,
    qualityCheckBatch,
    addRawMaterial,
    // Calculations
    calculateLabourCostPreview,
    calculateProductionTimePreview,
    // Stats
    getManufacturingStats,
};

