import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { UNITS } from '../../config/constants.js';
import { auditPlugin, notesPlugin } from '../../utils/auditPlugin.js';

/**
 * Stock Model
 * Tracks current inventory levels per item per warehouse
 */
const stockSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: [true, 'Item is required'],
        index: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Quantity cannot be negative'],
    },
    reservedQuantity: {
        type: Number,
        default: 0,
        min: 0,
    },
    availableQuantity: {
        type: Number, // quantity - reservedQuantity (auto-calculated)
    },
    unit: {
        type: String,
        enum: Object.values(UNITS),
        required: true,
    },
    // Batch/Lot tracking
    batch: {
        type: String,
        trim: true,
    },
    lotNumber: String,
    expiryDate: Date,
    manufacturingDate: Date,

    // Cost tracking (for FIFO/LIFO/Weighted Average)
    unitCost: {
        type: Number, // In rupees
        default: 0,
    },
    totalValue: {
        type: Number, // quantity × unitCost
    },

    // Movement tracking
    lastInDate: Date,
    lastOutDate: Date,
    lastStockCheck: Date,

    // Location within warehouse
    location: {
        zone: String,
        rack: String,
        shelf: String,
        bin: String,
    },

    // Status
    status: {
        type: String,
        enum: ['Available', 'Reserved', 'OnHold', 'Damaged', 'Expired'],
        default: 'Available',
    },

    // Reorder alerts
    reorderLevel: {
        type: Number,
        default: 0,
    },
    reorderQuantity: {
        type: Number,
        default: 0,
    },
    isLowStock: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Compound indexes
stockSchema.index({ itemId: 1, batch: 1 });
stockSchema.index({ isLowStock: 1 });
stockSchema.index({ expiryDate: 1 });

// Plugins
stockSchema.plugin(mongoosePaginate);
stockSchema.plugin(auditPlugin);
stockSchema.plugin(notesPlugin);

// Virtual for item details
stockSchema.virtual('item', {
    ref: 'Item',
    localField: 'itemId',
    foreignField: '_id',
    justOne: true,
});

// Pre-save calculations
stockSchema.pre('save', function (next) {
    // Calculate available quantity
    this.availableQuantity = this.quantity - this.reservedQuantity;

    // Calculate total value
    this.totalValue = Math.round(this.quantity * this.unitCost);

    // Check low stock
    this.isLowStock = this.availableQuantity <= this.reorderLevel;

    next();
});

// Static method to get stock by item
stockSchema.statics.getByItem = function (itemId) {
    return this.find({ itemId, status: 'Available' })
        .populate('itemId', 'name sku costType')
        .lean();
};

// Static method to update stock (add/remove)
stockSchema.statics.updateQuantity = async function (itemId, quantityChange, options = {}) {
    const session = options.session;

    const query = { itemId };
    if (options.batch) query.batch = options.batch;
    let stock = await this.findOne(query).session(session);

    if (!stock) {
        // Create new stock record if doesn't exist
        stock = new this({
            itemId,
            quantity: 0,
            unit: options.unit || 'piece',
            unitCost: options.unitCost || 0,
            reorderLevel: options.reorderLevel || 0,
        });
    }

    const newQuantity = stock.quantity + quantityChange;

    if (newQuantity < 0) {
        throw new Error('Insufficient stock');
    }

    stock.quantity = newQuantity;

    if (quantityChange > 0) {
        stock.lastInDate = new Date();
        // Update unit cost with weighted average if provided
        if (options.unitCost) {
            const totalOldValue = stock.quantity * stock.unitCost;
            const newValue = quantityChange * options.unitCost;
            stock.unitCost = Math.round((totalOldValue + newValue) / (stock.quantity + quantityChange));
        }
    } else {
        stock.lastOutDate = new Date();
    }

    if (options.batch) stock.batch = options.batch;

    await stock.save({ session });

    return stock;
};

// Static method to reserve stock
stockSchema.statics.reserveStock = async function (itemId, quantity, session) {
    const stock = await this.findOne({ itemId }).session(session);

    if (!stock) {
        throw new Error('Stock not found');
    }

    if (stock.availableQuantity < quantity) {
        throw new Error('Insufficient available stock');
    }

    stock.reservedQuantity += quantity;
    await stock.save({ session });

    return stock;
};

// Static method to release reserved stock
stockSchema.statics.releaseReservedStock = async function (itemId, quantity, session) {
    const stock = await this.findOne({ itemId }).session(session);

    if (!stock) {
        throw new Error('Stock not found');
    }

    stock.reservedQuantity = Math.max(0, stock.reservedQuantity - quantity);
    await stock.save({ session });

    return stock;
};

// Static method to get low stock items
stockSchema.statics.getLowStock = function () {
    return this.find({ isLowStock: true, status: 'Available' })
        .populate('itemId', 'name sku')
        .lean();
};

const Stock = mongoose.model('Stock', stockSchema);

export default Stock;
