import mongoose from 'mongoose';
import { asyncHandler } from '../../middleware/error.js';

// Import available models for reporting
import Stock from '../inventory/stock.model.js';
import PurchaseOrder from '../procurement/po.model.js';
import BrickBatch from '../manufacturing/batch.model.js';
// import TransportTrip from '../logistics/trip.model.js'; // Not available
import Estimate from '../procurement/estimate.model.js';
// import GoodsReceipt from '../inventory/receipt.model.js'; // Not available
import Vendor from '../procurement/vendor.model.js';
import SalesOrder from '../sales/salesOrder.model.js';
import LabourPayment from '../payment/labourPayment.model.js';
// import Kiln from '../manufacturing/kiln.model.js'; // Not available
// import Warehouse from '../inventory/warehouse.model.js'; // Not available

// ============================================
// DASHBOARD KPIs  (single endpoint for ErpDashboard)
// ============================================

export const getDashboardKPIs = asyncHandler(async (req, res) => {
    const [
        stockAgg,
        customerAgg,
        transportAgg,
        labourAgg,
        vendorAgg,
    ] = await Promise.all([
        // 1. Total Stock — sum all quantity across Stock documents
        Stock.aggregate([
            { $group: { _id: null, totalQty: { $sum: '$quantity' } } },
        ]),

        // 2. Customer Pending — sum balanceDue where paymentStatus Unpaid or Partial
        SalesOrder.aggregate([
            {
                $match: {
                    isDeleted: { $ne: true },
                    paymentStatus: { $in: ['Unpaid', 'Partial'] },
                },
            },
            { $group: { _id: null, total: { $sum: '$balanceDue' } } },
        ]),

        // 3. Transport Pending — sum transportCost where paidStatus != 'Paid'
        SalesOrder.aggregate([
            {
                $match: {
                    isDeleted: { $ne: true },
                    transportCost: { $gt: 0 },
                    'transportDetails.paidStatus': { $ne: 'Paid' },
                },
            },
            { $group: { _id: null, total: { $sum: '$transportCost' } } },
        ]),

        // 4. Labour Pending — sum amount from PENDING labour payment records
        LabourPayment.aggregate([
            { $match: { isDeleted: { $ne: true }, paymentStatus: 'PENDING' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),

        // 5. Vendor Pending — sum totalAmountLocked from open POs
        PurchaseOrder.aggregate([
            {
                $match: {
                    status: { $in: ['Draft', 'Approved', 'PartiallyReceived'] },
                },
            },
            { $group: { _id: null, total: { $sum: '$totalAmountLocked' } } },
        ]),
    ]);

    res.json({
        success: true,
        data: {
            totalStock: stockAgg[0]?.totalQty ?? 0,
            customerPending: customerAgg[0]?.total ?? 0,
            transportPending: transportAgg[0]?.total ?? 0,
            labourPending: labourAgg[0]?.total ?? 0,
            vendorPending: vendorAgg[0]?.total ?? 0,
        },
    });
});

// ============================================
// DASHBOARD OVERVIEW
// ============================================

export const getDashboardOverview = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Parallel queries for performance
    const [
        openPOCount,
        pendingEstimates,
        activeBatches,
        lowStockItems,
        monthlyStats,
    ] = await Promise.all([
        // Open POs
        PurchaseOrder.countDocuments({
            status: { $in: ['Draft', 'Approved', 'PartiallyReceived'] },
        }),

        // Pending estimates
        Estimate.countDocuments({ status: 'Draft' }),

        // Active production batches
        BrickBatch.countDocuments({
            status: { $in: ['InProduction', 'InKiln'] },
        }),

        // Low stock items
        Stock.countDocuments({ isLowStock: true }),

        // Monthly PO value
        PurchaseOrder.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo },
                    status: { $ne: 'Cancelled' },
                },
            },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: '$totalAmountLocked' },
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);

    res.json({
        success: true,
        data: {
            openPurchaseOrders: openPOCount,
            pendingEstimates,
            activeBatches,
            lowStockAlerts: lowStockItems,
            monthlyPurchases: monthlyStats[0] || { totalValue: 0, count: 0 },
        },
    });
});

// ============================================
// STOCK REPORTS
// ============================================

