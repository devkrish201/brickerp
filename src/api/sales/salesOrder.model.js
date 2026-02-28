import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { UNITS } from '../../config/constants.js';
import { auditPlugin, notesPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

/**
 * Sales Order Model
 * 
 * PURPOSE: Track customer orders before invoicing.
 * This is the "Sales" counterpart to PurchaseOrder.
 * 
 * From JSON Config: module_sales_invoicing
 * Logic: "Selling products, optional transport, delivery options"
 */

// Sales Order Status Constants
export const SALES_ORDER_STATUS = {
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
};

// Transport vehicle types and default flat-rate card (flat per-trip rates)
export const TRANSPORT_VEHICLE = {
    TRACTOR: 'Tractor',
    MINI_TRUCK: 'Mini_Truck',
    TRUCK: 'Truck',
    MAJDA: 'Majda',
    TEMPO: 'Tempo',
};

// Default flat per-trip rates (INR) — used when no rate card / manual override provided
export const TRANSPORT_FLAT_RATE_CARD = {
    [TRANSPORT_VEHICLE.TRACTOR]: 800,
    [TRANSPORT_VEHICLE.MINI_TRUCK]: 1000,
    [TRANSPORT_VEHICLE.TRUCK]: 1500,
    [TRANSPORT_VEHICLE.MAJDA]: 900,
    [TRANSPORT_VEHICLE.TEMPO]: 500,
};

// Sales Order Item Sub-Schema
const salesOrderItemSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item',
        required: [true, 'Item is required'],
    },
    itemName: String, // Denormalized
    sku: String,
    description: String,
    qty: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.01, 'Quantity must be positive'],
    },
    unit: {
        type: String,
        enum: Object.values(UNITS),
        required: true,
    },
    // Pricing
    unitPrice: {
        type: Number,
        required: [true, 'Unit price is required'],
        min: 0,
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    discountAmount: {
        type: Number,
        default: 0,
    },
    taxRate: {
        type: Number,
        default: 0, // GST %
    },
    taxAmount: {
        type: Number,
        default: 0,
    },
    totalPrice: {
        type: Number,
        default: 0,
    },
    hsnCode: String,
    // Delivery tracking
    deliveredQty: {
        type: Number,
        default: 0,
    },
    pendingQty: {
        type: Number,
    },
    fullyDelivered: {
        type: Boolean,
        default: false,
    },
    // Source batch (for traceability)
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BrickBatch',
    },
    warehouseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
    },
}, { _id: true });

// Pre-save calculations
salesOrderItemSchema.pre('save', function (next) {
    const baseAmount = this.qty * this.unitPrice;
    this.discountAmount = baseAmount * (this.discountPercent / 100);
    const afterDiscount = baseAmount - this.discountAmount;
    this.taxAmount = afterDiscount * (this.taxRate / 100);
    this.totalPrice = afterDiscount + this.taxAmount;
    this.pendingQty = this.qty - this.deliveredQty;
    this.fullyDelivered = this.pendingQty <= 0;
    next();
});

/**
 * Main Sales Order Schema
 */
