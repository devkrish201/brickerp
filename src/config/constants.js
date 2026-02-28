/**
 * Business Constants for Brick Manufacturing ERP
 * All monetary values in RUPEES
 */

// Cost Types
export const COST_TYPES = {
    MATERIAL: 'Material',
    LABOUR: 'Labour',
    TRANSPORT: 'Transport',
    PRODUCT: 'Product',
    SERVICE: 'Service',
    EXPENSE: 'Expense',
};

// Units of Measurement
export const UNITS = {
    PIECE: 'piece',
    BAG: 'bag',
    TON: 'ton',
    KG: 'kg',
    CUBIC_METER: 'cubic_meter',
    CUBIC_FEET: 'cubic_feet',
    DAY: 'day',
    HOUR: 'hour',
    TRIP: 'trip',
    KM: 'km',
    SQFT: 'sqft',
    SQMT: 'sqmt',
    LITER: 'liter',
    THOUSAND: 'thousand',
    UNIT: 'unit',
};

// User Roles
export const ROLES = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    PROCUREMENT: 'Procurement',
    WAREHOUSE: 'Warehouse',
    PRODUCTION: 'Production',
    TRANSPORT: 'Transport',
    VENDOR: 'Vendor',
    WORKER: 'Worker',
};

// Estimate Status
export const ESTIMATE_STATUS = {
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    CONVERTED_TO_PO: 'ConvertedToPO',
    CANCELLED: 'Cancelled',
};

// Purchase Order Status
export const PO_STATUS = {
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    PARTIALLY_RECEIVED: 'PartiallyReceived',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};



// Brick Batch Status – simplified to three values
export const BATCH_STATUS = {
    DRAFT: 'Draft',
    PENDING: 'Pending',
    COMPLETED: 'Completed',
};



// Vehicle Types
export const VEHICLE_TYPES = {
    SMALL: 'Small',
    LARGE: 'Large',
    MEDIUM: 'Medium',
    CUSTOM: 'Custom',
};

// Transport Status
export const TRIP_STATUS = {
    SCHEDULED: 'Scheduled',
    IN_TRANSIT: 'InTransit',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
};

// Work Completion Status
export const WORK_STATUS = {
    NOT_STARTED: 'NotStarted',
    IN_PROGRESS: 'InProgress',
    COMPLETED: 'Completed',
    VERIFIED: 'Verified',
};

// Default Business Values (in rupees)
export const DEFAULTS = {
    LABOUR_RATE_PER_DAY: 400, // ₹400
    BRICKS_PER_VEHICLE: 2000,
    BRICK_COST_PER_1000: 550, // ₹550

    // Transport cost tiers based on distance
    TRANSPORT_COST_TIERS: [
        { maxKm: 10, cost: 700 },    // ₹700 for 0-10 km
        { maxKm: 25, cost: 1000 },   // ₹1000 for 11-25 km
        { maxKm: 50, cost: 1200 },   // ₹1200 for 26-50 km
        { maxKm: 100, cost: 1500 },  // ₹1500 for 51-100 km
        { maxKm: Infinity, cost: 2000 }, // ₹2000 for 100+ km
    ],



    // Standard brick sizes (inches)
    BRICK_SIZES: {
        STANDARD: { length: 9, width: 4.5, height: 3 },
        LARGE: { length: 12, width: 6, height: 4 },
    },
};

// Currency
export const CURRENCY = {
    CODE: 'INR',
    SYMBOL: '₹',
    DECIMAL_PLACES: 2,

};

// Pagination
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};
