import TransportPayment from './tranportPayment.model.js';
import { asyncHandler } from '../../middleware/error.js';

/**
 * Get all transport payments with pagination
 */
export const getTransportPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;
    const query = {};

    if (search) {
        query.$or = [
            { paymentNumber: { $regex: search, $options: 'i' } },
            { trackingNumber: { $regex: search, $options: 'i' } },
            { vehicleNumber: { $regex: search, $options: 'i' } },
        ];
    }

    if (status) query.paymentStatus = status;

    const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { paymentDate: -1 },
        populate: ['transportItemId', 'salesOrderId', 'purchaseOrderId', 'createdBy', 'modifiedBy'],
    };

    const result = await TransportPayment.paginate(query, options);
    res.json(result);
});

/**
 * Get single transport payment
 */
export const getTransportPayment = asyncHandler(async (req, res) => {
    const payment = await TransportPayment.findById(req.params.id).populate([
        'transportItemId',
        'salesOrderId',
        'purchaseOrderId',
        'createdBy',
        'modifiedBy',
    ]);

    if (!payment) {
        return res.status(404).json({ message: 'Transport payment not found' });
    }

    res.json(payment);
});

/**
 * Create transport payment
 */
export const createTransportPayment = asyncHandler(async (req, res) => {
    const {
        salesOrderId,
        soNumber,
        purchaseOrderId,
        poNumber,
        transportItemId,
        shipmentDetails,
        vehicleNumber,
        vehicleType,
        driverName,
        driverPhone,
        shipmentDate,
        deliveryDate,
        trackingNumber,
        paymentDate,
        paymentMethod,
        paymentStatus,
        baseAmount,
        additionalCharges = 0,
        discount = 0,
        tax = 0,
        reference,
        notes,
    } = req.body;

    // Calculate total amount
    const totalAmount = baseAmount + additionalCharges - discount + tax;

    // Generate payment number
    const count = await TransportPayment.countDocuments();
    const paymentNumber = `TP-${Date.now()}-${count + 1}`;

    const payment = new TransportPayment({
        paymentNumber,
        salesOrderId,
        soNumber,
        purchaseOrderId,
        poNumber,
        transportItemId,
        shipmentDetails,
        vehicleNumber,
        vehicleType,
        driverName,
        driverPhone,
        shipmentDate,
        deliveryDate,
        trackingNumber,
        paymentDate: paymentDate || Date.now(),
        paymentMethod,
        paymentStatus: paymentStatus || 'PENDING',
        baseAmount,
        additionalCharges,
        discount,
        tax,
        totalAmount,
        reference,
        notes,
        createdBy: req.user?.id,
    });

    await payment.save();
    res.status(201).json(payment);
});

/**
 * Update transport payment
 */
export const updateTransportPayment = asyncHandler(async (req, res) => {
    const {
        transportItemId,
        shipmentDetails,
        vehicleNumber,
        vehicleType,
        driverName,
        driverPhone,
        shipmentDate,
        deliveryDate,
        trackingNumber,
        paymentDate,
        paymentMethod,
        paymentStatus,
        baseAmount,
        additionalCharges,
        discount,
        tax,
        chequeNumber,
        chequeDate,
        bankName,
        chequeStatus,
        reference,
        notes,
    } = req.body;

    const payment = await TransportPayment.findById(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Transport payment not found' });
    }

    // Update fields
    if (transportItemId) payment.transportItemId = transportItemId;
    if (providerName) payment.providerName = providerName;
    if (providerPhone) payment.providerPhone = providerPhone;
    if (providerEmail) payment.providerEmail = providerEmail;
    if (providerAddress) payment.providerAddress = providerAddress;
    if (shipmentDetails) payment.shipmentDetails = shipmentDetails;
    if (vehicleNumber) payment.vehicleNumber = vehicleNumber;
    if (vehicleType) payment.vehicleType = vehicleType;
    if (driverName) payment.driverName = driverName;
    if (driverPhone) payment.driverPhone = driverPhone;
    if (shipmentDate) payment.shipmentDate = shipmentDate;
    if (deliveryDate) payment.deliveryDate = deliveryDate;
    if (trackingNumber) payment.trackingNumber = trackingNumber;
    if (paymentDate) payment.paymentDate = paymentDate;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (paymentStatus) payment.paymentStatus = paymentStatus;

    // Recalculate total if any amount field changes
    if (baseAmount !== undefined || additionalCharges !== undefined || discount !== undefined || tax !== undefined) {
        const base = baseAmount !== undefined ? baseAmount : payment.baseAmount;
        const additional = additionalCharges !== undefined ? additionalCharges : payment.additionalCharges;
        const disc = discount !== undefined ? discount : payment.discount;
        const txn = tax !== undefined ? tax : payment.tax;
        payment.totalAmount = base + additional - disc + txn;

        if (baseAmount !== undefined) payment.baseAmount = baseAmount;
        if (additionalCharges !== undefined) payment.additionalCharges = additionalCharges;
        if (discount !== undefined) payment.discount = discount;
        if (tax !== undefined) payment.tax = tax;
    }

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
 * Delete transport payment
 */
export const deleteTransportPayment = asyncHandler(async (req, res) => {
    const payment = await TransportPayment.findByIdAndDelete(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Transport payment not found' });
    }

    res.json({ message: 'Transport payment deleted successfully' });
});


/**
 * Mark cheque as cleared
 */
export const markChequeAsCleared = asyncHandler(async (req, res) => {
    const payment = await TransportPayment.findById(req.params.id);

    if (!payment) {
        return res.status(404).json({ message: 'Transport payment not found' });
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
 * Get transport statistics
 */
export const getTransportStats = asyncHandler(async (req, res) => {
    const stats = await TransportPayment.aggregate([
        {
            $match: { isDeleted: false },
        },
        {
            $group: {
                _id: '$paymentStatus',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' },
            },
        },
    ]);

    res.json(stats);
});

/**
 * Track shipment
 */
export const trackShipment = asyncHandler(async (req, res) => {
    const { trackingNumber } = req.params;

    const payment = await TransportPayment.findOne({ trackingNumber }).populate([

        'purchaseOrderId',
    ]);

    if (!payment) {
        return res.status(404).json({ message: 'Shipment not found' });
    }

    res.json(payment);
});
