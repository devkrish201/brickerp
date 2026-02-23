/**
 * Mongoose plugin to add audit fields (createdBy, updatedBy, timestamps)
 * and track changes for traceability
 */

/**
 * Audit Plugin - adds createdBy, updatedBy fields and tracks modifications
 * @param {mongoose.Schema} schema - Mongoose schema to apply plugin
 * @param {Object} options - Plugin options
 */
export const auditPlugin = (schema, options = {}) => {
    // Add audit fields
    schema.add({
        createdBy: {
            type: schema.constructor.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: schema.constructor.Types.ObjectId,
            ref: 'User',
        },
    });

    // Enable timestamps if not already enabled
    if (!schema.options.timestamps) {
        schema.set('timestamps', true);
    }

    // Pre-save hook to set createdBy on new documents
    schema.pre('save', function (next) {
        if (this.isNew && this._auditUser) {
            this.createdBy = this._auditUser;
        }
        if (this._auditUser) {
            this.updatedBy = this._auditUser;
        }
        next();
    });

    // Pre-update hooks
    schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
        if (this.options._auditUser) {
            this.set({ updatedBy: this.options._auditUser });
        }
        next();
    });
};

/**
 * Notes plugin - adds a notes array for tracking ambiguous values and sources
 * @param {mongoose.Schema} schema - Mongoose schema to apply plugin
 */
export const notesPlugin = (schema) => {
    schema.add({
        notes: [{
            text: {
                type: String,
                required: true,
            },
            source: {
                type: String, // e.g., "Inferred from photo", "Client verbal communication"
            },
            category: {
                type: String,
                enum: ['ambiguity', 'clarification', 'assumption', 'change', 'general'],
                default: 'general',
            },
            createdBy: {
                type: schema.constructor.Types.ObjectId,
                ref: 'User',
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }],
    });

    // Instance method to add a note
    schema.methods.addNote = function (noteData, userId) {
        this.notes.push({
            ...noteData,
            createdBy: userId,
            createdAt: new Date(),
        });
        return this.save();
    };
};

/**
 * Soft delete plugin - adds isDeleted field and overrides delete methods
 * @param {mongoose.Schema} schema - Mongoose schema to apply plugin
 */
export const softDeletePlugin = (schema) => {
    schema.add({
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: Date,
        deletedBy: {
            type: schema.constructor.Types.ObjectId,
            ref: 'User',
        },
    });

    // Override find methods to exclude deleted documents by default
    const excludeDeleted = function (next) {
        if (!this.getOptions().includeDeleted) {
            this.where({ isDeleted: { $ne: true } });
        }
        next();
    };

    schema.pre('find', excludeDeleted);
    schema.pre('findOne', excludeDeleted);
    schema.pre('countDocuments', excludeDeleted);
    schema.pre('aggregate', function (next) {
        if (!this.options?.includeDeleted) {
            this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
        }
        next();
    });

    // Soft delete method
    schema.methods.softDelete = function (userId) {
        this.isDeleted = true;
        this.deletedAt = new Date();
        this.deletedBy = userId;
        return this.save();
    };

    // Restore method
    schema.methods.restore = function () {
        this.isDeleted = false;
        this.deletedAt = undefined;
        this.deletedBy = undefined;
        return this.save();
    };
};

/**
 * Helper function to set audit user in save context
 */
export const setAuditUser = (doc, userId) => {
    doc._auditUser = userId;
    return doc;
};

export default { auditPlugin, notesPlugin, softDeletePlugin, setAuditUser };
