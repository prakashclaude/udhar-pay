const prisma = require('../config/database');
const { decrypt } = require('../utils/encryption');

/**
 * POST /api/transactions
 * Create a new credit transaction (sender gives credit to receiver)
 */
async function createTransaction(req, res) {
    try {
        const { receiverId, amount, module, description, invoiceNumber, invoiceDate, direction } = req.body;
        const senderId = req.user.id;

        // direction: 'gave' = I gave credit (I am sender), 'received' = I received credit (swap roles)
        const actualSenderId = direction === 'received' ? receiverId : senderId;
        const actualReceiverId = direction === 'received' ? senderId : receiverId;

        if (actualSenderId === actualReceiverId) {
            return res.status(400).json({ success: false, message: 'Cannot create transaction with yourself' });
        }

        const receiver = await prisma.user.findUnique({ where: { id: actualReceiverId } });
        if (!receiver) {
            return res.status(404).json({ success: false, message: 'Receiver not found' });
        }

        // ===== SHOP/WHOLESALER Repayment (Inbox Routing) =====
        // If giving money to a Shop or Wholesaler, it acts STRICTLY as a debt repayment. No advance credit.
        if ((module === 'SHOP' || module === 'WHOLESALER') && direction === 'gave') {
            // Find all active debts I owe them
            const existingDebtsToThem = await prisma.transaction.findMany({
                where: { senderId: actualReceiverId, receiverId: actualSenderId },
                include: { payments: { where: { status: 'COMPLETED' } } },
                orderBy: { createdAt: 'asc' }
            });

            let totalOwed = 0;
            const debtsWithUnpaid = [];

            for (const targetTxn of existingDebtsToThem) {
                const paidOff = targetTxn.payments.reduce((sum, p) => sum + p.amount, 0);
                const unpaid = targetTxn.amount - paidOff;
                if (unpaid > 0) {
                    totalOwed += unpaid;
                    debtsWithUnpaid.push({ txn: targetTxn, unpaid });
                }
            }

            const requestedAmount = parseFloat(amount);

            if (requestedAmount > totalOwed) {
                return res.status(400).json({
                    success: false,
                    message: `For ${module.toLowerCase()}s, you cannot pay more than your pending udhar of ₹${totalOwed}.`
                });
            }

            let amountToDistribute = requestedAmount;

            for (const { txn, unpaid } of debtsWithUnpaid) {
                if (amountToDistribute <= 0) break;

                const amountToSettle = Math.min(amountToDistribute, unpaid);

                await prisma.payment.create({
                    data: {
                        amount: amountToSettle,
                        method: 'CASH',
                        status: 'PENDING',
                        notes: description || `Udhar repayment`,
                        transactionId: txn.id,
                        payerId: actualSenderId,
                        payeeId: actualReceiverId,
                    }
                });

                amountToDistribute -= amountToSettle;
            }

            return res.status(201).json({
                success: true,
                message: `Payment of ₹${requestedAmount} submitted and sent to ${receiver.name}'s Inbox for approval.`,
                data: null
            });
        }

        // 1. Create the new transaction with the FULL requested amount
        const transaction = await prisma.transaction.create({
            data: {
                amount: parseFloat(amount),
                type: 'CREDIT',
                module,
                description: description || null,
                senderId: actualSenderId,
                receiverId: actualReceiverId,
                invoiceNumber: invoiceNumber || null,
                invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
            },
            include: {
                sender: { select: { id: true, name: true, mobile: true, role: true } },
                receiver: { select: { id: true, name: true, mobile: true, role: true } },
            },
        });

        // 2. ===== Auto-Settlement (Netting) Logic via Double-Entry Cross-Payments =====
        // Find all active transactions where actualSender owes money to the actualReceiver.
        const existingDebts = await prisma.transaction.findMany({
            where: { senderId: actualReceiverId, receiverId: actualSenderId },
            include: { payments: { where: { status: 'COMPLETED' } } },
            orderBy: { createdAt: 'asc' }
        });

        let amountAvailableToNet = parseFloat(amount);
        let totalSettled = 0;

        for (const targetTxn of existingDebts) {
            if (amountAvailableToNet <= 0) break;

            const paidOff = targetTxn.payments.reduce((sum, p) => sum + p.amount, 0);
            const unpaid = targetTxn.amount - paidOff;

            if (unpaid > 0) {
                const amountToSettle = Math.min(amountAvailableToNet, unpaid);

                // Payment 1: actualSender pays off the OLD debt they owed
                await prisma.payment.create({
                    data: {
                        amount: amountToSettle,
                        method: 'CASH',
                        status: 'COMPLETED',
                        notes: `Auto-settlement: Offset against new Udhar given`,
                        transactionId: targetTxn.id,
                        payerId: actualSenderId,
                        payeeId: actualReceiverId,
                    }
                });

                // Payment 2: actualReceiver automatically "pays" back the exact same amount on the NEW loan
                await prisma.payment.create({
                    data: {
                        amount: amountToSettle,
                        method: 'CASH',
                        status: 'COMPLETED',
                        notes: `Auto-settlement: Offset against previous Udhar taken`,
                        transactionId: transaction.id,
                        payerId: actualReceiverId,
                        payeeId: actualSenderId,
                    }
                });

                amountAvailableToNet -= amountToSettle;
                totalSettled += amountToSettle;
            }
        }

        res.status(201).json({
            success: true,
            message: totalSettled > 0
                ? `Transaction processed. ₹${totalSettled} automatically offset against past debts. Net new credit to collect: ₹${amountAvailableToNet}.`
                : 'Transaction recorded successfully',
            data: {
                transaction,
            },
        });
    } catch (error) {
        console.error('createTransaction error:', error);
        res.status(500).json({ success: false, message: 'Failed to create transaction' });
    }
}