const salesOrderSchema = new mongoose.Schema({
    // Unique SO number
    soNumber: {
        type: String,
        unique: true,
    },
    // Customer
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required'],
        index: true,
    },
    customerName: String, // Denormalized for quick display
    // Order date
    orderDate: {
        type: Date,
        default: Date.now,
    },
    expectedDeliveryDate: Date,

    // Status
    status: {
        type: String,
        enum: Object.values(SALES_ORDER_STATUS),
        default: SALES_ORDER_STATUS.DELIVERED,
        index: true,
    },

    // Order items
    items: [salesOrderItemSchema],

    // ========== TRANSPORT OPTIONS (From JSON Config) ==========
    // "transport_cost": { "is_optional": true, "label": "Add Delivery Charges?" }
    includeTransport: {
        type: Boolean,
        default: false,
    },
    transportDetails: {
        // link to a transport item (e.g. vehicle/driver record) from catalog
        transportItemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
        },
        distanceKm: Number,
        vehicleType: {
            type: String,
            enum: Object.values(TRANSPORT_VEHICLE),
        },
        // Vehicle / driver info (persisted so API returns these fields)
        vehicleNumber: String,
        driverName: String,
        driverPhone: String,
        // Calculated from TransportRateCard or flat-rate mapping
        calculatedCost: Number,
        // Manual override (administrator can override calculated cost)
        manualCost: Number,
        // Final transport cost saved on the order
        transportCost: Number,
        // payment status for transport charges
        paidStatus: {
            type: String,
            enum: ['Unpaid', 'Paid'],
            default: 'Unpaid',
        },
    },

    // Delivery address
    deliveryAddress: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        contactPerson: String,
        contactPhone: String,
    },

    // ========== PRICING SUMMARY ==========
    subtotal: {
        type: Number,
        default: 0, // Sum of item totals before tax
    },
    totalDiscountAmount: {
        type: Number,
        default: 0,
    },
    totalTaxAmount: {
        type: Number,
        default: 0,
    },
    transportCost: {
        type: Number,
        default: 0,
    },
    // Additional charges (loading, etc.)
    additionalCharges: {
        loading: { type: Number, default: 0 },
        unloading: { type: Number, default: 0 },
        other: { type: Number, default: 0 },
        otherDescription: String,
    },
    grandTotal: {
        type: Number,
        default: 0,
    },
    currency: {
        type: String,
        default: 'INR',
    },

    // ========== PAYMENT TRACKING ==========
    // From JSON: allow_partial_payment: true
    paymentStatus: {
        type: String,
        enum: ['Unpaid', 'Partial', 'Paid', 'Overpaid'],
        default: 'Unpaid',
        index: true,
    },
    amountPaid: {
        type: Number,
        default: 0,
    },
    balanceDue: {
        type: Number,
    },
    // Advance payment at order time
    advanceAmount: {
        type: Number,
        default: 0,
    },
    advancePaymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerPayment',
    },

    // ========== LINKED DOCUMENTS ==========
    // Linked invoice(s)
    invoiceIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesInvoice',
    }],
    // Linked delivery/transport trips
    tripIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TransportTrip',
    }],

    // ========== WORKFLOW ==========
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    confirmedAt: Date,
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    cancelledAt: Date,
    cancellationReason: String,

    // Notes & Terms
    notes: String, // Visible to customer
    internalNotes: String, // Internal only
    termsAndConditions: String,

    // Attachments
    attachments: [{
        name: String,
        url: String,
        type: String,
    }],

    // Priority
    priority: {
        type: String,
        enum: ['Low', 'Normal', 'High', 'Urgent'],
        default: 'Normal',
    },

    // Source (for tracking lead source)
    source: {
        type: String,
        enum: ['Walk-in', 'Phone', 'WhatsApp', 'Website', 'Referral', 'Repeat', 'Other'],
        default: 'Walk-in',
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
salesOrderSchema.index({ orderDate: -1 });
salesOrderSchema.index({ expectedDeliveryDate: 1 });
salesOrderSchema.index({ paymentStatus: 1, status: 1 });
salesOrderSchema.index({ createdBy: 1 });
// indexes useful for transport reporting
salesOrderSchema.index({ 'transportDetails.transportItemId': 1 });
salesOrderSchema.index({ 'transportDetails.paidStatus': 1 });

// Plugins
salesOrderSchema.plugin(mongoosePaginate);
salesOrderSchema.plugin(auditPlugin);
salesOrderSchema.plugin(softDeletePlugin);

// helper to create a unique sales‑order number based on current year/month
salesOrderSchema.statics.generateNextSoNumber = async function () {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // find the latest number for this period
    const lastSO = await this.findOne({ soNumber: new RegExp(`^SO-${year}${month}`) })
        .sort({ soNumber: -1 })
        .select('soNumber');

    let nextNumber = 1;
    if (lastSO) {
        const match = lastSO.soNumber.match(/SO-\d{6}-(\d+)/);
        if (match) nextNumber = parseInt(match[1]) + 1;
    }

    let candidate = `SO-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
    // loop until we find one that does not yet exist
    while (await this.exists({ soNumber: candidate })) {
        nextNumber++;
        candidate = `SO-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
    }
    return candidate;
};

