import LabourPayment from './labourPayment.model.js';
import Labourer from './labourer.model.js';
import { asyncHandler } from '../../middleware/error.js';

/**
 * Get all labour payments with pagination
 */
export const getLabourPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status, labourerId } = req.query;
    const query = {};

    if (search) {
        query.$or = [
            { labourerName: { $regex: search, $options: 'i' } },
            { paymentNumber: { $regex: search, $options: 'i' } },
            { labourerPhone: { $regex: search, $options: 'i' } },
        ];
    }

    if (status) query.paymentStatus = status;
    if (labourerId) query.labourerId = labourerId;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { paymentDate: -1 },
        populate: ['labourerId', 'batchId', 'createdBy', 'modifiedBy'],
    };

    const result = await LabourPayment.paginate(query, options);
    res.json(result);
});

/**
 * Get single labour payment
 */
export const getLabourPayment = asyncHandler(async (req, res) => {
    const payment = await LabourPayment.findById(req.params.id).populate([
        'labourerId',
        'batchId',
        'createdBy',
        'modifiedBy',
    ]);

    if (!payment) {
        return res.status(404).json({ message: 'Labour payment not found' });
    }

    res.json(payment);
});

/**
 * Create labour payment
 */
export const createLabourPayment = asyncHandler(async (req, res) => {
    const {
        batchId,
        labourerId,
        labourerName,
        labourerPhone,
        labourerAddress,
        paymentDate,
        paymentMethod,
        paymentStatus,
        amount,
        workType,
        payCategory,
        workHours,
        ratePerHour,
        description,
        reference,
        notes,
    } = req.body;

    // Generate payment number
    const count = await LabourPayment.countDocuments();
    const paymentNumber = `LP-${Date.now()}-${count + 1}`;

    const payment = new LabourPayment({
        paymentNumber,
        batchId,
        labourerId,
        labourerName,
        labourerPhone,
        labourerAddress,
        paymentDate: paymentDate || Date.now(),
        paymentMethod,
        paymentStatus: paymentStatus || 'PENDING',
        amount,
        workType,
        payCategory: payCategory || 'Per Day',
        workHours,
        ratePerHour,
        description,
        reference,
        notes,
        createdBy: req.user?.id,
    });

    await payment.save();
    res.status(201).json(payment);
});

/**
 * Update labour payment
 */
export const updateLabourPayment = asyncHandler(async (req, res) => {
    const {
        labourerId,
        batchId,
        labourerName,
        labourerPhone,
        labourerAddress,
        paymentDate,
        paymentMethod,
        paymentStatus,
        amount,
        workType,
        payCategory,
        workHours,
        ratePerHour,
        description,
        chequeNumber,
        chequeDate,
        bankName,
        chequeStatus,
        reference,
        notes,
    } = req.body;

    const payment = await LabourPayment.findById(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Labour payment not found' });
    }

    // Update fields
    if (labourerId) payment.labourerId = labourerId;
    if (batchId) payment.batchId = batchId;
    if (labourerName) payment.labourerName = labourerName;
    if (labourerPhone) payment.labourerPhone = labourerPhone;
    if (labourerAddress) payment.labourerAddress = labourerAddress;
    if (paymentDate) payment.paymentDate = paymentDate;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (paymentStatus) payment.paymentStatus = paymentStatus;
    if (amount !== undefined) payment.amount = amount;
    if (workType) payment.workType = workType;
    if (payCategory) payment.payCategory = payCategory;
    if (workHours !== undefined) payment.workHours = workHours;
    if (ratePerHour !== undefined) payment.ratePerHour = ratePerHour;
    if (description) payment.description = description;
    if (chequeNumber) payment.chequeNumber = chequeNumber;
    if (chequeDate) payment.chequeDate = chequeDate;
    if (bankName) payment.bankName = bankName;
    if (chequeStatus) payment.chequeStatus = chequeStatus;
    if (reference) payment.reference = reference;
    if (notes) payment.notes = notes;

    payment.modifiedBy = req.user?.id;
    await payment.save();

    res.json(payment);
});

/**
 * Delete labour payment
 */
export const deleteLabourPayment = asyncHandler(async (req, res) => {
    const payment = await LabourPayment.findByIdAndDelete(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Labour payment not found' });
    }

    res.json({ message: 'Labour payment deleted successfully' });
});

/**
 * Get payments by batch
 */
export const getPaymentsByBatch = asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const payments = await LabourPayment.find({ batchId }).populate([
        'labourerId',
        'createdBy',
    ]);

    res.json(payments);
});

/**
 * Mark cheque as cleared
 */
export const markChequeAsCleared = asyncHandler(async (req, res) => {
    const payment = await LabourPayment.findById(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Labour payment not found' });
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

/**
 * Get payment statistics
 */
export const getLabourPaymentStats = asyncHandler(async (req, res) => {
    const stats = await LabourPayment.aggregate([
        {
            $match: { isDeleted: false },
        },
        {
            $group: {
                _id: '$paymentStatus',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
            },
        },
    ]);

    res.json(stats);
});
