const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNetting() {
    console.log("Starting netting test...");

    // Create User A and User B
    const userA = await prisma.user.create({ data: { name: 'User A', mobile: '1111111111', passwordHash: 'test' } });
    const userB = await prisma.user.create({ data: { name: 'User B', mobile: '2222222222', passwordHash: 'test' } });

    console.log(`Created User A: ${userA.id} and User B: ${userB.id}`);

    // User A gives User B 1500
    const tx1 = await prisma.transaction.create({
        data: { senderId: userA.id, receiverId: userB.id, amount: 1500, type: 'CREDIT', module: 'FRIEND' }
    });
    console.log(`User A gave User B 1500. Tx1: ${tx1.id}`);

    // User B pays User A 500 (Completed)
    await prisma.payment.create({
        data: { transactionId: tx1.id, payerId: userB.id, payeeId: userA.id, amount: 500, method: 'CASH', status: 'COMPLETED' }
    });
    console.log(`User B paid 500. Unpaid debt is 1000.`);

    // NOW User B gives User A 2000. We call the netting logic exactly as in controller.
    const actualSenderId = userB.id;
    const actualReceiverId = userA.id;
    let remainingAmountToRecord = 2000;

    // existingDebts
    const existingDebts = await prisma.transaction.findMany({
        where: { senderId: actualReceiverId, receiverId: actualSenderId },
        include: { payments: { where: { status: 'COMPLETED' } } }
    });

    let totalUnpaidDebt = 0;
    const pendingTxnsToPay = [];
    for (const txn of existingDebts) {
        const paidOff = txn.payments.reduce((sum, p) => sum + p.amount, 0);
        const unpaid = txn.amount - paidOff;
        if (unpaid > 0) {
            totalUnpaidDebt += unpaid;
            pendingTxnsToPay.push({ txnId: txn.id, unpaid });
        }
    }

    console.log(`User B owes User A total Unpaid: ${totalUnpaidDebt}`);

    let settledAmount = 0;
    let settlementPayment = null;
    if (totalUnpaidDebt > 0) {
        settledAmount = Math.min(remainingAmountToRecord, totalUnpaidDebt);
        remainingAmountToRecord -= settledAmount;

        if (pendingTxnsToPay.length > 0) {
            const targetTxn = pendingTxnsToPay[0];
            settlementPayment = await prisma.payment.create({
                data: {
                    amount: settledAmount,
                    method: 'CASH',
                    status: 'PENDING',
                    notes: 'Auto-settlement',
                    transactionId: targetTxn.txnId,
                    payerId: actualSenderId,
                    payeeId: actualReceiverId,
                }
            });
        }
    }

    let transaction = null;
    if (remainingAmountToRecord > 0) {
        transaction = await prisma.transaction.create({
            data: {
                amount: remainingAmountToRecord,
                type: 'CREDIT',
                module: 'FRIEND',
                senderId: actualSenderId,
                receiverId: actualReceiverId,
            }
        });
    }

    console.log(`Resulting logic state:`);
    console.log(`Settled Amount: ${settledAmount}`);
    console.log(`Remaining Amount to Record: ${remainingAmountToRecord}`);
    console.log(`New Tx created:`, transaction ? transaction.amount : 'None');
    console.log(`New pending payment:`, settlementPayment ? settlementPayment.amount : 'None');

    await prisma.user.deleteMany({ where: { mobile: { in: ['1111111111', '2222222222'] } } });
}

testNetting().catch(console.error).finally(() => prisma.$disconnect());
