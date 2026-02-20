require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const txns = await prisma.transaction.findMany({
        where: {
            OR: [
                { sender: { name: { contains: 'Prakash' } } },
                { receiver: { name: { contains: 'Prakash' } } }
            ]
        },
        include: { sender: true, receiver: true, payments: true }
    });
    console.log(JSON.stringify(txns, null, 2));
}
run();
