/* eslint-env jest */
// Lightweight unit tests for PurchaseOrder model behavior
// - One synchronous unit test (no DB) to ensure controller-supplied poNumber is accepted
// - One integration test (skipped by default) that verifies model generates poNumber when saving without one

import mongoose from 'mongoose';
import PurchaseOrder from '../po.model.js';

describe('PurchaseOrder model (unit)', () => {
    test('validateSync accepts provided poNumber (no DB required)', () => {
        const po = new PurchaseOrder({
            poNumber: 'PO-TEST-0001',
            vendorId: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            items: [
                { itemId: new mongoose.Types.ObjectId(), qty: 1, unit: 'piece', unitPriceLocked: 100 },
            ],
        });

        const err = po.validateSync();
        expect(err).toBeUndefined();
    });
});

// Integration test: requires a running MongoDB instance (uses MONGO_URI env var)
// This test is skipped by default in CI/workspaces that don't have a DB available.
// To run locally: set MONGO_URI to your test mongo and run `npm test -- src/api/procurement/__tests__/po.model.test.js`

describe.skip('PurchaseOrder model (integration)', () => {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp_test';

    beforeAll(async () => {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await mongoose.model('PurchaseOrder').deleteMany({ poNumber: /PO-TEST/ });
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    test('creates PO without poNumber (model generates before validate/save)', async () => {
        const poData = {
            vendorId: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            items: [
                { itemId: new mongoose.Types.ObjectId(), qty: 2, unit: 'piece', unitPriceLocked: 100 },
            ],
        };

        const po = await PurchaseOrder.create(poData);
        expect(po).toBeDefined();
        expect(po.poNumber).toMatch(/^PO-\d{6}-\d{4}$/);
    }, 20000);

    // Concurrency check (skipped in CI; run locally to verify atomic counter prevents duplicates)
    test.skip('concurrent creates assign unique poNumber (no collisions)', async () => {
        const base = {
            vendorId: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            items: [{ itemId: new mongoose.Types.ObjectId(), qty: 1, unit: 'piece', unitPriceLocked: 10 }],
        };

        const [a, b] = await Promise.all([
            PurchaseOrder.create(base),
            PurchaseOrder.create(base),
        ]);

        expect(a.poNumber).not.toEqual(b.poNumber);
        expect(a.poNumber).toMatch(/^PO-\d{6}-\d{4}$/);
        expect(b.poNumber).toMatch(/^PO-\d{6}-\d{4}$/);
    }, 20000);
});
