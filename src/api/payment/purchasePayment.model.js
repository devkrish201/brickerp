import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Purchase Payment Schema - Tracks payments and received quantities for Purchase Orders
 */
const purchasePaymentSchema = new mongoose.Schema({
    paymentNumber: {
        type: String,
        unique: true,
        // required: true, // Removed required since it's auto-generated
    },
    // Related Purchase Order
    purchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
        required: [true, 'Purchase Order is required'],
        index: true,
    },
    poNumber: {
        type: String,
        required: true,
    },
    // Vendor details
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: [true, 'Vendor is required'],
        index: true,
    },
    vendorName: String,

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

    // Amount and quantity details
    amount: {
        type: Number,
        required: [true, 'Payment amount is required'],
        min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
        type: String,
        default: 'INR',
    },

    // Received items (for quantity tracking)
    receivedItems: [{
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
        unitPrice: {
            type: Number,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true,
        },
    }],

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
purchasePaymentSchema.index({ createdAt: -1 });
purchasePaymentSchema.index({ paymentDate: -1 });
purchasePaymentSchema.index({ paymentStatus: 1, paymentDate: -1 });
purchasePaymentSchema.index({ vendorId: 1, paymentDate: -1 });

// Virtual for amount in rupees
purchasePaymentSchema.virtual('amountInRupees').get(function () {
    return this.amount;
});

// Pre-save middleware to generate payment number
purchasePaymentSchema.pre('save', function (next) {
    if (!this.paymentNumber) {
        this.paymentNumber = `PPAY-${Date.now()}`;
    }
    next();
});

// Post-save middleware to update Purchase Order
purchasePaymentSchema.post('save', async function (doc) {
    if (doc.paymentStatus === 'COMPLETED') {
        try {
            const PurchaseOrder = mongoose.model('PurchaseOrder');
            const po = await PurchaseOrder.findById(doc.purchaseOrderId);
            if (po) {
                // Update received quantities and values
                doc.receivedItems.forEach(receivedItem => {
                    const item = po.items.find(i => i.itemId.toString() === receivedItem.itemId.toString());
                    if (item) {
                        item.receivedQty = (item.receivedQty || 0) + receivedItem.quantity;
                        item.pendingQty = item.qty - item.receivedQty;
                        item.fullyReceived = item.pendingQty <= 0;
                    }
                });

                // Mark items as modified
                po.markModified('items');

                // Update total received value
                po.receivedValue = (po.receivedValue || 0) + doc.amount;
                po.pendingValue = po.netAmount - po.receivedValue;

                // Update PO status based on received items
                const allReceived = po.items.every(item => item.fullyReceived);
                if (allReceived && po.pendingValue <= 0) {
                    po.status = 'Completed';
                } else if (po.receivedValue > 0) {
                    po.status = 'PartiallyReceived';
                }

                await po.save({ validateBeforeSave: false });
            }
        } catch (error) {
            console.error('Error updating purchase order after payment:', error);
            // Don't throw, so payment save doesn't fail
        }
    }
});

// Plugins
purchasePaymentSchema.plugin(mongoosePaginate);
purchasePaymentSchema.plugin(auditPlugin);
purchasePaymentSchema.plugin(notesPlugin);
purchasePaymentSchema.plugin(softDeletePlugin);

const PurchasePayment = mongoose.model('PurchasePayment', purchasePaymentSchema);

export default PurchasePayment;