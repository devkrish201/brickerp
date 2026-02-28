import mongoose from 'mongoose';
import SalesPayment from './salesPayment.model.js';
import SalesOrder from '../sales/salesOrder.model.js';
import Customer from '../sales/customer.model.js';
import { asyncHandler, ApiError } from '../../middleware/error.js';
import { simplePaginate } from '../../utils/paginatePlugin.js';

// ============================================
// SALES PAYMENT CONTROLLERS
// ============================================

// helper to recalc order totals and delivered quantities based on all completed payments
async function syncSalesOrderFromPayments(salesOrderId) {
    if (!salesOrderId) return;
    const payments = await SalesPayment.find({ salesOrderId, paymentStatus: 'COMPLETED' }).lean();
    let totalPaid = 0;
    const deliveredMap = {};

    payments.forEach(p => {
        totalPaid += p.amount || 0;
        if (Array.isArray(p.deliveredItems)) {
            p.deliveredItems.forEach(di => {
                const id = di.itemId?.toString?.() || '';
                if (!id) return;
                deliveredMap[id] = (deliveredMap[id] || 0) + (di.quantity || 0);
            });
        }
    });

    const order = await SalesOrder.findById(salesOrderId);
    if (!order) return;

    order.amountPaid = totalPaid;
    order.balanceDue = (order.grandTotal || 0) - totalPaid;

    // determine order paymentStatus similar to model logic
    let newPaymentStatus = 'Unpaid';
    if (totalPaid >= (order.grandTotal || 0)) {
        newPaymentStatus = totalPaid > (order.grandTotal || 0) ? 'Overpaid' : 'Paid';
    } else if (totalPaid > 0) {
        newPaymentStatus = 'Partial';
    }
    order.paymentStatus = newPaymentStatus;

    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
            // support both item document _id and referenced itemId used in payments
            const oid = item._id?.toString?.();
            const iid = item.itemId?.toString?.();
            const delivered = (oid && deliveredMap[oid]) || (iid && deliveredMap[iid]) || 0;
            item.deliveredQty = delivered;
            item.pendingQty = (item.qty || 0) - delivered;
            item.fullyDelivered = delivered >= (item.qty || 0);
        });
    }

    await order.save();
}

/**
 * Get all sales payments (paginated)
 * GET /api/v1/sales-payments
 */
export const getSalesPayments = asyncHandler(async (req, res) => {
    const { search, paymentStatus, paymentMethod, customerId, salesOrderId, fromDate, toDate } = req.query;
    const filter = {};

    if (search) {
        filter.$or = [
            { paymentNumber: { $regex: search, $options: 'i' } },
            { soNumber: { $regex: search, $options: 'i' } },
            { transactionId: { $regex: search, $options: 'i' } },
            { referenceNumber: { $regex: search, $options: 'i' } },
        ];
    }

    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (customerId) filter.customerId = customerId;
    if (salesOrderId) filter.salesOrderId = salesOrderId;

    if (fromDate || toDate) {
        filter.paymentDate = {};
        if (fromDate) filter.paymentDate.$gte = new Date(fromDate);
        if (toDate) filter.paymentDate.$lte = new Date(toDate);
    }

    const result = await simplePaginate(SalesPayment, filter, req, {
        sort: { createdAt: -1 },
        populate: [
            { path: 'customerId', select: 'name customerCode' },
            { path: 'salesOrderId', select: 'soNumber grandTotal status' },
            { path: 'processedBy', select: 'firstName lastName email' },
            { path: 'approvedBy', select: 'firstName lastName email' },
        ],
    });

    res.json(result);
});

/**
 * Get single sales payment
 * GET /api/v1/sales-payments/:id
 */
export const getSalesPayment = asyncHandler(async (req, res) => {
    const payment = await SalesPayment.findById(req.params.id)
        .populate('customerId', 'name customerCode')
        .populate('salesOrderId', 'soNumber grandTotal status')
        .populate('processedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email');

    if (!payment) {
        throw new ApiError(404, 'Sales payment not found');
    }

    res.json({ success: true, data: payment });
});

