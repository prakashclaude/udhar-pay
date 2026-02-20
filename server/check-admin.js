require('dotenv').config();
const prisma = require('./src/config/database');

async function check() {
    try {
        const admin = await prisma.user.findUnique({
            where: { mobile: '9999999999' }
        });
        console.log('Admin User:', admin);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
