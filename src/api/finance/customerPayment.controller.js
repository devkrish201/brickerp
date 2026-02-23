import CustomerPayment from './customerPayment.model.js';
import Customer from '../sales/customer.model.js';
// import CustomerLedger from './customerLedger.model.js'; // Not available

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentAllocation:
 *       type: object
 *       properties:
 *         invoiceId:
 *           type: string
 *         invoiceNumber:
 *           type: string
 *         amount:
 *           type: number
 *
 *     CustomerPayment:
 *       type: object
 *       required:
 *         - customerId
 *         - amount
 *         - paymentMethod
 *       properties:
 *         _id:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         customerId:
 *           type: string
 *         customerName:
 *           type: string
 *         paymentDate:
 *           type: string
 *           format: date-time
 *         amount:
 *           type: number
 *         paymentMethod:
 *           type: string
 *           enum: [Cash, UPI, Bank_Transfer, Cheque, Card, NEFT, RTGS, IMPS]
 *         reference:
 *           type: string
 *         chequeDetails:
 *           type: object
 *           properties:
 *             chequeNumber:
 *               type: string
 *             bankName:
 *               type: string
 *             chequeDate:
 *               type: string
 *               format: date
 *             status:
 *               type: string
 *               enum: [Pending, Cleared, Bounced]
 *         allocations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaymentAllocation'
 *         allocatedAmount:
 *           type: number
 *         unallocatedAmount:
 *           type: number
 *         tdsAmount:
 *           type: number
 *         netAmount:
 *           type: number
 *         status:
 *           type: string
 *           enum: [Draft, Completed, Cancelled, Bounced]
 */

/**
 * CustomerPayment Controller - Handles payment receipts from customers
 */
