require('dotenv').config();
const prisma = require('./src/config/database');
const { Role } = require('@prisma/client');

async function debug() {
    console.log('--- DEBUG ROLE ---');
    console.log('Role Object:', Role);

    if (!Role) {
        console.error('CRITICAL: Role object is undefined!');
    } else {
        console.log('Role.ADMIN:', Role.ADMIN);
        console.log('Type of Role.ADMIN:', typeof Role.ADMIN);
    }

    const mobile = '9999999999';
    const user = await prisma.user.findUnique({ where: { mobile } });
    console.log('Current DB User Role:', user?.role);

    // Try update with explicit string if Enum fails
    console.log('Attempting update to "ADMIN"...');
    try {
        const updated = await prisma.user.update({
            where: { mobile },
            data: { role: 'ADMIN' }
        });
        console.log('Update Result:', updated.role);
    } catch (e) {
        console.error('Update Failed:', e.message);
    }

    await prisma.$disconnect();
}

debug();
