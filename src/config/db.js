import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    const maxRetries = parseInt(process.env.MONGO_CONNECT_MAX_RETRIES || '0', 10); // 0 => infinite
    const baseDelay = parseInt(process.env.MONGO_CONNECT_RETRY_MS || '2000', 10); // ms

    console.log('🔄 Connecting to MongoDB...');
    console.log('MONGO_URI:', uri);

    let attempt = 0;
    while (true) {
        try {
            const conn = await mongoose.connect(uri, {
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
            console.log(`📊 Database: ${conn.connection.db.databaseName}`);
            console.log(`🔗 URI: ${uri}`);

            mongoose.connection.on('error', (err) => {
                console.error(`❌ MongoDB connection error: ${err}`);
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
            });

            mongoose.connection.on('reconnected', () => {
                console.log('✅ MongoDB reconnected');
            });

            process.on('SIGINT', async () => {
                await mongoose.connection.close();
                console.log('MongoDB connection closed due to app termination');
                process.exit(0);
            });

            return conn;
        } catch (error) {
            attempt += 1;
            const msg = error && error.message ? error.message : String(error);
            console.error(`❌ MongoDB connection failed (attempt ${attempt}): ${msg}`);

            if (maxRetries > 0 && attempt >= maxRetries) {
                console.error(`❌ Reached max MongoDB connection attempts (${maxRetries}).`);
                throw error;
            }

            const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
            console.log(`⏳ Retrying MongoDB connection in ${delay}ms... (press Ctrl+C to abort)`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};

export default connectDB;
