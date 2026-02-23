import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Item from '../api/catalog/item.model.js';
import Category from '../api/catalog/category.model.js';

// simple seed for finished‑goods items

dotenv.config();

const items = [
    {
        name: 'Flyash Brick 8x4x4',
        sku: 'FG-FLY-8X4X4',
        description: 'Flyash brick sized 8x4x4 inches',
        costType: 'Product',
        units: ['piece'],
        defaultUnit: 'piece',
        defaultUnitPrice: 6.0,
        specifications: { size: '8x4x4' },
        isSellable: true,
        isPurchasable: false,
        categorySlug: 'finished-goods',
    },
    {
        name: 'Flyash Brick 9x4x3',
        sku: 'FG-FLY-9X4X3',
        description: 'Flyash brick sized 9x4x3 inches',
        costType: 'Product',
        units: ['piece'],
        defaultUnit: 'piece',
        defaultUnitPrice: 7.0,
        specifications: { size: '9x4x3' },
        isSellable: true,
        isPurchasable: false,
        categorySlug: 'finished-goods',
    },
    // labour item example
    {
        name: 'Skilled Labour (Mason)',
        sku: 'LAB-MASON-001',
        description: 'Skilled mason labour charge',
        costType: 'Labour',
        units: ['day'],
        defaultUnit: 'day',
        defaultUnitPrice: 300,  // per day rate
        specifications: {
            labourName: 'John Doe',
            labourNumber: '9876543210',
            labourAddress: '123 Worker Lane',
        },
        isSellable: true,
        isPurchasable: false,
        categorySlug: 'labour',
    },
    // transport item example
    {
        name: 'Truck Transport (Tata 407)',
        sku: 'TRANS-TRUCK-407',
        description: 'Tata 407 truck transport per trip',
        costType: 'Transport',
        units: ['trip'],
        defaultUnit: 'trip',
        defaultUnitPrice: 1500,
        specifications: {
            driverName: 'Ramesh Kumar',
            driverNumber: '9123456789',
            vehicleType: 'Tata 407',
            vehicleNumber: 'MH12AB1234',
        },
        isSellable: true,
        isPurchasable: false,
        categorySlug: 'transport',
    },
    // expense/service items
    {
        name: 'Petrol Expense',
        sku: 'EXP-PETROL',
        description: 'Petrol cost per litre',
        costType: 'Expense',
        units: ['liter'],
        defaultUnit: 'liter',
        defaultUnitPrice: 100,
        specifications: { type: 'Petrol' },
        isSellable: false,
        isPurchasable: true,
        categorySlug: 'service',
    },
    {
        name: 'Diesel Expense',
        sku: 'EXP-DIESEL',
        description: 'Diesel cost per litre',
        costType: 'Expense',
        units: ['liter'],
        defaultUnit: 'liter',
        defaultUnitPrice: 90,
        specifications: { type: 'Diesel' },
        isSellable: false,
        isPurchasable: true,
        categorySlug: 'service',
    },
    {
        name: 'Electricity Expense',
        sku: 'EXP-ELECTRICITY',
        description: 'Electricity cost per unit',
        costType: 'Expense',
        units: ['unit'],
        defaultUnit: 'unit',
        defaultUnitPrice: 10,
        specifications: { type: 'Electricity' },
        isSellable: false,
        isPurchasable: true,
        categorySlug: 'service',
    },
    // additional raw material items
    {
        name: 'Fly Ash (Raakh)',
        sku: 'RAW-ASH',
        costType: 'Material',
        units: ['ton'],
        defaultUnit: 'ton',
        defaultUnitPrice: 400, // Client Rate: 400/ton
        description: 'Gaadi: 21 Ton / 34 Ton',
        categorySlug: 'raw-material',
    },
    {
        name: 'Stone Dust (Bajari)',
        sku: 'RAW-DUST',
        costType: 'Material',
        units: ['ton'],
        defaultUnit: 'ton',
        defaultUnitPrice: 300, // Client Rate: 250-300/ton
        categorySlug: 'raw-material',
    },
    {
        name: 'Lime (Chuna)',
        sku: 'RAW-LIME',
        costType: 'Material',
        units: ['ton'],
        defaultUnit: 'ton',
        defaultUnitPrice: 7200, // Client Rate: 7200/ton
        categorySlug: 'raw-material',
    },
    {
        name: 'Gypsum',
        sku: 'RAW-GYP',
        costType: 'Material',
        units: ['ton'],
        defaultUnit: 'ton',
        defaultUnitPrice: 2500, // Client Rate: 2500/ton
        categorySlug: 'raw-material',
    },
    {
        name: 'Hardener Chemical',
        sku: 'RAW-CHEM',
        costType: 'Material',
        units: ['liter'],
        defaultUnit: 'liter',
        defaultUnitPrice: 45, // Approx (10k per 230L drum)
        categorySlug: 'raw-material',
    },
    {
        name: 'Coal (Koyla)',
        sku: 'RAW-COAL',
        costType: 'Material',
        units: ['ton'],
        defaultUnit: 'ton',
        defaultUnitPrice: 8000,
        categorySlug: 'raw-material',
    }
];

async function run() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/brick-erp-dev';
        await mongoose.connect(uri);
        console.log('Connected to', uri);

        // load all required categories by slug
        const slugs = [...new Set(items.map(i => i.categorySlug).filter(Boolean))];
        const categories = await Category.find({ slug: { $in: slugs } });
        const catMap = categories.reduce((m, c) => { m[c.slug] = c._id; return m; }, {});

        // ensure each slug exists
        for (const slug of slugs) {
            if (!catMap[slug]) {
                throw new Error(`Category with slug '${slug}' not found`);
            }
        }

        // remove existing items having any of the skus
        const skus = items.map(i => i.sku);
        await Item.deleteMany({ sku: { $in: skus } });

        // build documents with proper categoryId mapped from slug
        const docs = items.map(i => {
            const cid = catMap[i.categorySlug];
            return { ...i, categoryId: cid };
        });
        const result = await Item.insertMany(docs);
        console.log(`${result.length} items inserted.`);
    } catch (err) {
        console.error('Error inserting items', err);
    } finally {
        mongoose.disconnect();
    }
}

run();
