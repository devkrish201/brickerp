import Vendor from './vendor.model.js';
import Estimate from './estimate.model.js';
import PurchaseOrder from './po.model.js';
import Item from '../catalog/item.model.js';
import mongoose from 'mongoose';
import { asyncHandler, ApiError } from '../../middleware/error.js';
import { simplePaginate } from '../../utils/paginatePlugin.js';
import { ESTIMATE_STATUS, PO_STATUS } from '../../config/constants.js';
import { calculateCompleteEstimate } from '../../business-rules/calculators.js';

// ============================================
// VENDOR CONTROLLERS
// ============================================

/**
 * Get all vendors (paginated)
 */
export const getVendors = asyncHandler(async (req, res) => {
    const { search, active, verified } = req.query;
    const filter = { blacklisted: false };

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } },
            { 'contact.contactPerson': { $regex: search, $options: 'i' } },
        ];
    }
    if (active !== undefined) filter.active = active === 'true';
    if (verified !== undefined) filter.verified = verified === 'true';

    const result = await simplePaginate(Vendor, filter, req, {
        sort: { createdAt: -1 },
        select: 'name code contact address active verified rating totalOrders',
    });

    res.json(result);
});

/**
 * Get single vendor
 */
export const getVendor = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id)
        .populate('supplyCategories', 'name')
        .populate('supplyItems', 'name sku');

    if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
    }

    res.json({ success: true, data: vendor });
});

/**
 * Create vendor
 */
export const createVendor = asyncHandler(async (req, res) => {
    const vendor = new Vendor({
        ...req.body,
        _auditUser: req.user._id,
    });
    await vendor.save();

    res.status(201).json({
        success: true,
        message: 'Vendor created successfully',
        data: vendor,
    });
});

/**
 * Update vendor
 */
export const updateVendor = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
    );

    if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
    }

    res.json({
        success: true,
        message: 'Vendor updated successfully',
        data: vendor,
    });
});

/**
 * Delete vendor
 */
export const deleteVendor = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
    }

    // Check for linked POs
    const linkedPOs = await PurchaseOrder.countDocuments({ vendorId: vendor._id });
    if (linkedPOs > 0) {
        throw new ApiError(400, 'Cannot delete vendor with linked purchase orders');
    }

    await vendor.softDelete(req.user._id);

    res.json({
        success: true,
        message: 'Vendor deleted successfully',
    });
});

// ============================================
// ESTIMATE CONTROLLERS
// ============================================

/**
 * Get all estimates (paginated)
 */
export const getEstimates = asyncHandler(async (req, res) => {
    const { search, status, createdBy } = req.query;
    const filter = {};

    if (search) {
        filter.$or = [
            { estimateNumber: { $regex: search, $options: 'i' } },
            { clientName: { $regex: search, $options: 'i' } },
            { projectName: { $regex: search, $options: 'i' } },
        ];
    }
    if (status) filter.status = status;
    if (createdBy) filter.createdBy = createdBy;

    const result = await simplePaginate(Estimate, filter, req, {
        sort: { createdAt: -1 },
        populate: { path: 'createdBy', select: 'name email' },
    });

    res.json(result);
});

/**
 * Get single estimate
 */
export const getEstimate = asyncHandler(async (req, res) => {
    const estimate = await Estimate.findById(req.params.id)
        .populate('items.itemId', 'name sku costType')
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('linkedPurchaseOrderId', 'poNumber status');

    if (!estimate) {
        throw new ApiError(404, 'Estimate not found');
    }

    res.json({ success: true, data: estimate });
});

/**
 * Create estimate
 */
export const createEstimate = asyncHandler(async (req, res) => {
    const { clientName, clientContact, projectName, projectDescription, items, labourSummary, validUntil } = req.body;

    // Validate items exist
    const itemIds = items.map(i => i.itemId);
    const existingItems = await Item.find({ _id: { $in: itemIds } });
    if (existingItems.length !== itemIds.length) {
        throw new ApiError(400, 'One or more items not found');
    }

    const estimate = new Estimate({
        clientName,
        clientContact,
        projectName,
        projectDescription,
        items,
        labourSummary,
        validUntil,
        createdBy: req.user._id,
        _auditUser: req.user._id,
    });

    await estimate.save();

    res.status(201).json({
        success: true,
        message: 'Estimate created successfully',
        data: estimate,
    });
});

/**
 * Update estimate
 */
export const updateEstimate = asyncHandler(async (req, res) => {
    const estimate = await Estimate.findById(req.params.id);
    if (!estimate) {
        throw new ApiError(404, 'Estimate not found');
    }

    if (estimate.status !== ESTIMATE_STATUS.DRAFT) {
        throw new ApiError(400, 'Only draft estimates can be updated');
    }

    Object.assign(estimate, req.body);
    estimate.updatedBy = req.user._id;
    await estimate.save();

    res.json({
        success: true,
        message: 'Estimate updated successfully',
        data: estimate,
    });
});

/**
 * Approve estimate
 */
