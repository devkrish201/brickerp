/**
 * Business Rules - Calculators
 * Contains all calculation logic for the ERP system
 */

/**
 * Calculate total price for a line item
 */
export const calculateLineItemTotal = (quantity, unitPrice, discountPercent = 0) => {
    const subtotal = quantity * unitPrice;
    const discountAmount = (subtotal * discountPercent) / 100;
    return subtotal - discountAmount;
};

/**
 * Calculate labour cost
 */
export const calculateLabourCost = (labourHours, labourRatePerHour) => {
    return labourHours * labourRatePerHour;
};

/**
 * Calculate brick labour cost
 */
export const calculateBrickLabourCost = (quantity, costPerUnit) => {
    return quantity * costPerUnit;
};

/**
 * Calculate cement cost
 */
export const calculateCementCost = (quantity, unitPrice) => {
    return quantity * unitPrice;
};

/**
 * Calculate gypsum cost
 */
export const calculateGypsumCost = (quantity, unitPrice) => {
    return quantity * unitPrice;
};

/**
 * Calculate sand cost
 */
export const calculateSandCost = (quantity, unitPrice) => {
    return quantity * unitPrice;
};

/**
 * Calculate transport cost
 */
export const calculateTransportCost = (distance, ratePerKm) => {
    return distance * ratePerKm;
};

/**
 * Calculate kiln production time
 */
export const calculateKilnProductionTime = (quantity, capacityPerDay) => {
    return Math.ceil(quantity / capacityPerDay);
};

/**
 * Calculate complete estimate with all line items
 */
export const calculateCompleteEstimate = (lineItems = []) => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    lineItems.forEach(item => {
        const itemTotal = calculateLineItemTotal(
            item.quantity,
            item.unitPrice,
            item.discountPercent
        );
        subtotal += itemTotal;
        totalDiscount += (item.quantity * item.unitPrice * item.discountPercent) / 100;
        totalTax += (itemTotal * (item.taxPercent || 0)) / 100;
    });

    return {
        subtotal,
        totalDiscount,
        totalTax,
        total: subtotal + totalTax,
    };
};

/**
 * Calculate estimate total
 */
export const calculateEstimateTotal = (estimates = {}) => {
    return estimates.total || 0;
};

/**
 * Lock PO prices to prevent future changes
 */
export const lockPOPrices = (pricingData) => {
    return {
        ...pricingData,
        locked: true,
        lockedAt: new Date(),
    };
};

export default {
    calculateLineItemTotal,
    calculateLabourCost,
    calculateBrickLabourCost,
    calculateCementCost,
    calculateGypsumCost,
    calculateSandCost,
    calculateTransportCost,
    calculateKilnProductionTime,
    calculateCompleteEstimate,
    calculateEstimateTotal,
    lockPOPrices,
};
