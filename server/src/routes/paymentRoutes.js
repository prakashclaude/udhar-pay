const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { initiatePayment, verifyPaymentOtp, confirmUpiPayment, getPayments } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/payments
router.get('/', getPayments);

// POST /api/payments/initiate
router.post('/initiate', [
    body('payeeId').isUUID().withMessage('Invalid payee ID'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least 1'),
    body('method').isIn(['UPI', 'CASH']).withMessage('Method must be UPI or CASH'),
    body('transactionId').optional().isUUID(),
    body('notes').optional().trim().isLength({ max: 500 }),
], initiatePayment);

// POST /api/payments/:id/verify-otp
router.post('/:id/verify-otp', [
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
], verifyPaymentOtp);

// POST /api/payments/:id/confirm-upi
router.post('/:id/confirm-upi', [
    body('razorpayPaymentId').notEmpty().withMessage('Razorpay payment ID required'),
    body('razorpaySignature').notEmpty().withMessage('Razorpay signature required'),
], confirmUpiPayment);

module.exports = router;
