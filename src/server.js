import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🧱 Brick Manufacturing ERP Backend                       ║
║                                                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║   Port: ${PORT}                                              ║
║   Local: http://localhost:${PORT}/api/v1                    ║
║   Network: http://0.0.0.0:${PORT}/api/v1                    ║
║                                                            ║
║   🌐 Network Access:                                        ║
║   Find your IP: ipconfig (Windows) or ifconfig (Linux/Mac) ║
║   Then use: http://YOUR_IP:${PORT}/api/v1                   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
