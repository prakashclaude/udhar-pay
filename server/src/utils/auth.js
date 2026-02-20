const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a user
 */
function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
}

/**
 * Verify a JWT token
 */
function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Generate a random 6-digit OTP
 */
function generateOtp() {
    if (process.env.NODE_ENV === 'development') {
        return '1234';
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { generateToken, verifyToken, generateOtp };