// Pre-save: Generate SO number and calculate totals
salesOrderSchema.pre('save', async function (next) {
    // only generate if not already assigned (controller may pre-populate)
    if (this.isNew && !this.soNumber) {
        try {
            this.soNumber = await mongoose.model('SalesOrder').generateNextSoNumber();
        } catch (err) {
            return next(err);
        }
    }

    // Calculate item totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    // Ensure transport payment status is initialized
    if (this.includeTransport && this.transportDetails) {
        if (!this.transportDetails.paidStatus) {
            this.transportDetails.paidStatus = 'Unpaid';
        }
    }

    for (const item of this.items) {
        const baseAmount = item.qty * item.unitPrice;
        item.discountAmount = baseAmount * ((item.discountPercent || 0) / 100);
        const afterDiscount = baseAmount - item.discountAmount;
        item.taxAmount = afterDiscount * ((item.taxRate || 0) / 100);
        item.totalPrice = afterDiscount + item.taxAmount;
        item.pendingQty = item.qty - (item.deliveredQty || 0);
        item.fullyDelivered = item.pendingQty <= 0;

        subtotal += baseAmount;
        totalDiscount += item.discountAmount;
        totalTax += item.taxAmount;
    }

    this.subtotal = subtotal;
    this.totalDiscountAmount = totalDiscount;
    this.totalTaxAmount = totalTax;

    // Transport cost
    if (this.includeTransport && this.transportDetails) {
        // If a manual override was provided prefer it
        if (this.transportDetails.manualCost != null) {
            this.transportDetails.calculatedCost = this.transportDetails.manualCost;
        }

        // If calculatedCost is not set but vehicleType is provided, use flat-rate card (flat per-trip)
        if ((this.transportDetails.calculatedCost == null || this.transportDetails.calculatedCost === 0) && this.transportDetails.vehicleType) {
            const vehicle = this.transportDetails.vehicleType;
            const flatRate = TRANSPORT_FLAT_RATE_CARD[vehicle] || 0;
            this.transportDetails.calculatedCost = flatRate;
        }

        // Final transport cost on order (transportDetails.transportCost can be provided by client but model will prefer manual/calculated)
        this.transportCost = this.transportDetails.transportCost ||
            this.transportDetails.manualCost ||
            this.transportDetails.calculatedCost || 0;
    }

    // Additional charges
    const additionalTotal = (this.additionalCharges?.loading || 0) +
        (this.additionalCharges?.unloading || 0) +
        (this.additionalCharges?.other || 0);

    // Grand total (transport cost handled separately now – tracked on order but not included)
    this.grandTotal = (subtotal - totalDiscount) + totalTax + additionalTotal;

    // Balance due
    this.balanceDue = this.grandTotal - (this.amountPaid || 0);

    // Payment status
    if (this.amountPaid >= this.grandTotal) {
        this.paymentStatus = this.amountPaid > this.grandTotal ? 'Overpaid' : 'Paid';
    } else if (this.amountPaid > 0) {
        this.paymentStatus = 'Partial';
    } else {
        this.paymentStatus = 'Unpaid';
    }

    // Auto-update status based on delivery
    if (this.status === SALES_ORDER_STATUS.CONFIRMED ||
        this.status === SALES_ORDER_STATUS.PARTIALLY_DELIVERED) {
        const allDelivered = this.items.every(item => item.fullyDelivered);
        const anyDelivered = this.items.some(item => (item.deliveredQty || 0) > 0);

        if (allDelivered) {
            this.status = SALES_ORDER_STATUS.DELIVERED;
        } else if (anyDelivered) {
            this.status = SALES_ORDER_STATUS.PARTIALLY_DELIVERED;
        }
    }

    // if order is already marked Delivered but lines still have pending qty,
    // treat as complete and generate stock deltas accordingly
    if (this.status === SALES_ORDER_STATUS.DELIVERED) {
        for (const item of this.items) {
            const prevDelivered = item.deliveredQty || 0;
            const pending = (item.qty || 0) - prevDelivered;
            if (pending > 0) {
                // mark fully delivered
                item.deliveredQty = item.qty;
                item.pendingQty = 0;
                item.fullyDelivered = true;
                // record delta (will be included later by _stockDeltas logic)
                this._stockDeltas = this._stockDeltas || [];
                this._stockDeltas.push({ itemId: item.itemId, qty: -pending });
            }
        }
    }

    // compute stock quantity changes for delivered items
    // this._stockDeltas will be available in post-save hook
    this._stockDeltas = [];
    const SalesOrderModel = mongoose.model('SalesOrder');
    if (this.isNew) {
        // new document – deduct entire ordered quantity immediately
        for (const it of this.items) {
            const d = it.qty || 0;
            if (d > 0) {
                this._stockDeltas.push({ itemId: it.itemId, qty: -d });
            }
        }
    } else {
        // existing order – adjust stock based on quantity changes only
        const orig = await SalesOrderModel.findById(this._id).lean();
        if (orig) {
            for (const it of this.items) {
                const prev = orig.items.find(i => i._id && it._id && i._id.toString() === it._id.toString());
                const prevQty = prev ? (prev.qty || 0) : 0;
                const deltaQty = (it.qty || 0) - prevQty;
                if (deltaQty !== 0) {
                    this._stockDeltas.push({ itemId: it.itemId, qty: -deltaQty });
                }
            }
        }
    }

    // perform availability check before allowing the save if there will be
    // any negative delta (i.e. stock deduction).
    if (this._stockDeltas.length) {
        const Stock = mongoose.model('Stock');
        for (const d of this._stockDeltas) {
            if (!d.itemId) continue;
            if (d.qty < 0) {
                const needed = -d.qty;
                const agg = await Stock.aggregateByItem({ itemId: d.itemId });
                const avail = agg.length ? (agg[0].availableQty || 0) : 0;
                if (avail < needed) {
                    const err = new Error('Insufficient stock for delivery');
                    err.status = 400;
                    // abort save
                    return next(err);
                }
            }
        }
    }

    next();
});

