import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

const vendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vendor name is required'],
        trim: true,
        maxlength: [200, 'Vendor name cannot exceed 200 characters'],
    },
    code: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        maxlength: [20, 'Vendor code cannot exceed 20 characters'],
    },
    contact: {
        phone: {
            type: String,
            trim: true,
        },
        alternatePhone: String,
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        contactPerson: String,
        designation: String,
    },
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: {
            type: String,
            default: 'India',
        },
        landmark: String,
    },
    // GST and Tax details
    gst: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                if (!v) return true; // GST is optional
                return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
            },
            message: 'Invalid GST number format',
        },
    },
    pan: {
        type: String,
        trim: true,
    },
    // Payment terms
    paymentTerms: {
        type: String,
        default: 'Net30',
    },
    customPaymentDays: Number,
    creditLimit: {
        type: Number, // In rupees
        default: 0,
    },
    // Bank details
    bankDetails: {
        bankName: String,
        accountNumber: String,
        ifscCode: String,
        accountType: {
            type: String,
            enum: ['Current', 'Savings'],
        },
    },
    // Categories/Items this vendor supplies
    supplyCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
    }],
    supplyItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
    }],
    // Rating and performance
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
    },
    totalOrders: {
        type: Number,
        default: 0,
    },
    totalPurchaseValue: {
        type: Number, // In rupees
        default: 0,
    },
    // Documents
    documents: [{
        name: String,
        url: String,
        type: {
            type: String,
            enum: ['registration', 'license', 'certificate', 'agreement', 'other'],
        },
        expiryDate: Date,
    }],
    // Status
    active: {
        type: Boolean,
        default: true,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    blacklisted: {
        type: Boolean,
        default: false,
    },
    blacklistReason: String,
    // Metadata
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
vendorSchema.index({ name: 'text', 'contact.contactPerson': 'text' });
vendorSchema.index({ gst: 1 }, { sparse: true });
vendorSchema.index({ active: 1, blacklisted: 1 });
vendorSchema.index({ supplyCategories: 1 });
vendorSchema.index({ supplyItems: 1 });
// code has unique: true, sparse: true in schema

// Plugins
vendorSchema.plugin(mongoosePaginate);
vendorSchema.plugin(auditPlugin);
vendorSchema.plugin(notesPlugin);
vendorSchema.plugin(softDeletePlugin);

// Pre-save hook to generate vendor code
vendorSchema.pre('save', async function (next) {
    if (!this.code && this.isNew) {
        const lastVendor = await mongoose.model('Vendor')
            .findOne()
            .sort({ createdAt: -1 })
            .select('code');

        let nextNumber = 1;
        if (lastVendor && lastVendor.code) {
            const match = lastVendor.code.match(/VND-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        this.code = `VND-${String(nextNumber).padStart(5, '0')}`;
    }
    next();
});

// Instance method to update stats after a PO
vendorSchema.methods.updateOrderStats = async function (orderValue) {
    this.totalOrders += 1;
    this.totalPurchaseValue += orderValue;
    await this.save();
};

// Static method to get vendors by category
vendorSchema.statics.getByCategory = function (categoryId) {
    return this.find({
        supplyCategories: categoryId,
        active: true,
        blacklisted: false,
    })
        .select('name code contact rating')
        .sort({ rating: -1 })
        .lean();
};

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;
