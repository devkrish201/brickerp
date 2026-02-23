import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { ROLES } from '../config/constants.js';

// Import models
import User from '../api/iam/user.model.js';
import Item from '../api/catalog/item.model.js';
import Category from '../api/catalog/category.model.js';
import Tag from '../api/catalog/tag.model.js';
import Vendor from '../api/procurement/vendor.model.js';
import PurchaseOrder from '../api/procurement/po.model.js';
import Estimate from '../api/procurement/estimate.model.js';
import Customer from '../api/sales/customer.model.js';
import Stock from '../api/inventory/stock.model.js';
import BrickBatch from '../api/manufacturing/batch.model.js';
import SalesOrder from '../api/sales/salesOrder.model.js';
import SalesPayment from '../api/payment/salesPayment.model.js';
import CustomerPayment from '../api/finance/customerPayment.model.js';
import PurchasePayment from '../api/payment/purchasePayment.model.js';
import LabourPayment from '../api/payment/labourPayment.model.js';
import ExpensePayment from '../api/payment/expencePayment.model.js';
import TransportPayment from '../api/payment/tranportPayment.model.js';

dotenv.config();

const seedDatabase = async () => {
    try {
        // Connect to MongoDB using shared helper (retries, logging, etc.)
        console.log('👉 seeder: establishing database connection');
        await connectDB();
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        console.log('🧹 Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Item.deleteMany({}),
            Category.deleteMany({}),
            Tag.deleteMany({}),
            Vendor.deleteMany({}),
            Customer.deleteMany({}),
            Stock.deleteMany({}),
            PurchaseOrder.deleteMany({}),
            Estimate.deleteMany({}),
            BrickBatch.deleteMany({}),
            SalesOrder.deleteMany({}),
            SalesPayment.deleteMany({}),
            CustomerPayment.deleteMany({}),
            PurchasePayment.deleteMany({}),
            LabourPayment.deleteMany({}),
            ExpensePayment.deleteMany({}),
            TransportPayment.deleteMany({}),
        ]);
        console.log('✅ Data cleared');

        // ========== CREATE USERS ==========
        console.log('👥 Creating users...');
        // Because the User schema requires passwordHash and hashes it in a pre-save
        // hook, we provide the raw password under passwordHash. The model will
        // hash it automatically before saving.
        const users = await User.create([
            {
                name: 'Admin User',
                email: 'admin@brickerp.com',
                passwordHash: 'Admin@123456456',
                roles: [ROLES.ADMIN],
                phone: '9876543210',
                status: 'ACTIVE',
            },
            {
                name: 'Production Manager',
                email: 'manager@brickerp.com',
                passwordHash: 'Manager@123456',
                roles: [ROLES.MANAGER],
                phone: '9876543211',
                status: 'ACTIVE',
            },
            {
                name: 'Finance Officer',
                email: 'finance@brickerp.com',
                passwordHash: 'Finance@123456',
                roles: [ROLES.OFFICER],
                phone: '9876543212',
                status: 'ACTIVE',
            },
        ]);
        console.log(`✅ Created ${users.length} users`);

        // ========== CREATE CATEGORIES ==========
        console.log('📂 Creating categories...');
        const categories = await Category.create([
            { name: 'Red Bricks', description: 'Traditional red clay bricks', code: 'CAT-RB' },
            { name: 'White Bricks', description: 'White/fly ash bricks', code: 'CAT-WB' },
            { name: 'Interlocking Bricks', description: 'Interlocking paver bricks', code: 'CAT-IB' },
        ]);
        console.log(`✅ Created ${categories.length} categories`);

        // ========== CREATE ITEMS ==========
        console.log('📦 Creating items...');
        const items = await Item.create([
            {
                name: 'Standard Red Brick',
                sku: 'BRICK-RED-STD',
                code: 'ITEM-RB-001',
                categoryId: categories[0]._id,
                description: 'Standard 9x4.5x4 inch red brick',
                unit: 'PCS',
                defaultUnitPrice: 5.50,
                costType: 'Material',
                reorderLevel: 1000,
            },
            {
                name: 'White Fly Ash Brick',
                sku: 'BRICK-FLYASH',
                code: 'ITEM-WB-001',
                categoryId: categories[1]._id,
                description: 'White fly ash brick',
                unit: 'PCS',
                defaultUnitPrice: 6.50,
                costType: 'Material',
                reorderLevel: 800,
            },
            {
                name: 'Interlocking Paver',
                sku: 'BRICK-PAVER-INT',
                code: 'ITEM-IP-001',
                categoryId: categories[2]._id,
                description: 'Interlocking paver brick 200x100x60mm',
                unit: 'PCS',
                defaultUnitPrice: 8.00,
                costType: 'Material',
                reorderLevel: 500,
            },
        ]);
        console.log(`✅ Created ${items.length} items`);

        // ========== CREATE VENDORS ==========
        console.log('🏭 Creating vendors...');
        const vendors = await Vendor.create([
            {
                name: 'ABC Suppliers',
                code: 'VEND-001',
                contact: {
                    contactPerson: 'John Smith',
                    email: 'contact@abcsuppliers.com',
                    phone: '9876543220',
                },
                address: {
                    city: 'Delhi',
                    state: 'Delhi',
                    country: 'India',
                },
                paymentTerms: 'Net30',
                creditLimit: 500000,
            },
            {
                name: 'XYZ Logistics',
                code: 'VEND-002',
                contact: {
                    contactPerson: 'Mike Johnson',
                    email: 'info@xyzlogistics.com',
                    phone: '9876543221',
                },
                address: {
                    city: 'Bangalore',
                    state: 'Karnataka',
                    country: 'India',
                },
                paymentTerms: 'Net15',
                creditLimit: 300000,
            },
        ]);
        console.log(`✅ Created ${vendors.length} vendors`);

        // ========== CREATE CUSTOMERS ==========
        console.log('👔 Creating customers...');
        const customers = await Customer.create([
            {
                customerCode: 'CUST-001',
                name: 'BuildCorp Ltd',
                contact: {
                    phone: '9876543230',
                    contactPerson: 'Alice Brown',
                    email: 'alice@buildcorp.com',
                },
                address: {
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    country: 'India',
                },
                creditLimit: 1000000,
                paymentTerms: { creditDays: 30 },
            },
            {
                customerCode: 'CUST-002',
                name: 'ConstructCo',
                contact: {
                    phone: '9876543231',
                    contactPerson: 'Bob Davis',
                    email: 'bob@constructco.com',
                },
                address: {
                    city: 'Bangalore',
                    state: 'Karnataka',
                    country: 'India',
                },
                creditLimit: 800000,
                paymentTerms: { creditDays: 45 },
            },
        ]);
        console.log(`✅ Created ${customers.length} customers`);

        // ========== CREATE STOCK ==========
        // Skipped: Warehouse model is not available in this build, so stock
        // entries cannot be created.  Inventory operations will still work with
        // manual stock creation via API if a warehouse record is later added.
        console.log('📊 Skipping stock seed (warehouse model unavailable)');

        // ========== CREATE ESTIMATES ==========
        console.log('📋 Creating estimates...');
        const estimates = await Estimate.create([
            {
                estimateNumber: 'EST-001',
                clientName: 'ABC Construction',
                clientContact: {
                    phone: '9876543299',
                    email: 'abc@construction.com',
                },
                projectName: 'New Warehouse',
                projectDescription: 'Estimate for warehouse construction',
                vendorId: vendors[0]._id,
                vendorName: vendors[0].name,
                estimateDate: new Date(),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                items: [
                    {
                        itemId: items[0]._id,
                        description: items[0].name,
                        qty: 1000,
                        unit: 'piece',
                        unitPrice: 5.50,
                    },
                ],
                estimateStatus: 'APPROVED',
                createdBy: users[0]._id,
            },
        ]);
        console.log(`✅ Created ${estimates.length} estimates`);

        // ========== CREATE PURCHASE ORDERS ==========
        console.log('🛒 Creating purchase orders...');
        const purchaseOrders = await PurchaseOrder.create([
            {
                poNumber: 'PO-001',
                vendorId: vendors[0]._id,
                vendorName: vendors[0].name,
                poDate: new Date(),
                deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                items: [
                    {
                        itemId: items[0]._id,
                        itemName: items[0].name,
                        qty: 2000,
                        unit: 'piece',
                        unitPrice: 5.50,
                        unitPriceLocked: true,
                        discountPercent: 5,
                        taxPercent: 18,
                    },
                    {
                        itemId: items[1]._id,
                        itemName: items[1].name,
                        qty: 1500,
                        unit: 'piece',
                        unitPrice: 6.50,
                        unitPriceLocked: true,
                        discountPercent: 3,
                        taxPercent: 18,
                    },
                ],
                poStatus: 'CONFIRMED',
                createdBy: users[0]._id,
            },
        ]);
        console.log(`✅ Created ${purchaseOrders.length} purchase orders`);

        // ========== CREATE BRICK BATCHES ==========
        console.log('🧱 Creating brick batches...');
        const batches = await BrickBatch.create([
            {
                batchCode: 'BB-20260220-001',
                batchNumber: 'BATCH-001',
                itemId: items[0]._id,
                itemName: items[0].name,
                plannedQty: 10000,
                startDate: new Date(),
                plannedEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                status: 'Pending',
                createdBy: users[0]._id,
            },
            {
                batchCode: 'BB-20260220-002',
                batchNumber: 'BATCH-002',
                itemId: items[1]._id,
                itemName: items[1].name,
                plannedQty: 5000,
                startDate: new Date(),
                plannedEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                status: 'Draft',
                createdBy: users[0]._id,
            },
        ]);
        console.log(`✅ Created ${batches.length} brick batches`);

        // ========== CREATE SALES ORDERS ==========
        console.log('📦 Creating sales orders...');
        const salesOrders = await SalesOrder.create([
            {
                soNumber: 'SO-001',
                customerId: customers[0]._id,
                customerName: customers[0].name,
                soDate: new Date(),
                deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                items: [
                    {
                        itemId: items[0]._id,
                        itemName: items[0].name,
                        qty: 1000,
                        unit: 'piece',
                        unitPrice: 6.00,
                        discountPercent: 2,
                        taxPercent: 18,
                    },
                    {
                        itemId: items[1]._id,
                        itemName: items[1].name,
                        qty: 800,
                        unit: 'piece',
                        unitPrice: 7.00,
                        discountPercent: 0,
                        taxPercent: 18,
                    },
                ],
                soStatus: 'CONFIRMED',
                createdBy: users[0]._id,
            },
        ]);
        console.log(`✅ Created ${salesOrders.length} sales orders`);

        // ========== CREATE PURCHASE PAYMENTS ==========
        console.log('💳 Creating purchase payments...');
        const purchasePayments = await PurchasePayment.create([
            {
                paymentNumber: 'PP-001',
                purchaseOrderId: purchaseOrders[0]._id,
                poNumber: purchaseOrders[0].poNumber,
                vendorId: vendors[0]._id,
                vendorName: vendors[0].name,
                paymentDate: new Date(),
                paymentMethod: 'BANK_TRANSFER',
                paymentStatus: 'COMPLETED',
                amount: 25000,
                description: 'Payment for PO-001',
                createdBy: users[2]._id,
            },
        ]);
        console.log(`✅ Created ${purchasePayments.length} purchase payments`);

        // ========== CREATE SALES PAYMENTS ==========
        console.log('💰 Creating sales payments...');
        const salesPayments = await SalesPayment.create([
            {
                paymentNumber: 'SP-001',
                salesOrderId: salesOrders[0]._id,
                soNumber: salesOrders[0].soNumber,
                customerId: customers[0]._id,
                customerName: customers[0].name,
                paymentDate: new Date(),
                paymentMethod: 'CHEQUE',
                paymentStatus: 'PENDING',
                amount: 15000,
                deliveredItems: [
                    // deliver 5 units of first item (example)
                    { itemId: salesOrders[0].items[0]._id, quantity: 5 }
                ],
                chequeNumber: 'CHQ-123456',
                chequeDate: new Date(),
                bankName: 'State Bank of India',
                chequeStatus: 'NOT_CLEARED',
                createdBy: users[2]._id,
            },
        ]);
        console.log(`✅ Created ${salesPayments.length} sales payments`);

        // ========== CREATE CUSTOMER PAYMENTS ==========
        console.log('💵 Creating customer payments...');
        const customerPayments = await CustomerPayment.create([
            {
                paymentNumber: 'CP-001',
                customerId: customers[0]._id,
                customerName: customers[0].name,
                paymentDate: new Date(),
                paymentMethod: 'CASH',
                paymentStatus: 'COMPLETED',
                amount: 50000,
                invoiceNumber: 'INV-123',
                reference: 'Payment for invoice',
                createdBy: users[2]._id,
                receivedBy: users[2]._id,
            },
        ]);
        console.log(`✅ Created ${customerPayments.length} customer payments`);

        // ========== CREATE LABOUR PAYMENTS ==========
        console.log('👷 Creating labour payments...');
        const labourPayments = await LabourPayment.create([
            {
                paymentNumber: 'LP-001',
                batchId: batches[0]._id,
                batchNumber: batches[0].batchNumber,
                labourerId: users[0]._id,
                labourerName: 'Ram Kumar',
                labourerPhone: '9876543240',
                labourerAddress: 'Village, District',
                paymentDate: new Date(),
                paymentMethod: 'CASH',
                paymentStatus: 'COMPLETED',
                amount: 5000,
                workType: 'PRODUCTION',
                workHours: 40,
                ratePerHour: 125,
                createdBy: users[0]._id,
            },
            {
                paymentNumber: 'LP-002',
                batchId: batches[0]._id,
                batchNumber: batches[0].batchNumber,
                labourerId: users[0]._id,
                labourerName: 'Shyam Singh',
                labourerPhone: '9876543241',
                labourerAddress: 'Village, District',
                paymentDate: new Date(),
                paymentMethod: 'CASH',
                paymentStatus: 'COMPLETED',
                amount: 4500,
                workType: 'LOADING',
                workHours: 36,
                ratePerHour: 125,
                createdBy: users[0]._id,
            },
        ]);
        console.log(`✅ Created ${labourPayments.length} labour payments`);

        // ========== CREATE EXPENSE PAYMENTS ==========
        console.log('📉 Creating expense payments...');
        const expensePayments = await ExpensePayment.create([
            {
                paymentNumber: 'EP-001',
                expenseType: 'UTILITIES',
                expenseCategory: 'Electricity',
                payeeName: 'State Electricity Board',
                paymentDate: new Date(),
                paymentMethod: 'BANK_TRANSFER',
                paymentStatus: 'COMPLETED',
                amount: 25000,
                gstApplicable: true,
                gstPercentage: 18,
                grossAmount: 29500,
                description: 'Monthly electricity bill',
                createdBy: users[2]._id,
            },
            {
                paymentNumber: 'EP-002',
                expenseType: 'MAINTENANCE',
                expenseCategory: 'Equipment Repair',
                payeeName: 'ABC Repairs',
                paymentDate: new Date(),
                paymentMethod: 'CHEQUE',
                paymentStatus: 'PENDING',
                amount: 10000,
                gstApplicable: true,
                gstPercentage: 18,
                grossAmount: 11800,
                chequeNumber: 'CHQ-654321',
                chequeDate: new Date(),
                bankName: 'HDFC Bank',
                chequeStatus: 'NOT_CLEARED',
                description: 'Equipment maintenance',
                createdBy: users[2]._id,
            },
        ]);
        console.log(`✅ Created ${expensePayments.length} expense payments`);

        // ========== CREATE TRANSPORT PAYMENTS ==========
        console.log('🚚 Creating transport payments...');
        const transportPayments = await TransportPayment.create([
            {
                paymentNumber: 'TP-001',
                salesOrderId: salesOrders[0]._id,
                soNumber: salesOrders[0].soNumber,
                transportProviderId: vendors[1]._id,
                providerName: vendors[1].name,
                providerPhone: vendors[1].phone,
                shipmentDetails: {
                    origin: 'Factory, Delhi',
                    destination: 'Mumbai',
                    distance: 1400,
                    unit: 'KM',
                },
                vehicleNumber: 'DL-01-AB-1234',
                vehicleType: 'TRUCK',
                driverName: 'Rajesh Kumar',
                driverPhone: '9876543250',
                shipmentDate: new Date(),
                deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                trackingNumber: 'TRACK-123456789',
                paymentDate: new Date(),
                paymentMethod: 'BANK_TRANSFER',
                paymentStatus: 'COMPLETED',
                baseAmount: 15000,
                additionalCharges: 2000,
                tax: 3060,
                totalAmount: 20060,
                createdBy: users[0]._id,
            },
        ]);
        console.log(`✅ Created ${transportPayments.length} transport payments`);

        console.log('\n✅ ✅ ✅ SEED DATA CREATED SUCCESSFULLY ✅ ✅ ✅\n');
        console.log('📊 Summary:');
        console.log(`   - Users: ${users.length}`);
        console.log(`   - Categories: ${categories.length}`);
        console.log(`   - Items: ${items.length}`);
        console.log(`   - Vendors: ${vendors.length}`);
        console.log(`   - Customers: ${customers.length}`);
        // stock entries skipped
        console.log(`   - Estimates: ${estimates.length}`);
        console.log(`   - Purchase Orders: ${purchaseOrders.length}`);
        console.log(`   - Brick Batches: ${batches.length}`);
        console.log(`   - Sales Orders: ${salesOrders.length}`);
        console.log(`   - Purchase Payments: ${purchasePayments.length}`);
        console.log(`   - Sales Payments: ${salesPayments.length}`);
        console.log(`   - Customer Payments: ${customerPayments.length}`);
        console.log(`   - Labour Payments: ${labourPayments.length}`);
        console.log(`   - Expense Payments: ${expensePayments.length}`);
        console.log(`   - Transport Payments: ${transportPayments.length}`);
        console.log('\n🎉 Database seeded! You can now login with:');
        console.log('   Email: admin@brickerp.com');
        console.log('   Password: Admin@123456456\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error.message || error);
        console.error('🛑 Ensure MongoDB is running and MONGO_URI is correct.');
        process.exit(1);
    }
};

seedDatabase();
