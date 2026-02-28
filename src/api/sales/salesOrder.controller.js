import mongoose from 'mongoose';
import SalesOrder, { TRANSPORT_VEHICLE, TRANSPORT_FLAT_RATE_CARD } from './salesOrder.model.js';
import Customer from './customer.model.js';
import Item from '../catalog/item.model.js';
// import TransportRateCard from '../logistics/transportRateCard.model.js'; // Not available
// import OperationalExpense, { EXPENSE_CATEGORIES } from '../finance/operationalExpense.model.js'; // Not available

/**
 * @swagger
 * components:
 *   schemas:
 *     SalesOrderLineItem:
 *       type: object
 *       required:
 *         - itemId
 *         - quantity
 *         - unit
 *         - unitPrice
 *       properties:
 *         itemId:
 *           type: string
 *         itemName:
 *           type: string
 *         quantity:
 *           type: number
 *         unit:
 *           type: string
 *         unitPrice:
 *           type: number
 *         discountPercent:
 *           type: number
 *         taxPercent:
 *           type: number
 *         subtotal:
 *           type: number
 *         taxAmount:
 *           type: number
 *         total:
 *           type: number
 *
 *     SalesOrder:
 *       type: object
 *       required:
 *         - customerId
 *         - lineItems
 *       properties:
 *         _id:
 *           type: string
 *         orderNumber:
 *           type: string
 *         customerId:
 *           type: string
 *         customerName:
 *           type: string
 *         orderDate:
 *           type: string
 *           format: date-time
 *         expectedDeliveryDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [Draft, Confirmed, Processing, Ready, Ready_For_Dispatch, Dispatched, Partially_Delivered, Delivered, Invoiced, Cancelled]
 *         lineItems:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SalesOrderLineItem'
 *         includeTransport:
 *           type: boolean
 *         transportDetails:
 *           type: object
 *         subtotal:
 *           type: number
 *         totalDiscount:
 *           type: number
 *         totalTax:
 *           type: number
 *         transportCharges:
 *           type: number
 *         grandTotal:
 *           type: number
 *         amountPaid:
 *           type: number
 *         balanceDue:
 *           type: number
 */

/**
 * SalesOrder Controller - Handles sales order operations
 */
