import ExpensePayment from './expencePayment.model.js';
import { asyncHandler } from '../../middleware/error.js';

/**
 * Get all expense payments with pagination
 */
export const getExpensePayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status, expenseType } = req.query;
    const query = {};

    if (search) {
        query.$or = [
            { payeeName: { $regex: search, $options: 'i' } },
            { paymentNumber: { $regex: search, $options: 'i' } },
            { invoiceNumber: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
        ];
    }

    if (status) query.paymentStatus = status;
    if (expenseType) query.expenseType = expenseType;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { paymentDate: -1 },
        populate: ['createdBy', 'modifiedBy'],
    };

    const result = await ExpensePayment.paginate(query, options);
    res.json(result);
});

/**
 * Get single expense payment
 */
export const getExpensePayment = asyncHandler(async (req, res) => {
    const payment = await ExpensePayment.findById(req.params.id).populate([
        'createdBy',
        'modifiedBy',
    ]);

    if (!payment) {
        return res.status(404).json({ message: 'Expense payment not found' });
    }

    res.json(payment);
});

/**
 * Create expense payment
 */
export const createExpensePayment = asyncHandler(async (req, res) => {
    const {
        expenseType,
        expenseCategory,
        payeeName,
        payeePhone,
        payeeEmail,
        payeeAddress,
        paymentDate,
        paymentMethod,
        amount,
        gstApplicable,
        gstPercentage,
        invoiceNumber,
        billNumber,
        description,
        departmentCode,
        projectCode,
        notes,
    } = req.body;

    // Calculate GST and gross amount
    let gstAmount = 0;
    let grossAmount = amount;

    if (gstApplicable && gstPercentage) {
        gstAmount = (amount * gstPercentage) / 100;
        grossAmount = amount + gstAmount;
    }

    // Generate payment number
    const count = await ExpensePayment.countDocuments();
    const paymentNumber = `EP-${Date.now()}-${count + 1}`;

    const payment = new ExpensePayment({
        paymentNumber,
        expenseType,
        expenseCategory,
        payeeName,
        payeePhone,
        payeeEmail,
        payeeAddress,
        paymentDate: paymentDate || Date.now(),
        paymentMethod,
        paymentStatus: 'PENDING',
        amount,
        gstApplicable,
        gstPercentage: gstPercentage || 0,
        gstAmount,
        grossAmount,
        invoiceNumber,
        billNumber,
        description,
        departmentCode,
        projectCode,
        notes,
        createdBy: req.user?.id,
    });

    await payment.save();
    res.status(201).json(payment);
});

/**
 * Update expense payment
 */
export const updateExpensePayment = asyncHandler(async (req, res) => {
    const {
        expenseType,
        expenseCategory,
        payeeName,
        payeePhone,
        payeeEmail,
        payeeAddress,
        paymentDate,
        paymentMethod,
        paymentStatus,
        amount,
        gstApplicable,
        gstPercentage,
        chequeNumber,
        chequeDate,
        bankName,
        chequeStatus,
        invoiceNumber,
        billNumber,
        description,
        departmentCode,
        projectCode,
        notes,
    } = req.body;

    const payment = await ExpensePayment.findById(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Expense payment not found' });
    }

    // Update fields
    if (expenseType) payment.expenseType = expenseType;
    if (expenseCategory) payment.expenseCategory = expenseCategory;
    if (payeeName) payment.payeeName = payeeName;
    if (payeePhone) payment.payeePhone = payeePhone;
    if (payeeEmail) payment.payeeEmail = payeeEmail;
    if (payeeAddress) payment.payeeAddress = payeeAddress;
    if (paymentDate) payment.paymentDate = paymentDate;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (paymentStatus) payment.paymentStatus = paymentStatus;

    if (amount !== undefined) {
        payment.amount = amount;
        // Recalculate GST
        if (gstApplicable !== undefined || gstPercentage !== undefined) {
            const gstPct = gstPercentage !== undefined ? gstPercentage : payment.gstPercentage;
            const gst = (amount * gstPct) / 100;
            payment.gstAmount = gst;
            payment.grossAmount = amount + gst;
        }
    }

    if (gstApplicable !== undefined) payment.gstApplicable = gstApplicable;
    if (gstPercentage !== undefined) payment.gstPercentage = gstPercentage;
    if (chequeNumber) payment.chequeNumber = chequeNumber;
    if (chequeDate) payment.chequeDate = chequeDate;
    if (bankName) payment.bankName = bankName;
    if (chequeStatus) payment.chequeStatus = chequeStatus;
    if (invoiceNumber) payment.invoiceNumber = invoiceNumber;
    if (billNumber) payment.billNumber = billNumber;
    if (description) payment.description = description;
    if (departmentCode) payment.departmentCode = departmentCode;
    if (projectCode) payment.projectCode = projectCode;
    if (notes) payment.notes = notes;

    payment.modifiedBy = req.user?.id;
    await payment.save();

    res.json(payment);
});

/**
 * Delete expense payment
 */
export const deleteExpensePayment = asyncHandler(async (req, res) => {
    const payment = await ExpensePayment.findByIdAndDelete(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Expense payment not found' });
    }

    res.json({ message: 'Expense payment deleted successfully' });
});

/**
 * Get expense summary by type
 */
export const getExpenseSummary = asyncHandler(async (req, res) => {
    const summary = await ExpensePayment.aggregate([
        {
            $match: { isDeleted: false },
        },
        {
            $group: {
                _id: '$expenseType',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                totalGross: { $sum: '$grossAmount' },
            },
        },
        {
            $sort: { totalAmount: -1 },
        },
    ]);

    res.json(summary);
});

/**
 * Get expenses by date range
 */
export const getExpensesByDateRange = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const expenses = await ExpensePayment.find({
        paymentDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        },
        isDeleted: false,
    }).sort({ paymentDate: -1 });

    const total = expenses.reduce((sum, exp) => sum + exp.grossAmount, 0);

    res.json({
        count: expenses.length,
        total,
        expenses,
    });
});

/**
 * Mark cheque as cleared
 */
export const markChequeAsCleared = asyncHandler(async (req, res) => {
    const payment = await ExpensePayment.findById(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Expense payment not found' });
    }

    if (!payment.chequeNumber) {
        return res.status(400).json({ message: 'This payment is not a cheque payment' });
    }

    payment.chequeStatus = 'CLEARED';
    payment.paymentStatus = 'COMPLETED';
    payment.modifiedBy = req.user?.id;
    await payment.save();

    res.json(payment);
});
