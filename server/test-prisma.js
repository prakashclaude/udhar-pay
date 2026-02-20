const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPrisma() {
    try {
        console.log("Checking Prisma Notification model...");
        const notifs = await prisma.notification.findMany({ take: 1 });
        console.log("SUCCESS! Found:", notifs.length);
    } catch (e) {
        console.error("PRISMA QUERY FAILED:");
        console.error(e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testPrisma();
