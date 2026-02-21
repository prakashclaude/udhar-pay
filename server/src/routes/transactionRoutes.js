const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();
const { createTransaction, getTransactions, getSummary, getUserByQr, searchUser, payTransaction, getPendingPayments, respondToPayment, sendReminder, getNotifications, markNotificationRead, getBalance } = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/transactions/summary
router.get('/summary', getSummary);

// GET /api/transactions/balance/:userId
router.get('/balance/:userId', getBalance);

// GET /api/transactions/by-qr/:qrCode
router.get('/by-qr/:qrCode', getUserByQr);

// GET /api/transactions/search-user?q=
router.get('/search-user', [
    query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
], searchUser);

// GET /api/transactions
router.get('/', [
    query('module').optional().isIn(['FRIEND', 'SHOP', 'WHOLESALER']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
], getTransactions);

// POST /api/transactions
router.post('/', [
    body('receiverId').isUUID().withMessage('Invalid receiver ID'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least 1'),
    body('module').isIn(['FRIEND', 'SHOP', 'SHOPKEEPER', 'WHOLESALER']).withMessage('Invalid module'),
    body('description').optional().trim().isLength({ max: 500 }),
    body('direction').optional().isIn(['gave', 'received']).withMessage('Direction must be gave or received'),
    body('invoiceNumber').optional().trim(),
    body('invoiceDate').optional().isISO8601().withMessage('Invalid invoice date'),
], createTransaction);

// GET /api/transactions/pending-payments
router.get('/pending-payments', getPendingPayments);

// POST /api/transactions/remind
router.post('/remind', [
    body('receiverId').isUUID().withMessage('Invalid receiver ID'),
], sendReminder);

// GET /api/transactions/notifications
router.get('/notifications', getNotifications);

// PUT /api/transactions/notifications/:id/read
router.put('/notifications/:id/read', [
    param('id').isUUID().withMessage('Invalid notification ID'),
], markNotificationRead);

// POST /api/transactions/payments/:id/respond
router.post('/payments/:id/respond', [
    param('id').isUUID().withMessage('Invalid payment ID'),
    body('action').isIn(['APPROVE', 'REJECT']).withMessage('Action must be APPROVE or REJECT'),
], respondToPayment);

// POST /api/transactions/:id/pay
router.post('/:id/pay', [
    param('id').isUUID().withMessage('Invalid transaction ID'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least 1'),
    body('method').isIn(['UPI', 'CASH', 'CARD']).withMessage('Method must be UPI, CASH, or CARD'),
    body('notes').optional().trim().isLength({ max: 500 }),
    body('upiRef').optional().trim(),
], payTransaction);

module.exports = router;
