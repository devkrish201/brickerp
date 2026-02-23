import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
    },
    level: {
        type: Number,
        default: 0, // 0 = root category, 1 = first level child, etc.
    },
    path: {
        type: String, // Materialized path for efficient queries (e.g., "Materials/Construction/Cement")
    },
    active: {
        type: Boolean,
        default: true,
    },
    sortOrder: {
        type: Number,
        default: 0,
    },
    // ========== NEW FIELDS (From JSON Config: module_1_master_setup) ==========
    // "fields": [ "cat_name", "is_sellable", "is_purchasable" ]
    // Controls which items appear in Sales vs Purchase modules
    isSellable: {
        type: Boolean,
        default: true, // Items in this category can be sold to customers
    },
    isPurchasable: {
        type: Boolean,
        default: true, // Items in this category can be purchased from vendors
    },
    // Is this category for finished products or raw materials?
    categoryType: {
        type: String,
        enum: ['RawMaterial', 'FinishedGoods', 'Service', 'Labour', 'Transport', 'Mixed'],
        default: 'Mixed',
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
categorySchema.index({ parentId: 1 });
categorySchema.index({ path: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ name: 'text', description: 'text' });
// slug has unique: true in schema
// active is not indexed individually

// Plugins
categorySchema.plugin(mongoosePaginate);
categorySchema.plugin(auditPlugin);
categorySchema.plugin(softDeletePlugin);

// Virtual for children (populated separately)
categorySchema.virtual('children', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parentId',
});

// Pre-save hook to generate slug and path
categorySchema.pre('save', async function (next) {
    // Generate slug if not provided
    if (!this.slug || this.isModified('name')) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Ensure unique slug
        const existingCount = await mongoose.model('Category').countDocuments({
            slug: this.slug,
            _id: { $ne: this._id },
        });
        if (existingCount > 0) {
            this.slug = `${this.slug}-${Date.now()}`;
        }
    }

    // Calculate level and path
    if (this.parentId) {
        const parent = await mongoose.model('Category').findById(this.parentId);
        if (parent) {
            this.level = parent.level + 1;
            this.path = parent.path ? `${parent.path}/${this.name}` : this.name;
        }
    } else {
        this.level = 0;
        this.path = this.name;
    }

    next();
});

// Static method to get category tree
categorySchema.statics.getTree = async function (rootId = null) {
    const categories = await this.find({ parentId: rootId, active: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean();

    for (let category of categories) {
        category.children = await this.getTree(category._id);
    }

    return categories;
};

// Static method to get all ancestors
categorySchema.statics.getAncestors = async function (categoryId) {
    const ancestors = [];
    let current = await this.findById(categoryId);

    while (current && current.parentId) {
        current = await this.findById(current.parentId);
        if (current) {
            ancestors.unshift(current);
        }
    }

    return ancestors;
};

// Static method to get all descendants
categorySchema.statics.getDescendants = async function (categoryId) {
    const descendants = [];
    const children = await this.find({ parentId: categoryId, active: true });

    for (const child of children) {
        descendants.push(child);
        const childDescendants = await this.getDescendants(child._id);
        descendants.push(...childDescendants);
    }

    return descendants;
};

const Category = mongoose.model('Category', categorySchema);

export default Category;
