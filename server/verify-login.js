require('dotenv').config();
const prisma = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function verify() {
    console.log('Verifying Admin Login...');
    const mobile = '9999999999';
    const password = 'admin';

    try {
        const user = await prisma.user.findUnique({ where: { mobile } });

        if (!user) {
            console.log('❌ User NOT FOUND');
            return;
        }
        console.log('✅ User Found:', user.name);
        console.log('Role Value:', `'${user.role}'`);
        console.log('Role Type:', typeof user.role);
        console.log('Is ADMIN?', user.role === 'ADMIN');
        console.log('User Object:', JSON.stringify(user, null, 2));

        if (!user.passwordHash) {
            console.log('❌ No password hash');
            return;
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (isMatch) {
            console.log('✅ Password MATCHES! Login Logic is correct.');
        } else {
            console.log('❌ Password MISMATCH.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
