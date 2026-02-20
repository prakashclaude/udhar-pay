require('dotenv').config();
const prisma = require('./src/config/database');

async function fixEnumAndRole() {
    console.log('Fixing Enum and Role...');
    const mobile = '9999999999';

    try {
        console.log('Step 1: Adding ADMIN to Role enum...');
        // Try to add 'ADMIN' to the enum type
        try {
            await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE 'ADMIN';`);
            console.log('✅ Added ADMIN to Role enum.');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('⚠️ ADMIN already exists in Role enum.');
            } else {
                console.error('❌ Failed to alter enum:', e.message);
                // Proceed anyway, maybe it failed for another reason but we want to try update
            }
        }

        console.log('Step 2: Updating User Role...');
        const count = await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'ADMIN'::"Role" WHERE "mobile" = '${mobile}';`);
        console.log('✅ Updated rows:', count);

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

fixEnumAndRole();
