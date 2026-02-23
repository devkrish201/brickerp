import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Sales Payment Schema - Tracks payments received for Sales Orders
 */
const salesPaymentSchema = new mongoose.Schema({
    paymentNumber: {
        type: String,
        unique: true,
        // required: true, // Removed required since it's auto-generated
    },
    // Related Sales Order
    salesOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        required: [true, 'Sales Order is required'],
        index: true,
    },
    soNumber: {
        type: String,
        required: true,
    },
    // Customer details
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required'],
        index: true,
    },
    customerName: String,

    // Payment details
    paymentDate: {
        type: Date,
        default: Date.now,
        required: true,
    },
    paymentMethod: {
        type: String,
        enum: ['CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'OTHER'],
        required: [true, 'Payment method is required'],
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'],
        default: 'PENDING',
        index: true,
    },

    // Amount details
    amount: {
        type: Number,
        required: [true, 'Payment amount is required'],
        min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
        type: String,
        default: 'INR',
    },

    // Transaction details
    transactionId: {
        type: String,
        index: true,
    },
    referenceNumber: String,
    bankName: String,
    chequeNumber: String,
    chequeDate: Date,
    upiId: String,

    // Processed by
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    processedAt: Date,

    // Approval workflow
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    approvedAt: Date,

    // Attachments (receipts, invoices)
    attachments: [{
        name: String,
        url: String,
        type: String,
        uploadedAt: {
            type: Date,
            default: Date.now,
        },
    }],

    // Link delivered items (for partial shipments/payments)
    // this mirrors PurchasePayment.receivedItems logic
    deliveredItems: [{
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: [0, 'Quantity must be non-negative'],
        },
    }],

    // Transport (optional) — captured when payment includes transport charge
    transportApplied: { type: Boolean, default: false },
    transportDetails: {
        vehicleType: { type: String },
        vehicleNumber: { type: String },
        transportCost: { type: Number, default: 0 },
    },

    // Notes
    remarks: String,
    internalNotes: String,

    // Metadata
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes
salesPaymentSchema.index({ createdAt: -1 });
salesPaymentSchema.index({ paymentDate: -1 });
salesPaymentSchema.index({ paymentStatus: 1, paymentDate: -1 });
salesPaymentSchema.index({ customerId: 1, paymentDate: -1 });

// Virtual for amount in rupees
salesPaymentSchema.virtual('amountInRupees').get(function () {
    return this.amount;
});

// Pre-save middleware to generate payment number
salesPaymentSchema.pre('save', async function (next) {
    if (!this.paymentNumber) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        // Financial year (April to March)
        const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;

        const lastPayment = await mongoose.model('SalesPayment')
            .findOne()
            .sort({ paymentNumber: -1 })
            .select('paymentNumber');

        let nextNumber = 1;
        if (lastPayment && lastPayment.paymentNumber) {
            const match = lastPayment.paymentNumber.match(/-(\d+)$/);
            if (match) nextNumber = parseInt(match[1]) + 1;
        }
        let candidateNumber = `SPAY/${fy}/${String(nextNumber).padStart(5, '0')}`;

        // Check if the candidate number already exists, and increment if necessary
        while (await mongoose.model('SalesPayment').findOne({ paymentNumber: candidateNumber })) {
            nextNumber++;
            candidateNumber = `SPAY/${fy}/${String(nextNumber).padStart(5, '0')}`;
        }

        this.paymentNumber = candidateNumber;
    }
    next();
});

