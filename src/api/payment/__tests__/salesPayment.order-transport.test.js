import mongoose from 'mongoose';
import SalesPayment from '../salesPayment.model.js';
import SalesOrder from '../../sales/salesOrder.model.js';
import SalesInvoice from '../../sales/salesInvoice.model.js';
import Customer from '../../sales/customer.model.js';

/**
 * Integration test: ensure a COMPLETED payment that includes transport
 * updates the SalesOrder transportCost/grandTotal and the invoice created
 * has transport applied and payment is allocated correctly.
 */

describe('SalesPayment -> SalesOrder transport allocation (integration)', () => {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/erp-test';

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        }
        // cleanup test artifacts if any
        await SalesPayment.deleteMany({ paymentNumber: /SPAY-TEST-TRANSPORT/ });
        await SalesInvoice.deleteMany({ invoiceNumber: /INV-TEST-TRANSPORT/ });
        await SalesOrder.deleteMany({ soNumber: /SO-TEST-TRANSPORT/ });
        await mongoose.model('Customer').deleteMany({ customerCode: /CUST-TEST-TRANSPORT/ });
    });

    afterAll(async () => {
        await SalesPayment.deleteMany({ paymentNumber: /SPAY-TEST-TRANSPORT/ });
        await SalesInvoice.deleteMany({ invoiceNumber: /INV-TEST-TRANSPORT/ });
        await SalesOrder.deleteMany({ soNumber: /SO-TEST-TRANSPORT/ });
        await mongoose.model('Customer').deleteMany({ customerCode: /CUST-TEST-TRANSPORT/ });
        await mongoose.disconnect();
    });

    test('COMPLETED payment with transport updates SalesOrder and creates/applies invoice', async () => {
        const customer = await Customer.create({ customerCode: 'CUST-TEST-TRANSPORT-1', name: 'TransportCo', contact: { phone: '9999999999' } });

        // Sales order without transport
        const so = await SalesOrder.create({
            soNumber: 'SO-TEST-TRANSPORT-1',
            customerId: customer._id,
            customerName: customer.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Prod T', qty: 10, unit: 'piece', unitPrice: 800 }],
            subtotal: 8000,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            transportCost: 0,
            grandTotal: 8000,
            amountPaid: 0,
            balanceDue: 8000,
        });

        // Payment includes transport ₹500
        const transportCost = 500;
        const paymentAmount = so.grandTotal + transportCost; // customer pays order + transport

        const payment = await SalesPayment.create({
            paymentNumber: 'SPAY-TEST-TRANSPORT-1',
            salesOrderId: so._id,
            soNumber: so.soNumber,
            customerId: customer._id,
            customerName: customer.name,
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'COMPLETED',
            amount: paymentAmount,
            transportApplied: true,
            transportDetails: { vehicleType: 'Truck', vehicleNumber: 'TN-XX-0001', transportCost },
        });

        // Reload SalesOrder and invoices
        const updatedSO = await SalesOrder.findById(so._id).lean();
        const invoices = await SalesInvoice.find({ salesOrderId: so._id }).lean();

        // SalesOrder must reflect transport and totals
        expect(updatedSO.transportCost || 0).toBeCloseTo(transportCost);
        expect(updatedSO.grandTotal).toBeCloseTo(so.grandTotal + transportCost);
        expect(updatedSO.amountPaid).toBeCloseTo(paymentAmount);
        expect(updatedSO.balanceDue).toBeCloseTo(0);
        expect(['Paid', 'Overpaid']).toContain(updatedSO.paymentStatus);

        // Invoice should be created and show transport + payment applied
        expect(invoices.length).toBeGreaterThanOrEqual(1);
        const inv = invoices[0];
        expect(inv.transportCost || 0).toBeCloseTo(transportCost);
        expect(inv.grandTotal).toBeCloseTo(paymentAmount);
        expect(inv.amountPaid).toBeCloseTo(paymentAmount);
        expect(inv.balanceDue).toBeCloseTo(0);
        expect(inv.status).toBe('Paid');
    }, 20000);
});
