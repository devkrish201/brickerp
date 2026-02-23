import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { BATCH_STATUS, UNITS } from '../../config/constants.js';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';
import { calculateBrickLabourCost } from '../../business-rules/calculators.js';

/**
 * Labour Entry Sub-Schema
 * Tracks labour for brick production
 */
const labourEntrySchema = new mongoose.Schema({
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    workerName: String,
    workType: {
        type: String,
        enum: ['molding', 'loading', 'firing', 'unloading', 'supervision', 'other'],
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    hoursWorked: Number,
    daysWorked: {
        type: Number,
        default: 1,
    },
    ratePerDay: {
        type: Number, // In rupees
    },
    totalCost: {
        type: Number, // In rupees
    },
    notes: String,
}, { _id: true });

// Calculate labour cost
labourEntrySchema.pre('save', function (next) {
    if (this.ratePerDay && this.daysWorked) {
        this.totalCost = Math.round(this.ratePerDay * this.daysWorked);
    }
    next();
});

/**
 * Raw Material Usage Sub-Schema
 */
const rawMaterialUsageSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: true,
    },
    itemName: String,
    quantity: {
        type: Number,
        required: true,
    },
    unit: {
        type: String,
        enum: Object.values(UNITS),
        required: true,
    },
    unitCost: {
        type: Number, // In rupees
    },
    totalCost: {
        type: Number, // In rupees
    },
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
    },
    stockDeducted: {
        type: Boolean,
        default: false,
    },
}, { _id: true });

/**
 * Main Brick Batch Schema
 */
const brickBatchSchema = new mongoose.Schema({
    batchCode: {
        type: String,
        unique: true,
        required: true,
    },
    // Product being produced (Brick item)
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: [true, 'Brick product is required'],
        index: true,
    },
    // Quantities
    plannedQty: {
        type: Number,
        required: [true, 'Planned quantity is required'],
        min: 1,
    },
    producedQty: {
        type: Number,
        default: 0,
    },
    qualityPassedQty: {
        type: Number,
        default: 0,
    },
    rejectedQty: {
        type: Number,
        default: 0,
    },
    unit: {
        type: String,
        default: 'piece',
    },
    // Brick specifications
    brickSize: {
        length: Number, // inches
        width: Number,
        height: Number,
        type: {
            type: String,
            enum: ['standard', 'large', 'custom'],
            default: 'standard',
        },
    },
    // Raw materials used
    rawMaterials: [rawMaterialUsageSchema],

    // Labour entries
    labourEntries: [labourEntrySchema],

    // Labour cost summary (from client calculations)
    labourCostSummary: {
        totalDays: Number,
        avgRatePerDay: Number, // In rupees
        totalCost: Number, // In rupees
        costPer1000: Number, // In rupees
    },

    // Dates
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    },
    plannedEndDate: {
        type: Date,
    },

    // Status
    status: {
        type: String,
        enum: Object.values(BATCH_STATUS),
        default: BATCH_STATUS.DRAFT,
        index: true,
    },
    // flag indicating finished quantity has been posted to stock
    stockAdded: {
        type: Boolean,
        default: false,
    },

    // Quality
    qualityNotes: String,
    qualityGrade: {
        type: String,
        enum: ['A', 'B', 'C', 'Rejected'],
    },
    qualityCheckedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    qualityCheckDate: Date,

    // Cost tracking
    totalMaterialCost: {
        type: Number, // In rupees
        default: 0,
    },
    totalLabourCost: {
        type: Number, // In rupees
        default: 0,
    },
    totalCost: {
        type: Number, // In rupees
        default: 0,
    },
    costPerBrick: {
        type: Number, // In rupees
    },

    // Transport (after production)
    transportTripId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TransportTrip',
    },

    // Linked documents
    linkedPurchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
    },

    // Created by
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
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
brickBatchSchema.index({ startDate: -1 });
// batchCode has unique: true in schema
// itemId and status have index: true in schema

// Plugins
brickBatchSchema.plugin(mongoosePaginate);
brickBatchSchema.plugin(auditPlugin);
brickBatchSchema.plugin(notesPlugin);
brickBatchSchema.plugin(softDeletePlugin);