// Post-save middleware to update Sales Order
salesPaymentSchema.post('save', async function (doc) {
    if (doc.paymentStatus === 'COMPLETED') {
        try {
            const SalesOrder = mongoose.model('SalesOrder');
            const SalesInvoice = mongoose.model('SalesInvoice');
            const so = await SalesOrder.findById(doc.salesOrderId).lean();
            // order totals and delivered quantities are now maintained by controller helpers

            // 2) Allocate payment to existing outstanding invoices (oldest first)
            let remaining = doc.amount;
            const outstandingInvs = await SalesInvoice.find({ salesOrderId: doc.salesOrderId, balanceDue: { $gt: 0 }, status: { $ne: 'Cancelled' } }).sort({ invoiceDate: 1, createdAt: 1 });

            console.debug('SalesPayment.post-save allocation', { outstandingCount: outstandingInvs.length, initialRemaining: remaining });

            for (const inv of outstandingInvs) {
                if (remaining <= 0) break;
                const toApply = Math.min(remaining, inv.balanceDue || 0);
                if (toApply <= 0) continue;

                // record payment on invoice
                inv.payments = inv.payments || [];
                inv.payments.push({ paymentId: doc._id, amount: toApply, date: doc.paymentDate || new Date(), method: doc.paymentMethod });

                inv.amountPaid = (inv.amountPaid || 0) + toApply;
                inv.balanceDue = (inv.grandTotal || 0) - inv.amountPaid;

                // update status
                if (inv.balanceDue <= 0) inv.status = 'Paid';
                else if (inv.amountPaid > 0) inv.status = 'Partially_Paid';

                await inv.save({ validateBeforeSave: false });

                // ensure SalesOrder.invoiceIds includes this invoice
                try {
                    await SalesOrder.updateOne({ _id: doc.salesOrderId, invoiceIds: { $ne: inv._id } }, { $push: { invoiceIds: inv._id } });
                } catch (e) {
                    // ignore
                }

                remaining -= toApply;
            }

            console.debug('SalesPayment.post-save after allocation', { remaining });

            // 3) If there were no invoices or payment still remains, create a single invoice from the SO and apply remaining payment
            if ((outstandingInvs.length === 0 || remaining > 0) && so) {
                // create invoice only if there's an outstanding amount on the order and no invoice exists yet
                const orderOutstanding = (so.grandTotal || 0) - (so.amountPaid || 0);
                console.debug('SalesPayment.post-save invoice-creation-check', { orderOutstanding, remaining });
                if (orderOutstanding > 0 && remaining > 0) {
                    // Check if an invoice already exists for this sales order
                    const existingInvoice = await mongoose.model('SalesInvoice').findOne({ salesOrderId: so._id });
                    if (existingInvoice) {
                        console.debug('SalesPayment.post-save skipping invoice creation (invoice already exists)', { salesOrderId: so._id, existingInvoiceId: existingInvoice._id });
                    } else {
                        const SalesInvoiceModel = mongoose.model('SalesInvoice');

                        // Map order items to invoice items (minimal required fields)
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

                        // Determine transport details to include on invoice. Prefer order values; if order has no transport but payment included transport, use payment.transportDetails.
                        // transport charges are managed separately; do not adjust invoice/order totals here
                        const orderTransportExisting = (so.transportCost || 0);
                        const invoiceTransportCost = orderTransportExisting; // only include order transport if already set
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
                            transportDetails: so.transportDetails || (doc.transportApplied ? doc.transportDetails : undefined),
                            grandTotal: invoiceGrandTotal || 0,
                            amountPaid: 0,
                            balanceDue: invoiceGrandTotal || 0,
                            currency: so.currency || 'INR',
                            createdBy: doc.processedBy || so.createdBy || null,
                            invoiceDate: new Date(),
                            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        };

                        const newInv = new SalesInvoiceModel(invoiceData);

                        // apply as much as possible from remaining
                        const applyNow = Math.min(remaining, newInv.grandTotal || 0);
                        if (applyNow > 0) {
                            newInv.payments = [{ paymentId: doc._id, amount: applyNow, date: doc.paymentDate || new Date(), method: doc.paymentMethod }];
                            newInv.amountPaid = applyNow;
                            newInv.balanceDue = (newInv.grandTotal || 0) - applyNow;
                            newInv.status = newInv.balanceDue <= 0 ? 'Paid' : 'Partially_Paid';
                            remaining -= applyNow;
                        }

                        await newInv.save({ validateBeforeSave: false });

                        // link invoice to sales order
                        try {
                            await SalesOrder.updateOne({ _id: so._id }, { $addToSet: { invoiceIds: newInv._id } });
                        } catch (e) {
                            // ignore
                        }

                        console.debug('SalesPayment.post-save created invoice', { invoiceId: newInv._id?.toString?.(), applied: applyNow, remaining });
                    }
                } else {
                    console.debug('SalesPayment.post-save skipping invoice creation (no outstanding or nothing to apply)', { orderOutstanding, remaining });
                }
            }

            // NOTE: any leftover `remaining` (overpayment) will be handled by existing overpayment logic elsewhere
        } catch (error) {
            console.error('Error updating invoices after sales payment:', error);
            // don't throw from post-save
        }
    }
});

// Plugins
salesPaymentSchema.plugin(mongoosePaginate);
salesPaymentSchema.plugin(auditPlugin);
salesPaymentSchema.plugin(notesPlugin);
salesPaymentSchema.plugin(softDeletePlugin);

const SalesPayment = mongoose.model('SalesPayment', salesPaymentSchema);

export default SalesPayment;