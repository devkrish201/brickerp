import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Labour Payment Schema - Tracks payments to workers/labourers
 */
const labourPaymentSchema = new mongoose.Schema({
    paymentNumber: {
        type: String,
        unique: true,
    },
    // Related Batch/Production
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrickBatch',
        index: true,
    },
    batchIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrickBatch',
    }],
    batchNumber: String,

    // Labourer details
    labourerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Labourer',
        required: [true, 'Labourer is required'],
        index: true,
    },
    labourerName: {
        type: String,
        required: [true, 'Labourer name is required'],
    },
    labourerPhone: String,
    labourerAddress: String,

    // Payment details
    paymentDate: {
        type: Date,
        default: Date.now,
        required: true,
    },
    paymentMethod: {
        type: String,
        enum: ['CASH',  'BANK_TRANSFER', 'UPI'],
        required: [true, 'Payment method is required'],
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING',  'COMPLETED', 'CANCELLED'],
        default: 'PENDING',
        index: true,
    },

    // Amount details
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: 0,
    },
    description: String,

    // Work details
    workType: {
        type: String,
        enum: ['PRODUCTION', 'LOADING', 'PACKING', 'MAINTENANCE', 'OTHER'],
        required: true,
    },
    payCategory: {
        type: String,
        enum: ['Per Day', 'Per Brick'],
        default: 'Per Day',
    },
    workHours: {
        type: Number,
        min: 0,
    },
    ratePerHour: {
        type: Number,
        min: 0,
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
    reference: String,
    notes: String,

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
labourPaymentSchema.plugin(mongoosePaginate);
labourPaymentSchema.plugin(auditPlugin);
labourPaymentSchema.plugin(softDeletePlugin);

// Indexes
labourPaymentSchema.index({ paymentDate: -1 });
labourPaymentSchema.index({ labourerId: 1, paymentDate: -1 });
labourPaymentSchema.index({ paymentStatus: 1, paymentDate: -1 });

export default mongoose.model('LabourPayment', labourPaymentSchema);
