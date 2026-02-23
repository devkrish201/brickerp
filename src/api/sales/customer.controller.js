import Customer from './customer.model.js';
// import CustomerLedger from '../finance/customerLedger.model.js'; // Not available

/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerAddress:
 *       type: object
 *       properties:
 *         label:
 *           type: string
 *         line1:
 *           type: string
 *         line2:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *         pincode:
 *           type: string
 *         landmark:
 *           type: string
 *         distance:
 *           type: number
 *           description: Distance in km for transport calculation
 *         zone:
 *           type: string
 *           description: Zone for zone-based transport rates
 *         isDefault:
 *           type: boolean
 *
 *     Customer:
 *       type: object
 *       required:
 *         - name
 *         - phone
 *         - billingAddress
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           maxLength: 200
 *         customerCode:
 *           type: string
 *         customerType:
 *           type: string
 *           enum: [Individual, Business, Contractor, Government, Dealer, Retailer]
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *         gstin:
 *           type: string
 *         panNumber:
 *           type: string
 *         billingAddress:
 *           $ref: '#/components/schemas/CustomerAddress'
 *         deliveryAddresses:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CustomerAddress'
 *         creditLimit:
 *           type: number
 *           description: Maximum credit allowed (Udhaari limit)
 *         currentBalance:
 *           type: number
 *           description: Current outstanding balance (Udhaari)
 *         paymentTerms:
 *           type: object
 *           properties:
 *             creditDays:
 *               type: number
 *             discountPercent:
 *               type: number
 *             discountDays:
 *               type: number
 *         priceCategory:
 *           type: string
 *           enum: [Standard, Premium, Wholesale, Retail, Special]
 *         totalSales:
 *           type: number
 *         active:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * Customer Controller - Handles customer (buyer) operations
 */
