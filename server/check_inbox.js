require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
    try {
        const shopkeeperId = 'c4dc72aa-6062-4325-9960-950a2ce476c1';
        const payments = await prisma.payment.findMany({
            where: {
                payeeId: shopkeeperId,
                status: 'PENDING',
                method: 'CASH',
            },
            include: {
                payer: { select: { id: true, name: true, mobile: true, role: true } },
                transaction: { select: { id: true, amount: true, description: true } },
            }
        });

        fs.writeFileSync('inbox_verify.json', JSON.stringify(payments, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
