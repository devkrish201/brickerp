import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { PO_STATUS, UNITS } from '../../config/constants.js';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';
import { calculateLineItemTotal, lockPOPrices } from '../../business-rules/calculators.js';

/**
 * PO Item Sub-Schema
 * Prices are LOCKED at PO approval
 */
const poItemSchema = new mongoose.Schema({
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
        min: [0.01, 'Quantity must be greater than 0'],
    },
    unit: {
        type: String,
        enum: Object.values(UNITS),
        required: [true, 'Unit is required'],
    },
    // LOCKED prices (cannot be changed after approval)
    unitPriceLocked: {
        type: Number, // In rupees
        required: true,
    },
    totalPriceLocked: {
        type: Number, // In rupees, auto-calculated
    },
    // Receiving tracking
    receivedQty: {
        type: Number,
        default: 0,
        min: 0,
    },
    pendingQty: {
        type: Number, // Auto-calculated
    },
    fullyReceived: {
        type: Boolean,
        default: false,
    },
    // Notes
    notes: String,
    specifications: String,
}, { _id: true });

// Calculate totals and pending qty
poItemSchema.pre('save', function (next) {
    this.totalPriceLocked = calculateLineItemTotal(this.qty, this.unitPriceLocked);
    this.pendingQty = this.qty - this.receivedQty;
    this.fullyReceived = this.pendingQty <= 0;
    next();
});

/**
 * Main Purchase Order Schema
 */
const purchaseOrderSchema = new mongoose.Schema({
    poNumber: {
        type: String,
        unique: true,
        required: true,
    },
    // Source estimate (if converted from estimate)
    sourceEstimateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Estimate',
    },
    // Vendor
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: [true, 'Vendor is required'],
        index: true,
    },
    // User who created
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Dates
    poDate: {
        type: Date,
        default: Date.now,
    },
    expectedDeliveryDate: {
        type: Date,
    },
    // Status
    status: {
        type: String,
        enum: Object.values(PO_STATUS),
        default: PO_STATUS.DRAFT,
        index: true,
    },
    // Items (with locked prices)
    items: [poItemSchema],

    // Totals (all LOCKED at approval)
    totalAmount: {
        type: Number, // In rupees
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
    netAmount: {
        type: Number, // totalAmount + taxAmount - discountAmount
        default: 0,
    },
    // Received amount tracking
    receivedValue: {
        type: Number,
        default: 0,
    },
    pendingValue: {
        type: Number,
    },

    // Currency
    currency: {
        type: String,
        default: 'INR',
    },

    // Delivery details
    deliveryAddress: {
        type: String,
    },
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
    },

    // Terms and conditions
    paymentTerms: String,
    deliveryTerms: String,
    termsAndConditions: String,

    // Approval workflow
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    approvedAt: Date,

    // Documents
    attachments: [{
        name: String,
        url: String,
        type: String,
    }],

    // Linked records
    goodsReceipts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GoodsReceipt',
    }],

    // Internal notes
    internalNotes: String,

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
purchaseOrderSchema.index({ createdBy: 1 });
purchaseOrderSchema.index({ poDate: -1 });
purchaseOrderSchema.index({ expectedDeliveryDate: 1 });
// poNumber has unique: true in schema
// vendorId and status have index: true in schema

// Plugins
purchaseOrderSchema.plugin(mongoosePaginate);
purchaseOrderSchema.plugin(auditPlugin);
purchaseOrderSchema.plugin(notesPlugin);
purchaseOrderSchema.plugin(softDeletePlugin);

