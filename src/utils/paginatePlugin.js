import mongoosePaginate from 'mongoose-paginate-v2';

/**
 * Custom labels for pagination response
 */
const customLabels = {
    docs: 'data',
    totalDocs: 'totalCount',
    limit: 'pageSize',
    page: 'currentPage',
    totalPages: 'totalPages',
    nextPage: 'nextPage',
    prevPage: 'prevPage',
    pagingCounter: 'startIndex',
    hasPrevPage: 'hasPrevPage',
    hasNextPage: 'hasNextPage',
    meta: 'pagination',
};

mongoosePaginate.paginate.options = {
    lean: true,
    customLabels,
};

/**
 * Paginate helper function for controllers
 * @param {Object} query - Mongoose query object
 * @param {Object} req - Express request object
 * @param {Object} options - Additional pagination options
 */
export const paginate = async (Model, filter = {}, req, options = {}) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Sort handling
    let sort = options.sort || { createdAt: -1 };
    if (req.query.sortBy) {
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        sort = { [req.query.sortBy]: sortOrder };
    }

    const paginateOptions = {
        page,
        limit,
        sort,
        ...options,
        customLabels,
    };

    const result = await Model.paginate(filter, paginateOptions);

    return {
        success: true,
        data: result.data,
        pagination: {
            currentPage: result.currentPage,
            pageSize: result.pageSize,
            totalCount: result.totalCount,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
            nextPage: result.nextPage,
            prevPage: result.prevPage,
        },
    };
};

/**
 * Simple pagination without mongoose-paginate-v2
 * For cases where plugin isn't attached
 */
export const simplePaginate = async (Model, filter = {}, req, options = {}) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    // Sort handling
    let sort = options.sort || { createdAt: -1 };
    if (req.query.sortBy) {
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        sort = { [req.query.sortBy]: sortOrder };
    }

    const [data, totalCount] = await Promise.all([
        Model.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate(options.populate || [])
            .select(options.select || '')
            .lean(),
        Model.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
        success: true,
        data,
        pagination: {
            currentPage: page,
            pageSize: limit,
            totalCount,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
        },
    };
};

export default { paginate, simplePaginate };
