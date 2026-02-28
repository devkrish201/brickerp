/* eslint-env jest */
import mongoose from 'mongoose';
import SalesOrder from '../salesOrder.model.js';
import Customer from '../customer.model.js';

describe('SalesOrder model SO number generation', () => {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp_test';

    beforeAll(async () => {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await SalesOrder.deleteMany({ soNumber: /SO-TEST/ });
        await Customer.deleteMany({ customerCode: /CUST-TEST/ });
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    test('assigns unique SO numbers on create and ignores provided value', async () => {
        const cust = await Customer.create({ customerCode: 'CUST-TEST-001', name: 'Test Corp', contact: { phone: '9999999999' } });

        const so1 = await SalesOrder.create({
            customerId: cust._id,
            customerName: cust.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Stuff', qty: 1, unit: 'piece', unitPrice: 100 }],
            subtotal: 100,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            grandTotal: 100,
            amountPaid: 0,
            balanceDue: 100,
        });

        const so2 = await SalesOrder.create({
            customerId: cust._id,
            customerName: cust.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Stuff', qty: 2, unit: 'piece', unitPrice: 50 }],
            subtotal: 100,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            grandTotal: 100,
            amountPaid: 0,
            balanceDue: 100,
        });

        expect(so1.soNumber).toMatch(/^SO-\d{6}-\d{4}$/);
        expect(so2.soNumber).toMatch(/^SO-\d{6}-\d{4}$/);
        expect(so1.soNumber).not.toEqual(so2.soNumber);

        // try creating with custom (should be ignored)
        const so3 = new SalesOrder({
            soNumber: 'SHOULD-BE-IGNORED',
            customerId: cust._id,
            customerName: cust.name,
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), itemName: 'Stuff', qty: 1, unit: 'piece', unitPrice: 10 }],
            subtotal: 10,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            grandTotal: 10,
            amountPaid: 0,
            balanceDue: 10,
        });
        await so3.save();
        expect(so3.soNumber).not.toEqual('SHOULD-BE-IGNORED');
        expect(so3.soNumber).toMatch(/^SO-\d{6}-\d{4}$/);
    });
});