// Ensure PO number exists before Mongoose validation (prevents validation race)
// Replaced last-PO scan with atomic monthly counter to avoid duplicates under concurrency
// Defensive: if counter returns a poNumber that already exists (counters out-of-sync), retry a few times
purchaseOrderSchema.pre('validate', async function (next) {
    if (this.isNew && !this.poNumber) {
        try {
            const poDate = this.poDate || new Date();
            const year = poDate.getFullYear();
            const month = String(poDate.getMonth() + 1).padStart(2, '0');
            const counterId = `po_${year}${month}`;

            const countersColl = mongoose.connection.collection('counters');
            const MAX_ATTEMPTS = 5;

            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                // atomic increment in lightweight counters collection
                const res = await countersColl.findOneAndUpdate(
                    { _id: counterId },
                    { $inc: { seq: 1 }, $setOnInsert: { createdAt: new Date() } },
                    { upsert: true, returnDocument: 'after' }
                );

                const seq = (res && res.value && Number.isInteger(res.value.seq)) ? res.value.seq : 1;
                const candidate = `PO-${year}${month}-${String(seq).padStart(4, '0')}`;

                // Defensive check: if candidate already exists in DB, continue loop to get next seq
                // This protects against counters being stale / out-of-sync with existing documents
                // (rare but possible after manual DB edits or previous failures)
                // Note: this additional read is acceptable because PO creation is not high-frequency.
                // eslint-disable-next-line no-await-in-loop
                const exists = await mongoose.model('PurchaseOrder').findOne({ poNumber: candidate }).select('_id').lean();
                if (!exists) {
                    this.poNumber = candidate;
                    break;
                }

                // eslint-disable-next-line no-console
                console.warn(`poNumber candidate ${candidate} already exists; incrementing counter and retrying (attempt ${attempt})`);
            }

            if (!this.poNumber) {
                const fallback = Date.now();
                this.poNumber = `PO-${String(fallback).slice(-12)}`;
                // eslint-disable-next-line no-console
                console.error(`Failed to allocate unique poNumber after ${MAX_ATTEMPTS} attempts; using fallback ${this.poNumber}`);
            }
        } catch (err) {
            // fallback to timestamp-based number if counter fails (should be rare)
            const fallback = Date.now();
            this.poNumber = `PO-${String(fallback).slice(-12)}`;
            // eslint-disable-next-line no-console
            console.error('Failed to generate poNumber via counter, using fallback:', err);
        }
    }

    next();
});

// Pre-save hook: calculate totals and pending qty (no longer generates poNumber here)
purchaseOrderSchema.pre('save', async function (next) {
    // Calculate totals
    let totalAmount = 0;
    let receivedValue = 0;

    for (const item of this.items) {
        item.totalPriceLocked = calculateLineItemTotal(item.qty, item.unitPriceLocked);
        item.pendingQty = item.qty - item.receivedQty;
        item.fullyReceived = item.pendingQty <= 0;

        totalAmount += item.totalPriceLocked;
        receivedValue += calculateLineItemTotal(item.receivedQty, item.unitPriceLocked);
    }

    this.totalAmount = totalAmount;
    this.netAmount = totalAmount + (this.taxAmount || 0) - (this.discountAmount || 0);
    this.receivedValue = receivedValue;
    this.pendingValue = this.netAmount - receivedValue;

    // Auto-update status based on received quantities
    if (this.status === PO_STATUS.APPROVED ||
        this.status === PO_STATUS.PARTIALLY_RECEIVED) {
        const allReceived = this.items.every(item => item.fullyReceived);
        const anyReceived = this.items.some(item => item.receivedQty > 0);

        if (allReceived) {
            this.status = PO_STATUS.COMPLETED;
        } else if (anyReceived) {
            this.status = PO_STATUS.PARTIALLY_RECEIVED;
        }
    }

    next();
});

// Post-save hook: auto-create purchase invoice when PO is completed or partially received
purchaseOrderSchema.post('save', async function (doc) {
    // Only create invoice if status is COMPLETED or PARTIALLY_RECEIVED and no invoice exists yet
    if (doc.status === PO_STATUS.COMPLETED || doc.status === PO_STATUS.PARTIALLY_RECEIVED) {
        try {
            const PurchaseInvoiceModel = mongoose.model('PurchaseInvoice');
            const existingInvoice = await PurchaseInvoiceModel.findOne({
                purchaseOrderId: doc._id
            });

            if (!existingInvoice) {
                // Populate vendor and items for invoice creation
                const populatedPO = await PurchaseOrder.findById(doc._id)
                    .populate('vendorId')
                    .populate('items.itemId');

                if (populatedPO) {
                    await PurchaseInvoiceModel.createFromPO(populatedPO, doc.createdBy);
                    console.log(`Auto-created purchase invoice for PO ${populatedPO.poNumber}`);
                }
            }
        } catch (error) {
            // Log error but don't fail the PO save
            console.error('Failed to auto-create purchase invoice:', error);
        }
    }
});