/**
 * Create new sales payment
 * POST /api/v1/sales-payments
 */
export const createSalesPayment = asyncHandler(async (req, res) => {
    const {
        salesOrderId,
        paymentDate,
        paymentMethod,
        paymentStatus,
        amount,
        // delivered items for this payment
        deliveredItems = [],
        transactionId,
        referenceNumber,
        bankName,
        chequeNumber,
        chequeDate,
        upiId,
        remarks,
        internalNotes,
        attachments,
        // transport
        transportApplied,
        transportDetails,
    } = req.body;

    // Validate sales order exists
    const so = await SalesOrder.findById(salesOrderId);
    if (!so) {
        throw new ApiError(404, 'Sales order not found');
    }

    // Validate customer
    const customer = await Customer.findById(so.customerId);
    if (!customer) {
        throw new ApiError(404, 'Customer not found');
    }

    // convert delivered item ids to ObjectId and sanitize
    const processedDeliveredItems = (Array.isArray(deliveredItems) ? deliveredItems : []).map(di => ({
        itemId: new mongoose.Types.ObjectId(di.itemId),
        quantity: di.quantity,
    }));

    // Create payment
    const payment = new SalesPayment({
        paymentNumber: `SPAY-${Date.now()}`, // Set payment number explicitly
        salesOrderId,
        soNumber: so.soNumber,
        customerId: so.customerId,
        customerName: customer.name,
        paymentDate,
        paymentMethod,
        paymentStatus: paymentStatus || 'PENDING', // Default to PENDING if not provided
        amount,
        deliveredItems: processedDeliveredItems,
        transactionId,
        referenceNumber,
        bankName,
        chequeNumber,
        chequeDate,
        upiId,
        // transport
        transportApplied: !!transportApplied,
        transportDetails: transportDetails || undefined,
        remarks,
        internalNotes,
        attachments,
        processedBy: req.user._id,
    });

    await payment.save();

    // Populate payment
    await payment.populate([
        { path: 'customerId', select: 'name customerCode' },
        { path: 'salesOrderId', select: 'soNumber grandTotal status' },
        { path: 'processedBy', select: 'firstName lastName email' },
    ]);

    // Fetch invoices for the sales order (including any auto-created by post-save hook)
    let relatedInvoices = [];
    let invoiceCreationError = null;

    // sync order totals/deliveries after creating the payment
    try {
        await syncSalesOrderFromPayments(payment.salesOrderId);
    } catch (syncErr) {
        console.warn('Syncing sales order after payment creation failed:', syncErr);
    }

    try {
        const SalesInvoice = mongoose.model('SalesInvoice');
        relatedInvoices = await SalesInvoice.find({ salesOrderId: payment.salesOrderId }).sort({ invoiceDate: 1 }).lean();

        // Safety: if payment is COMPLETED but post-save hook hasn't finished creating invoices yet,
        // create/apply a single invoice synchronously so the API response includes it immediately.
        if ((relatedInvoices.length === 0) && payment.paymentStatus === 'COMPLETED') {
            const SalesOrderModel = mongoose.model('SalesOrder');
            const so = await SalesOrderModel.findById(payment.salesOrderId).lean();
            if (so) {
                const orderOutstanding = (so.grandTotal || 0) - (so.amountPaid || 0);
                const remaining = Math.min(payment.amount || 0, orderOutstanding);

                // Diagnostic log to help debug missing invoice creation
                console.debug('Payment COMPLETED sync-invoice check', {
                    paymentId: payment._id?.toString?.() || payment._id,
                    salesOrderId: payment.salesOrderId?.toString?.() || payment.salesOrderId,
                    soGrandTotal: so.grandTotal,
                    soAmountPaid: so.amountPaid,
                    orderOutstanding,
                    paymentAmount: payment.amount,
                    remainingToApply: remaining,
                    itemsCount: (so.items || []).length,
                });

                if (orderOutstanding > 0 && remaining > 0) {
                    const SalesInvoiceModel = mongoose.model('SalesInvoice');

                    const items = (so.items || []).map(i => ({
                        soItemId: i._id,
                        itemId: i.itemId,
                        itemName: i.itemName || i.description || '',
                        sku: i.sku,
                        hsnCode: i.hsnCode || '',
                        qty: i.qty,
                        unit: i.unit,
                        unitPrice: i.unitPrice,
                        discountPercent: i.discountPercent || 0,
                        discountAmount: i.discountAmount || 0,
                        taxableAmount: (i.qty * i.unitPrice) - (i.discountAmount || 0),
                        cgstRate: 0, sgstRate: 0, igstRate: 0,
                        cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
                        totalTaxAmount: i.taxAmount || 0,
                        totalAmount: i.totalPrice || ((i.qty * i.unitPrice) - (i.discountAmount || 0) + (i.taxAmount || 0)),
                    }));

                    const createdById = (payment && payment.processedBy && payment.processedBy._id) ? payment.processedBy._id : (payment.processedBy || so.createdBy || null);
                    // include transport from order if present; otherwise, if payment carried transport, include that on the invoice
                    const extraTransportFromPayment = (payment.transportApplied && payment.transportDetails && (payment.transportDetails.transportCost || 0)) ? (payment.transportDetails.transportCost || 0) : 0;
                    const orderTransportExisting = (so.transportCost || 0);
                    // keep transport cost on invoice only if it was already part of order;
                    // do not inflate grand total with new transport charges from payment
                    const invoiceTransportCost = orderTransportExisting || 0;
                    const invoiceGrandTotal = (so.grandTotal || 0);

                    const invoiceData = {
                        salesOrderId: so._id,
                        soNumber: so.soNumber,
                        customerId: so.customerId,
                        customerDetails: { name: so.customerName || '' },
                        items,
                        subtotal: so.subtotal || 0,
                        totalDiscountAmount: so.totalDiscountAmount || 0,
                        taxableAmount: so.subtotal - (so.totalDiscountAmount || 0),
                        totalTaxAmount: so.totalTaxAmount || 0,
                        transportCost: invoiceTransportCost || 0,
                        transportDetails: so.transportDetails || (payment.transportApplied ? payment.transportDetails : undefined),
                        grandTotal: invoiceGrandTotal || 0,
                        amountPaid: 0,
                        balanceDue: invoiceGrandTotal || 0,
                        currency: so.currency || 'INR',
                        createdBy: createdById,
                        invoiceDate: new Date(),
                        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    };

                    try {
                        const newInv = new (mongoose.model('SalesInvoice'))(invoiceData);
                        const applyNow = Math.min(remaining, newInv.grandTotal || 0);
                        if (applyNow > 0) {
                            newInv.payments = [{ paymentId: payment._id, amount: applyNow, date: payment.paymentDate || new Date(), method: payment.paymentMethod }];
                            newInv.amountPaid = applyNow;
                            newInv.balanceDue = (newInv.grandTotal || 0) - applyNow;
                            newInv.status = newInv.balanceDue <= 0 ? 'Paid' : 'Partially_Paid';
                        }

                        await newInv.save({ validateBeforeSave: false });

                        // Auto-issue when no payment was applied (so invoice appears in 'Issued' lists).
                        try {
                            if ((newInv.amountPaid || 0) === 0 && typeof newInv.issue === 'function') {
                                await newInv.issue(createdById || null);
                            } else if ((newInv.amountPaid || 0) > 0 && typeof newInv.issue === 'function') {
                                // For partially/fully paid invoices, still set issued metadata if possible
                                try {
                                    newInv.issuedBy = createdById || newInv.issuedBy;
                                    newInv.issuedAt = new Date();
                                    await newInv.save({ validateBeforeSave: false });
                                } catch (e) {
                                    /* non-blocking */
                                }
                            }
                        } catch (issueErr) {
                            console.warn('Auto-issuing sync-created invoice failed:', issueErr.message || issueErr);
                        }

                        try { await SalesOrderModel.updateOne({ _id: so._id }, { $addToSet: { invoiceIds: newInv._id } }); } catch (e) { /* ignore */ }
                    } catch (err) {
                        invoiceCreationError = err.message || String(err);
                        console.error('Synchronous invoice creation failed:', err);
                    }
                } else {
                    // Provide diagnostic so API callers know why we skipped creation
                    if (orderOutstanding <= 0) invoiceCreationError = invoiceCreationError || 'Order already fully paid / overpaid — no invoice created';
                    else invoiceCreationError = invoiceCreationError || 'No remaining amount to apply from payment';
                }

                // refresh relatedInvoices
                relatedInvoices = await SalesInvoice.find({ salesOrderId: payment.salesOrderId }).sort({ invoiceDate: 1 }).lean();

                // If still no invoices, log detailed diagnostic so support can trace the reason
                if ((relatedInvoices.length === 0)) {
                    console.warn('Synchronous invoice creation did not produce invoices for payment', {
                        paymentId: payment._id?.toString?.() || payment._id,
                        salesOrderId: payment.salesOrderId?.toString?.() || payment.salesOrderId,
                        soSnapshot: { grandTotal: so.grandTotal, amountPaid: so.amountPaid, itemsCount: (so.items || []).length },
                        paymentSnapshot: { amount: payment.amount, status: payment.paymentStatus },
                        invoiceCreationError,
                    });
                }
            }
        }
    } catch (e) {
        invoiceCreationError = e.message || String(e);
        console.error('Error while fetching/creating related invoices:', e);
    }

    res.status(201).json({ success: true, data: payment, relatedInvoices, invoiceCreationError });
});

