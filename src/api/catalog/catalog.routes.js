import express from 'express';
import Category from './category.model.js';
import Tag from './tag.model.js';
import Item from './item.model.js';
import { asyncHandler, ApiError } from '../../middleware/error.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import { itemValidation, categoryValidation } from '../../middleware/validate.js';
import { simplePaginate } from '../../utils/paginatePlugin.js';
import { COST_TYPES, UNITS } from '../../config/constants.js';

const router = express.Router();

// ============================================
// CONSTANTS / METADATA ROUTES (Public for frontend)
// ============================================

/**
 * @swagger
 * /catalog/constants/cost-types:
 *   get:
 *     summary: Get available cost types
 *     description: Retrieve all available cost types for items (Material, Labour, Transport, Product, Service)
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Cost types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/constants/cost-types', (req, res) => {
    res.json({
        success: true,
        data: Object.values(COST_TYPES),
    });
});

/**
 * @swagger
 * /catalog/constants/units:
 *   get:
 *     summary: Get available units
 *     description: Retrieve all available units of measurement
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Units retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/constants/units', (req, res) => {
    res.json({
        success: true,
        data: Object.values(UNITS),
    });
});

/**
 * @swagger
 * /catalog/constants:
 *   get:
 *     summary: Get all catalog constants
 *     description: Retrieve cost types, units, and other constants in one call
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Constants retrieved successfully
 */
router.get('/constants', (req, res) => {
    res.json({
        success: true,
        data: {
            costTypes: Object.values(COST_TYPES),
            units: Object.values(UNITS),
        },
    });
});

// ============================================
// CATEGORY ROUTES
// ============================================

/**
 * @swagger
 * /catalog/categories/tree:
 *   get:
 *     summary: Get category tree structure
 *     description: Retrieve the complete category hierarchy in tree format
 *     tags: [Catalog]
 *     responses:
 *       200:
 *         description: Category tree retrieved successfully
 */
router.get('/categories/tree', asyncHandler(async (req, res) => {
    const tree = await Category.getTree();
    res.json({ success: true, data: tree });
}));

/**
 * @swagger
 * /catalog/categories:
 *   get:
 *     summary: Get all categories with pagination
 *     description: Retrieve categories with optional filtering and pagination
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/categories', asyncHandler(async (req, res) => {
    const { parentId, search } = req.query;
    const filter = {};

    if (parentId === 'null' || parentId === 'root') {
        filter.parentId = null;
    } else if (parentId) {
        filter.parentId = parentId;
    }

    if (search) {
        filter.name = { $regex: search, $options: 'i' };
    }

    const result = await simplePaginate(Category, filter, req, {
        sort: { sortOrder: 1, name: 1 },
        populate: { path: 'parentId', select: 'name' },
    });

    res.json(result);
}));

/**
 * @swagger
 * /catalog/categories/{id}:
 *   get:
 *     summary: Get single category
 *     description: Retrieve a specific category with ancestors and children
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *       404:
 *         description: Category not found
 */
router.get('/categories/:id', asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id)
        .populate('parentId', 'name path');

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    // Get ancestors and children
    const [ancestors, children] = await Promise.all([
        Category.getAncestors(category._id),
        Category.find({ parentId: category._id, active: true }).select('name slug').lean(),
    ]);

    res.json({
        success: true,
        data: {
            ...category.toObject(),
            ancestors,
            children,
        },
    });
}));

/**
 * @swagger
 * /catalog/categories:
 *   post:
 *     summary: Create new category
 *     description: Create a new product category with optional parent category
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               parentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/categories',
    authenticate,
    authorize(...ROLE_GROUPS.MANAGEMENT),
    categoryValidation,
    asyncHandler(async (req, res) => {
        const category = new Category({
            ...req.body,
            _auditUser: req.user._id,
        });
        await category.save();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category,
        });
    })
);

/**
 * @swagger
 * /catalog/categories/{id}:
 *   put:
 *     summary: Update category
 *     description: Update an existing category details
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.put('/categories/:id',
    authenticate,
    authorize(...ROLE_GROUPS.MANAGEMENT),
    asyncHandler(async (req, res) => {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true, runValidators: true }
        );

        if (!category) {
            throw new ApiError(404, 'Category not found');
        }

        res.json({
            success: true,
            message: 'Category updated successfully',
            data: category,
        });
    })
);

/**
 * @swagger
 * /catalog/categories/{id}:
 *   delete:
 *     summary: Delete category
 *     description: Soft delete a category (cannot delete if has children or items)
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category with subcategories or items
 *       404:
 *         description: Category not found
 */
