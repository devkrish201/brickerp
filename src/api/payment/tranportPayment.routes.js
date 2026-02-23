import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import {
    getTransportPayments,
    getTransportPayment,
    createTransportPayment,
    updateTransportPayment,
    deleteTransportPayment,
    markChequeAsCleared,
    getTransportStats,
    trackShipment,
} from './tranportPayment.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all transport payments
router.get('/', authorize(...ROLE_GROUPS.LOGISTICS_TEAM, ...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getTransportPayments);

// Get transport stats
router.get('/stats', authorize(...ROLE_GROUPS.LOGISTICS_TEAM, ...ROLE_GROUPS.MANAGEMENT), getTransportStats);

// Track shipment (public within auth)
router.get('/track/:trackingNumber', trackShipment);


// Create transport payment
router.post('/', authorize(...ROLE_GROUPS.LOGISTICS_TEAM, ...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), createTransportPayment);

// Get single transport payment
router.get('/:id', authorize(...ROLE_GROUPS.LOGISTICS_TEAM, ...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getTransportPayment);

// Update transport payment
router.put('/:id', authorize(...ROLE_GROUPS.LOGISTICS_TEAM, ...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), updateTransportPayment);

// Delete transport payment
router.delete('/:id', authorize(...ROLE_GROUPS.LOGISTICS_TEAM, ...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), deleteTransportPayment);

// Mark cheque as cleared
router.patch('/:id/cheque-cleared', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), markChequeAsCleared);

export default router;
