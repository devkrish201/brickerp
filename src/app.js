import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

// Import routes
import authRoutes from './api/iam/auth.routes.js';
import catalogRoutes from './api/catalog/catalog.routes.js';
import procurementRoutes from './api/procurement/procurement.routes.js';
import inventoryRoutes from './api/inventory/inventory.routes.js';
import manufacturingRoutes from './api/manufacturing/manufacturing.routes.js';
import reportsRoutes from './api/reports/reports.routes.js';
import excelRoutes from './api/excel/excel.routes.js';
import calcRoutes from './api/calc/calc.routes.js';
import purchasePaymentRoutes from './api/payment/purchasePayment.routes.js';
import salesPaymentRoutes from './api/payment/salesPayment.routes.js';
import labourPaymentRoutes from './api/payment/labourPayment.routes.js';
import expensePaymentRoutes from './api/payment/expencePayment.routes.js';
import transportPaymentRoutes from './api/payment/tranportPayment.routes.js';

// Import sales routes
import customerRoutes from './api/sales/customer.routes.js';
import salesOrderRoutes from './api/sales/salesOrder.routes.js';

// Import finance routes
import customerPaymentRoutes from './api/finance/customerPayment.routes.js';

// Import middleware
import { errorHandler, notFound } from './middleware/error.js';

// Import Swagger
import { specs } from './config/swagger.js';

dotenv.config();

const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for Swagger customization
app.use(express.static('public'));

