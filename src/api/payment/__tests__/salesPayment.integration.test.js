/* eslint-env jest */
// Integration & unit tests for SalesPayment allocation -> SalesInvoice
// - integration tests are skipped by default (require a running MongoDB set in MONGO_URI)
// - a fast unit test validates model accepts transport fields without DB

import mongoose from 'mongoose';
import SalesPayment from '../salesPayment.model.js';
import SalesOrder from '../../sales/salesOrder.model.js';
import SalesInvoice from '../../sales/salesInvoice.model.js';
import Customer from '../../sales/customer.model.js';

describe('SalesPayment model (unit)', () => {
    test('accepts transport fields on validateSync', () => {
        const custId = new mongoose.Types.ObjectId();
        const soId = new mongoose.Types.ObjectId();

        const p = new SalesPayment({
            paymentNumber: 'SPAY-TEST-1',
            salesOrderId: soId,
            soNumber: 'SO-TEST-1',
            customerId: custId,
            customerName: 'Test Cust',
            paymentMethod: 'BANK_TRANSFER',
            amount: 1000,
            transportApplied: true,
            transportDetails: { vehicleType: 'Truck', vehicleNumber: 'TN01AA0001', transportCost: 500 },
        });

        const err = p.validateSync();
        expect(err).toBeUndefined();
    });
});