/**
 * GET /api/transactions
 * Get all transactions for the current user
 */
async function getTransactions(req, res) {
    try {
        const userId = req.user.id;
        const { module, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            OR: [{ senderId: userId }, { receiverId: userId }],
        };
        if (module) where.module = module;

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                include: {
                    sender: { select: { id: true, name: true, mobile: true, role: true, address: true, aadhaarNumber: true, gstNumber: true } },
                    receiver: { select: { id: true, name: true, mobile: true, role: true, address: true, aadhaarNumber: true, gstNumber: true } },
                    payments: { select: { id: true, amount: true, method: true, status: true, payerId: true, createdAt: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.transaction.count({ where }),
        ]);

        // Decrypt sensitive fields
        const decryptedTransactions = transactions.map(txn => {
            if (txn.sender.aadhaarNumber) txn.sender.aadhaarNumber = decrypt(txn.sender.aadhaarNumber);
            if (txn.sender.gstNumber) txn.sender.gstNumber = decrypt(txn.sender.gstNumber);

            if (txn.receiver.aadhaarNumber) txn.receiver.aadhaarNumber = decrypt(txn.receiver.aadhaarNumber);
            if (txn.receiver.gstNumber) txn.receiver.gstNumber = decrypt(txn.receiver.gstNumber);

            return txn;
        });

        res.json({
            success: true,
            data: {
                transactions: decryptedTransactions,
                pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
            },
        });
    } catch (error) {
        console.error('getTransactions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
    }
}

/**
 * GET /api/transactions/summary
 * Get credit/debit summary for the current user (accounting for payments)
 */
async function getSummary(req, res) {
    try {
        const userId = req.user.id;

        const allTxns = await prisma.transaction.findMany({
            where: { OR: [{ senderId: userId }, { receiverId: userId }] },
            include: { payments: { where: { status: 'COMPLETED' } } }
        });

        const contactMap = {};

        allTxns.forEach(txn => {
            const iAmSender = txn.senderId === userId;
            const otherId = iAmSender ? txn.receiverId : txn.senderId;

            if (!contactMap[otherId]) {
                contactMap[otherId] = { given: 0, taken: 0, paidByMe: 0, paidByThem: 0 };
            }

            if (iAmSender) {
                contactMap[otherId].given += txn.amount;
            } else {
                contactMap[otherId].taken += txn.amount;
            }

            txn.payments.forEach(p => {
                if (p.payerId === userId) {
                    contactMap[otherId].paidByMe += p.amount;
                } else {
                    contactMap[otherId].paidByThem += p.amount;
                }
            });
        });

        let iStillOwe = 0;
        let othersOweMe = 0;
        let totalGivenRaw = 0;
        let totalTakenRaw = 0;
        let totalPaidBackRaw = 0;
        let totalRecoveredRaw = 0;

        Object.values(contactMap).forEach(c => {
            totalGivenRaw += c.given;
            totalTakenRaw += c.taken;
            totalPaidBackRaw += c.paidByMe;
            totalRecoveredRaw += c.paidByThem;

            const actualTaken = c.taken - c.paidByMe;
            const actualGiven = c.given - c.paidByThem;

            // Net them out for this specific person
            const netBalance = actualGiven - actualTaken;

            if (netBalance > 0) {
                othersOweMe += netBalance;
            } else if (netBalance < 0) {
                iStillOwe += Math.abs(netBalance);
            }
        });

        res.json({
            success: true,
            data: {
                // Raw totals (kept for backwards compat)
                totalGiven: totalGivenRaw,
                totalReceived: totalTakenRaw,
                totalPaidBack: totalPaidBackRaw,
                totalRecovered: totalRecoveredRaw,
                // Net figures (after correctly netting per-person offsets)
                iStillOwe,
                othersOweMe,
                netOutstanding: othersOweMe - iStillOwe,
                netBalance: othersOweMe - iStillOwe,
            },
        });
    } catch (error) {
        console.error('getSummary error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch summary' });
    }
}

/**
 * GET /api/transactions/balance/:userId
 * Get the net balance between the current user and a target user
 */
async function getBalance(req, res) {
    try {
        const selfId = req.user.id;
        const targetId = req.params.userId;

        const txns = await prisma.transaction.findMany({
            where: {
                OR: [
                    { senderId: selfId, receiverId: targetId },
                    { senderId: targetId, receiverId: selfId }
                ]
            },
            include: { payments: { where: { status: 'COMPLETED' } } }
        });

        let udharGiven = 0;
        let udharTaken = 0;
        let paidByMe = 0;
        let paidByThem = 0;

        txns.forEach(txn => {
            if (txn.senderId === selfId) udharGiven += txn.amount;
            else udharTaken += txn.amount;

            (txn.payments || []).forEach(p => {
                if (p.payerId === selfId) paidByMe += p.amount;
                else paidByThem += p.amount;
            });
        });

        const actualTaken = udharTaken - paidByMe;
        const actualGiven = udharGiven - paidByThem;
        const netBalance = actualGiven - actualTaken; // positive = they owe me

        res.json({
            success: true,
            data: {
                targetUserId: targetId,
                netBalance,
                iOweThem: Math.max(0, -netBalance),
                theyOweMe: Math.max(0, netBalance)
            }
        });
    } catch (error) {
        console.error('getBalance error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch balance' });
    }
}