const salesOrderController = {
    /**
     * @swagger
     * /sales/orders:
     *   get:
     *     summary: List all sales orders with pagination
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *       - in: query
     *         name: customerId
     *         schema:
     *           type: string
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [Draft, Confirmed, Processing, Ready, Ready_For_Dispatch, Dispatched, Partially_Delivered, Delivered, Invoiced, Cancelled]
     *       - in: query
     *         name: fromDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: toDate
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Paginated list of sales orders
     */
    async list(req, res, next) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                customerId,
                status,
                fromDate,
                toDate,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            const query = {}; // plugin will exclude soft-deleted records

            if (search) {
                query.$or = [
                    { orderNumber: { $regex: search, $options: 'i' } },
                    { customerName: { $regex: search, $options: 'i' } },
                ];
            }

            if (customerId) {
                query.customerId = customerId;
            }

            if (status) {
                query.status = status;
            }

            if (req.query.transportItemId) {
                query['transportDetails.transportItemId'] = req.query.transportItemId;
            }
            if (req.query.transportPaidStatus) {
                query['transportDetails.paidStatus'] = req.query.transportPaidStatus;
            }
            if (req.query.driverName) {
                query['transportDetails.driverName'] = { $regex: req.query.driverName, $options: 'i' };
            }

            if (fromDate || toDate) {
                query.orderDate = {};
                if (fromDate) query.orderDate.$gte = new Date(fromDate);
                if (toDate) query.orderDate.$lte = new Date(toDate);
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
                populate: [
                    { path: 'customerId', select: 'name phone currentBalance' },
                ],
            };

            const result = await SalesOrder.paginate(query, options);

            // strip status field from returned documents
            const docs = (result.docs || []).map(o => {
                const obj = o.toObject ? o.toObject() : { ...o };
                delete obj.status;
                return obj;
            });
            result.docs = docs;

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/{id}:
     *   get:
     *     summary: Get sales order by ID
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Sales order details
     *       404:
     *         description: Order not found
     */

    async getTotalsByCustomer(req, res, next) {
        try {
            const { customerId } = req.params;

            if (!customerId) {
                return res.status(400).json({ success: false, message: 'customerId required' });
            }

            if (!mongoose.isValidObjectId(customerId)) {
                // invalid id format
                return res.status(400).json({ success: false, message: 'Invalid customerId' });
            }

            const objId = new mongoose.Types.ObjectId(customerId);
            let data;
            try {
                const agg = await SalesOrder.aggregate([
                    { $match: { customerId: objId, isDeleted: { $ne: true } } },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: '$grandTotal' },
                            totalPending: { $sum: '$balanceDue' }
                        }
                    }
                ]);
                data = agg[0] || { totalAmount: 0, totalPending: 0 };
            } catch (aggErr) {
                // aggregation failed; log and fallback to manual summation
                // eslint-disable-next-line no-console
                console.error('aggregation failed in getTotalsByCustomer', aggErr);
                const orders = await SalesOrder.find({ customerId: objId, isDeleted: { $ne: true } })
                    .select('grandTotal balanceDue')
                    .lean();
                data = orders.reduce((acc, o) => {
                    acc.totalAmount += o.grandTotal || 0;
                    acc.totalPending += o.balanceDue || 0;
                    return acc;
                }, { totalAmount: 0, totalPending: 0 });
            }
            res.json({ success: true, data });
        } catch (error) {
            // log for debugging
            // eslint-disable-next-line no-console
            console.error('getTotalsByCustomer failed', error);
            next(error);
        }
    },

    async getById(req, res, next) {
        try {
            const { id } = req.params;

            let order = await SalesOrder.findOne({ _id: id })
                .populate('customerId', 'name phone email gstin billingAddress deliveryAddresses')
                .populate('lineItems.itemId', 'name sku');

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Sales order not found',
                });
            }

            // ensure stock is reconciled if somehow items still pending
            await order.reconcileDeliveredStock();

            const obj = order.toObject ? order.toObject() : { ...order };
            delete obj.status;

            res.json({
                success: true,
                data: obj,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders:
     *   post:
     *     summary: Create a new sales order
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SalesOrder'
     *     responses:
     *       201:
     *         description: Sales order created successfully
     *       400:
     *         description: Validation error
     */
    async create(req, res, next) {
        try {
            const orderData = req.body;
            // status & order number are managed internally; ignore anything passed from client
            if ('status' in orderData) delete orderData.status;
            if ('soNumber' in orderData) delete orderData.soNumber;

            // Fetch customer details
            const customer = await Customer.findOne({
                _id: orderData.customerId,
                deleted: { $ne: true }
            });

            if (!customer) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            // Cache customer name
            orderData.customerName = customer.name;

            // Map delivery address fields
            if (orderData.deliveryAddress) {
                orderData.deliveryAddress = {
                    street: orderData.deliveryAddress.line1 || '',
                    city: orderData.deliveryAddress.city || '',
                    state: orderData.deliveryAddress.state || '',
                    pincode: orderData.deliveryAddress.pincode || '',
                    contactPerson: orderData.deliveryAddress.contactPerson || '',
                    contactPhone: orderData.deliveryAddress.contactPhone || '',
                };
            }

            // Enrich line items with item names
            const itemIds = orderData.lineItems.map(li => li.itemId);
            const items = await Item.find({ _id: { $in: itemIds } }).select('name sku defaultUnitPrice hsnCode taxRate');
            const itemMap = new Map(items.map(item => [item._id.toString(), item]));

            orderData.items = orderData.lineItems.map(li => {
                const item = itemMap.get(li.itemId);
                return {
                    ...li,
                    itemName: item?.name || li.itemName,
                    hsnCode: li.hsnCode || item?.hsnCode,
                    taxRate: 0, // ignore taxes now that front-end no longer collects them
                    qty: li.quantity,
                    unit: li.unit,
                    unitPrice: li.unitPrice,
                    discountPercent: 0, // ignore discounts
                };
            });

            // Add default internal transport add-on if not provided
            if (!orderData.includeTransport) {
                orderData.includeTransport = true;
                orderData.transportDetails = orderData.transportDetails || {};
                // No vehicleType for internal, just set cost to 0
                orderData.transportDetails.transportCost = 0;
                orderData.transportDetails.calculatedCost = 0;
            }

            // Calculate transport if needed (server-authoritative)
            if (orderData.includeTransport && orderData.transportDetails) {
                // 1) If a rate-card is provided, use it
                if (orderData.transportDetails?.rateCardId) {
                    const rateCard = await TransportRateCard.findById(orderData.transportDetails.rateCardId);
                    if (rateCard) {
                        const params = {
                            zone: orderData.transportDetails.zone,
                            distance: orderData.transportDetails.distance || orderData.transportDetails.distanceKm,
                        };
                        orderData.transportDetails.calculatedCost = rateCard.calculateCost(params);
                    }
                }

                // 2) Else if vehicleType provided, use internal flat-rate per-trip mapping
                else if (orderData.transportDetails.vehicleType) {
                    const vehicle = orderData.transportDetails.vehicleType;
                    orderData.transportDetails.calculatedCost = TRANSPORT_FLAT_RATE_CARD[vehicle] || 0;
                }

                // 3) If client provided a manualCost/transportCost prefer manual override
                if (orderData.transportDetails.manualCost != null) {
                    orderData.transportDetails.calculatedCost = orderData.transportDetails.manualCost;
                }

                // Ensure top-level transportCost is present for downstream logic
                orderData.transportCost = orderData.transportDetails.transportCost || orderData.transportDetails.calculatedCost || 0;
            }

            // ensure backend assigns a unique order number (override any client value)
            const order = new SalesOrder(orderData);

            // generate once before saving to reduce chances of duplicate key error
            order.soNumber = await SalesOrder.generateNextSoNumber();

            // try saving; if a duplicate key error occurs (race condition) regenerate and retry
            let attempts = 0;
            while (true) {
                try {
                    await order.save();
                    break;
                } catch (err) {
                    // only handle duplicate key on soNumber
                    if (err.code === 11000 && err.keyPattern && err.keyPattern.soNumber && attempts < 5) {
                        attempts++;
                        order.soNumber = await SalesOrder.generateNextSoNumber();
                        continue;
                    }
                    throw err;
                }
            }

            // Auto-create an OperationalExpense for transport when transport is present - DISABLED
            // try {
            //     if (order.includeTransport && (order.transportCost || 0) > 0) {
            //         const existingExpense = await OperationalExpense.findOne({ 'metadata.salesOrderId': order._id, deleted: { $ne: true } });
            //         // ...
            //     }
            // } catch (err) {
            //     console.error('Failed to create/update transport expense for SO:', order._id, err.message || err);
            // }

            res.status(201).json({
                success: true,
                message: 'Sales order created successfully',
                data: order,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/{id}:
     *   put:
     *     summary: Update a sales order (only Draft status)
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SalesOrder'
     *     responses:
     *       200:
     *         description: Sales order updated successfully
     *       400:
     *         description: Cannot update non-draft order
     *       404:
     *         description: Order not found
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            // clients must not be able to change the SO number after creation
            if ('soNumber' in updateData) delete updateData.soNumber;

            const order = await SalesOrder.findOne({ _id: id, deleted: { $ne: true } });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Sales order not found',
                });
            }

            // Only allow updates for Draft orders
            if (order.status !== 'Draft') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot update order in ${order.status} status. Only Draft orders can be modified.`,
                });
            }

            // prevent clients from changing status through this endpoint; use
            // the dedicated status route which has proper stock/transition checks
            if (updateData.status && updateData.status !== order.status) {
                return res.status(400).json({
                    success: false,
                    message: 'Status changes are not allowed here; use /sales/orders/:id/status',
                });
            }

            // Map delivery address fields if provided
            if (updateData.deliveryAddress) {
                updateData.deliveryAddress = {
                    street: updateData.deliveryAddress.line1 || updateData.deliveryAddress.street || '',
                    city: updateData.deliveryAddress.city || '',
                    state: updateData.deliveryAddress.state || '',
                    pincode: updateData.deliveryAddress.pincode || '',
                    contactPerson: updateData.deliveryAddress.contactPerson || '',
                    contactPhone: updateData.deliveryAddress.contactPhone || '',
                };
            }

            // Enrich line items if provided
            if (updateData.lineItems) {
                const itemIds = updateData.lineItems.map(li => li.itemId);
                const items = await Item.find({ _id: { $in: itemIds } }).select('name sku defaultUnitPrice hsnCode taxRate');
                const itemMap = new Map(items.map(item => [item._id.toString(), item]));

                updateData.items = updateData.lineItems.map(li => {
                    const item = itemMap.get(li.itemId);
                    return {
                        ...li,
                        itemName: item?.name || li.itemName,
                        hsnCode: li.hsnCode || item?.hsnCode,
                        taxRate: 0, // ignore taxes from client
                        qty: li.quantity,
                        unit: li.unit,
                        unitPrice: li.unitPrice,
                        discountPercent: 0, // ignore discounts
                    };
                });
            }

            Object.assign(order, updateData);
            await order.save();

            // Sync transport expense disabled - OperationalExpense model not available
            // try {
            //     const existingExpense = await OperationalExpense.findOne({ 'metadata.salesOrderId': order._id, deleted: { $ne: true } });
            //     // ...
            // } catch (err) {
            //     console.error('Failed to sync transport expense for SO update:', order._id, err.message || err);
            // }

            res.json({
                success: true,
                message: 'Sales order updated successfully',
                data: order,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/{id}/status:
     *   patch:
     *     summary: Update sales order status
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - status
     *             properties:
     *               status:
     *                 type: string
     *                 enum: [Draft, Confirmed, Processing, Ready, Ready_For_Dispatch, Dispatched, Partially_Delivered, Delivered, Invoiced, Cancelled]
     *               reason:
     *                 type: string
     *     responses:
     *       200:
     *         description: Status updated successfully
     */
    async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, reason } = req.body;

            const order = await SalesOrder.findOne({ _id: id, deleted: { $ne: true } });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Sales order not found',
                });
            }

            // Validate status transitions
            const validTransitions = {
                'Draft': ['Confirmed', 'Cancelled'],
                'Confirmed': ['Processing', 'Cancelled'],
                'Processing': ['Ready', 'Ready_For_Dispatch', 'Cancelled'],
                'Ready': ['Dispatched', 'Cancelled'],
                'Ready_For_Dispatch': ['Dispatched', 'Cancelled'],
                'Dispatched': ['Delivered', 'Partially_Delivered', 'Cancelled'],
                'Partially_Delivered': ['Delivered', 'Cancelled'],
                'Delivered': ['Invoiced'],
                'Invoiced': [],
                'Cancelled': [],
            };

            if (!validTransitions[order.status]?.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot transition from ${order.status} to ${status}`,
                });
            }

            // handle some transitions via model helpers so logic stays in schema
            if (status === SALES_ORDER_STATUS.CONFIRMED) {
                // confirm() will set status, save, update customer stats and reserve stock
                await order.confirm(req.user?._id);
            } else if (status === SALES_ORDER_STATUS.CANCELLED) {
                // cancel() handles reservation release
                await order.cancel(req.user?._id, reason || '');
            } else if (status === SALES_ORDER_STATUS.DELIVERED) {
                // stock already adjusted at creation; just update status history
                order.status = status;
                if (!order.statusHistory) order.statusHistory = [];
                order.statusHistory.push({ status, timestamp: new Date(), userId: req.user?._id, reason });
                order.actualDeliveryDate = new Date();
                await order.save();
            } else {
                // generic status update path
                order.status = status;

                // Track status history
                if (!order.statusHistory) {
                    order.statusHistory = [];
                }
                order.statusHistory.push({
                    status,
                    timestamp: new Date(),
                    userId: req.user?._id,
                    reason,
                });

                // Update delivery date if delivered
                if (status === SALES_ORDER_STATUS.DELIVERED) {
                    order.actualDeliveryDate = new Date();
                }

                await order.save();
            }

            res.json({
                success: true,
                message: `Order status updated to ${status}`,
                data: order,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/{id}/payment:
     *   post:
     *     summary: Record advance payment for order
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - amount
     *               - paymentMode
     *             properties:
     *               amount:
     *                 type: number
     *               paymentMode:
     *                 type: string
     *                 enum: [Cash, UPI, Bank_Transfer, Cheque]
     *               reference:
     *                 type: string
     *     responses:
     *       200:
     *         description: Payment recorded
     */
    async recordPayment(req, res, next) {
        try {
            const { id } = req.params;
            const { amount, paymentMode, reference, notes } = req.body;

            const order = await SalesOrder.findOne({ _id: id, deleted: { $ne: true } });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Sales order not found',
                });
            }

            // Add to payments
            if (!order.payments) {
                order.payments = [];
            }

            order.payments.push({
                amount,
                paymentMode,
                reference,
                date: new Date(),
                notes,
            });

            // Update amount paid
            order.amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);

            await order.save();

            res.json({
                success: true,
                message: `Payment of ₹${amount} recorded`,
                data: {
                    orderId: order._id,
                    amountPaid: order.amountPaid,
                    balanceDue: order.balanceDue,
                },
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/{id}/invoice:
     *   post:
     *     summary: Create invoice from sales order
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       201:
     *         description: Invoice created successfully
     */
    async createInvoiceFromOrder(req, res, next) {
        try {
            const { id } = req.params;

            const order = await SalesOrder.findOne({ _id: id, deleted: { $ne: true } });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Sales order not found',
                });
            }

            if (order.status !== 'Delivered' && order.status !== 'Invoiced') {
                return res.status(400).json({
                    success: false,
                    message: 'Order must be delivered before creating invoice',
                });
            }

            // Check if invoice already exists
            if (order.invoiceIds && order.invoiceIds.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invoice already exists for this order',
                });
            }

            // Import SalesInvoice model
            const SalesInvoice = (await import('../invoice/salesInvoice.model.js')).default;

            // Create invoice data
            const invoiceData = {
                customerId: order.customerId,
                orderId: order._id,
                items: order.items.map(item => ({
                    itemId: item.itemId,
                    itemName: item.itemName,
                    sku: item.sku,
                    description: item.description,
                    qty: item.qty,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    discountPercent: item.discountPercent,
                    taxRate: item.taxRate,
                    hsnCode: item.hsnCode,
                })),
                subtotal: order.subtotal,
                totalDiscountAmount: order.totalDiscountAmount,
                totalTaxAmount: order.totalTaxAmount,
                transportCost: order.transportCost,
                additionalCharges: order.additionalCharges,
                grandTotal: order.grandTotal,
                notes: order.notes,
                internalNotes: order.internalNotes,
                paymentTerms: {
                    creditDays: 30, // Default
                    advanceRequired: 0,
                },
            };

            const invoice = new SalesInvoice(invoiceData);
            await invoice.save();

            // Update order
            order.invoiceIds = [invoice._id];
            order.status = 'Invoiced';
            await order.save();

            res.status(201).json({
                success: true,
                message: 'Invoice created successfully',
                data: invoice,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/{id}:
     *   delete:
     *     summary: Cancel/delete a sales order
     *     requestBody:
     *       description: Optionally provide a reason for cancellation (ignored when deleting draft)
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               reason:
     *                 type: string
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Order cancelled successfully
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            const order = await SalesOrder.findOne({ _id: id, deleted: { $ne: true } });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Sales order not found',
                });
            }

            // Always perform a soft delete; the softDelete plugin will set isDeleted flag
            // (original behavior attempted hard delete only for drafts, but status field
            // has been removed so we simply soft-delete everything).
            if (typeof order.softDelete === 'function') {
                await order.softDelete(req.user?._id || null);
                return res.json({
                    success: true,
                    message: 'Sales order deleted',
                    data: { _id: id, deleted: true },
                });
            }
            // fallback to hard delete if softDelete not available
            await SalesOrder.deleteOne({ _id: id });
            return res.json({ success: true, message: 'Sales order deleted', data: { _id: id, deleted: true } });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/by-customer/{customerId}:
     *   get:
     *     summary: Get all orders for a customer
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: customerId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: List of customer orders
     */
    async getByCustomer(req, res, next) {
        try {
            const { customerId } = req.params;
            const { status, limit = 20 } = req.query;

            const query = {
                customerId,
                deleted: { $ne: true }
            };

            if (status) {
                query.status = status;
            }

            const orders = await SalesOrder.find(query)
                .select('orderNumber orderDate status grandTotal amountPaid balanceDue')
                .sort({ orderDate: -1 })
                .limit(parseInt(limit));

            res.json({
                success: true,
                data: orders,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/orders/pending-delivery:
     *   get:
     *     summary: Get orders pending delivery
     *     tags: [Sales Orders]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of pending delivery orders
     */
    async getPendingDelivery(req, res, next) {
        try {
            const orders = await SalesOrder.find({
                status: { $in: ['Confirmed', 'Processing', 'Ready', 'Ready_For_Dispatch', 'Dispatched', 'Partially_Delivered'] },
            })
                .populate('customerId', 'name phone')
                .select('orderNumber customerName status expectedDeliveryDate grandTotal')
                .sort({ expectedDeliveryDate: 1 });

            res.json({
                success: true,
                data: orders,
            });
        } catch (error) {
            next(error);
        }
    },
};

export default salesOrderController;