// ===========================================
// ROUTES
// ===========================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(specs, {
    swaggerOptions: {
        url: '/api-docs.json',
        persistAuthorization: true,
        requestInterceptor: (request) => {
            const token = localStorage.getItem('authToken');
            if (token) {
                request.headers['Authorization'] = 'Bearer ' + token;
            }
            return request;
        }
    },
    customCss: `
        .swagger-ui .topbar { background-color: #1a1a1a; }
        .swagger-ui .auth-wrapper { margin-top: 20px; }
        .swagger-ui .information-container { margin-bottom: 30px; }
    `,
    customSiteTitle: 'Brick Manufacturing ERP - API Documentation',
    customJsStr: `
        // Enhanced Auto-Authorization Script
        (function() {
            console.log('🔐 Auto-Authorization Script Loaded');
            
            // Function to authorize Swagger UI with token
            function authorizeSwagger(token) {
                if (window.ui) {
                    // Use preauthorizeApiKey with Bearer prefix
                    window.ui.preauthorizeApiKey('bearerAuth', 'Bearer ' + token);
                    
                    // Also trigger the authorize action
                    try {
                        window.ui.authActions.authorize({
                            bearerAuth: {
                                name: 'bearerAuth',
                                schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
                                value: 'Bearer ' + token
                            }
                        });
                    } catch (e) {
                        console.warn('authActions.authorize not available:', e.message);
                    }
                    
                    console.log('✅ Swagger UI authorized with Bearer token');
                    return true;
                }
                return false;
            }
            
            // Check if we have a saved token and auto-authorize on page load
            const savedToken = localStorage.getItem('authToken');
            if (savedToken) {
                setTimeout(() => {
                    try {
                        if (authorizeSwagger(savedToken)) {
                            console.log('✅ Auto-authorized with saved token from localStorage');
                            updateAuthBanner(true);
                        }
                    } catch (err) {
                        console.error('❌ Auto-authorization failed:', err);
                    }
                }, 1500);
            }
            
            // Intercept fetch to capture login/register responses
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                return originalFetch.apply(this, args).then(response => {
                    const clonedResponse = response.clone();
                    const url = args[0];
                    
                    // Check for 401 Unauthorized responses
                    if (response.status === 401) {
                        clonedResponse.json().then(data => {
                            if (!localStorage.getItem('authToken')) {
                                showNotification('🔒 Authentication Required', 'You need to login first! Use POST /auth/login to get a token. It will be saved automatically.', 'error');
                            }
                        }).catch(() => {});
                    }
                    
                    // Check if this is a login or register request
                    if (typeof url === 'string' && (url.includes('/auth/login') || url.includes('/auth/register'))) {
                        clonedResponse.json().then(data => {
                            console.log('📥 Auth response received:', data);
                            if (data && data.success && data.data) {
                                const token = data.data.accessToken || data.data.token;
                                const refreshToken = data.data.refreshToken;
                                
                                if (token) {
                                    console.log('🎉 Token found:', token.substring(0, 20) + '...');
                                    console.log('💾 Saving to localStorage...');
                                    localStorage.setItem('authToken', token);
                                    if (refreshToken) {
                                        localStorage.setItem('refreshToken', refreshToken);
                                    }
                                    
                                    // Auto-authorize Swagger UI
                                    setTimeout(() => {
                                        try {
                                            if (authorizeSwagger(token)) {
                                                updateAuthBanner(true);
                                                showNotification('🎉 Login Successful!', 'Token saved and applied! All API requests will now include Authorization header automatically.', 'success');
                                            }
                                        } catch (err) {
                                            console.error('❌ Auto-authorization failed:', err);
                                        }
                                    }, 500);
                                }
                            }
                        }).catch(err => console.error('Error parsing response:', err));
                    }
                    return response;
                });
            };
            
            // Function to show notification
            function showNotification(title, message, type) {
                const notification = document.createElement('div');
                notification.style.cssText = 'position:fixed;top:20px;right:20px;background:' + (type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#ff9800') + ';color:white;padding:20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:9999;max-width:400px;animation:slideIn 0.3s ease-out;';
                notification.innerHTML = '<h4 style="margin:0 0 10px 0;">' + title + '</h4><p style="margin:0;">' + message + '</p>';
                document.body.appendChild(notification);
                setTimeout(() => {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => notification.remove(), 300);
                }, 5000);
            }
            
            // Function to update auth banner
            function updateAuthBanner(isAuthorized) {
                const banner = document.getElementById('auth-info-banner');
                if (banner) {
                    banner.style.cssText = 'background:' + (isAuthorized ? '#e7f7ed' : '#fff3e0') + ';border-left:4px solid ' + (isAuthorized ? '#4CAF50' : '#ff9800') + ';padding:15px;margin:20px 0;border-radius:4px;';
                    banner.innerHTML = '<h4 style="margin:0 0 10px 0;color:' + (isAuthorized ? '#2e7d32' : '#e65100') + ';">🔐 Authentication: ' + (isAuthorized ? '✅ Authorized' : '⚠️ Not Logged In') + '</h4><p style="margin:0;color:#555;">' + (isAuthorized ? '✅ <strong>Authenticated!</strong> All API requests will automatically include your authentication token.' : '⚠️ <strong>Please login first:</strong> Expand <code>Authentication > POST /auth/login</code>, click "Try it out", enter credentials, and click "Execute". Your token will be captured and saved automatically for all future requests!') + '</p>';
                }
            }
            
            // Add UI enhancements after DOM loads
            setTimeout(() => {
                // Add logout/clear auth button
                const topbar = document.querySelector('.swagger-ui .topbar');
                if (topbar && !document.getElementById('custom-logout-btn')) {
                    const logoutBtn = document.createElement('button');
                    logoutBtn.id = 'custom-logout-btn';
                    logoutBtn.innerHTML = '🚪 Clear Auth';
                    logoutBtn.style.cssText = 'position:absolute;right:20px;top:15px;padding:8px 16px;background:#ff4444;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;transition:background 0.3s;';
                    logoutBtn.onmouseover = () => logoutBtn.style.background = '#cc0000';
                    logoutBtn.onmouseout = () => logoutBtn.style.background = '#ff4444';
                    logoutBtn.onclick = function() {
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('refreshToken');
                        showNotification('🚪 Logged Out', 'Authentication tokens cleared. Page will reload.', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    };
                    topbar.appendChild(logoutBtn);
                }
                
                // Add authentication status banner
                const infoContainer = document.querySelector('.swagger-ui .information-container');
                if (infoContainer && !document.getElementById('auth-info-banner')) {
                    const hasToken = localStorage.getItem('authToken');
                    const banner = document.createElement('div');
                    banner.id = 'auth-info-banner';
                    updateAuthBanner(hasToken);
                    infoContainer.appendChild(banner);
                }
                
                // Add CSS animations
                const style = document.createElement('style');
                style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }';
                document.head.appendChild(style);
            }, 1500);
        })();
    `,
}));

// API documentation endpoints
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