/**
 * GET /api/transactions/by-qr/:qrId
 * Get user by their Udhar-Pay QR ID for quick transaction
 */
async function getUserByQr(req, res) {
    try {
        const { qrCode } = req.params;
        const user = await prisma.user.findUnique({
            where: { qrCode },
            select: { id: true, name: true, mobile: true, role: true, qrCode: true },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'QR code not found' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('getUserByQr error:', error);
        res.status(500).json({ success: false, message: 'Failed to find user by QR' });
    }
}

/**
 * GET /api/transactions/search-user?q=
 * Search users by name or mobile number (excludes self)
 */
async function searchUser(req, res) {
    try {
        const { q } = req.query;
        const selfId = req.user.id;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
        }

        const query = q.trim();

        // Search by mobile (exact prefix) or name (case-insensitive contains)
        const users = await prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: selfId } },
                    { isActive: true },
                    {
                        OR: [
                            { mobile: { startsWith: query } },
                            { name: { contains: query, mode: 'insensitive' } },
                            { qrCode: { equals: query } },
                        ],
                    },
                ],
            },
            select: { id: true, name: true, mobile: true, role: true, qrCode: true, address: true, aadhaarNumber: true, gstNumber: true },
            take: 10,
        });

        // Decrypt search results
        const decryptedUsers = users.map(user => {
            if (user.aadhaarNumber) user.aadhaarNumber = decrypt(user.aadhaarNumber);
            if (user.gstNumber) user.gstNumber = decrypt(user.gstNumber);
            return user;
        });

        res.json({ success: true, data: decryptedUsers });
    } catch (error) {
        console.error('searchUser error:', error);
        res.status(500).json({ success: false, message: 'Failed to search users' });
    }
}

