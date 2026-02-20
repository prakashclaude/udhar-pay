const prisma = require('../config/database');
const bcrypt = require('bcryptjs');

exports.repairDb = async (req, res) => {
    try {
        console.log('Starting DB Repair for Netting Logic...');
        const badPayments = await prisma.payment.findMany({
            where: { notes: { startsWith: 'Auto-settlement from recording new transaction' } },
            orderBy: { createdAt: 'asc' }
        });

        let repaired = 0;
        for (const p of badPayments) {
            const newTxn = await prisma.transaction.findFirst({
                where: {
                    senderId: p.payerId,
                    receiverId: p.payeeId,
                    createdAt: { gte: p.createdAt } // Created immediately after the payment
                },
                orderBy: { createdAt: 'asc' }
            });

            if (newTxn) {
                // 1. Restore the shrunk principal amount
                await prisma.transaction.update({
                    where: { id: newTxn.id },
                    data: { amount: { increment: p.amount } }
                });

                // 2. Create the missing double-entry cross payment
                await prisma.payment.create({
                    data: {
                        amount: p.amount,
                        method: 'CASH',
                        status: 'COMPLETED',
                        notes: `Auto-settlement: Offset against previous Udhar taken`,
                        transactionId: newTxn.id,
                        payerId: p.payeeId,
                        payeeId: p.payerId
                    }
                });

                // 3. Rename the old payment to standard double-entry format
                await prisma.payment.update({
                    where: { id: p.id },
                    data: { notes: `Auto-settlement: Offset against new Udhar given` }
                });
                repaired++;
            }
        }
        res.json({ message: `Successfully repaired ${repaired} transactions.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.debugTxns = async (req, res) => {
    try {
        const txns = await prisma.transaction.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { payments: true }
        });
        res.json(txns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getStats = async (req, res) => {
    try {
        const [
            customerCount,
            shopkeeperCount,
            wholesalerCount,
            transactions
        ] = await Promise.all([
            prisma.user.count({ where: { role: 'CUSTOMER' } }),
            prisma.user.count({ where: { role: 'SHOPKEEPER' } }),
            prisma.user.count({ where: { role: 'WHOLESALER' } }),
            prisma.transaction.findMany({ include: { payments: true } }) // Optimize this for large datasets later
        ]);

        let unsettledFriend = 0, unsettledShop = 0, unsettledWholesale = 0;
        let settledAmount = 0;

        transactions.forEach(txn => {
            const paidAmount = txn.payments
                .filter(p => p.status === 'COMPLETED')
                .reduce((sum, p) => sum + p.amount, 0);

            settledAmount += paidAmount;
            const remaining = txn.amount - paidAmount;

            if (remaining > 0) {
                if (txn.module === 'FRIEND') unsettledFriend += remaining;
                else if (txn.module === 'SHOP') unsettledShop += remaining;
                else if (txn.module === 'WHOLESALER') unsettledWholesale += remaining;
            }
        });

        res.json({
            success: true,
            counts: { customer: customerCount, shopkeeper: shopkeeperCount, wholesaler: wholesalerCount },
            financials: {
                settled: settledAmount,
                unsettled: { friend: unsettledFriend, shop: unsettledShop, wholesale: unsettledWholesale }
            }
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
};

const getUsers = async (req, res) => {
    try {
        const { search, role, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const where = {};
        if (role) where.role = role;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { mobile: { contains: search } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, mobile: true, role: true, isActive: true, createdAt: true }
            }),
            prisma.user.count({ where })
        ]);

        res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

const getUserDetails = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id }
        });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { name, mobile, role, isActive, address, aadhaarNumber, panNumber, gstNumber } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: { name, mobile, role, isActive, address, aadhaarNumber, panNumber, gstNumber }
        });
        res.json({ success: true, message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

const getSiteConfig = async (req, res) => {
    try {
        let config = await prisma.siteConfig.findUnique({ where: { id: 'config' } });
        if (!config) {
            config = await prisma.siteConfig.create({ data: { id: 'config' } });
        }
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch config' });
    }
};

const updateSiteConfig = async (req, res) => {
    try {
        const { tagline, aboutUs, contactUs, bannerUrl, contactEmail, contactPhone, contactHours } = req.body;
        const config = await prisma.siteConfig.upsert({
            where: { id: 'config' },
            update: { tagline, aboutUs, contactUs, bannerUrl, contactEmail, contactPhone, contactHours },
            create: { id: 'config', tagline, aboutUs, contactUs, bannerUrl, contactEmail, contactPhone, contactHours }
        });
        res.json({ success: true, message: 'Config updated', config });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update config' });
    }
};

const createAdmin = async (req, res) => {
    try {
        const { name, mobile, password } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { mobile } });
        if (existingUser) return res.status(400).json({ success: false, message: 'Mobile already registered' });

        const passwordHash = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                name,
                mobile,
                passwordHash,
                role: 'ADMIN'
            }
        });

        res.status(201).json({ success: true, message: 'Admin created successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create admin' });
    }
};

module.exports = {
    getStats,
    getUsers,
    getUserDetails,
    updateUser,
    getSiteConfig,
    updateSiteConfig,
    createAdmin,
    repairDb: exports.repairDb,
    debugTxns: exports.debugTxns
};
