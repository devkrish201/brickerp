import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import mongoosePaginate from 'mongoose-paginate-v2';
import { ROLES } from '../../config/constants.js';
import { auditPlugin, softDeletePlugin } from '../../utils/auditPlugin.js';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    passwordHash: {
        type: String,
        required: [true, 'Password is required'],
        select: false, // Don't include in queries by default
    },
    roles: [{
        type: String,
        enum: Object.values(ROLES),
        default: ROLES.WORKER,
    }],
    active: {
        type: Boolean,
        default: true,
    },
    profile: {
        phone: String,
        address: String,
        avatar: String,
        department: String,
        employeeId: String,
    },
    lastLogin: Date,
    refreshTokens: [{
        token: String,
        createdAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: Date,
    }],
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.passwordHash;
            delete ret.refreshTokens;
            delete ret.__v;
            return ret;
        },
    },
});

// Indexes
userSchema.index({ 'profile.employeeId': 1 }, { sparse: true });
// email index is created by unique: true in field definition
// roles and active already have index: true in field definitions

// Plugins
userSchema.plugin(mongoosePaginate);
userSchema.plugin(auditPlugin);
userSchema.plugin(softDeletePlugin);

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(12);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Instance method to check if user has a specific role
userSchema.methods.hasRole = function (role) {
    return this.roles.includes(role) || this.roles.includes(ROLES.ADMIN);
};

// Instance method to check if user has any of the specified roles
userSchema.methods.hasAnyRole = function (roles) {
    return roles.some(role => this.hasRole(role));
};

// Static method to find by email with password
userSchema.statics.findByEmailWithPassword = function (email) {
    return this.findOne({ email }).select('+passwordHash');
};

const User = mongoose.model('User', userSchema);

export default User;