/**
 * Update sales payment
 * PUT /api/v1/sales-payments/:id
 */
export const updateSalesPayment = asyncHandler(async (req, res) => {
    const payment = await SalesPayment.findById(req.params.id);

    if (!payment) {
        throw new ApiError(404, 'Sales payment not found');
    }

    const allowedFields = [
        'paymentDate', 'paymentMethod', 'paymentStatus', 'amount', 'deliveredItems',
        'transactionId', 'referenceNumber', 'bankName', 'chequeNumber', 'chequeDate', 'upiId',
        // transport
        'transportApplied', 'transportDetails',
        'remarks', 'internalNotes', 'attachments', 'approvedBy', 'approvedAt'
    ];

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined && field !== 'deliveredItems') {
            payment[field] = req.body[field];
        }
    });

    if (req.body.deliveredItems !== undefined) {
        // convert ids
        const processed = (Array.isArray(req.body.deliveredItems) ? req.body.deliveredItems : []).map(di => ({
            itemId: new mongoose.Types.ObjectId(di.itemId),
            quantity: di.quantity,
        }));
        payment.deliveredItems = processed;
    }

    if (req.body.approvedBy) {
        payment.approvedBy = req.body.approvedBy;
        payment.approvedAt = new Date();
    }

    await payment.save();

    await payment.populate([
        { path: 'customerId', select: 'name customerCode' },
        { path: 'salesOrderId', select: 'soNumber grandTotal status' },
        { path: 'processedBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName email' },
    ]);

    // Return related invoices (if any were affected by the update)
    let relatedInvoices = [];
    let invoiceCreationError = null;

    // make sure the sales order stays accurate after update
    try {
        await syncSalesOrderFromPayments(payment.salesOrderId);
    } catch (syncErr) {
        console.warn('Syncing sales order after payment update failed:', syncErr);
    }
    try {
        const SalesInvoice = mongoose.model('SalesInvoice');
        relatedInvoices = await SalesInvoice.find({ salesOrderId: payment.salesOrderId }).sort({ invoiceDate: 1 }).lean();

        // Safety: if payment was updated to COMPLETED but post-save allocation hasn't finished,
        // create/apply invoice synchronously so UI gets immediate feedback.
        if ((relatedInvoices.length === 0) && payment.paymentStatus === 'COMPLETED') {
            const SalesOrderModel = mongoose.model('SalesOrder');
            const so = await SalesOrderModel.findById(payment.salesOrderId).lean();
            if (so) {
                const orderOutstanding = (so.grandTotal || 0) - (so.amountPaid || 0);
                const remaining = Math.min(payment.amount || 0, orderOutstanding);

                console.debug('UpdatePayment: sync-invoice check', { paymentId: payment._id?.toString?.() || payment._id, salesOrderId: payment.salesOrderId, orderOutstanding, remaining });

                // If no positive outstanding or nothing to apply, set diagnostic so UI won't attempt client fallback
                if (!(orderOutstanding > 0 && remaining > 0)) {
                    if (orderOutstanding <= 0) invoiceCreationError = invoiceCreationError || 'Order already fully paid / overpaid — no invoice created';
                    else invoiceCreationError = invoiceCreationError || 'No remaining amount to apply from payment';
                }

                if (orderOutstanding > 0 && remaining > 0) {
                    try {
                        const SalesInvoiceModel = mongoose.model('SalesInvoice');

                        const items = (so.items || []).map(i => ({
                            soItemId: i._id,
                            itemId: i.itemId,
                            itemName: i.itemName || i.description || '',
                            sku: i.sku,
                            hsnCode: i.hsnCode || '',
                            qty: i.qty,
                            unit: i.unit,
                            unitPrice: i.unitPrice,
                            discountPercent: i.discountPercent || 0,
                            discountAmount: i.discountAmount || 0,
                            taxableAmount: (i.qty * i.unitPrice) - (i.discountAmount || 0),
                            cgstRate: 0, sgstRate: 0, igstRate: 0,
                            cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
                            totalTaxAmount: i.taxAmount || 0,
                            totalAmount: i.totalPrice || ((i.qty * i.unitPrice) - (i.discountAmount || 0) + (i.taxAmount || 0)),
                        }));

                        const createdById = (payment && payment.processedBy && payment.processedBy._id) ? payment.processedBy._id : (payment.processedBy || so.createdBy || null);
                        // include transport from order if present; otherwise use payment.transportDetails when payment carried transport
                        const extraTransportFromPayment = (payment && payment.transportApplied && payment.transportDetails && (payment.transportDetails.transportCost || 0)) ? (payment.transportDetails.transportCost || 0) : 0;
                        const orderTransportExisting = (so.transportCost || 0);
                        const invoiceTransportCost = orderTransportExisting || 0;
                        const invoiceGrandTotal = (so.grandTotal || 0);

                        const invoiceData = {
                            salesOrderId: so._id,
                            soNumber: so.soNumber,
                            customerId: so.customerId,
                            customerDetails: { name: so.customerName || '' },
                            items,
                            subtotal: so.subtotal || 0,
                            totalDiscountAmount: so.totalDiscountAmount || 0,
                            taxableAmount: so.subtotal - (so.totalDiscountAmount || 0),
                            totalTaxAmount: so.totalTaxAmount || 0,
                            transportCost: invoiceTransportCost || 0,
                            transportDetails: so.transportDetails || (payment && payment.transportApplied ? payment.transportDetails : undefined),
                            grandTotal: invoiceGrandTotal || 0,
                            amountPaid: 0,
                            balanceDue: so.grandTotal || 0,
                            currency: so.currency || 'INR',
                            createdBy: createdById,
                            invoiceDate: new Date(),
                            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        };

                        const newInv = new (mongoose.model('SalesInvoice'))(invoiceData);
                        const applyNow = Math.min(remaining, newInv.grandTotal || 0);
                        if (applyNow > 0) {
                            newInv.payments = [{ paymentId: payment._id, amount: applyNow, date: payment.paymentDate || new Date(), method: payment.paymentMethod }];
                            newInv.amountPaid = applyNow;
                            newInv.balanceDue = (newInv.grandTotal || 0) - applyNow;
                            newInv.status = newInv.balanceDue <= 0 ? 'Paid' : 'Partially_Paid';
                        }

                        await newInv.save({ validateBeforeSave: false });

                        // Auto-issue when no payment was applied (so invoice appears in 'Issued' lists).
                        try {
                            if ((newInv.amountPaid || 0) === 0 && typeof newInv.issue === 'function') {
                                await newInv.issue(createdById || null);
                            } else if ((newInv.amountPaid || 0) > 0 && typeof newInv.issue === 'function') {
                                try {
                                    newInv.issuedBy = createdById || newInv.issuedBy;
                                    newInv.issuedAt = new Date();
                                    await newInv.save({ validateBeforeSave: false });
                                } catch (e) { /* non-blocking */ }
                            }
                        } catch (issueErr) {
                            console.warn('Auto-issuing sync-created invoice failed (update):', issueErr.message || issueErr);
                        }

                        try { await SalesOrderModel.updateOne({ _id: so._id }, { $addToSet: { invoiceIds: newInv._id } }); } catch (e) { /* ignore */ }
                    } catch (err) {
                        invoiceCreationError = err.message || String(err);
                        console.error('Synchronous invoice creation failed (update):', err);
                    }
                }

                // refresh relatedInvoices
                relatedInvoices = await SalesInvoice.find({ salesOrderId: payment.salesOrderId }).sort({ invoiceDate: 1 }).lean();

                if ((relatedInvoices.length === 0)) {
                    console.warn('UpdatePayment: sync-invoice created none', { paymentId: payment._id?.toString?.() || payment._id, salesOrderId: payment.salesOrderId, orderOutstanding, remaining, invoiceCreationError });
                }
            }
        }
    } catch (e) {
        invoiceCreationError = e.message || String(e);
        console.error('Error while fetching/creating related invoices (update):', e);
    }

    res.json({ success: true, data: payment, relatedInvoices, invoiceCreationError });
});

