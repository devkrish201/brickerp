import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

const tagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tag name is required'],
        trim: true,
        unique: true,
        maxlength: [50, 'Tag name cannot exceed 50 characters'],
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
    },
    color: {
        type: String, // Hex color for UI display
        default: '#808080',
    },
    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    usageCount: {
        type: Number,
        default: 0, // Track how many items use this tag
    },
    active: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Indexes
tagSchema.index({ usageCount: -1 });
// name and slug have unique: true in schema

// Plugins
tagSchema.plugin(mongoosePaginate);
tagSchema.plugin(auditPlugin);
tagSchema.plugin(softDeletePlugin);

// Pre-save hook to generate slug
tagSchema.pre('save', function (next) {
    if (!this.slug || this.isModified('name')) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    next();
});

// Static method to get popular tags
tagSchema.statics.getPopular = function (limit = 10) {
    return this.find({ active: true })
        .sort({ usageCount: -1 })
        .limit(limit)
        .lean();
};

// Static method to increment usage count
tagSchema.statics.incrementUsage = async function (tagIds) {
    await this.updateMany(
        { _id: { $in: tagIds } },
        { $inc: { usageCount: 1 } }
    );
};

// Static method to decrement usage count
tagSchema.statics.decrementUsage = async function (tagIds) {
    await this.updateMany(
        { _id: { $in: tagIds } },
        { $inc: { usageCount: -1 } }
    );
};

const Tag = mongoose.model('Tag', tagSchema);

export default Tag;