router.delete('/categories/:id',
    authenticate,
    authorize(...ROLE_GROUPS.MANAGEMENT),
    asyncHandler(async (req, res) => {
        const category = await Category.findById(req.params.id);
        if (!category) {
            throw new ApiError(404, 'Category not found');
        }

        // Check for children
        const childCount = await Category.countDocuments({ parentId: category._id });
        if (childCount > 0) {
            throw new ApiError(400, 'Cannot delete category with subcategories');
        }

        // Check for items
        const itemCount = await Item.countDocuments({
            $or: [{ categoryId: category._id }, { subCategoryId: category._id }]
        });
        if (itemCount > 0) {
            throw new ApiError(400, 'Cannot delete category with associated items');
        }

        await category.softDelete(req.user._id);

        res.json({
            success: true,
            message: 'Category deleted successfully',
        });
    })
);

// ============================================
// TAG ROUTES
// ============================================

/**
 * @swagger
 * /catalog/tags:
 *   get:
 *     summary: Get all tags
 *     description: Retrieve all tags with optional pagination and popularity filtering
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: popular
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 */
router.get('/tags', asyncHandler(async (req, res) => {
    const { search, popular } = req.query;

    if (popular === 'true') {
        const tags = await Tag.getPopular(20);
        return res.json({ success: true, data: tags });
    }

    const filter = { active: true };
    if (search) {
        filter.name = { $regex: search, $options: 'i' };
    }

    const result = await simplePaginate(Tag, filter, req, {
        sort: { name: 1 },
    });

    res.json(result);
}));

/**
 * @swagger
 * /catalog/tags:
 *   post:
 *     summary: Create new tag
 *     description: Create a new product tag
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tag created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/tags',
    authenticate,
    authorize(...ROLE_GROUPS.MANAGEMENT),
    asyncHandler(async (req, res) => {
        const tag = new Tag({
            ...req.body,
            _auditUser: req.user._id,
        });
        await tag.save();

        res.status(201).json({
            success: true,
            message: 'Tag created successfully',
            data: tag,
        });
    })
);

/**
 * @swagger
 * /catalog/tags/{id}:
 *   put:
 *     summary: Update tag
 *     description: Update an existing tag
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tag updated successfully
 *       404:
 *         description: Tag not found
 */
router.put('/tags/:id',
    authenticate,
    authorize(...ROLE_GROUPS.MANAGEMENT),
    asyncHandler(async (req, res) => {
        const tag = await Tag.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true, runValidators: true }
        );

        if (!tag) {
            throw new ApiError(404, 'Tag not found');
        }

        res.json({
            success: true,
            message: 'Tag updated successfully',
            data: tag,
        });
    })
);

/**
 * @swagger
 * /catalog/tags/{id}:
 *   delete:
 *     summary: Delete tag
 *     description: Soft delete a tag
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tag deleted successfully
 *       404:
 *         description: Tag not found
 */
router.delete('/tags/:id',
    authenticate,
    authorize(...ROLE_GROUPS.MANAGEMENT),
    asyncHandler(async (req, res) => {
        const tag = await Tag.findById(req.params.id);
        if (!tag) {
            throw new ApiError(404, 'Tag not found');
        }

        await tag.softDelete(req.user._id);

        res.json({
            success: true,
            message: 'Tag deleted successfully',
        });
    })
);

// ============================================
// ITEM ROUTES
// ============================================