// Instance: reconcile stock for any pending qty when order is marked Delivered
salesOrderSchema.methods.reconcileDeliveredStock = async function () {
    if (this.status !== SALES_ORDER_STATUS.DELIVERED) return;
    let changed = false;
    const Stock = mongoose.model('Stock');
    for (const it of this.items || []) {
        const pending = (it.qty || 0) - (it.deliveredQty || 0);
        if (pending > 0 && it.itemId) {
            try {
                await Stock.updateQuantity(it.itemId, -pending);
                await Stock.releaseReservedStock(it.itemId, pending);
            } catch (e) {
                // ignore failures
            }
            it.deliveredQty = it.qty;
            it.pendingQty = 0;
            it.fullyDelivered = true;
            changed = true;
        }
    }
    if (changed) {
        await this.save();
    }
};

// Instance: Confirm order
salesOrderSchema.methods.confirm = async function (userId) {
    if (this.status !== SALES_ORDER_STATUS.DRAFT) {
        throw new Error('Only draft orders can be confirmed');
    }
    this.status = SALES_ORDER_STATUS.CONFIRMED;
    this.confirmedBy = userId;
    this.confirmedAt = new Date();

    // reservation no longer needed; stock was deducted on creation
    // (kept here for backward-compatibility if other code still relies on it)
    // try {
    //     const Stock = mongoose.model('Stock');
    //     for (const it of this.items || []) {
    //         const qty = it.qty || 0;
    //         if (qty > 0 && it.itemId) {
    //             try {
    //                 await Stock.reserveStock(it.itemId, qty);
    //             } catch (e) {
    //                 console.error('Failed to reserve stock for sales order', e.message || e);
    //             }
    //         }
    //     }
    // } catch (e) {
    //     console.error('Error reserving stock during order confirmation', e);
    // }

    await this.save();

    // Update customer stats
    const Customer = mongoose.model('Customer');
    await Customer.findByIdAndUpdate(this.customerId, {
        $inc: { totalOrders: 1, totalPurchaseValue: this.grandTotal },
        lastOrderDate: new Date(),
    });

    return this;
};

// Instance: Cancel order
salesOrderSchema.methods.cancel = async function (userId, reason) {
    if (this.status === SALES_ORDER_STATUS.DELIVERED ||
        this.status === SALES_ORDER_STATUS.INVOICED) {
        throw new Error('Delivered/Invoiced orders cannot be cancelled');
    }
    // return pending quantity to stock (cancelled orders free up inventory)
    try {
        const Stock = mongoose.model('Stock');
        for (const it of this.items || []) {
            const pending = (it.qty || 0) - (it.deliveredQty || 0);
            if (pending > 0 && it.itemId) {
                try {
                    await Stock.updateQuantity(it.itemId, pending);
                } catch (e) {
                    console.error('Error returning stock during cancellation', e.message || e);
                }
            }
        }
    } catch (e) {
        console.error('Error handling stock during cancellation', e);
    }

    this.status = SALES_ORDER_STATUS.CANCELLED;
    this.cancelledBy = userId;
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    await this.save();
    return this;
};

// Static: Get orders ready for dispatch
salesOrderSchema.statics.getReadyForDispatch = function () {
    return this.find({
        status: SALES_ORDER_STATUS.READY_FOR_DISPATCH,
    })
        .populate('customerId', 'name contact deliveryAddresses')
        .sort({ expectedDeliveryDate: 1, priority: -1 });
};

