const prisma = require('./src/config/database');

async function debugPrisma() {
    try {
        console.log("Testing transaction create...");
        const transaction = await prisma.transaction.create({
            data: {
                amount: 200,
                type: 'CREDIT',
                module: 'SHOP',
                description: 'test description',
                senderId: '593a2fa7-5ae9-465b-b7a3-e35e53c59efe',
                receiverId: 'c4dc72aa-6062-4325-9960-950a2ce476c1',
                invoiceNumber: null,
                invoiceDate: null,
            },
            include: {
                sender: { select: { id: true, name: true, mobile: true, role: true } },
                receiver: { select: { id: true, name: true, mobile: true, role: true } }
            }
        });
        console.log("Success:", transaction.id);
    } catch (e) {
        console.log("PRISMA ERROR CAUGHT!");
        console.log(e);
        console.log(e.stack);
    }
}

debugPrisma();