// Debug endpoint - MUST be before /items route
router.get('/items/debug/raw', asyncHandler(async (req, res) => {
    console.log('🔍 DEBUG: Checking raw item data');

    // Get database and collection info
    const dbName = Item.db.name;
    const collectionName = Item.collection.name;
    console.log('Connected to database:', dbName);
    console.log('Collection name:', collectionName);

    // List all collections in the database
    const collections = await Item.db.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('All collections:', collectionNames);

    // Test 1: Count all documents
    const total = await Item.countDocuments({});
    console.log('Total items in DB:', total);

    // Try to access Items collection (capital I) directly
    let capitalItemsCount = 0;
    try {
        capitalItemsCount = await Item.db.db.collection('Items').countDocuments({});
        console.log('Items (capital I) collection count:', capitalItemsCount);
    } catch (e) {
        console.log('No Items collection found');
    }

    // Test 2: Find all without any filters
    const allItems = await Item.find({}).limit(5);
    console.log('All items (no filter):', allItems.length);

    // Test 3: Find with isDeleted filter
    const nonDeleted = await Item.find({ isDeleted: { $ne: true } }).limit(5);
    console.log('Non-deleted items:', nonDeleted.length);

    // Test 4: Try the paginate method directly
    const paginated = await Item.paginate({}, { page: 1, limit: 10 });
    console.log('✅ Paginated ALL fields:', JSON.stringify(paginated));
    console.log('Paginated result:', { totalDocs: paginated.totalDocs, docs: paginated.docs?.length });

    // Test 5: Try paginate with the same filter as search method
    const paginatedWithFilter = await Item.paginate({ isDeleted: { $ne: true } }, { page: 1, limit: 10 });
    console.log('Paginated with isDeleted filter:', { totalDocs: paginatedWithFilter.totalDocs, docs: paginatedWithFilter.docs?.length });

    // Test 5: Try to find the specific item from the screenshot
    const specificItem = await Item.findById('6981e03f419424f5b9df8740');
    console.log('Specific item search:', specificItem ? 'FOUND' : 'NOT FOUND');

    // Test 6: Try Item.search() method directly
    const searchResult = await Item.search('', { page: 1, limit: 10 });
    console.log('Item.search result:', { totalDocs: searchResult.totalDocs, docsCount: searchResult.docs?.length });

    res.json({
        success: true,
        debug: {
            database: dbName,
            collection: collectionName,
            allCollections: collectionNames,
            totalCount: total,
            capitalItemsCount: capitalItemsCount,
            allItemsCount: allItems.length,
            nonDeletedCount: nonDeleted.length,
            paginatedCount: paginated.totalDocs,
            paginatedWithFilterCount: paginatedWithFilter.totalDocs,
            searchResultCount: searchResult.totalDocs,
            specificItemExists: !!specificItem,
            sampleItems: allItems.map(item => ({ _id: item._id, name: item.name, active: item.active, isDeleted: item.isDeleted }))
        }
    });
}));

/**
 * @swagger
 * /catalog/items:
 *   get:
 *     summary: Get all items with search and filtering
 *     description: Retrieve items with pagination, search, and category/tag filtering
 *     tags: [Catalog]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: costType
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *           description: Filter items created from this date (ISO 8601 format)
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *           description: Filter items created until this date (ISO 8601 format)
 *     responses:
 *       200:
 *         description: Items retrieved successfully
 */
router.get('/items', asyncHandler(async (req, res) => {
    const { search, costType, categoryId, tags, fromDate, toDate, sortBy, sortOrder } = req.query;

    console.log('📦 Items search request:', { search, costType, categoryId, tags, fromDate, toDate, page: req.query.page, limit: req.query.limit, sortBy, sortOrder });

    // BYPASS the static method and call paginate directly
    const filter = { isDeleted: { $ne: true } };
    if (costType) filter.costType = costType;
    if (categoryId) {
        filter.$or = [
            { categoryId },
            { subCategoryId: categoryId },
        ];
    }
    if (tags) {
        filter.tags = { $in: tags.split(',') };
    }
    if (req.query.active !== undefined) {
        filter.active = req.query.active === 'true';
    }
    if (search) {
        filter.$text = { $search: search };
    }

    // Date filtering
    if (fromDate || toDate) {
        filter.createdAt = {};
        if (fromDate) {
            filter.createdAt.$gte = new Date(fromDate);
        }
        if (toDate) {
            filter.createdAt.$lte = new Date(toDate);
        }
    }

    console.log('📦 Direct filter:', JSON.stringify(filter));

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Determine sort options
    let sortOption = {};
    if (search) {
        sortOption = { score: { $meta: 'textScore' } };
    } else if (sortBy) {
        const sortDirection = sortOrder === 'desc' ? -1 : 1;
        if (sortBy === 'serialNumber') {
            // Sort by creation date for serial number (newest first for desc, oldest first for asc)
            sortOption = { createdAt: sortDirection };
        } else {
            sortOption = { [sortBy]: sortDirection };
        }
    } else {
        sortOption = { name: 1 };
    }

    // Call paginate directly
    const result = await Item.paginate(filter, {
        page,
        limit,
        sort: sortOption,
        populate: [
            { path: 'categoryId', select: 'name path' },
            { path: 'tags', select: 'name color' },
        ],
    });

    // console.log('📦 Direct paginate ALL KEYS:', Object.keys(result));
    // console.log('📦 Direct paginate result:', {
    //     totalDocs: result.totalDocs,
    //     page: result.page,
    //     docsLength: result.docs?.length,
    //     fullResult: JSON.stringify(result).substring(0, 200)
    // });

    res.json({
        success: true,
        data: result.docs || [],
        pagination: {
            currentPage: result.page || 1,
            pageSize: result.limit || 20,
            totalCount: result.totalDocs || 0,
            totalPages: result.totalPages || 0,
            hasNextPage: result.hasNextPage || false,
            hasPrevPage: result.hasPrevPage || false,
        },
    });
}));

