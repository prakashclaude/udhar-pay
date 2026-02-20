const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { generateToken, generateOtp } = require('../utils/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const smsService = require('../services/smsService');

/**
 * GET /api/auth/check-mobile
 * Check if a mobile number is registered
 */
async function checkMobile(req, res) {
    try {
        const { mobile } = req.query;
        if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        }
        const user = await prisma.user.findUnique({
            where: { mobile },
            select: { id: true, name: true, role: true },
        });
        res.json({ success: true, data: { exists: !!user, name: user?.name, role: user?.role } });
    } catch (error) {
        console.error('checkMobile error:', error);
        res.status(500).json({ success: false, message: 'Failed to check mobile' });
    }
}

/**
 * POST /api/auth/send-otp
 * Send OTP to mobile number for registration/login
 */
async function sendOtp(req, res) {
    try {
        const { mobile, purpose = 'LOGIN' } = req.body;

        if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        }

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Invalidate old OTPs for this mobile
        await prisma.otpLog.updateMany({
            where: { mobile, purpose, used: false },
            data: { used: true },
        });

        // Save new OTP
        await prisma.otpLog.create({
            data: { mobile, otp, purpose, expiresAt },
        });

        // Send SMS
        await smsService.sendOtp(mobile, otp);

        res.json({ success: true, message: `OTP sent to ${mobile}` });
    } catch (error) {
        console.error('sendOtp error:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
}

/**
 * POST /api/auth/register
 * Register a new user
 */
async function register(req, res) {
    try {
        const {
            name, mobile, otp, role = 'CUSTOMER',
            // Optional profile fields
            address, aadhaarNumber, panNumber, gstNumber,
        } = req.body;

        // Validate OTP
        const otpRecord = await prisma.otpLog.findFirst({
            where: {
                mobile,
                otp,
                purpose: 'REGISTER',
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { mobile } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Mobile number already registered' });
        }

        // Validate GST for non-business roles
        if (gstNumber && role === 'CUSTOMER') {
            return res.status(400).json({
                success: false,
                message: 'GST Number is only applicable for Shopkeeper or Wholesaler',
            });
        }

        // Hash a default password (mobile number) — user can change later
        const passwordHash = await bcrypt.hash(mobile, 12);

        // Generate permanent QR code identifier (based on mobile, never changes)
        const qrCode = `UDHAR-${mobile}`;

        // Create user with encrypted sensitive fields
        const user = await prisma.user.create({
            data: {
                name,
                mobile,
                passwordHash,
                role,
                qrCode,
                address: address || null,
                aadhaarNumber: aadhaarNumber ? encrypt(aadhaarNumber) : null,
                panNumber: panNumber ? encrypt(panNumber) : null,
                gstNumber: gstNumber ? encrypt(gstNumber) : null,
            },
            select: {
                id: true, name: true, mobile: true, role: true,
                address: true, qrCode: true, createdAt: true,
            },
        });

        // Mark OTP as used
        await prisma.otpLog.update({ where: { id: otpRecord.id }, data: { used: true } });

        const token = generateToken({ userId: user.id, role: user.role });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: { user, token },
        });
    } catch (error) {
        console.error('register error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
}

/**
 * POST /api/auth/login
 * Login with mobile + OTP
 */
/**
 * POST /api/auth/login
 * Login with mobile + OTP or Password
 */
async function login(req, res) {
    try {
        const { mobile, otp, password } = req.body;
        console.log('Login attempt:', { mobile, hasOtp: !!otp, hasPassword: !!password });

        const user = await prisma.user.findUnique({
            where: { mobile },
            select: {
                id: true, name: true, mobile: true, role: true,
                address: true, qrCode: true, isActive: true, passwordHash: true
            },
        });

        if (!user) {
            console.log('User not found:', mobile);
            return res.status(404).json({ success: false, message: 'User not found or deactivated' });
        }
        if (!user.isActive) {
            console.log('User inactive:', mobile);
            return res.status(404).json({ success: false, message: 'User not found or deactivated' });
        }

        // LOGIN WITH PASSWORD
        if (password) {
            console.log('Verifying password for:', mobile);
            if (!user.passwordHash) {
                console.log('No password hash for user');
                return res.status(400).json({ success: false, message: 'Password not set for this user' });
            }
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isMatch) {
                console.log('Password mismatch');
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
            console.log('Password matched');
        }
        // LOGIN WITH OTP
        else if (otp) {
            const otpRecord = await prisma.otpLog.findFirst({
                where: {
                    mobile,
                    otp,
                    purpose: 'LOGIN',
                    used: false,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: 'desc' },
            });

            if (!otpRecord) {
                return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
            }
            await prisma.otpLog.update({ where: { id: otpRecord.id }, data: { used: true } });
        }
        else {
            return res.status(400).json({ success: false, message: 'OTP or Password required' });
        }

        const token = generateToken({ userId: user.id, role: user.role });

        // Remove sensitive hash from response
        const { passwordHash, ...userWithoutHash } = user;

        res.json({
            success: true,
            message: 'Login successful',
            data: { user: userWithoutHash, token },
        });
    } catch (error) {
        console.error('login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
}

/**
 * GET /api/auth/profile
 * Get current user's profile (with decrypted sensitive fields)
 */
async function getProfile(req, res) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, name: true, mobile: true, role: true,
                address: true, aadhaarNumber: true, panNumber: true,
                gstNumber: true, qrCode: true, createdAt: true,
                upiId: true, bankAccountNumber: true, bankIfsc: true,
                bankAccountName: true, bankName: true,
            },
        });

        // Ensure permanent qrCode (migrate old timestamped format or missing)
        const permanentQR = `UDHAR-${user.mobile}`;
        if (!user.qrCode || user.qrCode !== permanentQR) {
            await prisma.user.update({ where: { id: user.id }, data: { qrCode: permanentQR } });
            user.qrCode = permanentQR;
        }

        // Decrypt sensitive fields before sending
        const profile = {
            ...user,
            aadhaarNumber: user.aadhaarNumber ? decrypt(user.aadhaarNumber) : null,
            panNumber: user.panNumber ? decrypt(user.panNumber) : null,
            gstNumber: user.gstNumber ? decrypt(user.gstNumber) : null,
        };

        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('getProfile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
}

/**
 * PUT /api/auth/profile
 * Update user profile
 */
async function updateProfile(req, res) {
    try {
        const { name, address, aadhaarNumber, panNumber, gstNumber,
            upiId, bankAccountNumber, bankIfsc, bankAccountName, bankName } = req.body;

        if (gstNumber && req.user.role === 'CUSTOMER') {
            return res.status(400).json({
                success: false,
                message: 'GST Number is only applicable for Shopkeeper or Wholesaler',
            });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (aadhaarNumber !== undefined) updateData.aadhaarNumber = aadhaarNumber ? encrypt(aadhaarNumber) : null;
        if (panNumber !== undefined) updateData.panNumber = panNumber ? encrypt(panNumber) : null;
        if (gstNumber !== undefined) updateData.gstNumber = gstNumber ? encrypt(gstNumber) : null;
        // Payment details
        if (upiId !== undefined) updateData.upiId = upiId || null;
        if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber || null;
        if (bankIfsc !== undefined) updateData.bankIfsc = bankIfsc ? bankIfsc.toUpperCase() : null;
        if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName || null;
        if (bankName !== undefined) updateData.bankName = bankName || null;

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true, name: true, mobile: true, role: true,
                address: true, qrCode: true, updatedAt: true,
                upiId: true, bankAccountNumber: true, bankIfsc: true,
                bankAccountName: true, bankName: true,
            },
        });

        res.json({ success: true, message: 'Profile updated successfully', data: user });
    } catch (error) {
        console.error('updateProfile error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
}

/**
 * GET /api/auth/payment-info/:userId
 * Get payment details (UPI/bank) for any user — used by Pay Now modal
 */
async function getPaymentInfo(req, res) {
    try {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, name: true, mobile: true, role: true,
                upiId: true, bankAccountNumber: true, bankIfsc: true,
                bankAccountName: true, bankName: true,
            },
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('getPaymentInfo error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payment info' });
    }
}

module.exports = { checkMobile, sendOtp, register, login, getProfile, updateProfile, getPaymentInfo };
