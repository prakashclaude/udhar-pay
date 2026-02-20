require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function run() {
    console.log('Fetching payments...');
    const payments = await prisma.payment.findMany({
        include: { transaction: true },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    fs.writeFileSync('debug_payments.json', JSON.stringify(payments, null, 2));

    console.log('Fetching txns...');
    const txns = await prisma.transaction.findMany({
        include: { payments: true },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    fs.writeFileSync('debug_txns.json', JSON.stringify(txns, null, 2));

    console.log('Done');
}
run().catch(console.error).finally(() => prisma.$disconnect());
