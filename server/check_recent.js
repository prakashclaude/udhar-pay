const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentPayments() {
    try {
        console.log("Checking recent payments...");
        const payments = await prisma.payment.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                payer: { select: { name: true, mobile: true } },
                payee: { select: { name: true, mobile: true } },
                transaction: { select: { module: true, amount: true } }
            }
        });

        console.log(JSON.stringify(payments, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
checkRecentPayments();