// Instance method to approve PO (locks prices)
purchaseOrderSchema.methods.approve = async function (userId) {
    if (this.status !== PO_STATUS.DRAFT) {
        throw new Error('Only draft POs can be approved');
    }

    this.status = PO_STATUS.APPROVED;
    this.approvedBy = userId;
    this.approvedAt = new Date();

    // Prices are already locked in items, just mark as approved
    await this.save();

    return this;
};

// Instance method to cancel PO
purchaseOrderSchema.methods.cancel = async function (userId, reason) {
    if (this.status === PO_STATUS.COMPLETED) {
        throw new Error('Completed POs cannot be cancelled');
    }

    if (this.receivedValue > 0) {
        throw new Error('POs with received goods cannot be cancelled');
    }

    this.status = PO_STATUS.CANCELLED;
    this.notes.push({
        text: `PO cancelled: ${reason}`,
        createdBy: userId,
        createdAt: new Date(),
    });

    await this.save();
    return this;
};

// Instance method to update received quantities
purchaseOrderSchema.methods.updateReceivedQty = async function (itemId, receivedQty) {
    const item = this.items.id(itemId);
    if (!item) {
        throw new Error('Item not found in PO');
    }

    item.receivedQty = receivedQty;
    await this.save();

    return this;
};

// Static method to create from estimate
purchaseOrderSchema.statics.createFromEstimate = async function (estimate, vendorId, userId) {
    const lockedItems = lockPOPrices(estimate.items);

    const po = new this({
        sourceEstimateId: estimate._id,
        vendorId,
        createdBy: userId,
        items: lockedItems,
        _auditUser: userId,
    });

    // Save with retry on poNumber duplicate (protects convert-to-PO path under contention)
    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await po.save();
            break;
        } catch (err) {
            const isDup = err && (err.code === 11000 || err.name === 'MongoServerError') && /poNumber/.test(String(err.message));
            if (isDup && attempt < MAX_RETRIES) {
                // Defensive sync: ensure counters for the PO month are at least the current max
                try {
                    const poDate = po.poDate || new Date();
                    const year = poDate.getFullYear();
                    const month = String(poDate.getMonth() + 1).padStart(2, '0');
                    const ym = `${year}${month}`;
                    const id = `po_${ym}`;

                    const last = await mongoose.model('PurchaseOrder')
                        .findOne({ poNumber: new RegExp(`^PO-${ym}-`) })
                        .sort({ poNumber: -1 })
                        .select('poNumber')
                        .lean();

                    if (last && last.poNumber) {
                        const m = String(last.poNumber).match(/-(\d+)$/);
                        const maxSeq = m ? parseInt(m[1], 10) : null;
                        if (maxSeq) {
                            const countersColl = mongoose.connection.collection('counters');
                            const cur = await countersColl.findOne({ _id: id });
                            if (!cur || (cur.seq || 0) < maxSeq) {
                                await countersColl.updateOne(
                                    { _id: id },
                                    { $set: { seq: maxSeq, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
                                    { upsert: true }
                                );
                                // eslint-disable-next-line no-console
                                console.warn(`Synchronized counters['${id}'] => ${maxSeq} due to duplicate poNumber (createFromEstimate)`);
                            }
                        }
                    }
                } catch (syncErr) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to sync PO counter while handling duplicate in createFromEstimate:', syncErr);
                    // continue to retry anyway
                }

                po.poNumber = undefined; // force model to pick next seq on retry
                await new Promise(r => setTimeout(r, 50 * attempt));
                continue;
            }
            throw err;
        }
    }

    // Mark estimate as converted
    await estimate.markConvertedToPO(po._id);

    return po;
};

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
