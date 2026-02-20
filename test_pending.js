const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log("Fetching PENDING payments...");
    const p = await prisma.payment.findMany({ where: { status: 'PENDING' }, include: { payer: { select: { name: true } }, payee: { select: { name: true } } } });
    console.log(JSON.stringify(p, null, 2));
}
main();
