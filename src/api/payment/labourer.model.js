import mongoose from 'mongoose';

const labourerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Labourer name is required'],
    },
    phone: String,
    address: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

// register if not already
export default mongoose.models.Labourer || mongoose.model('Labourer', labourerSchema);