export const approveEstimate = asyncHandler(async (req, res) => {
    const estimate = await Estimate.findById(req.params.id);
    if (!estimate) {
        throw new ApiError(404, 'Estimate not found');
    }

    if (estimate.status !== ESTIMATE_STATUS.DRAFT) {
        throw new ApiError(400, 'Only draft estimates can be approved');
    }

    await estimate.approve(req.user._id);

    res.json({
        success: true,
        message: 'Estimate approved successfully',
        data: estimate,
    });
});

/**
 * Convert estimate to PO
 */
export const convertEstimateToPO = asyncHandler(async (req, res) => {
    const { vendorId, expectedDeliveryDate, deliveryAddress, warehouseId } = req.body;

    const estimate = await Estimate.findById(req.params.id);
    if (!estimate) {
        throw new ApiError(404, 'Estimate not found');
    }

    if (estimate.status !== ESTIMATE_STATUS.APPROVED) {
        throw new ApiError(400, 'Only approved estimates can be converted to PO');
    }

    // Validate vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.active) {
        throw new ApiError(400, 'Invalid or inactive vendor');
    }

    // Create PO from estimate
    const po = await PurchaseOrder.createFromEstimate(estimate, vendorId, req.user._id);

    // Update PO with additional details
    if (expectedDeliveryDate) po.expectedDeliveryDate = expectedDeliveryDate;
    if (deliveryAddress) po.deliveryAddress = deliveryAddress;
    if (warehouseId) po.warehouseId = warehouseId;
    await po.save();

    res.status(201).json({
        success: true,
        message: 'Estimate converted to PO successfully',
        data: {
            estimate,
            purchaseOrder: po,
        },
    });
});

/**
 * Calculate estimate preview
 */
export const calculateEstimatePreview = asyncHandler(async (req, res) => {
    const result = calculateCompleteEstimate(req.body);
    res.json({
        success: true,
        data: result,
    });
});

// ============================================
// PURCHASE ORDER CONTROLLERS
// ============================================

/**
 * Get all POs (paginated)
 */
export const getPurchaseOrders = asyncHandler(async (req, res) => {
    const { search, status, vendorId, createdBy } = req.query;
    const filter = {};

    if (search) {
        filter.$or = [
            { poNumber: { $regex: search, $options: 'i' } },
        ];
    }
    if (status) filter.status = status;
    if (vendorId) filter.vendorId = vendorId;
    if (createdBy) filter.createdBy = createdBy;

    const result = await simplePaginate(PurchaseOrder, filter, req, {
        sort: { createdAt: -1 },
        populate: [
            { path: 'vendorId', select: 'name code' },
            { path: 'createdBy', select: 'name email' },
        ],
    });

    res.json(result);
});

/**
 * Get single PO
 */
export const getPurchaseOrder = asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findById(req.params.id)
        .populate('items.itemId', 'name sku costType units')
        .populate('vendorId', 'name code contact address')
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('sourceEstimateId', 'estimateNumber clientName')
        .populate('goodsReceipts');

    if (!po) {
        throw new ApiError(404, 'Purchase Order not found');
    }

    res.json({ success: true, data: po });
});

/**
 * Create PO
 */