// Post-save hook: auto-create sales invoice when order is Delivered
salesOrderSchema.post('save', async function (doc) {
    try {
        if (doc.status !== SALES_ORDER_STATUS.DELIVERED) return;

        // only attempt invoice logic if the model has been registered
        let SalesInvoiceModel;
        try { SalesInvoiceModel = mongoose.model('SalesInvoice'); } catch (_) { SalesInvoiceModel = null; }
        if (!SalesInvoiceModel) return;

        const existing = await SalesInvoiceModel.findOne({ salesOrderId: doc._id });
        if (existing) return; // already invoiced

        // Populate customer on order (if not populated)
        const SalesOrderModel = mongoose.model('SalesOrder');
        const populated = await SalesOrderModel.findById(doc._id).populate('customerId');
        if (!populated) return;

        const customer = populated.customerId || {};
        const invoiceDate = new Date();
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const items = (populated.items || []).map(i => ({
            soItemId: i._id,
            itemId: i.itemId,
            itemName: i.itemName || i.description || '',
            sku: i.sku,
            hsnCode: i.hsnCode || '',
            qty: i.qty,
            unit: i.unit,
            unitPrice: i.unitPrice,
            discountPercent: i.discountPercent || 0,
            discountAmount: i.discountAmount || 0,
            taxableAmount: (i.qty * i.unitPrice) - (i.discountAmount || 0),
            cgstRate: 0, sgstRate: 0, igstRate: 0,
            cgstAmount: 0, sgstAmount: 0, igstAmount: 0,
            totalTaxAmount: i.taxAmount || 0,
            totalAmount: i.totalPrice || ((i.qty * i.unitPrice) - (i.discountAmount || 0) + (i.taxAmount || 0)),
        }));

        const invoiceData = {
            salesOrderId: populated._id,
            soNumber: populated.soNumber,
            customerId: populated.customerId ? populated.customerId._id : populated.customerId,
            customerDetails: { name: populated.customerName || (customer && customer.name) || '' },
            items,
            subtotal: populated.subtotal || 0,
            totalDiscountAmount: populated.totalDiscountAmount || 0,
            taxableAmount: (populated.subtotal || 0) - (populated.totalDiscountAmount || 0),
            totalTaxAmount: populated.totalTaxAmount || 0,
            transportCost: populated.transportCost || 0,
            grandTotal: populated.grandTotal || 0,
            amountPaid: 0,
            balanceDue: populated.grandTotal || 0,
            currency: populated.currency || 'INR',
            createdBy: populated.createdBy || null,
            invoiceDate,
            dueDate,
        };

        const newInv = new SalesInvoiceModel(invoiceData);
        await newInv.save({ validateBeforeSave: false });

        // Try to auto-issue the invoice so it appears in 'Issued' filters immediately
        try {
            if (typeof newInv.issue === 'function') {
                await newInv.issue(populated.createdBy || null);
            } else {
                newInv.status = 'Issued';
                newInv.issuedBy = populated.createdBy || null;
                newInv.issuedAt = new Date();
                await newInv.save({ validateBeforeSave: false });
            }
        } catch (e) {
            // if issuing fails, ignore and keep invoice as Draft
            console.error('Auto-issuing invoice failed:', e.message || e);
        }

        // Link invoice to sales order (non-blocking) and mark order Invoiced
        try {
            await SalesOrderModel.updateOne({ _id: populated._id }, { $addToSet: { invoiceIds: newInv._id }, $set: { status: SALES_ORDER_STATUS.INVOICED } });
        } catch (e) {
            // ignore linking failures
        }

        console.log(`Auto-created and issued sales invoice ${newInv.invoiceNumber} for SO ${populated.soNumber}`);
    } catch (error) {
        console.error('Failed to auto-create sales invoice after SO save:', error);
        // don't throw — keep save operation successful
    }
});

