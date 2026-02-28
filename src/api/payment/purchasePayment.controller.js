import mongoose from 'mongoose';
import PurchasePayment from './purchasePayment.model.js';
import PurchaseOrder from '../procurement/po.model.js';
import Vendor from '../procurement/vendor.model.js';
import { asyncHandler, ApiError } from '../../middleware/error.js';
import { simplePaginate } from '../../utils/paginatePlugin.js';

// ============================================
// PURCHASE PAYMENT CONTROLLERS
// ============================================

/**
 * Get all purchase payments (paginated)
 * GET /api/v1/purchase-payments
 */
export const getPurchasePayments = asyncHandler(async (req, res) => {
    const { search, paymentStatus, paymentMethod, vendorId, purchaseOrderId, fromDate, toDate } = req.query;
    const filter = {};

    if (search) {
        filter.$or = [
            { paymentNumber: { $regex: search, $options: 'i' } },
            { poNumber: { $regex: search, $options: 'i' } },
            { transactionId: { $regex: search, $options: 'i' } },
            { referenceNumber: { $regex: search, $options: 'i' } },
        ];
    }

    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (vendorId) filter.vendorId = vendorId;
    if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;

    if (fromDate || toDate) {
        filter.paymentDate = {};
        if (fromDate) filter.paymentDate.$gte = new Date(fromDate);
        if (toDate) filter.paymentDate.$lte = new Date(toDate);
    }

    const result = await simplePaginate(PurchasePayment, filter, req, {
        sort: { createdAt: -1 },
        populate: [
            { path: 'vendorId', select: 'name code' },
            { path: 'purchaseOrderId', select: 'poNumber netAmount status' },
            { path: 'processedBy', select: 'firstName lastName email' },
            { path: 'approvedBy', select: 'firstName lastName email' },
        ],
    });

    res.json(result);
});

/**
 * Get single purchase payment
 * GET /api/v1/purchase-payments/:id
 */
export const getPurchasePayment = asyncHandler(async (req, res) => {
    const payment = await PurchasePayment.findById(req.params.id)
        .populate('vendorId', 'name code')
        .populate('purchaseOrderId', 'poNumber netAmount status')
        .populate('processedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email');

    if (!payment) {
        throw new ApiError(404, 'Purchase payment not found');
    }

    res.json({ success: true, data: payment });
});

/**
 * Create new purchase payment
 * POST /api/v1/purchase-payments
 */
export const createPurchasePayment = asyncHandler(async (req, res) => {
    const {
        purchaseOrderId,
        paymentDate,
        paymentMethod,
        paymentStatus,
        amount,
        receivedItems,
        transactionId,
        referenceNumber,
        bankName,
        chequeNumber,
        chequeDate,
        upiId,
        remarks,
        internalNotes,
        attachments,
    } = req.body;

    // Validate purchase order exists
    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po) {
        throw new ApiError(404, 'Purchase order not found');
    }

    // Validate vendor
    const vendor = await Vendor.findById(po.vendorId);
    if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
    }

    // Convert itemIds to ObjectId
    const processedReceivedItems = receivedItems.map(item => ({
        ...item,
        itemId: new mongoose.Types.ObjectId(item.itemId)
    }));

    // Create payment
    const payment = new PurchasePayment({
        paymentNumber: `PPAY-${Date.now()}`, // Set payment number explicitly
        purchaseOrderId,
        poNumber: po.poNumber,
        vendorId: po.vendorId,
        vendorName: vendor.name,
        paymentDate,
        paymentMethod,
        paymentStatus: paymentStatus || 'PENDING', // Default to PENDING if not provided
        amount,
        receivedItems: processedReceivedItems,
        transactionId,
        referenceNumber,
        bankName,
        chequeNumber,
        chequeDate,
        upiId,
        remarks,
        internalNotes,
        attachments,
        processedBy: req.user._id,
    });

    await payment.save();

    // Populate and return
    await payment.populate([
        { path: 'vendorId', select: 'name code' },
        { path: 'purchaseOrderId', select: 'poNumber netAmount status' },
        { path: 'processedBy', select: 'firstName lastName email' },
    ]);

    res.status(201).json({ success: true, data: payment });
});

/**
 * Update purchase payment
 * PUT /api/v1/purchase-payments/:id
 */
export const updatePurchasePayment = asyncHandler(async (req, res) => {
    const payment = await PurchasePayment.findById(req.params.id);

    if (!payment) {
        throw new ApiError(404, 'Purchase payment not found');
    }

    const allowedFields = [
        'paymentDate', 'paymentMethod', 'paymentStatus', 'amount', 'receivedItems',
        'transactionId', 'referenceNumber', 'bankName', 'chequeNumber', 'chequeDate', 'upiId',
        'remarks', 'internalNotes', 'attachments', 'approvedBy', 'approvedAt'
    ];

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            payment[field] = req.body[field];
        }
    });

    if (req.body.approvedBy) {
        payment.approvedBy = req.body.approvedBy;
        payment.approvedAt = new Date();
    }

    await payment.save();

    await payment.populate([
        { path: 'vendorId', select: 'name code' },
        { path: 'purchaseOrderId', select: 'poNumber netAmount status' },
        { path: 'processedBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName email' },
    ]);

    res.json({ success: true, data: payment });
});