/**
 * @swagger
 * /catalog/items/by-type/{costType}:
 *   get:
 *     summary: Get items by cost type
 *     description: Retrieve items filtered by their cost type
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: costType
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Items retrieved successfully
 */
router.get('/items/by-type/:costType', asyncHandler(async (req, res) => {
    const items = await Item.getByCostType(req.params.costType);
    res.json({ success: true, data: items });
}));

/**
 * @swagger
 * /catalog/items/{id}:
 *   get:
 *     summary: Get single item details
 *     description: Retrieve a specific item with all relationships
 *     tags: [Catalog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item retrieved successfully
 *       404:
 *         description: Item not found
 */
router.get('/items/:id', asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id)
        .populate('categoryId', 'name path')
        .populate('subCategoryId', 'name')
        .populate('tags', 'name color')
        .populate('preferredVendors', 'name contact');

    if (!item) {
        throw new ApiError(404, 'Item not found');
    }

    res.json({ success: true, data: item });
}));

/**
 * @swagger
 * /catalog/items:
 *   post:
 *     summary: Create new item
 *     description: Create a new product item in catalog
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, categoryId]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               subCategoryId:
 *                 type: string
 *               costType:
 *                 type: string
 *               costValue:
 *                 type: number
 *               unit:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Item created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/items',
    authenticate,
    authorize(...ROLE_GROUPS.PROCUREMENT_TEAM, ...ROLE_GROUPS.MANAGEMENT),
    itemValidation,
    asyncHandler(async (req, res) => {
        const item = new Item({
            ...req.body,
            _auditUser: req.user._id,
        });
        await item.save();

        // Update tag usage counts
        if (item.tags && item.tags.length > 0) {
            await Tag.incrementUsage(item.tags);
        }

        res.status(201).json({
            success: true,
            message: 'Item created successfully',
            data: item,
        });
    })
);

/**
 * @swagger
 * /catalog/items/{id}:
 *   put:
 *     summary: Update item
 *     description: Update an existing product item
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               costType:
 *                 type: string
 *               costValue:
 *                 type: number
 *               unit:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Item updated successfully
 *       404:
 *         description: Item not found
 */
router.put('/items/:id',
    authenticate,
    authorize(...ROLE_GROUPS.PROCUREMENT_TEAM, ...ROLE_GROUPS.MANAGEMENT),
    asyncHandler(async (req, res) => {
        const existingItem = await Item.findById(req.params.id);
        if (!existingItem) {
            throw new ApiError(404, 'Item not found');
        }

        const oldTags = existingItem.tags.map(t => t.toString());
        const newTags = (req.body.tags || []).map(t => t.toString());

        const item = await Item.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true, runValidators: true }
        );

        // Update tag usage counts
        const removedTags = oldTags.filter(t => !newTags.includes(t));
        const addedTags = newTags.filter(t => !oldTags.includes(t));

        if (removedTags.length > 0) await Tag.decrementUsage(removedTags);
        if (addedTags.length > 0) await Tag.incrementUsage(addedTags);

        res.json({
            success: true,
            message: 'Item updated successfully',
            data: item,
        });
    })
);

/**
 * @swagger
 * /catalog/items/{id}:
 *   delete:
 *     summary: Delete item
 *     description: Soft delete a product item
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *       404:
 *         description: Item not found
 */
router.delete('/items/:id',
    authenticate,
    authorize(...ROLE_GROUPS.MANAGEMENT),
    asyncHandler(async (req, res) => {
        const item = await Item.findById(req.params.id);
        if (!item) {
            throw new ApiError(404, 'Item not found');
        }

        // Decrement tag usage
        if (item.tags && item.tags.length > 0) {
            await Tag.decrementUsage(item.tags);
        }

        await item.softDelete(req.user._id);

        res.json({
            success: true,
            message: 'Item deleted successfully',
        });
    })
);

/**
 * @swagger
 * /catalog/items/{id}/notes:
 *   post:
 *     summary: Add note to item
 *     description: Add a comment or note to an item
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [note]
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Note added successfully
 *       404:
 *         description: Item not found
 */
router.post('/items/:id/notes',
    authenticate,
    asyncHandler(async (req, res) => {
        const item = await Item.findById(req.params.id);
        if (!item) {
            throw new ApiError(404, 'Item not found');
        }

        await item.addNote(req.body, req.user._id);

        res.json({
            success: true,
            message: 'Note added successfully',
            data: item.notes,
        });
    })
);

export default router;
