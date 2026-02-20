const prisma = require('../config/database');
const { generateOtp } = require('../utils/auth');
const smsService = require('../services/smsService');
const paymentService = require('../services/paymentService');

/**
 * POST /api/payments/initiate
 * Initiate a payment (UPI or Cash+OTP)
 */
async function initiatePayment(req, res) {
    try {
        const { transactionId, amount, method, payeeId, notes } = req.body;
        const payerId = req.user.id;

        const payee = await prisma.user.findUnique({ where: { id: payeeId } });
        if (!payee) {
            return res.status(404).json({ success: false, message: 'Payee not found' });
        }

        let paymentData = {
            amount: parseFloat(amount),
            method,
            payerId,
            payeeId,
            transactionId: transactionId || null,
            notes: notes || null,
            status: 'PENDING',
        };

        if (method === 'CASH') {
            // Generate OTP for cash payment verification
            const otp = generateOtp();
            const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            paymentData.otp = otp;
            paymentData.otpExpiresAt = otpExpiresAt;

            // Send OTP to payee (receiver confirms cash was received)
            await smsService.sendPaymentOtp(payee.mobile, otp, req.user.name, amount);
        } else if (method === 'UPI') {
            // Create Razorpay order
            const order = await paymentService.createOrder(amount, payerId, payeeId);
            paymentData.upiRef = order.id;
        }

        const payment = await prisma.payment.create({
            data: paymentData,
            include: {
                payer: { select: { id: true, name: true, mobile: true } },
                payee: { select: { id: true, name: true, mobile: true } },
            },
        });

        res.status(201).json({
            success: true,
            message: method === 'CASH' ? 'OTP sent to payee for verification' : 'Payment order created',
            data: payment,
        });
    } catch (error) {
        console.error('initiatePayment error:', error);
        res.status(500).json({ success: false, message: 'Failed to initiate payment' });
    }
}

/**
 * POST /api/payments/:id/verify-otp
 * Verify OTP for cash payment (called by payee)
 */
async function verifyPaymentOtp(req, res) {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        const payment = await prisma.payment.findUnique({ where: { id } });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.payeeId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Only the payee can verify this OTP' });
        }

        if (payment.otpVerified) {
            return res.status(400).json({ success: false, message: 'OTP already verified' });
        }

        if (payment.otp !== otp || new Date() > payment.otpExpiresAt) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: { otpVerified: true, status: 'COMPLETED' },
        });

        res.json({ success: true, message: 'Payment verified successfully', data: updatedPayment });
    } catch (error) {
        console.error('verifyPaymentOtp error:', error);
        res.status(500).json({ success: false, message: 'Failed to verify OTP' });
    }
}

/**
 * POST /api/payments/:id/confirm-upi
 * Confirm UPI payment after Razorpay callback
 */
async function confirmUpiPayment(req, res) {
    try {
        const { id } = req.params;
        const { razorpayPaymentId, razorpaySignature } = req.body;

        const payment = await prisma.payment.findUnique({ where: { id } });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Verify Razorpay signature
        const isValid = paymentService.verifySignature(payment.upiRef, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: { status: 'COMPLETED', upiRef: razorpayPaymentId },
        });

        res.json({ success: true, message: 'UPI payment confirmed', data: updatedPayment });
    } catch (error) {
        console.error('confirmUpiPayment error:', error);
        res.status(500).json({ success: false, message: 'Failed to confirm UPI payment' });
    }
}

/**
 * GET /api/payments
 * Get payment history for current user
 */
async function getPayments(req, res) {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where: { OR: [{ payerId: userId }, { payeeId: userId }] },
                include: {
                    payer: { select: { id: true, name: true, mobile: true } },
                    payee: { select: { id: true, name: true, mobile: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.payment.count({ where: { OR: [{ payerId: userId }, { payeeId: userId }] } }),
        ]);

        res.json({
            success: true,
            data: {
                payments,
                pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
            },
        });
    } catch (error) {
        console.error('getPayments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
}

module.exports = { initiatePayment, verifyPaymentOtp, confirmUpiPayment, getPayments };
