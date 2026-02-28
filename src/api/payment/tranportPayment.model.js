import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Transport Payment Schema - Tracks payments for transportation services
 */
const transportPaymentSchema = new mongoose.Schema({
    paymentNumber: {
        type: String,
        unique: true,
    },

    // Related shipment/order
    salesOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
        index: true,
    },
    soNumber: String,

    purchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
        index: true,
    },
    poNumber: String,

    // Transport item reference
    transportItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        index: true,
    },

    // Shipment details
    shipmentDetails: {
        origin: String,
        destination: String,
        distance: {
            type: Number,
            min: 0,
        },
        unit: {
            type: String,
            enum: ['KM', 'MILES'],
            default: 'KM',
        },
    },

    // Vehicle details
    vehicleNumber: String,
    vehicleType: {
        type: String,
        // enum: ['TRUCK', 'TEMPO', 'AUTO', 'VAN', 'CONTAINER', 'OTHER'],
    },
    driverName: String,
    driverPhone: String,

    // Shipment tracking
    shipmentDate: Date,
    deliveryDate: Date,
    trackingNumber: String,

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
        enum: ['PENDING', 'COMPLETED', 'CANCELLED'],

        default: 'PENDING',
        index: true,
    },

    // Amount details
    baseAmount: {
        type: Number,
        required: [true, 'Base amount is required'],
        min: 0,
    },
    additionalCharges: {
        type: Number,
        default: 0,
        min: 0,
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
    },
    tax: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalAmount: {
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
    reference: String,
    notes: String,
    deliveryProofUrl: String,
    invoiceUrl: String,

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
transportPaymentSchema.plugin(mongoosePaginate);
transportPaymentSchema.plugin(auditPlugin);
transportPaymentSchema.plugin(softDeletePlugin);

// Indexes
transportPaymentSchema.index({ paymentDate: -1 });
transportPaymentSchema.index({ transportProviderId: 1, paymentDate: -1 });
transportPaymentSchema.index({ paymentStatus: 1, paymentDate: -1 });
transportPaymentSchema.index({ trackingNumber: 1 });

export default mongoose.model('TransportPayment', transportPaymentSchema);