/**
 * POST /api/transactions/:id/pay
 * Record a payment against a transaction (UPI / CASH / CARD)
 */
async function payTransaction(req, res) {
    try {
        const { id } = req.params;
        const { amount, method, notes, upiRef } = req.body;
        const payerId = req.user.id;
        const paymentAmount = parseFloat(amount);

        // Validate method
        const validMethods = ['UPI', 'CASH', 'CARD'];
        if (!validMethods.includes(method)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method. Use UPI, CASH, or CARD' });
        }

        // Find the transaction with its existing payments
        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: {
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } },
                payments: { where: { status: 'COMPLETED' } }
            },
        });

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        // Only sender or receiver can record payment
        if (transaction.senderId !== payerId && transaction.receiverId !== payerId) {
            return res.status(403).json({ success: false, message: 'Not authorized to record payment for this transaction' });
        }

        // Payee is the other party
        const payeeId = payerId === transaction.senderId ? transaction.receiverId : transaction.senderId;
        const status = method === 'CASH' ? 'PENDING' : 'COMPLETED';

        // Calculate how much of this transaction is actually unpaid
        const paidOff = transaction.payments.reduce((sum, p) => sum + p.amount, 0);
        const unpaidBalance = transaction.amount - paidOff;

        let amountToApplyToCurrentTxn = paymentAmount;
        let overpaymentAmount = 0;

        // If trying to pay more than what's owed, split it!
        if (paymentAmount > unpaidBalance) {
            amountToApplyToCurrentTxn = unpaidBalance;
            overpaymentAmount = paymentAmount - unpaidBalance;
        }

        // Create the payment for the exact amount needed to settle (or partial)
        const payment = await prisma.payment.create({
            data: {
                amount: amountToApplyToCurrentTxn,
                method,
                status,
                payerId,
                payeeId,
                transactionId: id,
                notes: notes || null,
                upiRef: upiRef || null,
            },
        });

        let newReverseTransaction = null;

        // If there was an overpayment, it becomes a NEW loan from the payer to the payee
        if (overpaymentAmount > 0) {
            newReverseTransaction = await prisma.transaction.create({
                data: {
                    amount: overpaymentAmount,
                    type: 'CREDIT',
                    module: transaction.module, // Inherit the same module type
                    description: `Auto-recorded overpayment from previous settlement of ₹${paymentAmount}`,
                    senderId: payerId,
                    receiverId: payeeId, // The person who was receiving the payment now owes the overpayment amount
                }
            });

            // If the original payment was CASH, the overpayment transaction needs to hit the ledger but we 
            // also need to record that the cash for this new loan was already handed over in the same physical exchange.
            // But since the netting logic usually puts the burden of approval on the receiver, we just create the transaction.
            // The existing `Pending Cash Approval` for the primary payment covers the physical cash transfer.
        }

        let successMessage = `Payment of ₹${amountToApplyToCurrentTxn} via ${method} recorded successfully.`;
        if (overpaymentAmount > 0) {
            successMessage = `Payment of ₹${paymentAmount} processed. ₹${amountToApplyToCurrentTxn} settled debt, and ₹${overpaymentAmount} was recorded as a new Udhar Given.`;
        }

        res.status(201).json({
            success: true,
            message: successMessage,
            data: {
                payment,
                newReverseTransaction
            },
        });
    } catch (error) {
        console.error('payTransaction error:', error);
        res.status(500).json({ success: false, message: 'Failed to record payment' });
    }
}

