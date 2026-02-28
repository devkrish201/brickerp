import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Expense Payment Schema - Tracks various business expenses
 */
const expensePaymentSchema = new mongoose.Schema({
    paymentNumber: {
        type: String,
        unique: true,
    },

    // Expense details
    expenseType: {
        type: String,
        enum: ['UTILITIES', 'MAINTENANCE', 'REPAIRS', 'SUPPLIES', 'RENT', 'INSURANCE', 'SALARIES', 'TRAVEL', 'COMMUNICATION', 'OTHER'],
        required: [true, 'Expense type is required'],
        index: true,
    },
    expenseCategory: String,

    // Payee details
    payeeName: {
        type: String,
        required: [true, 'Payee name is required'],
    },
    payeePhone: String,
    payeeEmail: String,
    payeeAddress: String,

    // Payment details
    paymentDate: {
        type: Date,
        default: Date.now,
        required: true,
    },
    paymentMethod: {
        type: String,
        enum: ['CASH', 'BANK_TRANSFER', 'UPI'],
        required: [true, 'Payment method is required'],
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'],
        default: 'PENDING',
        index: true,
    },

    // Amount details
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: 0,
    },

    // GST/Tax details
    gstApplicable: {
        type: Boolean,
        default: false,
    },
    gstPercentage: {
        type: Number,
        default: 0,
    },
    gstAmount: {
        type: Number,
        default: 0,
    },
    grossAmount: {
        type: Number,
        required: true,
    },

    // Cheque details (if applicable)
    chequeNumber: String,
    chequeDate: Date,
    bankName: String,
    chequeStatus: {
        type: String,
        enum: ['NOT_CLEARED', 'CLEARED', 'BOUNCED', 'CANCELLED'],
        default: 'NOT_CLEARED',
    },

    // References
    invoiceNumber: String,
    billNumber: String,
    description: String,
    notes: String,
    attachmentUrl: String,

    // Budget allocation
    departmentCode: String,
    projectCode: String,

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Add plugins
expensePaymentSchema.plugin(mongoosePaginate);
expensePaymentSchema.plugin(auditPlugin);
expensePaymentSchema.plugin(softDeletePlugin);

// Indexes
expensePaymentSchema.index({ paymentDate: -1 });
expensePaymentSchema.index({ expenseType: 1, paymentDate: -1 });
expensePaymentSchema.index({ paymentStatus: 1, paymentDate: -1 });

export default mongoose.model('ExpensePayment', expensePaymentSchema);