/**
 * Update purchase payment status
 * PATCH /api/v1/purchase-payments/:id/status
 */
export const updatePurchasePaymentStatus = asyncHandler(async (req, res) => {
    const { paymentStatus, remarks } = req.body;

    const payment = await PurchasePayment.findById(req.params.id);

    if (!payment) {
        throw new ApiError(404, 'Purchase payment not found');
    }

    // Update status
    payment.paymentStatus = paymentStatus;
    if (remarks) {
        payment.remarks = remarks;
    }

    await payment.save();

    // Populate and return
    await payment.populate([
        { path: 'vendorId', select: 'name code' },
        { path: 'purchaseOrderId', select: 'poNumber netAmount status' },
        { path: 'processedBy', select: 'firstName lastName email' },
    ]);

    res.json({ success: true, data: payment });
});

/**
 * Delete purchase payment
 * DELETE /api/v1/purchase-payments/:id
 */
export const deletePurchasePayment = asyncHandler(async (req, res) => {
    const payment = await PurchasePayment.findById(req.params.id);

    if (!payment) {
        throw new ApiError(404, 'Purchase payment not found');
    }

    // If payment was completed, reverse the changes to the purchase order
    if (payment.paymentStatus === 'COMPLETED') {
        try {
            const PurchaseOrder = mongoose.model('PurchaseOrder');
            const po = await PurchaseOrder.findById(payment.purchaseOrderId);
            if (po) {
                // Reverse received quantities
                payment.receivedItems.forEach(receivedItem => {
                    const item = po.items.find(i => i.itemId.toString() === receivedItem.itemId.toString());
                    if (item) {
                        item.receivedQty = Math.max(0, (item.receivedQty || 0) - receivedItem.quantity);
                        item.pendingQty = item.qty - item.receivedQty;
                        item.fullyReceived = item.pendingQty <= 0;
                    }
                });

                // Mark items as modified
                po.markModified('items');

                // Reverse received value
                po.receivedValue = Math.max(0, (po.receivedValue || 0) - payment.amount);
                po.pendingValue = po.netAmount - po.receivedValue;

                // Re-evaluate PO status
                const allReceived = po.items.every(item => item.fullyReceived);
                if (po.receivedValue === 0 && po.items.every(item => item.receivedQty === 0)) {
                    po.status = 'Approved'; // Reset to approved status
                } else if (po.receivedValue > 0) {
                    po.status = 'PartiallyReceived';
                }

                await po.save({ validateBeforeSave: false });
            }
        } catch (error) {
            console.error('Error updating purchase order after payment deletion:', error);
            // Don't throw, so payment deletion doesn't fail
        }
    }

    // Soft delete
    payment.isDeleted = true;
    await payment.save();

    res.json({ success: true, message: 'Purchase payment deleted successfully' });
});

/**
 * Get purchase payments by purchase order
 * GET /api/v1/purchase-payments/po/:poId
 */
export const getPaymentsByPurchaseOrder = asyncHandler(async (req, res) => {
    const payments = await PurchasePayment.find({
        purchaseOrderId: req.params.poId,
        isDeleted: { $ne: true }
    })
        .sort({ createdAt: -1 })
        .populate('processedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email');

    res.json({ success: true, data: payments });
});

/**
 * Get purchase payments grouped by PO for a vendor
 * GET /api/v1/purchase-payments/vendor/:vendorId
 * Returns both raw payment list and per-PO summary (total paid, pending, last paid date)
 */
export const getPaymentsByVendor = asyncHandler(async (req, res) => {
    const vendorId = req.params.vendorId;

    const payments = await PurchasePayment.find({
        vendorId,
        isDeleted: { $ne: true }
    })
        .sort({ paymentDate: -1 })
        .populate('purchaseOrderId', 'poNumber netAmount status');

    // build summary per PO
    const summaryMap = {};
    payments.forEach(p => {
        const po = p.purchaseOrderId;
        if (!po || !po._id) return;
        const key = po._id.toString();
        if (!summaryMap[key]) {
            summaryMap[key] = {
                poId: po._id,
                poNumber: po.poNumber,
                poTotal: po.netAmount || 0,
                totalPaid: 0,
                lastPaymentDate: null,
            };
        }
        summaryMap[key].totalPaid += p.amount || 0;
        if (!summaryMap[key].lastPaymentDate || new Date(p.paymentDate) > new Date(summaryMap[key].lastPaymentDate)) {
            summaryMap[key].lastPaymentDate = p.paymentDate;
        }
    });

    const summaries = Object.values(summaryMap).map(item => ({
        ...item,
        pendingAmount: item.poTotal - item.totalPaid,
    }));

    res.json({ success: true, data: { payments, summaries } });
});