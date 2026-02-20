require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('Starting DB Repair for Netting Logic...');

    // Find all legacy single-entry settlement payments
    const badPayments = await prisma.payment.findMany({
        where: { notes: { startsWith: 'Auto-settlement from recording new transaction' } },
        orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${badPayments.length} legacy payments to repair.`);

    let repaired = 0;
    for (const p of badPayments) {
        // Find the transaction that was created right after this payment, by the same user pair
        const newTxn = await prisma.transaction.findFirst({
            where: {
                senderId: p.payerId,
                receiverId: p.payeeId,
                createdAt: { gte: p.createdAt }
            },
            orderBy: { createdAt: 'asc' }
        });

        if (newTxn) {
            console.log(`Repairing Txn ${newTxn.id}: Increasing amount by ${p.amount}`);

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
        } else {
            console.log(`Could NOT find matching new transaction for payment ${p.id}.`);
        }
    }

    console.log(`Successfully repaired ${repaired} transactions.`);
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
