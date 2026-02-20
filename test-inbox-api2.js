async function testApi() {
    try {
        console.log("Logging in as Jai Gurudev (9999225703)...");
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: '9999225703',
                password: 'password123'
            })
        });

        const loginData = await loginRes.json();
        const token = loginData.data.token;
        console.log("Login successful! Token acquired.");

        console.log("Fetching /api/transactions/pending-payments...");
        const pendingRes = await fetch('http://localhost:5000/api/transactions/pending-payments', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const pendingData = await pendingRes.json();
        console.log("RESPONSE SUCCESS!");
        console.log(JSON.stringify(pendingData, null, 2));

    } catch (e) {
        console.error("API Error!", e);
    }
}

testApi();
