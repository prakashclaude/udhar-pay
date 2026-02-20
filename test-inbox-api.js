const axios = require('axios');

async function testApi() {
    try {
        console.log("Logging in as Jai Gurudev (9999225703)...");
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            mobile: '9999225703',
            password: 'password123'
        });

        const token = loginRes.data.data.token;
        console.log("Login successful! Token acquired.");

        console.log("Fetching /api/transactions/pending-payments...");
        const pendingRes = await axios.get('http://localhost:5000/api/transactions/pending-payments', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("RESPONSE SUCCESS!");
        console.log(JSON.stringify(pendingRes.data, null, 2));

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
