import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Customer Payment Model
 * 
 * PURPOSE: Track payments RECEIVED from customers.
 * Different from Payment model which tracks payments TO vendors.
 * 
 * From JSON Config: module_finance_ledger
 * Logic: "allow_partial_payment: true"
 */

// Payment Status
export const CUSTOMER_PAYMENT_STATUS = {
    PENDING: 'Pending',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

/**
 * Customer Payment Schema
 */
const customerPaymentSchema = new mongoose.Schema({
    // Payment number (receipt number)
    paymentNumber: {
        type: String,
        unique: true,
        required: true,
    },
    receiptNumber: String, // Alias for payment number

    // Customer
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required'],
        index: true,
    },
    customerName: String,

    // Payment date
    paymentDate: {
        type: Date,
        required: true,
        default: Date.now,
    },

    // ========== AMOUNT ==========
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be positive'],
    },
    currency: {
        type: String,
        default: 'INR',
    },

    // ========== PAYMENT METHOD ==========
    paymentMethod: {
        type: String,
        enum: ['CASH', 'UPI', 'BANK_TRANSFER'],
        required: [true, 'Payment method is required'],
    },
    // Method-specific details
    transactionId: String,
    referenceNumber: String,
    // Cheque details
    chequeNumber: String,
    chequeDate: Date,
    chequeBank: String,
    chequeStatus: {
        type: String,
        enum: ['Pending', 'Cleared', 'Bounced'],
    },
    // UPI/Bank details
    upiId: String,
    bankName: String,

    // ========== ALLOCATION ==========
    // Which invoices this payment is applied to
    allocations: [{
        invoiceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SalesInvoice',
        },
        invoiceNumber: String,
        amountAllocated: Number,
    }],
    // Total allocated to invoices
    allocatedAmount: {
        type: Number,
        default: 0,
    },
    // Unallocated (advance) amount
    unallocatedAmount: {
        type: Number,
        default: 0,
    },
    // Is this an advance payment (before invoice)?
    isAdvance: {
        type: Boolean,
        default: false,
    },

    // ========== LINKED DOCUMENTS ==========
    // If payment is for specific sales order
    salesOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
    },
    soNumber: String,

    // ========== STATUS & WORKFLOW ==========
    status: {
        type: String,
        enum: Object.values(CUSTOMER_PAYMENT_STATUS),
        default: CUSTOMER_PAYMENT_STATUS.PENDING,
        index: true,
    },
    // Received by
    receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Verified by (for cheques)
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    verifiedAt: Date,
    // If refunded
    refundedAmount: {
        type: Number,
        default: 0,
    },
    refundedAt: Date,
    refundReason: String,

    // ========== TDS (Tax Deducted at Source) ==========
    tdsDeducted: {
        type: Boolean,
        default: false,
    },
    tdsAmount: {
        type: Number,
        default: 0,
    },
    tdsPercentage: {
        type: Number,
        default: 0,
    },

    // ========== DOCUMENTS ==========
    attachments: [{
        name: String,
        url: String,
        type: {
            type: String,
            enum: ['receipt', 'cheque_image', 'bank_statement', 'other'],
        },
    }],

    // Notes
    remarks: String,
    internalNotes: String,

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
customerPaymentSchema.index({ paymentDate: -1 });
customerPaymentSchema.index({ paymentMethod: 1, paymentDate: -1 });

// Plugins
customerPaymentSchema.plugin(mongoosePaginate);
customerPaymentSchema.plugin(auditPlugin);
customerPaymentSchema.plugin(notesPlugin);
customerPaymentSchema.plugin(softDeletePlugin);

// Pre-save: Generate payment number
customerPaymentSchema.pre('save', async function (next) {
    if (this.isNew && !this.paymentNumber) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const count = await mongoose.model('CustomerPayment').countDocuments();
        this.paymentNumber = `RCPT-${year}${month}-${String(count + 1).padStart(5, '0')}`;
        this.receiptNumber = this.paymentNumber;
    }

    // Calculate unallocated amount
    this.allocatedAmount = (this.allocations || []).reduce((sum, a) => sum + (a.amountAllocated || 0), 0);
    this.unallocatedAmount = this.amount - this.allocatedAmount - (this.tdsAmount || 0);
    this.isAdvance = this.unallocatedAmount > 0 && this.allocations.length === 0;

    next();
});

/**
 * Instance: Complete payment and update ledger
 */
customerPaymentSchema.methods.complete = async function (userId) {
    if (this.status === CUSTOMER_PAYMENT_STATUS.COMPLETED) {
        return this;
    }

    this.status = CUSTOMER_PAYMENT_STATUS.COMPLETED;
    this.verifiedBy = userId;
    this.verifiedAt = new Date();
    await this.save();

    // Record in customer ledger
    const CustomerLedger = mongoose.model('CustomerLedger');
    await CustomerLedger.recordTransaction({
        customerId: this.customerId,
        type: 'Payment',
        referenceId: this._id,
        referenceNumber: this.paymentNumber,
        credit: this.amount,
        description: `Payment received via ${this.paymentMethod}`,
        userId,
    });

    // Update invoice payment status
    const SalesInvoice = mongoose.model('SalesInvoice');
    for (const allocation of this.allocations) {
        const invoice = await SalesInvoice.findById(allocation.invoiceId);
        if (invoice) {
            invoice.amountPaid += allocation.amountAllocated;
            invoice.payments.push({
                paymentId: this._id,
                amount: allocation.amountAllocated,
                date: this.paymentDate,
                method: this.paymentMethod,
            });
            await invoice.save(); // Pre-save hook updates status
        }
    }

    // Update customer
    const Customer = mongoose.model('Customer');
    await Customer.findByIdAndUpdate(this.customerId, {
        lastPaymentDate: this.paymentDate,
        $inc: { totalPaidAmount: this.amount },
    });

    return this;
};

/**
 * Instance: Allocate to invoice
 */
customerPaymentSchema.methods.allocateToInvoice = async function (invoiceId, amount) {
    const SalesInvoice = mongoose.model('SalesInvoice');
    const invoice = await SalesInvoice.findById(invoiceId);

    if (!invoice) {
        throw new Error('Invoice not found');
    }
    if (invoice.customerId.toString() !== this.customerId.toString()) {
        throw new Error('Invoice does not belong to this customer');
    }
    if (amount > this.unallocatedAmount) {
        throw new Error('Insufficient unallocated amount');
    }
    if (amount > invoice.balanceDue) {
        throw new Error('Amount exceeds invoice balance due');
    }

    this.allocations.push({
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amountAllocated: amount,
    });

    await this.save();
    return this;
};

/**
 * Static: Get payment summary by method
 */
customerPaymentSchema.statics.getSummaryByMethod = async function (startDate, endDate) {
    const match = { status: CUSTOMER_PAYMENT_STATUS.COMPLETED };
    if (startDate || endDate) {
        match.paymentDate = {};
        if (startDate) match.paymentDate.$gte = new Date(startDate);
        if (endDate) match.paymentDate.$lte = new Date(endDate);
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$paymentMethod',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
        { $sort: { totalAmount: -1 } },
    ]);
};

const CustomerPayment = mongoose.model('CustomerPayment', customerPaymentSchema);

export default CustomerPayment;