/**
 * GET /api/transactions/pending-payments
 * Get pending cash payments where current user is the payee
 */
async function getPendingPayments(req, res) {
    try {
        const userId = req.user.id;
        const payments = await prisma.payment.findMany({
            where: {
                OR: [{ payeeId: userId }, { payerId: userId }],
                status: 'PENDING',
                method: 'CASH',
            },
            include: {
                payer: { select: { id: true, name: true, mobile: true, role: true } },
                payee: { select: { id: true, name: true, mobile: true, role: true } },
                transaction: { select: { id: true, amount: true, description: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        console.log(`[DEBUG] getPendingPayments for userId=${userId} found ${payments.length} payments.`);
        if (payments.length > 0) {
            console.log(`[DEBUG] First payment payerId=${payments[0].payerId}, payeeId=${payments[0].payeeId}`);
        }

        res.json({ success: true, data: payments });
    } catch (error) {
        console.error('getPendingPayments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending payments' });
    }
}

/**
 * POST /api/transactions/payments/:id/respond
 * Approve or reject a pending cash payment
 */
async function respondToPayment(req, res) {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'APPROVE' or 'REJECT'
        const userId = req.user.id;

        const payment = await prisma.payment.findUnique({ where: { id } });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.payeeId !== userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to respond to this payment' });
        }

        if (payment.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Payment is not pending' });
        }

        const newStatus = action === 'APPROVE' ? 'COMPLETED' : 'FAILED'; // FAILED or REJECTED depending on enum, using FAILED as per schema

        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: { status: newStatus },
        });

        res.json({
            success: true,
            message: `Payment ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
            data: updatedPayment,
        });
    } catch (error) {
        console.error('respondToPayment error:', error);
        res.status(500).json({ success: false, message: 'Failed to respond to payment' });
    }
}

/**
 * POST /api/transactions/remind
 * Send a notification reminder
 */
async function sendReminder(req, res) {
    try {
        const { receiverId } = req.body;
        const senderId = req.user.id;

        const sender = await prisma.user.findUnique({ where: { id: senderId } });

        const notification = await prisma.notification.create({
            data: {
                userId: receiverId,
                title: 'Payment Reminder',
                message: `${sender.name} has requested you to settle your pending Udhar.`,
                type: 'REMINDER'
            }
        });

        res.json({ success: true, data: notification });
    } catch (error) {
        console.error('sendReminder error:', error);
        res.status(500).json({ success: false, message: 'Failed to send reminder' });
    }
}

/**
 * GET /api/transactions/notifications
 * Get all notifications for the current user
 */
async function getNotifications(req, res) {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('getNotifications error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
}

/**
 * PUT /api/transactions/notifications/:id/read
 * Mark a notification as read
 */
async function markNotificationRead(req, res) {
    try {
        const { id } = req.params;
        const notification = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ success: true, data: notification });
    } catch (error) {
        console.error('markNotificationRead error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notification read' });
    }
}

module.exports = { createTransaction, getTransactions, getSummary, getUserByQr, searchUser, payTransaction, getPendingPayments, respondToPayment, sendReminder, getNotifications, markNotificationRead, getBalance };