app.get('/api-docs-html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Brick Manufacturing ERP - API Documentation</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700">
        <style>
          body {
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        <redoc spec-url='/api-docs.json'></redoc>
        <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
      </body>
    </html>
  `);
});

// API version prefix
const API_PREFIX = '/api/v1';

// Root API endpoint - returns available endpoints
app.get(API_PREFIX, (req, res) => {
    res.json({
        success: true,
        message: 'Brick Manufacturing ERP - REST API v1.0.0',
        apiVersion: '1.0.0',
        documentation: `${req.protocol}://${req.get('host')}/api-docs`,
        endpoints: {
            auth: `${req.protocol}://${req.get('host')}/api/v1/auth`,
            catalog: `${req.protocol}://${req.get('host')}/api/v1/catalog`,
            procurement: `${req.protocol}://${req.get('host')}/api/v1/procurement`,
            inventory: `${req.protocol}://${req.get('host')}/api/v1/inventory`,
            manufacturing: `${req.protocol}://${req.get('host')}/api/v1/manufacturing`,
            payments: {
                purchase: `${req.protocol}://${req.get('host')}/api/v1/purchase-payments`,
                sales: `${req.protocol}://${req.get('host')}/api/v1/sales-payments`,
                labour: `${req.protocol}://${req.get('host')}/api/v1/labour-payments`,
                expense: `${req.protocol}://${req.get('host')}/api/v1/expense-payments`,
                transport: `${req.protocol}://${req.get('host')}/api/v1/transport-payments`,
            },
            sales: {
                customers: `${req.protocol}://${req.get('host')}/api/v1/sales/customers`,
                orders: `${req.protocol}://${req.get('host')}/api/v1/sales/orders`,
            },
            finance: {
                customerPayments: `${req.protocol}://${req.get('host')}/api/v1/finance/customer-payments`,
            },
            reports: `${req.protocol}://${req.get('host')}/api/v1/reports`,
            excel: `${req.protocol}://${req.get('host')}/api/v1/excel`,
            calc: `${req.protocol}://${req.get('host')}/api/v1/calc`,
        },
        availableModules: [
            {
                name: 'IAM',
                path: '/auth',
                description: 'User authentication and authorization',
            },
            {
                name: 'Catalog',
                path: '/catalog',
                description: 'Categories, items, and tags management',
            },
            {
                name: 'Procurement',
                path: '/procurement',
                description: 'Vendors, estimates, and purchase orders',
            },
            {
                name: 'Inventory',
                path: '/inventory',
                description: 'Warehouses, stock, and goods receipts',
            },
            {
                name: 'Manufacturing',
                path: '/manufacturing',
                description: 'Kilns, batches, labour, and production',
            },
            {
                name: 'Sales - Customers',
                path: '/sales/customers',
                description: 'Customer management',
            },
            {
                name: 'Sales - Orders',
                path: '/sales/orders',
                description: 'Sales order workflow and tracking',
            },
            {
                name: 'Finance - Customer Payments',
                path: '/finance/customer-payments',
                description: 'Payment receipts and cheque management',
            },
            {
                name: 'Payments - Purchase',
                path: '/purchase-payments',
                description: 'Purchase order payment management',
            },
            {
                name: 'Payments - Sales',
                path: '/sales-payments',
                description: 'Sales order payment management',
            },
            {
                name: 'Payments - Labour',
                path: '/labour-payments',
                description: 'Labour/worker payment management',
            },
            {
                name: 'Payments - Expense',
                path: '/expense-payments',
                description: 'Business expense payment management',
            },
            {
                name: 'Payments - Transport',
                path: '/transport-payments',
                description: 'Transportation/logistics payment management',
            },
            {
                name: 'Reports',
                path: '/reports',
                description: 'Business analytics and dashboards',
            },
            {
                name: 'Excel',
                path: '/excel',
                description: 'Import/export functionality',
            },
            {
                name: 'Calculations',
                path: '/calc',
                description: 'Real-time cost calculations',
            },
        ],
    });
});

// Mount routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/catalog`, catalogRoutes);
app.use(`${API_PREFIX}/procurement`, procurementRoutes);
app.use(`${API_PREFIX}/inventory`, inventoryRoutes);
app.use(`${API_PREFIX}/manufacturing`, manufacturingRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
app.use(`${API_PREFIX}/excel`, excelRoutes);
app.use(`${API_PREFIX}/calc`, calcRoutes);
app.use(`${API_PREFIX}/purchase-payments`, purchasePaymentRoutes);
app.use(`${API_PREFIX}/sales-payments`, salesPaymentRoutes);
app.use(`${API_PREFIX}/labour-payments`, labourPaymentRoutes);
app.use(`${API_PREFIX}/expense-payments`, expensePaymentRoutes);
app.use(`${API_PREFIX}/transport-payments`, transportPaymentRoutes);
app.use(`${API_PREFIX}/sales/customers`, customerRoutes);
app.use(`${API_PREFIX}/sales/orders`, salesOrderRoutes);
app.use(`${API_PREFIX}/finance/customer-payments`, customerPaymentRoutes);

// ===========================================
// ERROR HANDLING
// ===========================================

app.use(notFound);
app.use(errorHandler);

export default app;
