const prisma = require('./src/config/database');

async function testPrisma() {
    try {
        console.log("Creating transaction directly via Prisma...");
        const transaction = await prisma.transaction.create({
            data: {
                amount: 200,
                type: 'CREDIT',
                module: 'SHOPKEEPER',
                description: 'direct prisma test',
                senderId: '593a2fa7-5ae9-465b-b7a3-e35e53c59efe', // Integration Test User
                receiverId: 'c4dc72aa-6062-4325-9960-950a2ce476c1', // Jai Gurudev
            }
        });
        console.log("SUCCESS!", transaction.id);
    } catch (e) {
        console.error("PRISMA ERROR IS:");
        console.error(e.message);
    }
}

testPrisma();