/**
 * Update sales payment status
 * PATCH /api/v1/sales-payments/:id/status
 */
export const updateSalesPaymentStatus = asyncHandler(async (req, res) => {
    const { paymentStatus, remarks } = req.body;

    const payment = await SalesPayment.findById(req.params.id);

    if (!payment) {
        throw new ApiError(404, 'Sales payment not found');
    }

    // Update status
    payment.paymentStatus = paymentStatus;
    if (remarks) {
        payment.remarks = remarks;
    }

    await payment.save();

    // Populate and return
    await payment.populate([
        { path: 'customerId', select: 'name customerCode' },
        { path: 'salesOrderId', select: 'soNumber grandTotal status' },
        { path: 'processedBy', select: 'firstName lastName email' },
    ]);

    // Return related invoices (and create synchronously if needed) so UI sees invoices when status is set to COMPLETED
    let relatedInvoices = [];
    let invoiceCreationError = null;

    // update order when status changes
    try {
        await syncSalesOrderFromPayments(payment.salesOrderId);
    } catch (syncErr) {
        console.warn('Syncing sales order after status update failed:', syncErr);
    }
    try {
        const SalesInvoice = mongoose.model('SalesInvoice');
        relatedInvoices = await SalesInvoice.find({ salesOrderId: payment.salesOrderId }).sort({ invoiceDate: 1 }).lean();

        if ((relatedInvoices.length === 0) && payment.paymentStatus === 'COMPLETED') {
            const SalesOrderModel = mongoose.model('SalesOrder');
            const so = await SalesOrderModel.findById(payment.salesOrderId).lean();
            if (so) {
                const orderOutstanding = (so.grandTotal || 0) - (so.amountPaid || 0);
                const remaining = Math.min(payment.amount || 0, orderOutstanding);

                console.debug('UpdatePaymentStatus: sync-invoice check', { paymentId: payment._id?.toString?.() || payment._id, salesOrderId: payment.salesOrderId, orderOutstanding, remaining });

                // If no positive outstanding or nothing to apply, set diagnostic so UI won't attempt client fallback
                if (!(orderOutstanding > 0 && remaining > 0)) {
                    if (orderOutstanding <= 0) invoiceCreationError = invoiceCreationError || 'Order already fully paid / overpaid — no invoice created';
                    else invoiceCreationError = invoiceCreationError || 'No remaining amount to apply from payment';
                }

                if (orderOutstanding > 0 && remaining > 0) {
                    try {
                        const SalesInvoiceModel = mongoose.model('SalesInvoice');

                        const items = (so.items || []).map(i => ({
                            soItemId: i._id,
                            itemId: i.itemId,
                            itemName: i.itemName || i.description || '',
                            sku: i.sku,
                            hsnCode: i.hsnCode || '',
                            qty: i.qty,
                            unit: i.unit,
                            unitPrice: i.unitPrice,
                            discountPercent: i.discountPercent || 0,
                            discountAmount: i.discountAmount || 0,
                            taxableAmount: (i.qty * i.unitPrice) - (i.discountAmount || 0),
                            cgstRate: 0, sgstRate: 0, igstRate: 0,
                            cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
                            totalTaxAmount: i.taxAmount || 0,
                            totalAmount: i.totalPrice || ((i.qty * i.unitPrice) - (i.discountAmount || 0) + (i.taxAmount || 0)),
                        }));

                        const createdById = (payment && payment.processedBy && payment.processedBy._id) ? payment.processedBy._id : (payment.processedBy || so.createdBy || null);
                        // include transport from order if present; otherwise use payment.transportDetails when payment carried transport
                        const extraTransportFromPayment = (payment && payment.transportApplied && payment.transportDetails && (payment.transportDetails.transportCost || 0)) ? (payment.transportDetails.transportCost || 0) : 0;
                        const orderTransportExisting = (so.transportCost || 0);
                        const invoiceTransportCost = orderTransportExisting || 0;
                        const invoiceGrandTotal = (so.grandTotal || 0);

                        const invoiceData = {
                            salesOrderId: so._id,
                            soNumber: so.soNumber,
                            customerId: so.customerId,
                            customerDetails: { name: so.customerName || '' },
                            items,
                            subtotal: so.subtotal || 0,
                            totalDiscountAmount: so.totalDiscountAmount || 0,
                            taxableAmount: so.subtotal - (so.totalDiscountAmount || 0),
                            totalTaxAmount: so.totalTaxAmount || 0,
                            transportCost: invoiceTransportCost || 0,
                            transportDetails: so.transportDetails || (payment && payment.transportApplied ? payment.transportDetails : undefined),
                            grandTotal: invoiceGrandTotal || 0,
                            amountPaid: 0,
                            balanceDue: so.grandTotal || 0,
                            currency: so.currency || 'INR',
                            createdBy: createdById,
                            invoiceDate: new Date(),
                            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        };

                        const newInv = new (mongoose.model('SalesInvoice'))(invoiceData);
                        const applyNow = Math.min(remaining, newInv.grandTotal || 0);
                        if (applyNow > 0) {
                            newInv.payments = [{ paymentId: payment._id, amount: applyNow, date: payment.paymentDate || new Date(), method: payment.paymentMethod }];
                            newInv.amountPaid = applyNow;
                            newInv.balanceDue = (newInv.grandTotal || 0) - applyNow;
                            newInv.status = newInv.balanceDue <= 0 ? 'Paid' : 'Partially_Paid';
                        }

                        await newInv.save({ validateBeforeSave: false });

                        // Auto-issue when no payment was applied (so invoice appears in 'Issued' lists).
                        try {
                            if ((newInv.amountPaid || 0) === 0 && typeof newInv.issue === 'function') {
                                await newInv.issue(createdById || null);
                            } else if ((newInv.amountPaid || 0) > 0 && typeof newInv.issue === 'function') {
                                try {
                                    newInv.issuedBy = createdById || newInv.issuedBy;
                                    newInv.issuedAt = new Date();
                                    await newInv.save({ validateBeforeSave: false });
                                } catch (e) { /* non-blocking */ }
                            }
                        } catch (issueErr) {
                            console.warn('Auto-issuing sync-created invoice failed (status update):', issueErr.message || issueErr);
                        }

                        try { await SalesOrderModel.updateOne({ _id: so._id }, { $addToSet: { invoiceIds: newInv._id } }); } catch (e) { /* ignore */ }
                    } catch (err) {
                        invoiceCreationError = err.message || String(err);
                        console.error('Synchronous invoice creation failed (status update):', err);
                    }
                }

                // refresh relatedInvoices
                relatedInvoices = await SalesInvoice.find({ salesOrderId: payment.salesOrderId }).sort({ invoiceDate: 1 }).lean();

                if ((relatedInvoices.length === 0)) {
                    console.warn('UpdatePaymentStatus: sync-invoice created none', { paymentId: payment._id?.toString?.() || payment._id, salesOrderId: payment.salesOrderId, orderOutstanding, remaining, invoiceCreationError });
                }
            }
        }
    } catch (e) {
        invoiceCreationError = e.message || String(e);
        console.error('Error while fetching/creating related invoices (status update):', e);
    }

    res.json({ success: true, data: payment, relatedInvoices, invoiceCreationError });
});

