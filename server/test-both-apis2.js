const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testApi() {
    try {
        console.log("Generating token for Jai Gurudev (c4dc72aa-6062-4325-9960-950a2ce476c1)...");

        const userId = "c4dc72aa-6062-4325-9960-950a2ce476c1";
        const token = jwt.sign({ userId: userId, role: 'SHOPKEEPER' }, process.env.JWT_SECRET, { expiresIn: '1d' });

        console.log("Token acquired.");

        console.log("Fetching /api/transactions/pending-payments...");
        const pendingRes = await axios.get('http://localhost:5000/api/transactions/pending-payments', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("PENDING PAYMENTS:", pendingRes.data.data.length);

        console.log("Fetching /api/transactions/notifications...");
        const notifRes = await axios.get('http://localhost:5000/api/transactions/notifications', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("NOTIFICATIONS SUCCESS:", notifRes.data.data.length);

    } catch (e) {
        console.error("API Error!");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
        } else {
            console.error(e.message);
        }
    }
}

testApi();
