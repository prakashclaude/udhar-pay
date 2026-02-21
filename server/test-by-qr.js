const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testApi() {
    try {
        const userId = "c4dc72aa-6062-4325-9960-950a2ce476c1"; // Jai Gurudev
        const token = jwt.sign({ userId, role: 'SHOPKEEPER' }, process.env.JWT_SECRET, { expiresIn: '1d' });

        console.log("Fetching /api/transactions/balance/c4dc72aa-6062-4325-9960-950a2ce476c1...");
        const res = await axios.get('http://localhost:5000/api/transactions/balance/c4dc72aa-6062-4325-9960-950a2ce476c1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("SUCCESS:", res.data);

    } catch (e) {
        console.error("API Error!");
        if (e.response) {
            console.error("Data:", e.response.data);
        } else {
            console.error(e.message);
        }
    }
}

testApi();