// Post-save hook: sync transport OperationalExpense for every saved SalesOrder
salesOrderSchema.post('save', async function (doc) {
    try {
        let OperationalExpense;
        try { OperationalExpense = mongoose.model('OperationalExpense'); } catch (_) { OperationalExpense = null; }
        if (!OperationalExpense) return;

        // ----- TRANSPORT EXPENSE (category: Travel) -----
        const hasTransport = !!(doc.includeTransport && (doc.transportCost || 0) > 0);
        const existingTransport = await OperationalExpense.findOne({ 'metadata.salesOrderId': doc._id, category: 'Travel', isDeleted: { $ne: true } });

        if (hasTransport) {
            const transportPayload = {
                title: `Transport for ${doc.soNumber || doc._id}`,
                description: `Vehicle: ${doc.transportDetails?.vehicleNumber || 'N/A'}; Type: ${doc.transportDetails?.vehicleType || 'N/A'}; Driver: ${doc.transportDetails?.driverName || 'N/A'}; Phone: ${doc.transportDetails?.driverPhone || 'N/A'}`,
                category: 'Travel',
                amount: doc.transportCost || 0,
                expenseDate: doc.orderDate || new Date(),
                department: 'Transport',
                submittedBy: doc.createdBy || undefined,
                payeeName: doc.transportDetails?.driverName || '',
                payeeContact: doc.transportDetails?.driverPhone || '',
                vehicleNumber: doc.transportDetails?.vehicleNumber || undefined,
                vehicleType: doc.transportDetails?.vehicleType || undefined,
                driverName: doc.transportDetails?.driverName || undefined,
                driverPhone: doc.transportDetails?.driverPhone || undefined,
                salesOrderId: doc._id,
                metadata: { salesOrderId: doc._id, soNumber: doc.soNumber },
            };

            if (existingTransport) {
                Object.assign(existingTransport, transportPayload);
                await existingTransport.save();
            } else {
                const exp = new OperationalExpense(transportPayload);
                await exp.save();
            }
        } else if (existingTransport) {
            await existingTransport.softDelete(doc.createdBy || null);
        }

        // ----- LABOUR EXPENSE (category: Salaries) -----
        // detect labour-type items in the order and create/update expense for them
        const labourItemIds = (doc.items || []).map(i => (i.itemId && i.itemId._id) ? i.itemId._id.toString() : (i.itemId ? i.itemId.toString() : null)).filter(Boolean);
        if (labourItemIds.length > 0) {
            const Item = mongoose.model('Item');
            const labourItems = await Item.find({ _id: { $in: labourItemIds }, costType: 'Labour' }).select('_id').lean();
            const labourSet = new Set((labourItems || []).map(li => li._id.toString()));

            let labourTotal = 0;
            for (const li of (doc.items || [])) {
                const iid = (li.itemId && li.itemId._id) ? li.itemId._id.toString() : (li.itemId ? li.itemId.toString() : null);
                if (!iid || !labourSet.has(iid)) continue;
                labourTotal += (li.totalPrice != null && li.totalPrice > 0) ? li.totalPrice : ((li.qty || 0) * (li.unitPrice || 0));
            }

            const existingLabour = await OperationalExpense.findOne({ 'metadata.salesOrderId': doc._id, category: 'Salaries', isDeleted: { $ne: true } });

            if (labourTotal > 0) {
                const labourPayload = {
                    title: `Labour for ${doc.soNumber || doc._id}`,
                    description: `Auto-created labour expense for SO ${doc.soNumber || doc._id}`,
                    category: 'Salaries',
                    amount: labourTotal,
                    expenseDate: doc.orderDate || new Date(),
                    department: 'Production',
                    submittedBy: doc.createdBy || undefined,
                    salesOrderId: doc._id,
                    metadata: { salesOrderId: doc._id, soNumber: doc.soNumber },
                };

                if (existingLabour) {
                    Object.assign(existingLabour, labourPayload);
                    await existingLabour.save();
                } else {
                    const exp = new OperationalExpense(labourPayload);
                    await exp.save();
                }
            } else if (existingLabour) {
                // remove if previously present but no longer applicable
                await existingLabour.softDelete(doc.createdBy || null);
            }
        }

    } catch (err) {
        console.error('Failed to sync transport/labour expense after SO save:', err);
    }
});

// Post-save hook: apply stock changes computed in pre-save
salesOrderSchema.post('save', async function (doc) {
    if (!doc._stockDeltas || !doc._stockDeltas.length) return;
    try {
        const Stock = mongoose.model('Stock');
        for (const d of doc._stockDeltas) {
            if (!d.itemId) continue;
            const qtyChange = d.qty;
            try {
                await Stock.updateQuantity(d.itemId, qtyChange);
            } catch (e) {
                console.error('Stock update error for sales order delivery:', e);
            }
        }
    } catch (e) {
        console.error('error applying stock deltas after SO save', e);
    }
});

const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);

export default SalesOrder;
