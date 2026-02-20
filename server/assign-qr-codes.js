/**
 * One-time script: Assign permanent QR codes to all users who don't have one.
 * QR code format: UDHAR-{mobile} — simple, permanent, never changes.
 * Run with: node assign-qr-codes.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignQRCodes() {
    console.log('🔍 Finding users without QR codes...');

    const users = await prisma.user.findMany({
        where: { qrCode: null },
        select: { id: true, mobile: true, name: true }
    });

    if (users.length === 0) {
        console.log('✅ All users already have QR codes!');
    } else {
        console.log(`📋 Found ${users.length} user(s) without QR codes:`);
        for (const user of users) {
            // Permanent format: UDHAR-{mobile} — simple and never changes
            const qrCode = `UDHAR-${user.mobile}`;
            await prisma.user.update({
                where: { id: user.id },
                data: { qrCode }
            });
            console.log(`  ✅ ${user.name} (${user.mobile}) → qrCode: ${qrCode}`);
        }
    }

    // Also show ALL users and their QR codes for verification
    console.log('\n📊 All users in database:');
    const allUsers = await prisma.user.findMany({
        select: { id: true, mobile: true, name: true, qrCode: true, role: true }
    });
    allUsers.forEach(u => {
        console.log(`  👤 ${u.name} | ${u.mobile} | role: ${u.role} | qrCode: ${u.qrCode}`);
    });

    await prisma.$disconnect();
    console.log('\n✅ Done!');
}

assignQRCodes().catch(err => {
    console.error('❌ Error:', err);
    prisma.$disconnect();
    process.exit(1);
});
