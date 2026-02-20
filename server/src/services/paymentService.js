/**
 * Payment Service - Razorpay Integration
 * 
 * To activate: Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env
 * Docs: https://razorpay.com/docs/
 */

const crypto = require('crypto');

let Razorpay;
let razorpayInstance;

// Lazy-load Razorpay to avoid crash if not installed
try {
    Razorpay = require('razorpay');
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
} catch (e) {
    console.warn('[PaymentService] Razorpay not installed. Run: npm install razorpay');
}

/**
 * Create a Razorpay order
 * Falls back to mock in development
 */
async function createOrder(amount, payerId, payeeId) {
    if (!razorpayInstance) {
        console.log(`[PAYMENT DEV] Mock order created: Rs.${amount} from ${payerId} to ${payeeId}`);
        return {
            id: `order_dev_${Date.now()}`,
            amount: amount * 100,
            currency: 'INR',
            status: 'created',
        };
    }

    const order = await razorpayInstance.orders.create({
        amount: Math.round(parseFloat(amount) * 100), // Razorpay uses paise
        currency: 'INR',
        notes: { payerId, payeeId },
    });

    return order;
}

/**
 * Verify Razorpay payment signature
 */
function verifySignature(orderId, paymentId, signature) {
    if (!process.env.RAZORPAY_KEY_SECRET) {
        console.log('[PAYMENT DEV] Signature verification skipped in dev mode');
        return true;
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
}

/**
 * Fetch payment details from Razorpay
 */
async function fetchPayment(paymentId) {
    if (!razorpayInstance) {
        return { id: paymentId, status: 'captured', dev: true };
    }
    return razorpayInstance.payments.fetch(paymentId);
}

module.exports = { createOrder, verifySignature, fetchPayment };