// Pre-save calculations
// Ensure batchCode is generated before validation so `required` passes for new documents
brickBatchSchema.pre('validate', async function (next) {
    if (this.isNew && !this.batchCode) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const day = String(new Date().getDate()).padStart(2, '0');

        const lastBatch = await mongoose.model('BrickBatch')
            .findOne({ batchCode: new RegExp(`^BB-${year}${month}${day}`) })
            .sort({ batchCode: -1 })
            .select('batchCode');

        let nextNumber = 1;
        if (lastBatch) {
            const match = lastBatch.batchCode.match(/BB-\d{8}-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        this.batchCode = `BB-${year}${month}${day}-${String(nextNumber).padStart(3, '0')}`;
    }

    next();
});

// pre-save retains calculations but no longer generates batchCode
brickBatchSchema.pre('save', async function (next) {

    // Calculate material costs
    this.totalMaterialCost = this.rawMaterials.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    // Calculate labour costs
    this.totalLabourCost = this.labourEntries.reduce((sum, l) => sum + (l.totalCost || 0), 0);

    // Labour cost summary
    if (this.labourEntries.length > 0) {
        const totalDays = this.labourEntries.reduce((sum, l) => sum + l.daysWorked, 0);
        this.labourCostSummary = {
            totalDays,
            avgRatePerDay: Math.round(this.totalLabourCost / totalDays),
            totalCost: this.totalLabourCost,
            costPer1000: this.producedQty > 0
                ? Math.round((this.totalLabourCost / this.producedQty) * 1000)
                : null,
        };
    }

    // Total cost
    this.totalCost = this.totalMaterialCost + this.totalLabourCost;

    // Cost per brick
    if (this.producedQty > 0) {
        this.costPerBrick = Math.round(this.totalCost / this.producedQty);
    }

    next();
});

// Instance method to start production (kiln side-effects removed — simplified)
// move from draft to pending
brickBatchSchema.methods.startProduction = async function (startDate = new Date()) {
    if (this.status !== BATCH_STATUS.DRAFT) {
        throw new Error('Batch must be in Draft status to start');
    }

    this.status = BATCH_STATUS.PENDING;
    this.startDate = startDate;

    await this.save();
    return this;
};

// Instance method to move to kiln (no external kiln side-effects — simplified)
// deprecated under simplified status model – alias for startProduction
brickBatchSchema.methods.moveToKiln = async function () {
    // if already pending simply return
    if (this.status === BATCH_STATUS.DRAFT) {
        throw new Error('Batch must be started before moving to kiln');
    }
    // no actual transition, keep status as pending
    await this.save();
    return this;
};

// Instance method to complete batch (kiln-related side-effects removed)
brickBatchSchema.methods.complete = async function (producedQty, qualityPassedQty, rejectedQty = 0) {
    this.status = BATCH_STATUS.COMPLETED;
    this.endDate = new Date();
    this.producedQty = producedQty;
    this.qualityPassedQty = qualityPassedQty;
    this.rejectedQty = rejectedQty;

    await this.save();
    return this;
};

// Instance method to add labour entry
brickBatchSchema.methods.addLabourEntry = async function (entryData) {
    const labourCalc = calculateBrickLabourCost(
        this.producedQty || this.plannedQty,
        entryData.ratePerDay ? entryData.ratePerDay * 1000 / 500 : 55000 // Convert to per 1000
    );

    this.labourEntries.push({
        ...entryData,
        totalCost: Math.round((entryData.ratePerDay || 40000) * (entryData.daysWorked || 1)),
    });

    await this.save();
    return this;
};

// Static method to get active batches
brickBatchSchema.statics.getActive = function () {
    return this.find({
        status: BATCH_STATUS.PENDING,
    })
        .populate('itemId', 'name sku')
        .populate('kilnId', 'name code kilnType')
        .sort({ startDate: -1 })
        .lean();
};

const BrickBatch = mongoose.model('BrickBatch', brickBatchSchema);

export default BrickBatch;
