import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize, ROLE_GROUPS } from '../../middleware/rbac.js';
import {
    getExpensePayments,
    getExpensePayment,
    createExpensePayment,
    updateExpensePayment,
    deleteExpensePayment,
    getExpenseSummary,
    getExpensesByDateRange,
    markChequeAsCleared,
} from './expencePayment.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all expense payments
router.get('/', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getExpensePayments);

// Get expense summary
router.get('/summary', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getExpenseSummary);

// Get expenses by date range
router.get('/date-range', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getExpensesByDateRange);

// Create expense payment
router.post('/', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), createExpensePayment);

// Get single expense payment
router.get('/:id', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), getExpensePayment);

// Update expense payment
router.put('/:id', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), updateExpensePayment);

// Delete expense payment
router.delete('/:id', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), deleteExpensePayment);

// Mark cheque as cleared
router.patch('/:id/cheque-cleared', authorize(...ROLE_GROUPS.FINANCE_TEAM, ...ROLE_GROUPS.MANAGEMENT), markChequeAsCleared);

export default router;
