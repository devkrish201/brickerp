import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import {
    getLabourPayments,
    getLabourPayment,
    createLabourPayment,
    updateLabourPayment,
    deleteLabourPayment,
    getPaymentsByBatch,
    markChequeAsCleared,
    getLabourPaymentStats,
} from './labourPayment.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all labour payments
router.get('/', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getLabourPayments);

// Get labour payment stats
router.get('/stats', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getLabourPaymentStats);

// Get payments by batch
router.get('/batch/:batchId', authorize(...ROLE_GROUPS.PRODUCTION_TEAM, ...ROLE_GROUPS.MANAGEMENT), getPaymentsByBatch);

// Create labour payment
router.post('/', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), createLabourPayment);

// Get single labour payment
router.get('/:id', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getLabourPayment);

// Update labour payment
router.put('/:id', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), updateLabourPayment);

// Delete labour payment
router.delete('/:id', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), deleteLabourPayment);

// Mark cheque as cleared
router.patch('/:id/cheque-cleared', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), markChequeAsCleared);

export default router;
