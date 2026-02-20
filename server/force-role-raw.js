require('dotenv').config();
const prisma = require('./src/config/database');

async function force() {
    console.log('Forcing Admin Role via Raw SQL...');
    const mobile = '9999999999';

    try {
        // Use double quotes for table name "User" if case-sensitive in Postgres (Prisma default)
        // Or "users" if mapped. Prisma usually maps model User to table "User" or "users".
        // Let's try "User" first (default).
        // Safest is to try both or check schema mapping.
        // But usually Prisma maps `model User` -> `table "User"` (capitalized) in Postgres unless @@map is used.
        // My schema didn't have @@map.

        const count = await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'ADMIN'::"Role" WHERE "mobile" = '${mobile}';`);
        console.log('Updated rows:', count);

    } catch (e) {
        console.error('Error with "User":', e.message);
        try {
            // Fallback to lowercase "user" or "users"
            const count2 = await prisma.$executeRawUnsafe(`UPDATE "users" SET "role" = 'ADMIN'::"Role" WHERE "mobile" = '${mobile}';`);
            console.log('Updated rows (users):', count2);
        } catch (e2) {
            console.error('Error with "users":', e2.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

force();