export const getStockLevelsReport = asyncHandler(async (req, res) => {
    const { warehouseId, isLowStock, category } = req.query;

    const matchStage = {};
    if (warehouseId) matchStage.warehouseId = new mongoose.Types.ObjectId(warehouseId);
    if (isLowStock === 'true') matchStage.isLowStock = true;

    const stockReport = await Stock.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: 'items',
                localField: 'itemId',
                foreignField: '_id',
                as: 'item',
            },
        },
        { $unwind: '$item' },
        {
            $lookup: {
                from: 'warehouses',
                localField: 'warehouseId',
                foreignField: '_id',
                as: 'warehouse',
            },
        },
        { $unwind: '$warehouse' },
        {
            $project: {
                itemName: '$item.name',
                itemSku: '$item.sku',
                itemCategory: '$item.categoryId',
                warehouseName: '$warehouse.name',
                quantity: 1,
                reservedQty: 1,
                availableQty: 1,
                reorderLevel: 1,
                isLowStock: 1,
                unit: 1,
                totalValue: 1,
            },
        },
        { $sort: { isLowStock: -1, itemName: 1 } },
    ]);

    // Summary
    const summary = await Stock.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalItems: { $sum: 1 },
                totalValue: { $sum: '$totalValue' },
                lowStockCount: { $sum: { $cond: ['$isLowStock', 1, 0] } },
            },
        },
    ]);

    res.json({
        success: true,
        data: {
            items: stockReport,
            summary: summary[0] || { totalItems: 0, totalValue: 0, lowStockCount: 0 },
        },
    });
});

// Stock movement report disabled - requires GoodsReceipt model
// export const getStockMovementReport = asyncHandler(async (req, res) => { ... });

// ============================================
// PURCHASE ORDER REPORTS
// ============================================

export const getOpenPurchaseOrdersReport = asyncHandler(async (req, res) => {
    const openPOs = await PurchaseOrder.find({
        status: { $in: ['Draft', 'Approved', 'PartiallyReceived'] },
    })
        .populate('vendorId', 'name')
        .populate('items.itemId', 'name sku')
        .sort({ createdAt: -1 })
        .lean();

    // Summary by status
    const byStatus = await PurchaseOrder.aggregate([
        {
            $match: {
                status: { $in: ['Draft', 'Approved', 'PartiallyReceived'] },
            },
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalValue: { $sum: '$totalAmountLocked' },
            },
        },
    ]);

    res.json({
        success: true,
        data: {
            orders: openPOs,
            byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s }), {}),
        },
    });
});

export const getPurchaseHistoryReport = asyncHandler(async (req, res) => {
    const { vendorId, dateFrom, dateTo, status } = req.query;

    const matchStage = {};
    if (vendorId) matchStage.vendorId = new mongoose.Types.ObjectId(vendorId);
    if (status) matchStage.status = status;
    if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
        if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
    }

    const history = await PurchaseOrder.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                },
                count: { $sum: 1 },
                totalValue: { $sum: '$totalAmountLocked' },
            },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);

    res.json({
        success: true,
        data: history,
    });
});

// ============================================
// PRODUCTION REPORTS
// ============================================

export const getProductionSummaryReport = asyncHandler(async (req, res) => {
    const { dateFrom, dateTo } = req.query;

    const matchStage = {};
    if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
        if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
    }

    // Production stats
    const productionStats = await BrickBatch.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalPlanned: { $sum: '$plannedQty' },
                totalProduced: { $sum: '$producedQty' },
                totalPassed: { $sum: '$qualityPassedQty' },
                totalRejected: { $sum: '$rejectedQty' },
                totalLabourCost: { $sum: '$totalLabourCost' },
                totalMaterialCost: { $sum: '$totalMaterialCost' },
            },
        },
    ]);

    // Quality breakdown
    const qualityBreakdown = await BrickBatch.aggregate([
        { $match: { ...matchStage, status: 'Completed' } },
        {
            $group: {
                _id: '$qualityGrade',
                count: { $sum: 1 },
                totalQty: { $sum: '$qualityPassedQty' },
            },
        },
    ]);

    res.json({
        success: true,
        data: {
            byStatus: productionStats,
            qualityBreakdown,
        },
    });
});

// Kiln utilization report disabled - requires Kiln model
// export const getKilnUtilizationReport = asyncHandler(async (req, res) => { ... });

// ============================================
// TRANSPORT REPORTS DISABLED
// ============================================
// Transport reports disabled - requires TransportTrip model

// ============================================
// VENDOR REPORTS
// ============================================

export const getVendorPerformanceReport = asyncHandler(async (req, res) => {
    const vendors = await Vendor.find({ active: true })
        .select('name rating totalOrders')
        .lean();

    // Get PO stats per vendor
    const vendorPOStats = await PurchaseOrder.aggregate([
        {
            $group: {
                _id: '$vendorId',
                totalPOs: { $sum: 1 },
                totalValue: { $sum: '$totalAmountLocked' },
                completedPOs: {
                    $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
                },
            },
        },
    ]);

    const statsMap = vendorPOStats.reduce((acc, s) => {
        acc[s._id?.toString()] = s;
        return acc;
    }, {});

    const result = vendors.map(vendor => ({
        ...vendor,
        poStats: statsMap[vendor._id.toString()] || {
            totalPOs: 0,
            totalValue: 0,
            completedPOs: 0,
        },
    }));

    res.json({
        success: true,
        data: result,
    });
});

export default {
    getDashboardKPIs,
    getDashboardOverview,
    getStockLevelsReport,
    getOpenPurchaseOrdersReport,
    getPurchaseHistoryReport,
    getProductionSummaryReport,
    getVendorPerformanceReport,
};