// Integration tests: requires MONGO_URI (skipped by default)
describe.skip('SalesPayment allocation (integration)', () => {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp_test';

    beforeAll(async () => {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        // clean up collections we will use
        await mongoose.model('SalesPayment').deleteMany({ paymentNumber: /SPAY-TEST/ });
        await mongoose.model('SalesInvoice').deleteMany({ invoiceNumber: /INV-TEST/ });
        await mongoose.model('SalesOrder').deleteMany({ soNumber: /SO-TEST/ });
        await mongoose.model('Customer').deleteMany({ customerCode: /CUST-TEST/ });
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    test('allocates payment to existing invoices (oldest first)', async () => {
        const customer = await Customer.create({ customerCode: 'CUST-TEST-1', name: 'ACME', contact: { phone: '9999999999' } });
        const so = await SalesOrder.create({
            soNumber: 'SO-TEST-ALLOC',
            customerId: customer._id,
            customerName: customer.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Item A', qty: 10, unit: 'piece', unitPrice: 100 }],
            subtotal: 1000,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            grandTotal: 1000,
            amountPaid: 0,
            balanceDue: 1000,
        });

        // Create two invoices (oldest first) with partial balances
        const inv1 = await SalesInvoice.create({
            invoiceNumber: 'INV-TEST-001',
            salesOrderId: so._id,
            soNumber: so.soNumber,
            customerId: customer._id,
            customerDetails: { name: customer.name },
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Item A', qty: 5, unit: 'piece', unitPrice: 100, totalAmount: 500 }],
            subtotal: 500,
            totalTaxAmount: 0,
            transportCost: 0,
            grandTotal: 500,
            amountPaid: 100,
            balanceDue: 400,
            status: 'Partially_Paid',
            createdBy: so.createdBy,
            invoiceDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // older
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        });

        const inv2 = await SalesInvoice.create({
            invoiceNumber: 'INV-TEST-002',
            salesOrderId: so._id,
            soNumber: so.soNumber,
            customerId: customer._id,
            customerDetails: { name: customer.name },
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Item A', qty: 5, unit: 'piece', unitPrice: 100, totalAmount: 500 }],
            subtotal: 500,
            totalTaxAmount: 0,
            transportCost: 0,
            grandTotal: 500,
            amountPaid: 0,
            balanceDue: 500,
            status: 'Issued',
            createdBy: so.createdBy,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        });

        // Create payment that should apply 300 to inv1 (making it 400->100) and 200 to inv2
        const payment = await SalesPayment.create({
            paymentNumber: 'SPAY-TEST-ALLOC-1',
            salesOrderId: so._id,
            soNumber: so.soNumber,
            customerId: customer._id,
            customerName: customer.name,
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'COMPLETED',
            amount: 500,
        });

        // reload invoices
        const r1 = await SalesInvoice.findById(inv1._id).lean();
        const r2 = await SalesInvoice.findById(inv2._id).lean();

        expect(r1.amountPaid).toBeCloseTo(400); // 100 + 300 applied
        expect(r1.balanceDue).toBeCloseTo(100);
        expect(r1.status === 'Partially_Paid' || r1.status === 'Partially_Paid').toBeTruthy();

        expect(r2.amountPaid).toBeCloseTo(100); // 0 + 100 applied
        expect(r2.balanceDue).toBeCloseTo(400);
        expect(r2.status === 'Partially_Paid' || r2.status === 'Partially_Paid').toBeTruthy();
    }, 20000);

    test('creates an invoice when none exist and applies payment', async () => {
        const customer = await Customer.create({ customerCode: 'CUST-TEST-2', name: 'Beta', contact: { phone: '8888888888' } });
        const so = await SalesOrder.create({
            soNumber: 'SO-TEST-CREATEINV',
            customerId: customer._id,
            customerName: customer.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Item B', qty: 2, unit: 'piece', unitPrice: 100 }],
            subtotal: 200,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            grandTotal: 200,
            amountPaid: 0,
            balanceDue: 200,
        });

        const payment = await SalesPayment.create({
            paymentNumber: 'SPAY-TEST-CREATEINV-1',
            salesOrderId: so._id,
            soNumber: so.soNumber,
            customerId: customer._id,
            customerName: customer.name,
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'COMPLETED',
            amount: 50,
        });

        const invoices = await SalesInvoice.find({ salesOrderId: so._id }).lean();
        expect(invoices.length).toBeGreaterThanOrEqual(1);

        const inv = invoices[0];
        expect(inv.amountPaid).toBeCloseTo(50);
        expect(inv.balanceDue).toBeCloseTo((inv.grandTotal || 0) - 50);
        expect(inv.status === 'Partially_Paid' || inv.status === 'Partially_Paid').toBeTruthy();
    }, 20000);

    test('payment transportDetails are included in sync-created invoice when order has no transport', async () => {
        const customer = await Customer.create({ customerCode: 'CUST-TEST-3', name: 'Gamma', contact: { phone: '7777777777' } });
        const so = await SalesOrder.create({
            soNumber: 'SO-TEST-TRANSPORT',
            customerId: customer._id,
            customerName: customer.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Item C', qty: 1, unit: 'piece', unitPrice: 85 }],
            subtotal: 85,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            grandTotal: 85,
            amountPaid: 0,
            balanceDue: 85,
        });

        // Payment includes transport (₹800) so invoice grand total should become 885
        const payment = await SalesPayment.create({
            paymentNumber: 'SPAY-TEST-TRANSPORT-1',
            salesOrderId: so._id,
            soNumber: so.soNumber,
            customerId: customer._id,
            customerName: customer.name,
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'COMPLETED',
            amount: 885,
            transportApplied: true,
            transportDetails: { vehicleType: 'Truck', vehicleNumber: 'TN01AA0002', transportCost: 800 },
        });

        const invoices = await SalesInvoice.find({ salesOrderId: so._id }).lean();
        expect(invoices.length).toBeGreaterThanOrEqual(1);

        const inv = invoices[0];
        expect(inv.transportCost || 0).toBeCloseTo(800);
        expect(inv.grandTotal).toBeCloseTo(885);
        expect(inv.amountPaid).toBeCloseTo(885);
        expect(inv.balanceDue).toBeCloseTo(0);
        expect(inv.status).toBe('Paid');
    }, 20000);

    test('sales order amountPaid/paymentStatus update after COMPLETED payment', async () => {
        const customer = await Customer.create({ customerCode: 'CUST-TEST-4', name: 'Delta', contact: { phone: '6666666666' } });
        const so = await SalesOrder.create({
            soNumber: 'SO-TEST-ORDERPAID',
            customerId: customer._id,
            customerName: customer.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Item D', qty: 1, unit: 'piece', unitPrice: 100 }],
            subtotal: 100,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            grandTotal: 100,
            amountPaid: 0,
            balanceDue: 100,
        });

        // Make a completed payment equal to order total
        const payment = await SalesPayment.create({
            paymentNumber: 'SPAY-TEST-ORDERPAID-1',
            salesOrderId: so._id,
            soNumber: so.soNumber,
            customerId: customer._id,
            customerName: customer.name,
            paymentMethod: 'BANK_TRANSFER',
            paymentStatus: 'COMPLETED',
            amount: 100,
        });

        // Reload order from DB
        const updatedSO = await SalesOrder.findById(so._id).lean();
        expect(updatedSO.amountPaid).toBeCloseTo(100);
        expect(updatedSO.balanceDue).toBeCloseTo(0);
        expect(updatedSO.paymentStatus).toBe('Paid');
    }, 20000);
});
