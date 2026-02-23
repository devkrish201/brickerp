import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../api/catalog/category.model.js';

// tiny script to populate a handful of master categories

dotenv.config();

const categories = [
    {
        name: 'Service',
        parentId: null,
        description: 'All service-related categories',
        level: 0,
        active: true,
        sortOrder: 1,
        isSellable: true,
        isPurchasable: false,
        categoryType: 'Service',
        isDeleted: false,
        slug: 'service',
        path: 'Service',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'Labour',
        parentId: null,
        description: 'Labour and workforce related category',
        level: 0,
        active: true,
        sortOrder: 2,
        isSellable: false,
        isPurchasable: true,
        categoryType: 'Service',
        isDeleted: false,
        slug: 'labour',
        path: 'Labour',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'Transport',
        parentId: null,
        description: 'Transport and logistics services',
        level: 0,
        active: true,
        sortOrder: 3,
        isSellable: false,
        isPurchasable: true,
        categoryType: 'Service',
        isDeleted: false,
        slug: 'transport',
        path: 'Transport',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'Finished Goods',
        parentId: null,
        description: 'Ready to sell finished products',
        level: 0,
        active: true,
        sortOrder: 4,
        isSellable: true,
        isPurchasable: false,
        // enum only allows 'FinishedGoods' for products
        categoryType: 'FinishedGoods',
        isDeleted: false,
        slug: 'finished-goods',
        path: 'Finished Goods',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
    {
        name: 'Raw Material',
        parentId: null,
        description: 'Raw materials used in production',
        level: 0,
        active: true,
        sortOrder: 5,
        isSellable: false,
        isPurchasable: true,
        categoryType: 'RawMaterial',
        isDeleted: false,
        slug: 'raw-material',
        path: 'Raw Material',
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];

async function run() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/brick-erp-dev';
        await mongoose.connect(uri);
        console.log('Connected to', uri);

        // Optionally wipe existing categories with same names or slugs
        const names = categories.map((c) => c.name);
        const slugs = categories.map((c) => c.slug);
        await Category.deleteMany({
            $or: [
                { name: { $in: names } },
                { slug: { $in: slugs } },
            ],
        });

        const result = await Category.insertMany(categories);
        console.log(`${result.length} categories inserted.`);
    } catch (err) {
        console.error('Error inserting categories', err);
    } finally {
        mongoose.disconnect();
    }
}

run();
