import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { UNITS } from '../../config/constants.js';
import { auditPlugin, notesPlugin } from '../../utils/auditPlugin.js';

/**
 * Stock Model
 * Tracks current inventory levels per item per warehouse
 */
const stockSchema = new mongoose.Schema({
    // optional category helper for faster filtering
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
    },

    // reference to the inventory item (brick, raw material, etc.)
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: [true, 'Item is required'],
        index: true,
    },

    // actual quantities and costing fields
    quantity: {
        type: Number,
        default: 0,
    },
    reservedQty: {
        type: Number,
        default: 0,
    },
    availableQty: {
        type: Number,
        default: 0,
    },
    unit: {
        type: String,
        enum: Object.values(UNITS),
        default: 'piece',
    },
    unitCost: {
        type: Number,
        default: 0,
    },
    reorderLevel: {
        type: Number,
        default: 0,
    },
    batch: String,
    expiryDate: Date,
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        index: true,
    },

    manufacturingDate: Date,

    totalValue: {
        type: Number,
    },

    // Status (Available, Consumed, etc.)
    status: {
        type: String,
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
stockSchema.index({ categoryId: 1 });
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
stockSchema.pre('save', async function (next) {
    // auto-fill categoryId from item if unset
    if (!this.categoryId && this.itemId) {
        try {
            const Item = mongoose.model('Item');
            const item = await Item.findById(this.itemId).select('categoryId').lean();
            if (item && item.categoryId) {
                this.categoryId = item.categoryId;
            }
        } catch (err) {
            // ignore if item lookup fails
        }
    }

    // Calculate available quantity
    this.availableQty = (this.quantity || 0) - (this.reservedQty || 0);

    // Calculate total value
    this.totalValue = Math.round((this.quantity || 0) * (this.unitCost || 0));

    // Check low stock
    this.isLowStock = this.availableQty <= (this.reorderLevel || 0);

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
            status: 'Available',          // finished goods are available by default
        });
        console.log('stock.updateQuantity: created new stock for', itemId, 'batch', options.batch);
    } else if (!stock.status) {
        // ensure existing record has a status so it is included in normal queries
        stock.status = 'Available';
    }

    const newQuantity = stock.quantity + quantityChange;
    console.log('stock.updateQuantity: item', itemId, 'current qty', stock.quantity, 'change', quantityChange, '=> newQty', newQuantity);

    if (newQuantity < 0) {
        throw new Error('Insufficient stock');
    }

    stock.quantity = newQuantity;
    if (quantityChange > 0) {
        stock.status = 'Available';
    }
    // maintain derived available qty immediately in case we bypass save hook
    stock.availableQty = (stock.quantity || 0) - (stock.reservedQty || 0);

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

    if (stock.availableQty < quantity) {
        throw new Error('Insufficient available stock');
    }

    stock.reservedQty += quantity;
    await stock.save({ session });

    return stock;
};

// Static method to release reserved stock
stockSchema.statics.releaseReservedStock = async function (itemId, quantity, session) {
    const stock = await this.findOne({ itemId }).session(session);

    if (!stock) {
        throw new Error('Stock not found');
    }

    stock.reservedQty = Math.max(0, stock.reservedQty - quantity);
    await stock.save({ session });

    return stock;
};

// Static method to get low stock items
stockSchema.statics.getLowStock = function () {
    return this.find({ isLowStock: true, status: 'Available' })
        .populate('itemId', 'name sku')
        .lean();
};

// Static method to aggregate stock by item (useful for finished goods overview)
stockSchema.statics.aggregateByItem = function (filter = {}) {
    const match = { ...filter };
    // ensure we only include available records by default
    if (!match.status) match.status = 'Available';

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$itemId',
                quantity: { $sum: '$quantity' },
                reservedQty: { $sum: '$reservedQty' },
                // compute availability from quantities rather than sum stored field, safer when docs are stale
                availableQty: { $sum: { $subtract: ['$quantity', '$reservedQty'] } },
                isLowStock: { $max: '$isLowStock' },
                categoryId: { $first: '$categoryId' },
                unit: { $first: '$unit' },
                lastUpdated: { $max: '$updatedAt' },
            },
        },
        {
            $lookup: {
                from: 'items',
                localField: '_id',
                foreignField: '_id',
                as: 'item',
            },
        },
        { $unwind: '$item' },
        {
            $project: {
                _id: 1,
                itemId: '$item',
                quantity: 1,
                reservedQty: 1,
                availableQty: 1,
                isLowStock: 1,
                // prefer stored categoryId but fall back to item.categoryId
                categoryId: { $ifNull: ['$categoryId', '$item.categoryId'] },
                unit: 1,
                lastUpdated: 1,
            },
        },
    ]);
};

const Stock = mongoose.model('Stock', stockSchema);

export default Stock;