export const createPurchaseOrder = asyncHandler(async (req, res) => {
    const { vendorId, items, expectedDeliveryDate, deliveryAddress, warehouseId, paymentTerms } = req.body;

    // Validate vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.active) {
        throw new ApiError(400, 'Invalid or inactive vendor');
    }

    // Validate items and get current prices
    const itemIds = items.map(i => i.itemId);
    const existingItems = await Item.find({ _id: { $in: itemIds } });
    if (existingItems.length !== itemIds.length) {
        throw new ApiError(400, 'One or more items not found');
    }

    // Prepare items with locked prices
    const poItems = items.map(item => {
        const existingItem = existingItems.find(ei => ei._id.toString() === item.itemId);
        return {
            itemId: item.itemId,
            description: item.description || existingItem.name,
            qty: item.qty,
            unit: item.unit || existingItem.defaultUnit,
            unitPriceLocked: item.unitPrice || existingItem.defaultUnitPrice,
            notes: item.notes,
        };
    });

    const po = new PurchaseOrder({
        // Do NOT accept client-supplied poNumber on create — model will generate a unique poNumber
        vendorId,
        items: poItems,
        expectedDeliveryDate,
        deliveryAddress,
        warehouseId,
        paymentTerms,
        createdBy: req.user._id,
        _auditUser: req.user._id,
    });

    // Save with retry on duplicate-poNumber (race protection + interim safety)
    const MAX_SAVE_RETRIES = 5;
    let saved = false;
    let lastErr;

    for (let attempt = 1; attempt <= MAX_SAVE_RETRIES; attempt++) {
        try {
            await po.save();
            saved = true;
            break;
        } catch (err) {
            lastErr = err;
            // Detect duplicate key error on poNumber and retry (model will request next counter value)
            const isDup = err && (err.code === 11000 || err.name === 'MongoServerError') && /poNumber/.test(String(err.message));
            if (isDup && attempt < MAX_SAVE_RETRIES) {
                // If a client supplied poNumber, do not overwrite — tell caller instead
                if (req.body.poNumber) {
                    // let the outer catch handle returning the duplicate error
                    throw err;
                }

                // Defensive sync: ensure counters for the PO month are at least the current max
                try {
                    const poDate = po.poDate || new Date();
                    const year = poDate.getFullYear();
                    const month = String(poDate.getMonth() + 1).padStart(2, '0');
                    const ym = `${year}${month}`;
                    const id = `po_${ym}`;

                    // Find highest existing PO sequence for this month
                    const last = await mongoose.model('PurchaseOrder')
                        .findOne({ poNumber: new RegExp(`^PO-${ym}-`) })
                        .sort({ poNumber: -1 })
                        .select('poNumber')
                        .lean();

                    if (last && last.poNumber) {
                        const m = String(last.poNumber).match(/-(\d+)$/);
                        const maxSeq = m ? parseInt(m[1], 10) : null;
                        if (maxSeq) {
                            const countersColl = mongoose.connection.collection('counters');
                            const cur = await countersColl.findOne({ _id: id });
                            if (!cur || (cur.seq || 0) < maxSeq) {
                                await countersColl.updateOne(
                                    { _id: id },
                                    { $set: { seq: maxSeq, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
                                    { upsert: true }
                                );
                                // eslint-disable-next-line no-console
                                console.warn(`Synchronized counters['${id}'] => ${maxSeq} due to duplicate poNumber`);
                            }
                        }
                    }
                } catch (syncErr) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to sync PO counter while handling duplicate:', syncErr);
                    // continue to retry anyway
                }

                // clear generated value so pre('validate') will obtain next sequence on retry
                po.poNumber = undefined;
                // small delay could help under extreme contention
                await new Promise(r => setTimeout(r, 50 * attempt));
                continue;
            }
            // other errors or max retries reached -> rethrow
            throw err;
        }
    }

    if (!saved) throw lastErr || new Error('Failed to save PurchaseOrder');

    res.status(201).json({
        success: true,
        message: 'Purchase Order created successfully',
        data: po,
    });
});

/**
 * Update PO
 */
export const updatePurchaseOrder = asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
        throw new ApiError(404, 'Purchase Order not found');
    }

    // Allow updates only when PO is editable
    if (!['Draft', 'Pending', 'Approved', 'Partially_Received'].includes(po.status)) {
        throw new ApiError(400, 'Only draft or pending or approved or partially received purchase orders can be updated');
    }

    const { vendorId, items, expectedDeliveryDate, deliveryAddress, warehouseId, paymentTerms, status, notes } = req.body;

    // If vendorId is supplied, validate
    if (vendorId) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor || !vendor.active) {
            throw new ApiError(400, 'Invalid or inactive vendor');
        }
        po.vendorId = vendorId;
    }

    // If items supplied, validate item ids and normalize similar to create
    if (Array.isArray(items)) {
        const itemIds = items.map(i => i.itemId);
        const existingItems = await Item.find({ _id: { $in: itemIds } });
        if (existingItems.length !== itemIds.length) {
            throw new ApiError(400, 'One or more items not found');
        }

        po.items = items.map(item => {
            const existingItem = existingItems.find(ei => ei._id.toString() === item.itemId);
            return {
                itemId: item.itemId,
                description: item.description || (existingItem ? existingItem.name : ''),
                qty: item.qty,
                unit: item.unit || (existingItem ? existingItem.defaultUnit : undefined),
                unitPriceLocked: item.unitPrice || (existingItem ? existingItem.defaultUnitPrice : 0),
                notes: item.notes,
            };
        });
    }

    if (expectedDeliveryDate !== undefined) po.expectedDeliveryDate = expectedDeliveryDate;
    if (deliveryAddress !== undefined) po.deliveryAddress = deliveryAddress;
    if (warehouseId !== undefined) po.warehouseId = warehouseId;
    if (paymentTerms !== undefined) po.paymentTerms = paymentTerms;
    if (status !== undefined) po.status = status;
    if (notes !== undefined) po.notes = notes;

    po.updatedBy = req.user._id;
    await po.save();

    res.json({
        success: true,
        message: 'Purchase Order updated successfully',
        data: po,
    });
});

/**
 * Approve PO
 */
export const approvePurchaseOrder = asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
        throw new ApiError(404, 'Purchase Order not found');
    }

    await po.approve(req.user._id);

    // Update vendor stats
    const vendor = await Vendor.findById(po.vendorId);
    if (vendor) {
        await vendor.updateOrderStats(po.netAmount);
    }

    res.json({
        success: true,
        message: 'Purchase Order approved successfully',
        data: po,
    });
});

/**
 * Cancel PO
 */
export const cancelPurchaseOrder = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
        throw new ApiError(404, 'Purchase Order not found');
    }

    await po.cancel(req.user._id, reason || 'No reason provided');

    res.json({
        success: true,
        message: 'Purchase Order cancelled successfully',
        data: po,
    });
});

export default {
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
    // Purchase Invoices - imported directly in routes
};
