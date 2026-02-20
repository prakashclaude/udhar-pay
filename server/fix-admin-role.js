require('dotenv').config();
const prisma = require('./src/config/database');
const { Role } = require('@prisma/client');

async function fixRole() {
    console.log('Fixing Admin Role...');
    const mobile = '9999999999';

    try {
        const user = await prisma.user.findUnique({ where: { mobile } });
        console.log('Current User State:', user?.mobile, user?.role);

        if (!user) {
            console.log('User not found! Creating...');
            // Create if missing (unlikely based on logs)
            // ... logic omitted for brevity, assuming exists based on logs
        } else {
            const updated = await prisma.user.update({
                where: { mobile },
                data: { role: Role.ADMIN }
            });
            console.log('✅ User Role Updated to:', updated.role);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

fixRole();
