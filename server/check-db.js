require('dotenv').config();
const prisma = require('./src/config/database');
async function check() {
    const payments = await prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { payer: true, payee: true }
    });
    console.log("Recent Payments:");
    payments.forEach(p => console.log(`${p.id} | Amount: ${p.amount} | Method: ${p.method} | Status: ${p.status} | From: ${p.payer.mobile} | To: ${p.payee.mobile}`));
}
check().finally(() => process.exit(0));
