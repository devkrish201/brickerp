import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Customer Model
 * 
 * PURPOSE: Represents buyers/clients who purchase products from you.
 * DIFFERENT from Vendor: Vendors SELL to you, Customers BUY from you.
 * 
 * From JSON Config: module_sales_invoicing, module_finance_ledger
 * Logic: "Track customer credit, partial payments, balance history"
 */

const customerSchema = new mongoose.Schema({
    // Unique customer code (auto-generated)
    customerCode: {
        type: String,
        unique: true,
        // generated in pre-validate hook below; not required from client
    },
    // Customer/Business name
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
        maxlength: 200,
    },
    // Type of customer
    customerType: {
        type: String,
        enum: ['Individual', 'Business', 'Contractor', 'Dealer', 'Government', 'Other'],
        default: 'Business',
    },
    // Contact details
    contact: {
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
        },
        alternatePhone: String,
        email: String,
        whatsapp: String, // For WhatsApp PDF sharing (from JSON config)
        contactPerson: String,
        designation: String,
    },
    // Address
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
    // Delivery address (can be different from billing)
    deliveryAddresses: [{
        label: String, // "Site 1", "Main Office", etc.
        street: String,
        city: String,
        state: String,
        pincode: String,
        contactPerson: String,
        contactPhone: String,
        isDefault: Boolean,
    }],
    // GST & Tax details
    gst: {
        type: String,
        trim: true,
    },
    pan: String,
    // Credit terms
    creditLimit: {
        type: Number,
        default: 0, // 0 = No credit allowed
    },
    // Store payment terms as an object (creditDays, discountPercent, discountDays)
    paymentTerms: {
        type: new mongoose.Schema({
            creditDays: { type: Number, default: 30 }, // default credit period
            discountPercent: { type: Number, default: 0 },
            discountDays: { type: Number, default: 0 },
        }, { _id: false }),
        default: { creditDays: 30, discountPercent: 0, discountDays: 0 },
    },
    customPaymentDays: Number,

    // Billing address (explicit, used by invoices/orders)
    billingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
        landmark: String,
    },
    // Running balance (Udhaari tracking)
    // Positive = Customer owes us, Negative = We owe customer (advance/overpayment)
    currentBalance: {
        type: Number,
        default: 0,
    },
    // Lifetime stats
    totalOrders: {
        type: Number,
        default: 0,
    },
    totalPurchaseValue: {
        type: Number,
        default: 0,
    },
    totalPaidAmount: {
        type: Number,
        default: 0,
    },
    lastOrderDate: Date,
    lastPaymentDate: Date,

    // Rating & Reliability
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
    },
    paymentBehavior: {
        type: String,
        enum: ['Excellent', 'Good', 'Average', 'Poor', 'Defaulter'],
        default: 'Good',
    },

    // Documents
    documents: [{
        name: String,
        url: String,
        type: {
            type: String,
            enum: ['id_proof', 'address_proof', 'gst_certificate', 'agreement', 'other'],
        },
    }],

    // Status
    active: {
        type: Boolean,
        default: true,
    },
    blacklisted: {
        type: Boolean,
        default: false,
    },
    blacklistReason: String,

    // Preferred settings
    preferredDeliveryMethod: {
        type: String,
        enum: ['Pickup', 'Delivery', 'Both'],
        default: 'Delivery',
    },
    preferredPaymentMethod: {
        type: String,
        enum: ['CASH', 'UPI', 'Bank_Transfer'],
        default: 'CASH',
    },

    // Tags for grouping
    tags: [String],

    // Created by (salesperson)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    assignedSalesperson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
customerSchema.index({ name: 'text', 'contact.contactPerson': 'text' });
customerSchema.index({ 'contact.phone': 1 });
customerSchema.index({ gst: 1 }, { sparse: true });
customerSchema.index({ active: 1, blacklisted: 1 });
customerSchema.index({ currentBalance: 1 });
customerSchema.index({ 'address.city': 1 });

// Plugins
customerSchema.plugin(mongoosePaginate);
customerSchema.plugin(auditPlugin);
customerSchema.plugin(notesPlugin);
customerSchema.plugin(softDeletePlugin);