const customerPaymentController = {
    /**
     * @swagger
     * /finance/customer-payments:
     *   get:
     *     summary: List all customer payments with pagination
     *     tags: [Customer Payments]
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
     *         name: paymentMethod
     *         schema:
     *           type: string
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [Draft, Completed, Cancelled, Bounced]
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
     *         description: Paginated list of payments
     */
    async list(req, res, next) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                customerId,
                paymentMethod,
                status,
                fromDate,
                toDate,
                sortBy = 'paymentDate',
                sortOrder = 'desc'
            } = req.query;

            const query = { deleted: { $ne: true } };

            if (search) {
                query.$or = [
                    { receiptNumber: { $regex: search, $options: 'i' } },
                    { customerName: { $regex: search, $options: 'i' } },
                    { reference: { $regex: search, $options: 'i' } },
                ];
            }

            if (customerId) {
                query.customerId = customerId;
            }

            if (paymentMethod) {
                query.paymentMethod = paymentMethod;
            }

            if (status) {
                query.status = status;
            }

            if (fromDate || toDate) {
                query.paymentDate = {};
                if (fromDate) query.paymentDate.$gte = new Date(fromDate);
                if (toDate) query.paymentDate.$lte = new Date(toDate);
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
                populate: [
                    { path: 'customerId', select: 'name phone' },
                ],
            };

            const result = await CustomerPayment.paginate(query, options);

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
     * /finance/customer-payments/{id}:
     *   get:
     *     summary: Get payment by ID
     *     tags: [Customer Payments]
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
     *         description: Payment details
     *       404:
     *         description: Payment not found
     */
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const payment = await CustomerPayment.findOne({ _id: id, deleted: { $ne: true } })
                .populate('customerId', 'name phone email')
                .populate('allocations.invoiceId', 'invoiceNumber grandTotal balanceDue');

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment not found',
                });
            }

            res.json({
                success: true,
                data: payment,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /finance/customer-payments:
     *   post:
     *     summary: Create a new customer payment
     *     tags: [Customer Payments]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/CustomerPayment'
     *     responses:
     *       201:
     *         description: Payment created successfully
     *       400:
     *         description: Validation error
     */
    async create(req, res, next) {
        try {
            const paymentData = req.body;

            // Fetch customer
            const customer = await Customer.findOne({
                _id: paymentData.customerId,
                deleted: { $ne: true }
            });

            if (!customer) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            paymentData.customerName = customer.name;

            // Validate allocations if provided
            if (paymentData.allocations && paymentData.allocations.length > 0) {
                // SalesInvoice model missing in this setup — allocation feature not available
                if (typeof SalesInvoice === 'undefined') {
                    return res.status(501).json({
                        success: false,
                        message: 'Invoice allocation not available (sales module missing).',
                    });
                }

                const invoiceIds = paymentData.allocations.map(a => a.invoiceId);
                const invoices = await SalesInvoice.find({
                    _id: { $in: invoiceIds },
                    customerId: paymentData.customerId,
                });

                if (invoices.length !== invoiceIds.length) {
                    return res.status(400).json({
                        success: false,
                        message: 'One or more invoices not found or do not belong to this customer',
                    });
                }

                // Enrich allocations with invoice numbers
                const invoiceMap = new Map(invoices.map(inv => [inv._id.toString(), inv]));
                paymentData.allocations = paymentData.allocations.map(alloc => ({
                    ...alloc,
                    invoiceNumber: invoiceMap.get(alloc.invoiceId)?.invoiceNumber,
                }));

                // Check total allocation doesn't exceed amount
                const totalAllocated = paymentData.allocations.reduce((sum, a) => sum + a.amount, 0);
                if (totalAllocated > paymentData.amount) {
                    return res.status(400).json({
                        success: false,
                        message: 'Total allocation exceeds payment amount',
                    });
                }
            }

            const payment = new CustomerPayment(paymentData);
            await payment.save();

            // If it's not a cheque or cheque is already cleared, complete the payment
            if (paymentData.paymentMethod !== 'Cheque' ||
                paymentData.chequeDetails?.status === 'Cleared') {
                await payment.complete(req.user?._id);
            }

            res.status(201).json({
                success: true,
                message: 'Payment created successfully',
                data: payment,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /finance/customer-payments/{id}/allocate:
     *   post:
     *     summary: Allocate payment to invoices
     *     tags: [Customer Payments]
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
     *               - allocations
     *             properties:
     *               allocations:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     invoiceId:
     *                       type: string
     *                     amount:
     *                       type: number
     *     responses:
     *       200:
     *         description: Payment allocated
     */
    async allocate(req, res, next) {
        try {
            // Allocation relies on SalesInvoice model; if missing, respond with 501
            if (typeof SalesInvoice === 'undefined') {
                return res.status(501).json({ success: false, message: 'Invoice allocation not available (sales module missing).' });
            }
            const { id } = req.params;
            const { allocations } = req.body;

            const payment = await CustomerPayment.findOne({ _id: id, deleted: { $ne: true } });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment not found',
                });
            }

            if (payment.status !== 'Completed') {
                return res.status(400).json({
                    success: false,
                    message: 'Only completed payments can be allocated',
                });
            }

            // Calculate new total allocation
            const newAllocationTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
            const existingAllocationTotal = payment.allocatedAmount || 0;

            if (existingAllocationTotal + newAllocationTotal > payment.netAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Total allocation would exceed payment amount',
                });
            }

            // Validate and enrich allocations
            const invoiceIds = allocations.map(a => a.invoiceId);
            const invoices = await SalesInvoice.find({ _id: { $in: invoiceIds } });
            const invoiceMap = new Map(invoices.map(inv => [inv._id.toString(), inv]));

            for (const alloc of allocations) {
                const invoice = invoiceMap.get(alloc.invoiceId);
                if (!invoice) {
                    return res.status(400).json({
                        success: false,
                        message: `Invoice ${alloc.invoiceId} not found`,
                    });
                }
                if (alloc.amount > invoice.balanceDue) {
                    return res.status(400).json({
                        success: false,
                        message: `Allocation exceeds balance due for invoice ${invoice.invoiceNumber}`,
                    });
                }

                // Add to payment allocations
                payment.allocations.push({
                    invoiceId: alloc.invoiceId,
                    invoiceNumber: invoice.invoiceNumber,
                    amount: alloc.amount,
                });

                // Update invoice
                invoice.amountPaid += alloc.amount;
                if (invoice.amountPaid >= invoice.grandTotal) {
                    invoice.status = 'Paid';
                } else {
                    invoice.status = 'Partially_Paid';
                }
                await invoice.save();
            }

            await payment.save();

            res.json({
                success: true,
                message: 'Payment allocated successfully',
                data: payment,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /finance/customer-payments/{id}/cheque-status:
     *   patch:
     *     summary: Update cheque status
     *     tags: [Customer Payments]
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
     *                 enum: [Cleared, Bounced]
     *               remarks:
     *                 type: string
     *     responses:
     *       200:
     *         description: Cheque status updated
     */
    async updateChequeStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, remarks } = req.body;

            const payment = await CustomerPayment.findOne({ _id: id, deleted: { $ne: true } });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment not found',
                });
            }

            if (payment.paymentMethod !== 'Cheque') {
                return res.status(400).json({
                    success: false,
                    message: 'This is not a cheque payment',
                });
            }

            if (payment.chequeDetails.status !== 'Pending') {
                return res.status(400).json({
                    success: false,
                    message: `Cheque is already ${payment.chequeDetails.status}`,
                });
            }

            payment.chequeDetails.status = status;
            payment.chequeDetails.remarks = remarks;
            payment.chequeDetails.clearedDate = status === 'Cleared' ? new Date() : null;

            if (status === 'Cleared') {
                await payment.complete(req.user?._id);
            } else if (status === 'Bounced') {
                payment.status = 'Bounced';
                await payment.save();

                // Record bounce in ledger - DISABLED (CustomerLedger model not available)
                // await CustomerLedger.recordTransaction(
                //     payment.customerId,
                //     payment.netAmount, // Debit (increase balance)
                //     0,
                //     'Adjustment',
                //     payment._id,
                //     `Cheque bounced - ${payment.receiptNumber}`
                // );

                // Update customer balance
                const customer = await Customer.findById(payment.customerId);
                if (customer) {
                    await customer.updateBalance(payment.netAmount);
                }
            }

            res.json({
                success: true,
                message: `Cheque marked as ${status}`,
                data: payment,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /finance/customer-payments/{id}:
     *   delete:
     *     summary: Cancel a payment
     *     tags: [Customer Payments]
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
     *         description: Payment cancelled
     */
    async cancel(req, res, next) {
        try {
            const { id } = req.params;

            const payment = await CustomerPayment.findOne({ _id: id, deleted: { $ne: true } });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment not found',
                });
            }

            if (payment.status === 'Cancelled') {
                return res.status(400).json({
                    success: false,
                    message: 'Payment is already cancelled',
                });
            }

            // If payment was completed, reverse it
            if (payment.status === 'Completed') {
                // If there are allocations but SalesInvoice model is missing, cannot safely reverse
                if ((payment.allocations && payment.allocations.length > 0) && typeof SalesInvoice === 'undefined') {
                    return res.status(501).json({ success: false, message: 'Cannot cancel completed payment because sales invoice module is missing.' });
                }

                // Reverse invoice allocations
                for (const alloc of payment.allocations) {
                    if (typeof SalesInvoice !== 'undefined') {
                        await SalesInvoice.findByIdAndUpdate(alloc.invoiceId, {
                            $inc: { amountPaid: -alloc.amount },
                        });
                    }
                }

                // Record reversal in ledger - DISABLED (CustomerLedger model not available)
                // await CustomerLedger.recordTransaction(
                //     payment.customerId,
                //     payment.netAmount, // Debit (increase balance)
                //     0,
                //     'Adjustment',
                //     payment._id,
                //     `Payment cancelled - ${payment.receiptNumber}`
                // );

                // Update customer balance
                const customer = await Customer.findById(payment.customerId);
                if (customer) {
                    await customer.updateBalance(payment.netAmount);
                }
            }

            payment.status = 'Cancelled';
            payment.cancelledAt = new Date();
            payment.cancelledBy = req.user?._id;
            await payment.save();

            res.json({
                success: true,
                message: 'Payment cancelled successfully',
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /finance/customer-payments/by-customer/{customerId}:
     *   get:
     *     summary: Get payments by customer
     *     tags: [Customer Payments]
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
     *         description: List of customer payments
     */
    async getByCustomer(req, res, next) {
        try {
            const { customerId } = req.params;
            const { limit = 20 } = req.query;

            const payments = await CustomerPayment.find({
                customerId,
                deleted: { $ne: true },
            })
                .select('receiptNumber paymentDate amount paymentMethod status')
                .sort({ paymentDate: -1 })
                .limit(parseInt(limit));

            res.json({
                success: true,
                data: payments,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /finance/customer-payments/pending-cheques:
     *   get:
     *     summary: Get pending cheques
     *     tags: [Customer Payments]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of pending cheques
     */
    async getPendingCheques(req, res, next) {
        try {
            const payments = await CustomerPayment.find({
                paymentMethod: 'Cheque',
                'chequeDetails.status': 'Pending',
                deleted: { $ne: true },
            })
                .populate('customerId', 'name phone')
                .select('receiptNumber customerName amount chequeDetails paymentDate')
                .sort({ 'chequeDetails.chequeDate': 1 });

            const totalPending = payments.reduce((sum, p) => sum + p.amount, 0);

            res.json({
                success: true,
                data: {
                    totalPending,
                    count: payments.length,
                    payments,
                },
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * @swagger
     * /finance/customer-payments/summary:
     *   get:
     *     summary: Get payment collection summary
     *     tags: [Customer Payments]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: fromDate
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: toDate
     *         required: true
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Payment summary
     */
    async getSummary(req, res, next) {
        try {
            const { fromDate, toDate } = req.query;

            const summary = await CustomerPayment.aggregate([
                {
                    $match: {
                        paymentDate: {
                            $gte: new Date(fromDate),
                            $lte: new Date(toDate),
                        },
                        status: 'Completed',
                        deleted: { $ne: true },
                    },
                },
                {
                    $group: {
                        _id: '$paymentMethod',
                        totalAmount: { $sum: '$netAmount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { totalAmount: -1 } },
            ]);

            const grandTotal = summary.reduce((sum, item) => sum + item.totalAmount, 0);

            res.json({
                success: true,
                data: {
                    period: { fromDate, toDate },
                    grandTotal: Math.round(grandTotal * 100) / 100,
                    totalTransactions: summary.reduce((sum, item) => sum + item.count, 0),
                    byPaymentMethod: summary,
                },
            });
        } catch (error) {
            next(error);
        }
    },
};

export default customerPaymentController;
