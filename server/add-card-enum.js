const { Client } = require('pg');
require('dotenv').config();

async function addCardEnum() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/udhar_pay_db?schema=public'
    });
    try {
        await client.connect();
        await client.query(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CARD'`);
        console.log('✅ CARD added to PaymentMethod enum successfully');

        // Verify
        const res = await client.query(`SELECT unnest(enum_range(NULL::"PaymentMethod"))::text as value`);
        console.log('Current PaymentMethod values:', res.rows.map(r => r.value));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

addCardEnum();
