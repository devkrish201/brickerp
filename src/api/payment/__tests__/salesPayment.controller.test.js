import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import SalesPayment from '../salesPayment.model.js';
import * as salesPaymentController from '../salesPayment.controller.js';
import SalesOrder from '../../sales/salesOrder.model.js';
import Customer from '../../sales/customer.model.js';

describe('salesPayment.controller (unit) - sync invoice creation', () => {
    let originalMongooseModel;
    beforeAll(() => {
        // keep original to restore later
        originalMongooseModel = mongoose.model;
    });

    afterAll(() => {
        mongoose.model = originalMongooseModel;
    });

    test('createSalesPayment should create invoice including transport when payment covers order + transport', async () => {
        const soId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        const fakeSO = {
            _id: soId,
            soNumber: 'SO-TRANSPORT-1',
            customerId: new mongoose.Types.ObjectId(),
            customerName: 'TransportCustomer',
            items: [{ _id: new mongoose.Types.ObjectId(), qty: 1, unit: 'piece', unitPrice: 8000, totalPrice: 8000 }],
            subtotal: 8000,
            totalDiscountAmount: 0,
            totalTaxAmount: 0,
            transportCost: 0,
            grandTotal: 8000,
            amountPaid: 0,
            balanceDue: 8000,
            createdBy: userId,
        };

        const fakeCustomer = { _id: fakeSO.customerId, name: 'TransportCustomer', contact: { phone: '9999999999' } };

        // SalesOrder.findById used for validation (return document) and controller later
        const soSpy = jest.spyOn(SalesOrder, 'findById')
            .mockImplementationOnce(() => Promise.resolve(fakeSO))
            .mockImplementation(() => ({ lean: () => Promise.resolve(fakeSO) }));

        jest.spyOn(Customer, 'findById').mockResolvedValue(fakeCustomer);

        // Mock SalesPayment save/populate
        jest.spyOn(SalesPayment.prototype, 'save').mockImplementationOnce(async function saveMock() { this._id = this._id || new mongoose.Types.ObjectId(); return this; });
        jest.spyOn(SalesPayment.prototype, 'populate').mockImplementation(async function populateMock() { return this; });

        // SalesInvoice mock: first find -> none, after save -> return created invoice
        let lastSavedInvoice = null;
        function SalesInvoiceMock(data) { Object.assign(this, data); this.save = async function () { this._id = this._id || new mongoose.Types.ObjectId(); this.invoiceNumber = this.invoiceNumber || 'INV-MOCK-TRANSPORT-1'; lastSavedInvoice = this; return this; }; }
        SalesInvoiceMock.find = jest.fn()
            .mockImplementationOnce(() => ({ sort: () => ({ lean: () => Promise.resolve([]) }) }))
            .mockImplementation(() => ({ sort: () => ({ lean: () => Promise.resolve(lastSavedInvoice ? [lastSavedInvoice] : []) }) }));

        mongoose.model = (name) => {
            if (name === 'SalesInvoice') return SalesInvoiceMock;
            if (name === 'SalesOrder') return SalesOrder;
            return originalMongooseModel(name);
        };

        const req = {
            body: {
                salesOrderId: soId.toString(),
                paymentDate: new Date().toISOString(),
                paymentMethod: 'BANK_TRANSFER',
                paymentStatus: 'COMPLETED',
                amount: 8500,
                transportApplied: true,
                transportDetails: { transportCost: 500, vehicleType: 'Truck' },
            },
            user: { _id: userId },
        };

        const res = { status: jest.fn((c) => res), json: jest.fn() };
        const next = jest.fn();

        await salesPaymentController.createSalesPayment(req, res, next);

        expect(next).not.toHaveBeenCalled();
        // verify controller created an invoice and included transportCost
        expect(SalesInvoiceMock.find).toHaveBeenCalled();
        expect(lastSavedInvoice).not.toBeNull();
        expect(lastSavedInvoice.transportCost || 0).toBeCloseTo(500);
        expect(lastSavedInvoice.grandTotal).toBeCloseTo(8500);
        // ensure payment application on the created invoice is not skipped
        // (controller will apply up to outstandingBefore; since transport was included,
        // remainingToApply should have been > 0 so invoice was created)
        const respArg = res.json.mock.calls[0][0];
        expect(respArg).toHaveProperty('relatedInvoices');
        expect(Array.isArray(respArg.relatedInvoices)).toBe(true);
        const returnedInv = respArg.relatedInvoices[0];
        expect(returnedInv.transportCost || 0).toBeCloseTo(500);
        expect(returnedInv.grandTotal).toBeCloseTo(8500);
    });
});
