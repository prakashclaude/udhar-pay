const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { checkMobile, sendOtp, register, login, getProfile, updateProfile, getPaymentInfo } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Validation rules
const mobileValidation = body('mobile')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Invalid Indian mobile number');

const otpValidation = body('otp')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 4-6 digits');

// GET /api/auth/check-mobile
router.get('/check-mobile', checkMobile);

// POST /api/auth/send-otp
router.post('/send-otp', mobileValidation, sendOtp);

// POST /api/auth/register
router.post(
    '/register',
    [
        body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
        mobileValidation,
        otpValidation,
        body('role').optional().isIn(['CUSTOMER', 'SHOPKEEPER', 'WHOLESALER']).withMessage('Invalid role'),
        body('aadhaarNumber').optional().matches(/^\d{12}$/).withMessage('Aadhaar must be 12 digits'),
        body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN format'),
        body('gstNumber').optional().matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/).withMessage('Invalid GST format'),
    ],
    register
);

// POST /api/auth/login
router.post('/login', [mobileValidation, otpValidation], login);

// GET /api/auth/profile (protected)
router.get('/profile', authenticate, getProfile);

// PUT /api/auth/profile (protected)
router.put(
    '/profile',
    authenticate,
    [
        body('name').optional().trim().isLength({ min: 2 }),
        body('aadhaarNumber').optional().matches(/^\d{12}$/).withMessage('Aadhaar must be 12 digits'),
        body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN format'),
        body('gstNumber').optional().matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/).withMessage('Invalid GST format'),
    ],
    updateProfile
);

// GET /api/auth/payment-info/:userId (protected) — used by Pay Now modal to show payee's UPI/bank
router.get('/payment-info/:userId', authenticate, getPaymentInfo);

module.exports = router;
