/**
 * Custom Pagination Plugin for Mongoose 8.x
 * Compatible replacement for mongoose-paginate-v2
 */

export function paginatePlugin(schema) {
    schema.statics.paginate = async function (query = {}, options = {}) {
        const {
            page = 1,
            limit = 10,
            sort = {},
            populate = [],
            select = '',
            lean = false,
        } = options;

        const skip = (page - 1) * limit;

        // Execute count and find in parallel
        const [totalDocs, docs] = await Promise.all([
            this.countDocuments(query),
            this.find(query)
                .select(select)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate(populate)
                .lean(lean),
        ]);

        const totalPages = Math.ceil(totalDocs / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return {
            docs,
            totalDocs,
            limit,
            page,
            totalPages,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? page + 1 : null,
            prevPage: hasPrevPage ? page - 1 : null,
            pagingCounter: skip + 1,
        };
    };
}

export default paginatePlugin;