/**
 * Delete sales payment
 * DELETE /api/v1/sales-payments/:id
 */
export const deleteSalesPayment = asyncHandler(async (req, res) => {
    const payment = await SalesPayment.findById(req.params.id);

    if (!payment) {
        throw new ApiError(404, 'Sales payment not found');
    }

    // Soft delete
    payment.isDeleted = true;
    await payment.save();

    // recalc order in case payment was previously completed
    try {
        await syncSalesOrderFromPayments(payment.salesOrderId);
    } catch (syncErr) {
        console.warn('Syncing sales order after payment deletion failed:', syncErr);
    }

    res.json({ success: true, message: 'Sales payment deleted successfully' });
});

/**
 * Get sales payments by sales order
 * GET /api/v1/sales-payments/so/:soId
 */
export const getPaymentsBySalesOrder = asyncHandler(async (req, res) => {
    const payments = await SalesPayment.find({
        salesOrderId: req.params.soId,
        isDeleted: { $ne: true }
    })
        .sort({ createdAt: -1 })
        .populate('processedBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName email');

    res.json({ success: true, data: payments });
});

// grouped by sales order for a customer
export const getPaymentsByCustomer = asyncHandler(async (req, res) => {
    const customerId = req.params.customerId;

    const payments = await SalesPayment.find({
        customerId,
        isDeleted: { $ne: true }
    })
        .sort({ paymentDate: -1 })
        .populate('salesOrderId', 'soNumber grandTotal status');

    const summaryMap = {};
    payments.forEach(p => {
        const so = p.salesOrderId;
        if (!so || !so._id) return;
        const key = so._id.toString();
        if (!summaryMap[key]) {
            summaryMap[key] = {
                soId: so._id,
                soNumber: so.soNumber,
                soTotal: so.grandTotal || 0,
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
        pendingAmount: item.soTotal - item.totalPaid,
    }));

    res.json({ success: true, data: { payments, summaries } });
});
