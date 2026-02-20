require('dotenv').config();
const prisma = require('./src/config/database');
const { Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
    const mobile = '9999999999'; // Default Admin Mobile
    const password = 'admin'; // Default Admin Password
    const name = 'Super Admin';

    const existingAdmin = await prisma.user.findUnique({
        where: { mobile }
    });

    if (existingAdmin) {
        console.log('Admin user already exists.');
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
        data: {
            name,
            mobile,
            passwordHash,
            role: Role.ADMIN,
            address: 'Headquarters',
            aadhaarNumber: '000000000000', // Dummy
            panNumber: 'ABCDE1234F',      // Dummy
            qrCode: 'UDHAR-9999999999'
        }
    });

    console.log(`Admin created: ${admin.mobile} / ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        require('fs').writeFileSync('seed-error.log', e.toString());
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
