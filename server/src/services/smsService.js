/**
 * SMS Service - MSG91 Integration
 * 
 * To activate: Set MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID in .env
 * Docs: https://docs.msg91.com/
 */

const axios = require('axios');

const BASE_URL = 'https://api.msg91.com/api/v5';

/**
 * Send OTP via MSG91
 * Falls back to console.log in development mode
 */
async function sendOtp(mobile, otp) {
    if (process.env.NODE_ENV !== 'production' || !process.env.MSG91_AUTH_KEY) {
        console.log(`[SMS DEV] OTP for ${mobile}: ${otp}`);
        return { success: true, dev: true };
    }

    try {
        const response = await axios.post(
            `${BASE_URL}/otp`,
            {
                template_id: process.env.MSG91_TEMPLATE_ID,
                mobile: `91${mobile}`,
                authkey: process.env.MSG91_AUTH_KEY,
                otp,
            }
        );
        return response.data;
    } catch (error) {
        console.error('MSG91 sendOtp error:', error.response?.data || error.message);
        throw new Error('Failed to send OTP via SMS');
    }
}

/**
 * Send payment OTP to payee for cash payment verification
 */
async function sendPaymentOtp(mobile, otp, payerName, amount) {
    const message = `UdharPay: ${payerName} is paying you Rs.${amount}. OTP: ${otp}. Valid for 15 mins. Do NOT share.`;

    if (process.env.NODE_ENV !== 'production' || !process.env.MSG91_AUTH_KEY) {
        console.log(`[SMS DEV] Payment OTP for ${mobile}: ${otp} | Message: ${message}`);
        return { success: true, dev: true };
    }

    try {
        const response = await axios.post(`${BASE_URL}/sendhttp.php`, null, {
            params: {
                authkey: process.env.MSG91_AUTH_KEY,
                mobiles: `91${mobile}`,
                message,
                sender: process.env.MSG91_SENDER_ID,
                route: 4,
            },
        });
        return response.data;
    } catch (error) {
        console.error('MSG91 sendPaymentOtp error:', error.response?.data || error.message);
        throw new Error('Failed to send payment OTP via SMS');
    }
}

/**
 * Send payment confirmation SMS
 */
async function sendPaymentConfirmation(mobile, amount, payerName) {
    const message = `UdharPay: Payment of Rs.${amount} received from ${payerName}. Your account has been updated.`;

    if (process.env.NODE_ENV !== 'production' || !process.env.MSG91_AUTH_KEY) {
        console.log(`[SMS DEV] Confirmation for ${mobile}: ${message}`);
        return { success: true, dev: true };
    }

    try {
        const response = await axios.post(`${BASE_URL}/sendhttp.php`, null, {
            params: {
                authkey: process.env.MSG91_AUTH_KEY,
                mobiles: `91${mobile}`,
                message,
                sender: process.env.MSG91_SENDER_ID,
                route: 4,
            },
        });
        return response.data;
    } catch (error) {
        console.error('MSG91 sendPaymentConfirmation error:', error.message);
        // Non-critical, don't throw
        return { success: false };
    }
}

module.exports = { sendOtp, sendPaymentOtp, sendPaymentConfirmation };
