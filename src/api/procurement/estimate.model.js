import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { ESTIMATE_STATUS, UNITS } from '../../config/constants.js';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';
import { calculateLineItemTotal, calculateLabourCost } from '../../business-rules/calculators.js';

/**
 * Estimate Item Sub-Schema
 */
const estimateItemSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true,
    },
    description: {
        type: String,
        trim: true,
    },
    qty: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity cannot be negative'],
    },
    unit: {
        type: String,
        enum: Object.values(UNITS),
        required: [true, 'Unit is required'],
    },
    unitPrice: {
        type: Number, // In rupees
        required: [true, 'Unit price is required'],
        min: [0, 'Unit price cannot be negative'],
    },
    totalPrice: {
        type: Number, // Auto-calculated
    },
    // For items with price ranges (like bricks: ₹10,000-12,000)
    minPrice: {
        type: Number,
    },
    maxPrice: {
        type: Number,
    },
    minTotalPrice: Number,
    maxTotalPrice: Number,
    // Notes for ambiguous values
    notes: {
        type: String,
        trim: true,
    },
    sourceReference: {
        type: String, // e.g., "From handwritten note - verify"
    },
}, { _id: true });

// Pre-save calculation for each item
estimateItemSchema.pre('save', function (next) {
    this.totalPrice = calculateLineItemTotal(this.qty, this.unitPrice);

    if (this.minPrice) {
        this.minTotalPrice = calculateLineItemTotal(this.qty, this.minPrice);
    }
    if (this.maxPrice) {
        this.maxTotalPrice = calculateLineItemTotal(this.qty, this.maxPrice);
    }

    next();
});

/**
 * Labour Summary Sub-Schema
 */
const labourSummarySchema = new mongoose.Schema({
    minDays: {
        type: Number,
        min: 0,
    },
    maxDays: {
        type: Number,
        min: 0,
    },
    ratePerDay: {
        type: Number, // In rupees
        min: 0,
    },
    minCost: Number,
    maxCost: Number,
    avgCost: Number,
    selectedCost: Number, // The cost user chose to use
    notes: String,
}, { _id: false });

/**
 * Main Estimate Schema
 */
const estimateSchema = new mongoose.Schema({
    estimateNumber: {
        type: String,
        unique: true,
        required: true,
    },
    clientName: {
        type: String,
        required: [true, 'Client name is required'],
        trim: true,
    },
    clientContact: {
        phone: String,
        email: String,
        address: String,
    },
    projectName: {
        type: String,
        trim: true,
    },
    projectDescription: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Line items
    items: [estimateItemSchema],

    // Labour summary (from client requirement)
    labourSummary: labourSummarySchema,

    // Totals
    materialTotal: {
        type: Number,
        default: 0,
    },
    labourTotal: {
        type: Number,
        default: 0,
    },
    transportTotal: {
        type: Number,
        default: 0,
    },
    subtotal: {
        type: Number,
        default: 0,
    },
    taxAmount: {
        type: Number,
        default: 0,
    },
    discountAmount: {
        type: Number,
        default: 0,
    },
    totalAmount: {
        type: Number,
        default: 0,
    },
    // Range totals (for estimates with min/max)
    totalMinAmount: Number,
    totalMaxAmount: Number,

    // Status
    status: {
        type: String,
        enum: Object.values(ESTIMATE_STATUS),
        default: ESTIMATE_STATUS.DRAFT,
        index: true,
    },

    // Approval workflow
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    approvedAt: Date,
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    rejectedAt: Date,
    rejectionReason: String,

    // Linked PO (when converted)
    linkedPurchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
    },

    // Validity
    validUntil: {
        type: Date,
    },

    // Documents
    attachments: [{
        name: String,
        url: String,
        type: String,
    }],

    // General notes and metadata
    internalNotes: String,
    termsAndConditions: String,
    currency: {
        type: String,
        default: 'INR',
    },
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
estimateSchema.index({ clientName: 'text', projectName: 'text' });
estimateSchema.index({ createdBy: 1 });
estimateSchema.index({ createdAt: -1 });
estimateSchema.index({ validUntil: 1 });
// estimateNumber has unique: true in schema
// status has index: true in schema

// Plugins
estimateSchema.plugin(mongoosePaginate);
estimateSchema.plugin(auditPlugin);
estimateSchema.plugin(notesPlugin);
estimateSchema.plugin(softDeletePlugin);

// Pre-save hook to generate estimate number and calculate totals
estimateSchema.pre('save', async function (next) {
    // Generate estimate number if new
    if (this.isNew && !this.estimateNumber) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');

        const lastEstimate = await mongoose.model('Estimate')
            .findOne({ estimateNumber: new RegExp(`^EST-${year}${month}`) })
            .sort({ estimateNumber: -1 })
            .select('estimateNumber');

        let nextNumber = 1;
        if (lastEstimate) {
            const match = lastEstimate.estimateNumber.match(/EST-\d{6}-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        this.estimateNumber = `EST-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
    }

    // Calculate totals
    let materialTotal = 0;
    let labourTotal = 0;
    let transportTotal = 0;
    let minTotal = 0;
    let maxTotal = 0;

    for (const item of this.items) {
        // Recalculate item total
        item.totalPrice = calculateLineItemTotal(item.qty, item.unitPrice);

        if (item.minPrice) {
            item.minTotalPrice = calculateLineItemTotal(item.qty, item.minPrice);
            minTotal += item.minTotalPrice;
        }
        if (item.maxPrice) {
            item.maxTotalPrice = calculateLineItemTotal(item.qty, item.maxPrice);
            maxTotal += item.maxTotalPrice;
        }

        // Categorize by item type (requires population)
        // For now, add to material total
        materialTotal += item.totalPrice;
    }

    // Labour summary calculation
    if (this.labourSummary && this.labourSummary.minDays && this.labourSummary.ratePerDay) {
        const labourCalc = calculateLabourCost(
            this.labourSummary.minDays,
            this.labourSummary.maxDays || this.labourSummary.minDays,
            this.labourSummary.ratePerDay
        );
        this.labourSummary.minCost = labourCalc.minCost;
        this.labourSummary.maxCost = labourCalc.maxCost;
        this.labourSummary.avgCost = labourCalc.avgCost;

        labourTotal = this.labourSummary.selectedCost || labourCalc.avgCost;
        minTotal += labourCalc.minCost;
        maxTotal += labourCalc.maxCost;
    }

    this.materialTotal = materialTotal;
    this.labourTotal = labourTotal;
    this.transportTotal = transportTotal;
    this.subtotal = materialTotal + labourTotal + transportTotal;
    this.totalAmount = this.subtotal + (this.taxAmount || 0) - (this.discountAmount || 0);
    this.totalMinAmount = minTotal || this.totalAmount;
    this.totalMaxAmount = maxTotal || this.totalAmount;

    next();
});

// Instance method to approve
estimateSchema.methods.approve = async function (userId) {
    this.status = ESTIMATE_STATUS.APPROVED;
    this.approvedBy = userId;
    this.approvedAt = new Date();
    await this.save();
};

// Instance method to convert to PO
estimateSchema.methods.markConvertedToPO = async function (poId) {
    this.status = ESTIMATE_STATUS.CONVERTED_TO_PO;
    this.linkedPurchaseOrderId = poId;
    await this.save();
};

const Estimate = mongoose.model('Estimate', estimateSchema);

export default Estimate;