// Pre-validate/coerce legacy fields and ensure consistency
customerSchema.pre('validate', function (next) {
    // If paymentTerms was set as a string by older code, coerce to object
    if (typeof this.paymentTerms === 'string') {
        const v = this.paymentTerms;
        if (v === 'Immediate') this.paymentTerms = { creditDays: 0, discountPercent: 0, discountDays: 0 };
        else if (/Net(\d+)/i.test(v)) {
            const days = parseInt(v.match(/Net(\d+)/i)[1], 10) || 30;
            this.paymentTerms = { creditDays: days, discountPercent: 0, discountDays: 0 };
        }
    }

    // If top-level phone provided (legacy/controller may set), move into contact.phone
    if (this.phone && (!this.contact || !this.contact.phone)) {
        this.contact = this.contact || {};
        this.contact.phone = this.phone;
    }

    next();
});

// Pre-validate hook: generate customerCode for new documents if missing
// We use a dedicated counter document to guarantee uniqueness even under
// heavy concurrency or after soft-deletes. This replaces earlier count/agg
// logic which could still collide when the database already contained codes.
// The counter collection is very small and atomic via findOneAndUpdate.

// ensure counter model exists (shared across files)
const counterSchema = new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 },
}, { collection: 'counters' });
let Counter;
try {
    Counter = mongoose.model('Counter');
} catch (e) {
    Counter = mongoose.model('Counter', counterSchema);
}

customerSchema.pre('validate', async function (next) {
    if (this.isNew && !this.customerCode) {
        // bump counter atomically
        const result = await Counter.findOneAndUpdate(
            { _id: 'customerCode' },
            { $inc: { seq: 1 } },
            { upsert: true, new: true }
        );
        let nextNum = result.seq;

        // if we just created the counter (seq===1) or it's very small,
        // make sure it's at least one larger than the current highest
        // code in the collection; this handles existing data from before
        // the counter was introduced.
        if (nextNum === 1) {
            try {
                const agg = await mongoose.model('Customer').aggregate([
                    { $match: { customerCode: { $regex: /^CUST-/ } } },
                    { $project: { n: { $toInt: { $substr: ['$customerCode', 5, -1] } } } },
                    { $sort: { n: -1 } },
                    { $limit: 1 }
                ]);
                if (agg.length && agg[0].n + 1 > nextNum) {
                    nextNum = agg[0].n + 1;
                    // persist the adjusted value so counter doesn't reset next time
                    await Counter.findByIdAndUpdate('customerCode', { seq: nextNum });
                }
            } catch (e) {
                // ignore; if aggregation fails we'll just start at 1 and
                // collision will be handled by retry logic in controller
            }
        }

        this.customerCode = `CUST-${String(nextNum).padStart(5, '0')}`;
    }
    next();
});

// Virtual: Available credit
customerSchema.virtual('availableCredit').get(function () {
    return Math.max(0, this.creditLimit - this.currentBalance);
});

// Virtual: Is over credit limit
customerSchema.virtual('isOverCreditLimit').get(function () {
    return this.currentBalance > this.creditLimit;
});

// Instance: Update balance after order/payment
customerSchema.methods.updateBalance = async function (amount, type) {
    if (type === 'ORDER') {
        this.currentBalance += amount; // Customer owes more
        this.totalPurchaseValue += amount;
        this.totalOrders += 1;
        this.lastOrderDate = new Date();
    } else if (type === 'PAYMENT') {
        this.currentBalance -= amount; // Customer paid
        this.totalPaidAmount += amount;
        this.lastPaymentDate = new Date();
    } else if (type === 'REFUND') {
        this.currentBalance -= amount; // We refunded
    }
    await this.save();
    return this;
};

// Static: Get customers with outstanding balance
customerSchema.statics.getWithOutstanding = function (minBalance = 0) {
    return this.find({
        currentBalance: { $gt: minBalance },
        active: true,
    })
        .select('customerCode name contact currentBalance creditLimit lastPaymentDate')
        .sort({ currentBalance: -1 });
};

// Static: Get over-credit customers
customerSchema.statics.getOverCreditLimit = function () {
    return this.find({
        $expr: { $gt: ['$currentBalance', '$creditLimit'] },
        active: true,
    }).sort({ currentBalance: -1 });
};

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
