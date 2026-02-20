// Script to add UPI/bank payment fields to users table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Add columns if they don't exist (using raw SQL)
        await prisma.$executeRawUnsafe(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS "upiId" TEXT,
            ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
            ADD COLUMN IF NOT EXISTS "bankIfsc" TEXT,
            ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT,
            ADD COLUMN IF NOT EXISTS "bankName" TEXT;
        `);
        console.log('✅ Payment fields added successfully to users table!');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
