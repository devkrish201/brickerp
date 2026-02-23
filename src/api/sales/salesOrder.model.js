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
    DRAFT: 'Draft',
    CONFIRMED: 'Confirmed',
    PROCESSING: 'Processing',
    READY_FOR_DISPATCH: 'Ready_For_Dispatch',
    PARTIALLY_DELIVERED: 'Partially_Delivered',
    DELIVERED: 'Delivered',
    INVOICED: 'Invoiced',
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
        default: SALES_ORDER_STATUS.DRAFT,
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
        distanceKm: Number,
        vehicleType: {
            type: String,
            // enum: Object.values(TRANSPORT_VEHICLE),
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
        // Linked trip
        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TransportTrip',
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

// Plugins
salesOrderSchema.plugin(mongoosePaginate);
salesOrderSchema.plugin(auditPlugin);
salesOrderSchema.plugin(softDeletePlugin);

// Pre-save: Generate SO number and calculate totals
salesOrderSchema.pre('save', async function (next) {
    // Generate SO number
    if (this.isNew && !this.soNumber) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const lastSO = await mongoose.model('SalesOrder')
            .findOne({ soNumber: new RegExp(`^SO-${year}${month}`) })
            .sort({ soNumber: -1 })
            .select('soNumber');

        let nextNumber = 1;
        if (lastSO) {
            const match = lastSO.soNumber.match(/SO-\d{6}-(\d+)/);
            if (match) nextNumber = parseInt(match[1]) + 1;
        }
        let candidateNumber = `SO-${year}${month}-${String(nextNumber).padStart(4, '0')}`;

        // Check if the candidate number already exists, and increment if necessary
        while (await mongoose.model('SalesOrder').findOne({ soNumber: candidateNumber })) {
            nextNumber++;
            candidateNumber = `SO-${year}${month}-${String(nextNumber).padStart(4, '0')}`;
        }

        this.soNumber = candidateNumber;
    }

    // Calculate item totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

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
        this.status === SALES_ORDER_STATUS.PROCESSING ||
        this.status === SALES_ORDER_STATUS.PARTIALLY_DELIVERED) {
        const allDelivered = this.items.every(item => item.fullyDelivered);
        const anyDelivered = this.items.some(item => (item.deliveredQty || 0) > 0);

        if (allDelivered) {
            this.status = SALES_ORDER_STATUS.DELIVERED;
        } else if (anyDelivered) {
            this.status = SALES_ORDER_STATUS.PARTIALLY_DELIVERED;
        }
    }

    next();
});

// Instance: Confirm order
salesOrderSchema.methods.confirm = async function (userId) {
    if (this.status !== SALES_ORDER_STATUS.DRAFT) {
        throw new Error('Only draft orders can be confirmed');
    }
    this.status = SALES_ORDER_STATUS.CONFIRMED;
    this.confirmedBy = userId;
    this.confirmedAt = new Date();
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

        const SalesInvoiceModel = mongoose.model('SalesInvoice');
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
        const OperationalExpense = mongoose.model('OperationalExpense');

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

const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema);

export default SalesOrder;
