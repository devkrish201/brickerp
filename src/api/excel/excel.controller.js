import mongoose from 'mongoose';
import {
    readExcel,
    exportToExcel,
    validateImportData,
    IMPORT_TEMPLATES,
} from '../../utils/excelService.js';
import { asyncHandler, ApiError } from '../../middleware/error.js';

// Import models
import Item from '../catalog/item.model.js';
import Vendor from '../procurement/vendor.model.js';
import Stock from '../inventory/stock.model.js';
import PurchaseOrder from '../procurement/po.model.js';
import BrickBatch from '../manufacturing/batch.model.js';
// import TransportTrip from '../logistics/trip.model.js'; // Not available

// ============================================
// IMPORT TEMPLATES
// ============================================

export const getImportTemplates = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: Object.keys(IMPORT_TEMPLATES).map(key => ({
            type: key,
            columns: IMPORT_TEMPLATES[key],
            description: getTemplateDescription(key),
        })),
    });
});

function getTemplateDescription(type) {
    const descriptions = {
        items: 'Import catalog items (Materials, Labour, Products)',
        vendors: 'Import vendor/supplier information',
        stock: 'Import initial stock quantities',
    };
    return descriptions[type] || '';
}

export const downloadImportTemplate = asyncHandler(async (req, res) => {
    const { type } = req.params;

    const template = IMPORT_TEMPLATES[type];
    if (!template) {
        throw new ApiError(400, `Unknown template type: ${type}`);
    }

    // Create sample data based on template
    const sampleData = [createSampleRow(type, template)];

    const buffer = exportToExcel(sampleData, template);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_template.xlsx`);
    res.send(buffer);
});

function createSampleRow(type, template) {
    const sampleValues = {
        // Items
        name: 'Sample Item Name',
        sku: 'ITEM-001',
        costType: 'Material',
        defaultUnit: 'piece',
        defaultUnitPrice: 10000, // In rupees
        categoryName: 'Raw Materials',
        description: 'Sample description',
        hsnCode: '25232900',
        taxRate: 18,

        // Vendors
        email: 'vendor@example.com',
        phone: '9876543210',
        gstNumber: '22AAAAA0000A1Z5',
        address: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        paymentTermDays: 30,

        // Stock
        warehouseName: 'Main Warehouse',
        quantity: 100,
        unit: 'piece',
        reorderLevel: 20,
        batchNumber: 'BATCH-001',
    };

    const row = {};
    template.forEach(col => {
        row[col] = sampleValues[col] || '';
    });
    return row;
}

// ============================================
// IMPORT DATA
// ============================================

export const importItems = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'Excel file is required');
    }

    const data = readExcel(req.file.buffer);
    const { valid, errors } = validateImportData(data, 'items');

    if (!valid) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors in import file',
            errors,
        });
    }

    const results = {
        success: 0,
        failed: 0,
        errors: [],
    };

    for (const row of data) {
        try {
            await Item.create({
                name: row.name,
                sku: row.sku,
                costType: row.costType,
                units: [{ unit: row.defaultUnit, conversionFactor: 1, isDefault: true }],
                defaultUnitPrice: row.defaultUnitPrice,
                description: row.description,
                hsnCode: row.hsnCode,
                taxRate: row.taxRate,
                createdBy: req.user._id,
                _auditUser: req.user._id,
            });
            results.success++;
        } catch (err) {
            results.failed++;
            results.errors.push({
                row: row.name || row.sku,
                error: err.message,
            });
        }
    }

    res.json({
        success: true,
        message: `Import completed. ${results.success} items imported, ${results.failed} failed.`,
        data: results,
    });
});

export const importVendors = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'Excel file is required');
    }

    const data = readExcel(req.file.buffer);
    const { valid, errors } = validateImportData(data, 'vendors');

    if (!valid) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors in import file',
            errors,
        });
    }

    const results = {
        success: 0,
        failed: 0,
        errors: [],
    };

    for (const row of data) {
        try {
            await Vendor.create({
                name: row.name,
                email: row.email,
                phone: row.phone,
                gstNumber: row.gstNumber,
                address: {
                    street: row.address,
                    city: row.city,
                    state: row.state,
                    pincode: row.pincode,
                },
                paymentTermDays: row.paymentTermDays || 30,
                createdBy: req.user._id,
                _auditUser: req.user._id,
            });
            results.success++;
        } catch (err) {
            results.failed++;
            results.errors.push({
                row: row.name,
                error: err.message,
            });
        }
    }

    res.json({
        success: true,
        message: `Import completed. ${results.success} vendors imported, ${results.failed} failed.`,
        data: results,
    });
});

// ============================================
// EXPORT DATA
// ============================================

export const exportItems = asyncHandler(async (req, res) => {
    const { categoryId, costType } = req.query;

    const filter = { active: true };
    if (categoryId) filter.categoryId = categoryId;
    if (costType) filter.costType = costType;

    const items = await Item.find(filter)
        .populate('categoryId', 'name')
        .lean();

    const exportData = items.map(item => ({
        name: item.name,
        sku: item.sku,
        costType: item.costType,
        defaultUnit: item.units?.[0]?.unit || '',
        defaultUnitPrice: item.defaultUnitPrice,
        categoryName: item.categoryId?.name || '',
        description: item.description,
        hsnCode: item.hsnCode,
        taxRate: item.taxRate,
    }));

    const columns = [
        'name', 'sku', 'costType', 'defaultUnit', 'defaultUnitPrice',
        'categoryName', 'description', 'hsnCode', 'taxRate',
    ];

    const buffer = exportToExcel(exportData, columns);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=items_export.xlsx');
    res.send(buffer);
});

export const exportVendors = asyncHandler(async (req, res) => {
    const vendors = await Vendor.find({ active: true }).lean();

    const exportData = vendors.map(v => ({
        name: v.name,
        email: v.email,
        phone: v.phone,
        gstNumber: v.gstNumber,
        address: v.address?.street || '',
        city: v.address?.city || '',
        state: v.address?.state || '',
        pincode: v.address?.pincode || '',
        paymentTermDays: v.paymentTermDays,
        rating: v.rating,
        totalOrders: v.totalOrders,
    }));

    const columns = [
        'name', 'email', 'phone', 'gstNumber', 'address',
        'city', 'state', 'pincode', 'paymentTermDays', 'rating', 'totalOrders',
    ];

    const buffer = exportToExcel(exportData, columns);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=vendors_export.xlsx');
    res.send(buffer);
});

export const exportStock = asyncHandler(async (req, res) => {
    const { warehouseId, isLowStock } = req.query;

    const filter = {};
    if (warehouseId) filter.warehouseId = warehouseId;
    if (isLowStock === 'true') filter.isLowStock = true;

    const stocks = await Stock.find(filter)
        .populate('itemId', 'name sku')
        .populate('warehouseId', 'name')
        .lean();

    const exportData = stocks.map(s => ({
        itemName: s.itemId?.name || '',
        itemSku: s.itemId?.sku || '',
        warehouseName: s.warehouseId?.name || '',
        quantity: s.quantity,
        reservedQty: s.reservedQty,
        availableQty: s.availableQty,
        unit: s.unit,
        reorderLevel: s.reorderLevel,
        isLowStock: s.isLowStock ? 'Yes' : 'No',
        totalValuePaise: s.totalValue,
    }));

    const columns = [
        'itemName', 'itemSku', 'warehouseName', 'quantity', 'reservedQty',
        'availableQty', 'unit', 'reorderLevel', 'isLowStock', 'totalValuePaise',
    ];

    const buffer = exportToExcel(exportData, columns);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_export.xlsx');
    res.send(buffer);
});

export const exportPurchaseOrders = asyncHandler(async (req, res) => {
    const { status, vendorId, dateFrom, dateTo } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (vendorId) filter.vendorId = vendorId;
    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const orders = await PurchaseOrder.find(filter)
        .populate('vendorId', 'name')
        .lean();

    const exportData = orders.map(po => ({
        poNumber: po.poNumber,
        vendorName: po.vendorId?.name || '',
        status: po.status,
        totalItems: po.items?.length || 0,
        totalAmountPaise: po.totalAmountLocked,
        createdAt: po.createdAt?.toISOString().split('T')[0],
        expectedDelivery: po.expectedDeliveryDate?.toISOString().split('T')[0] || '',
    }));

    const columns = [
        'poNumber', 'vendorName', 'status', 'totalItems',
        'totalAmountPaise', 'createdAt', 'expectedDelivery',
    ];

    const buffer = exportToExcel(exportData, columns);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=purchase_orders_export.xlsx');
    res.send(buffer);
});

export const exportProductionBatches = asyncHandler(async (req, res) => {
    const { status, kilnId, dateFrom, dateTo } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (kilnId) filter.kilnId = kilnId;
    if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const batches = await BrickBatch.find(filter)
        .populate('itemId', 'name')
        .populate('kilnId', 'name code')
        .lean();

    const exportData = batches.map(b => ({
        batchCode: b.batchCode,
        itemName: b.itemId?.name || '',
        kilnName: b.kilnId?.name || '',
        status: b.status,
        plannedQty: b.plannedQty,
        producedQty: b.producedQty,
        qualityPassedQty: b.qualityPassedQty,
        rejectedQty: b.rejectedQty,
        totalLabourCostPaise: b.totalLabourCost,
        totalMaterialCostPaise: b.totalMaterialCost,
        startDate: b.startDate?.toISOString().split('T')[0] || '',
        endDate: b.endDate?.toISOString().split('T')[0] || '',
    }));

    const columns = [
        'batchCode', 'itemName', 'kilnName', 'status', 'plannedQty',
        'producedQty', 'qualityPassedQty', 'rejectedQty',
        'totalLabourCostPaise', 'totalMaterialCostPaise', 'startDate', 'endDate',
    ];

    const buffer = exportToExcel(exportData, columns);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=production_batches_export.xlsx');
    res.send(buffer);
});

// Transport trips export disabled - requires TransportTrip model

export default {
    getImportTemplates,
    downloadImportTemplate,
    importItems,
    importVendors,
    exportItems,
    exportVendors,
    exportStock,
    exportPurchaseOrders,
    exportProductionBatches,
};
