import mongoose from 'mongoose';
import { paginatePlugin } from '../../utils/customPaginate.js';
import { COST_TYPES, UNITS } from '../../config/constants.js';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Unified Item Model
 * Handles: Materials, Products, Services, Labour, Transport
 * Flexible design for future product/material additions
 */
const itemSchema = new mongoose.Schema({
    name: {
        type: String, 
        required: [true, 'Item name is required'],
        trim: true,
        maxlength: [200, 'Item name cannot exceed 200 characters'],
    },
    sku: {
        type: String,
        trim: true,
        unique: true,
        sparse: true, // Allow null values, but enforce uniqueness when provided
        maxlength: [50, 'SKU cannot exceed 50 characters'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
    },
    subCategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
    },
    tags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
    }],
    costType: {
        type: String,
        enum: Object.values(COST_TYPES),
        required: [true, 'Cost type is required'],
        index: true,
    },
    units: [{
        type: String,
        enum: Object.values(UNITS),
    }],
    defaultUnit: {
        type: String,
        enum: Object.values(UNITS),
    },
    defaultUnitPrice: {
        type: Number, // In rupees
        default: 0,
        min: [0, 'Price cannot be negative'],
    },
    minPrice: {
        type: Number,
        min: 0,
    },
    maxPrice: {
        type: Number,
        min: 0,
    },
    // Specifications (flexible key-value for different item types)
    specifications: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        /*
        Examples:
        - Brick: { size: "9x4.5x3 inches", type: "standard" }
        - Cement: { brand: "UltraTech", grade: "53" }
        - Labour: { skillLevel: "skilled", workType: "brickmaking" }
        */
    },
    // For trackable inventory items
    isTrackable: {
        type: Boolean,
        default: true,
    },
    reorderLevel: {
        type: Number,
        default: 0,
    },
    reorderQuantity: {
        type: Number,
        default: 0,
    },
    // For service/labour items
    isService: {
        type: Boolean,
        default: false,
    },
    serviceDetails: {
        capacityPerDay: Number, // e.g., 500 bricks per day
        requiredSkills: [String],
        estimatedDuration: Number, // in hours
    },
    // ========== NEW FIELDS (From JSON Config: module_1_master_setup) ==========
    // item_master: { fields: ["item_name", "unit", "rate", "is_sellable", "is_purchasable", "hsn_code"] }

    // Controls visibility in Sales vs Purchase modules (overrides category settings)
    isSellable: {
        type: Boolean,
        default: true, // Can this item be sold to customers
    },
    isPurchasable: {
        type: Boolean,
        default: true, // Can this item be purchased from vendors
    },
    // Flag for transport service items (special handling in invoices)
    isTransportService: {
        type: Boolean,
        default: false,
    },
    // Default recipe/BOM for manufacturing finished goods
    defaultRecipeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductRecipe',
        default: null, // Link to BOM for manufacturing
    },
    // Opening stock configuration (for inventory initialization)
    openingStock: {
        quantity: { type: Number, default: 0 },
        value: { type: Number, default: 0 }, // Total value in rupees
        date: { type: Date, default: null },
    },
    // ========== END NEW FIELDS ==========
    // Vendor associations
    preferredVendors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
    }],
    // Images/Documents
    images: [{
        url: String,
        alt: String,
        isPrimary: Boolean,
    }],
    documents: [{
        name: String,
        url: String,
        type: String, // 'spec_sheet', 'safety_data', etc.
    }],
    // Tax & Accounting
    hsnCode: {
        type: String, // HSN code for GST
        trim: true,
    },
    taxRate: {
        type: Number,
        default: 0, // GST percentage
    },
    // Metadata for future extensibility
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
    },
    active: {
        type: Boolean,
        default: true,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes
itemSchema.index({ name: 'text', description: 'text', sku: 'text' });
itemSchema.index({ categoryId: 1, subCategoryId: 1 });
itemSchema.index({ tags: 1 });
itemSchema.index({ 'preferredVendors': 1 });
itemSchema.index({ isSellable: 1, isPurchasable: 1 }); // For filtering in Sales/Purchase
itemSchema.index({ isTransportService: 1 }); // For transport-related queries
// sku has unique: true, sparse: true in schema
// categoryId, subCategoryId, costType, and active have index: true in schema

// Plugins
itemSchema.plugin(paginatePlugin);
itemSchema.plugin(auditPlugin);
itemSchema.plugin(notesPlugin);
itemSchema.plugin(softDeletePlugin);

// Virtual for category info
itemSchema.virtual('category', {
    ref: 'Category',
    localField: 'categoryId',
    foreignField: '_id',
    justOne: true,
});

// Pre-save hook to auto-generate SKU if not provided
itemSchema.pre('save', async function (next) {
    if (!this.sku && this.isNew) {
        // Generate SKU: TYPE-CATCODE-NUMBER
        const typePrefix = this.costType.substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        this.sku = `${typePrefix}-${timestamp}`;
    }

    // Set default unit if not provided
    if (!this.defaultUnit && this.units && this.units.length > 0) {
        this.defaultUnit = this.units[0];
    }

    // Mark as service if cost type is Labour or Service
    if (this.costType === COST_TYPES.LABOUR || this.costType === COST_TYPES.SERVICE) {
        this.isService = true;
        this.isTrackable = false;
    }

    next();
});

// Static method to search items
itemSchema.statics.search = async function (query, options = {}) {
    const {
        costType,
        categoryId,
        tags,
        active,
        page = 1,
        limit = 20,
    } = options;

    const filter = { isDeleted: { $ne: true } };

    // Only add active filter if explicitly provided
    if (active !== undefined) {
        filter.active = active;
    }

    if (query) {
        filter.$text = { $search: query };
    }
    if (costType) {
        filter.costType = costType;
    }
    if (categoryId) {
        filter.$or = [
            { categoryId },
            { subCategoryId: categoryId },
        ];
    }
    if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
    }

    console.log('🔍 Item.search() filter:', JSON.stringify(filter));
    console.log('🔍 Item.search() options:', JSON.stringify({ page, limit, query }));

    const result = await this.paginate(filter, {
        page,
        limit,
        sort: query ? { score: { $meta: 'textScore' } } : { name: 1 },
        populate: [
            { path: 'categoryId', select: 'name path' },
            { path: 'tags', select: 'name color' },
        ],
    });

    console.log('🔍 Item.search() result:', { totalDocs: result.totalDocs, page: result.page, docsCount: result.docs?.length });

    return result;
};

// Static method to get items by cost type
itemSchema.statics.getByCostType = function (costType, options = {}) {
    return this.find({ costType, active: true, isDeleted: { $ne: true } })
        .populate('categoryId', 'name')
        .populate('tags', 'name color')
        .sort(options.sort || { name: 1 })
        .lean();
};

const Item = mongoose.model('Item', itemSchema);

export default Item;
