const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testApi() {
    try {
        const prisma = require('./src/config/database');

        const firstUser = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
        if (!firstUser) throw new Error("No customer found");

        console.log(`Using USER: ${firstUser.name} (${firstUser.id})`);

        const token = jwt.sign({ userId: firstUser.id, role: firstUser.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        console.log("Simulating Submit from QR Scanner Form...");
        const payload = {
            receiverId: "c4dc72aa-6062-4325-9960-950a2ce476c1", // Jai Gurudev
            amount: 200,
            module: "SHOPKEEPER",
            description: "paying partial amount",
            direction: "gave"
        };

        const res = await axios.post('http://localhost:5000/api/transactions', payload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("SUCCESS:", res.data);

    } catch (e) {
        console.error("API ERROR DETECTED:");
        if (e.response) {
            console.error(JSON.stringify(e.response.data, null, 2));
        } else {
            console.error(e.message);
            console.error(e.stack);
        }
    }
}

testApi();