const customerController = {
    /**
     * @swagger
     * /sales/customers:
     *   get:
     *     summary: List all customers with pagination
     *     tags: [Customers]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *       - in: query
     *         name: customerType
     *         schema:
     *           type: string
     *           enum: [Individual, Business, Contractor, Government, Dealer, Retailer]
     *       - in: query
     *         name: hasOutstanding
     *         schema:
     *           type: boolean
     *         description: Filter customers with outstanding balance
     *       - in: query
     *         name: active
     *         schema:
     *           type: boolean
     *     responses:
     *       200:
     *         description: Paginated list of customers
     */
    async list(req, res, next) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                customerType,
                priceCategory,
                hasOutstanding,
                active,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            const query = { deleted: { $ne: true } };

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { customerCode: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { gstin: { $regex: search, $options: 'i' } },
                ];
            }

            if (customerType) {
                query.customerType = customerType;
            }

            if (priceCategory) {
                query.priceCategory = priceCategory;
            }

            if (hasOutstanding === true || hasOutstanding === 'true') {
                query.currentBalance = { $gt: 0 };
            }

            if (typeof active === 'boolean' || active === 'true' || active === 'false') {
                query.active = active === true || active === 'true';
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
                select: '-metadata',
            };

            const result = await Customer.paginate(query, options);

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
     * /sales/customers/{id}:
     *   get:
     *     summary: Get customer by ID
     *     tags: [Customers]
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
     *         description: Customer details
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   $ref: '#/components/schemas/Customer'
     *       404:
     *         description: Customer not found
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const customer = await Customer.findOne({ _id: id, deleted: { $ne: true } })
                .populate('tags', 'name color');

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            res.json({
                success: true,
                data: customer,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/customers:
     *   post:
     *     summary: Create a new customer
     *     tags: [Customers]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/Customer'
     *     responses:
     *       201:
     *         description: Customer created successfully
     *       400:
     *         description: Validation error
     */
    async create(req, res, next) {
        try {
            // Normalize request body to model shape
            const customerData = { ...req.body };

            // Ensure customerCode is generated by backend model (do not accept client-supplied code)
            if (customerData.customerCode) delete customerData.customerCode;

            // map top-level phone into contact.phone if provided
            if (customerData.phone) {
                customerData.contact = customerData.contact || {};
                customerData.contact.phone = customerData.contact.phone || customerData.phone;
            }

            // copy billingAddress (validation ensures it exists) into model field
            if (customerData.billingAddress) {
                customerData.billingAddress = {
                    line1: customerData.billingAddress.line1 || '',
                    line2: customerData.billingAddress.line2 || undefined,
                    city: customerData.billingAddress.city || '',
                    state: customerData.billingAddress.state || '',
                    pincode: customerData.billingAddress.pincode || '',
                    landmark: customerData.billingAddress.landmark || undefined,
                };
                // also keep legacy `address` for backward-compatibility
                customerData.address = customerData.address || {
                    street: customerData.billingAddress.line1 || '',
                    city: customerData.billingAddress.city || '',
                    state: customerData.billingAddress.state || '',
                    pincode: customerData.billingAddress.pincode || '',
                    country: 'India',
                };
            }

            // Accept paymentTerms as object (validation enforces structure)
            if (customerData.paymentTerms && typeof customerData.paymentTerms === 'object') {
                customerData.paymentTerms = {
                    creditDays: customerData.paymentTerms.creditDays || 0,
                    discountPercent: customerData.paymentTerms.discountPercent || 0,
                    discountDays: customerData.paymentTerms.discountDays || 0,
                };
            }

            const customer = new Customer(customerData);
            await customer.save();

            // Create initial ledger entry - disabled (CustomerLedger model not available)
            // await CustomerLedger.create({
            //     customerId: customer._id,
            //     date: new Date(),
            //     description: 'Account opened',
            //     entryType: 'Opening',
            //     debit: 0,
            //     credit: 0,
            //     balance: 0,
            // });

            res.status(201).json({
                success: true,
                message: 'Customer created successfully',
                data: customer,
            });
        } catch (error) {
            if (error && error.code === 11000) {
                const key = error.keyValue ? Object.keys(error.keyValue)[0] : null;
                let message = 'Customer with this phone or customer code already exists';
                if (key === 'customerCode') message = 'Customer code already exists';
                if (key === 'contact.phone' || key === 'phone') message = 'Phone number already exists';
                return res.status(400).json({ success: false, message });
            }
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/customers/{id}:
     *   put:
     *     summary: Update a customer
     *     tags: [Customers]
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
     *             $ref: '#/components/schemas/Customer'
     *     responses:
     *       200:
     *         description: Customer updated successfully
     *       404:
     *         description: Customer not found
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };

            // map top-level phone into contact.phone if present
            if (updateData.phone) {
                updateData.contact = updateData.contact || {};
                updateData.contact.phone = updateData.contact.phone || updateData.phone;
            }

            // normalize billingAddress if provided
            if (updateData.billingAddress) {
                updateData.billingAddress = {
                    line1: updateData.billingAddress.line1 || '',
                    line2: updateData.billingAddress.line2 || undefined,
                    city: updateData.billingAddress.city || '',
                    state: updateData.billingAddress.state || '',
                    pincode: updateData.billingAddress.pincode || '',
                    landmark: updateData.billingAddress.landmark || undefined,
                };
                updateData.address = updateData.address || {
                    street: updateData.billingAddress.line1 || '',
                    city: updateData.billingAddress.city || '',
                    state: updateData.billingAddress.state || '',
                    pincode: updateData.billingAddress.pincode || '',
                    country: 'India',
                };
            }

            // ensure paymentTerms object shape
            if (updateData.paymentTerms && typeof updateData.paymentTerms === 'object') {
                updateData.paymentTerms = {
                    creditDays: updateData.paymentTerms.creditDays || 0,
                    discountPercent: updateData.paymentTerms.discountPercent || 0,
                    discountDays: updateData.paymentTerms.discountDays || 0,
                };
            }

            const customer = await Customer.findOneAndUpdate(
                { _id: id, deleted: { $ne: true } },
                updateData,
                { new: true, runValidators: true }
            );

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            res.json({
                success: true,
                message: 'Customer updated successfully',
                data: customer,
            });
        } catch (error) {
            if (error && error.code === 11000) {
                const key = error.keyValue ? Object.keys(error.keyValue)[0] : null;
                let message = 'Customer with this phone or customer code already exists';
                if (key === 'customerCode') message = 'Customer code already exists';
                if (key === 'contact.phone' || key === 'phone') message = 'Phone number already exists';
                return res.status(400).json({ success: false, message });
            }
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/customers/{id}:
     *   delete:
     *     summary: Soft delete a customer
     *     tags: [Customers]
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
     *         description: Customer deleted successfully
     *       404:
     *         description: Customer not found
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            const customer = await Customer.findOne({ _id: id, deleted: { $ne: true } });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            // Check if customer has outstanding balance
            if (customer.currentBalance > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete customer with outstanding balance of ₹${customer.currentBalance}`,
                });
            }

            await customer.softDelete(req.user?._id);

            res.json({
                success: true,
                message: 'Customer deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/customers/{id}/balance:
     *   get:
     *     summary: Get customer balance and credit info
     *     tags: [Customers]
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
     *         description: Customer balance information
     */
    async getBalance(req, res, next) {
        try {
            const { id } = req.params;

            const customer = await Customer.findOne({ _id: id, deleted: { $ne: true } })
                .select('name currentBalance creditLimit totalSales');

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            const availableCredit = customer.creditLimit - customer.currentBalance;

            res.json({
                success: true,
                data: {
                    customerId: customer._id,
                    name: customer.name,
                    currentBalance: customer.currentBalance,
                    creditLimit: customer.creditLimit,
                    availableCredit: Math.max(0, availableCredit),
                    isOverLimit: customer.currentBalance > customer.creditLimit,
                    totalSales: customer.totalSales,
                },
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/customers/{id}/ledger:
     *   get:
     *     summary: Get customer ledger (transaction history)
     *     tags: [Customers]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *     responses:
     *       200:
     *         description: Customer ledger entries
     */
    async getLedger(req, res, next) {
        try {
            const { id } = req.params;
            const { startDate, endDate, limit = 50 } = req.query;

            const customer = await Customer.findOne({ _id: id, deleted: { $ne: true } })
                .select('name currentBalance');

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            const query = { customerId: id };

            // CustomerLedger disabled - model not available
            // const ledgerEntries = await CustomerLedger.find(query)
            //     .sort({ date: -1, createdAt: -1 })
            //     .limit(parseInt(limit))
            //     .populate('referenceId');

            res.json({
                success: true,
                data: {
                    customer: {
                        _id: customer._id,
                        name: customer.name,
                        currentBalance: customer.currentBalance,
                    },
                    entries: [], // Ledger entries disabled
                },
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/customers/outstanding:
     *   get:
     *     summary: Get all customers with outstanding balance
     *     tags: [Customers]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of customers with outstanding balance
     */
    async getOutstanding(req, res, next) {
        try {
            const customers = await Customer.find({
                currentBalance: { $gt: 0 },
                deleted: { $ne: true },
            })
                .select('name phone currentBalance creditLimit')
                .sort({ currentBalance: -1 });

            const totalOutstanding = customers.reduce((sum, c) => sum + c.currentBalance, 0);

            res.json({
                success: true,
                data: {
                    totalOutstanding,
                    count: customers.length,
                    customers,
                },
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /sales/customers/search:
     *   get:
     *     summary: Quick search customers by name or phone
     *     tags: [Customers]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: q
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Search results
     */
    async quickSearch(req, res, next) {
        try {
            const { q } = req.query;

            if (!q || q.length < 2) {
                return res.json({
                    success: true,
                    data: [],
                });
            }

            const customers = await Customer.find({
                $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { phone: { $regex: q, $options: 'i' } },
                    { customerCode: { $regex: q, $options: 'i' } },
                ],
                active: true,
                deleted: { $ne: true },
            })
                .select('name phone customerCode currentBalance billingAddress')
                .limit(10)
                .sort({ name: 1 });

            res.json({
                success: true,
                data: customers,
            });
        } catch (error) {
            next(error);
        }
    },
};

export default customerController;
