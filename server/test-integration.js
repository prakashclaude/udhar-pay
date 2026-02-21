const axios = require('axios');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:5000/api';
// Use fixed OTP '1234' for dev mode testing
const FIXED_OTP = '1234';

const TEST_USER = {
    mobile: '9876543210',
    name: 'Integration Test User',
    role: 'CUSTOMER',
    address: '123 Test Lane',
    aadhaarNumber: '123456789012'
};

let server;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('--- STARTING INTEGRATION TEST (With Fixed OTP) ---');

    // Start Server
    const fs = require('fs');
    const serverLog = fs.openSync('server-integration.log', 'w');
    server = spawn('node', ['index.js'], {
        cwd: __dirname,
        stdio: ['ignore', serverLog, serverLog]
    });

    console.log('Waiting for server (5s)...');
    await sleep(5000);

    try {
        // 1. Send OTP (Simulated)
        // Even if fixed, we must call send-otp endpoint to create the record in DB
        console.log('\n[1] Sending OTP (Expecting 1234)...');
        // Important: Use purpose 'REGISTER' for registration flow
        const otpRes = await axios.post(`${BASE_URL}/auth/send-otp`, {
            mobile: TEST_USER.mobile,
            purpose: 'REGISTER'
        });
        console.log('Response:', otpRes.data);

        // In dev mode with our change, generateOtp returns '1234'
        const otp = FIXED_OTP;
        console.log(`Using Fixed OTP: ${otp}`);

        // 2. Register
        console.log('\n[2] Registering User...');
        try {
            const regRes = await axios.post(`${BASE_URL}/auth/register`, {
                ...TEST_USER,
                otp
            });
            console.log('Registration Success:', regRes.data.message);
            console.log('Token received:', !!regRes.data.data.token);
        } catch (e) {
            if (e.response && e.response.status === 409) {
                console.log('User already registered. Proceeding to login.');
            } else {
                console.error('Registration Failed:', e.response ? e.response.data : e.message);
                throw e;
            }
        }

        // 3. Login (to get fresh token)
        console.log('\n[3] Logging In...');
        // We need to send OTP AGAIN for login flow DB record
        console.log('   Sending Login OTP...');
        await axios.post(`${BASE_URL}/auth/send-otp`, {
            mobile: TEST_USER.mobile,
            purpose: 'LOGIN'
        });

        // Use fixed OTP again
        const loginOtp = FIXED_OTP;
        console.log(`   Login OTP: ${loginOtp}`);

        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            mobile: TEST_USER.mobile,
            otp: loginOtp
        });
        console.log('Login Success:', loginRes.data.message);
        const token = loginRes.data.data.token;

        // 4. Get Profile
        console.log('\n[4] Fetching Profile...');
        const profileRes = await axios.get(`${BASE_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Profile:', profileRes.data.data);
        console.log('Decrypted Aadhaar:', profileRes.data.data.aadhaarNumber);

        // 5. Create Transaction
        console.log('\n[5] Creating Transaction...');
        try {
            const txRes = await axios.post(`${BASE_URL}/transactions`, {
                receiverId: "c4dc72aa-6062-4325-9960-950a2ce476c1",
                amount: 200,
                module: "SHOPKEEPER",
                description: "integration test",
                direction: "gave"
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Transaction Success:', txRes.data.message);
        } catch (error) {
            console.error('\n!!! TRANSACTION CREATION FAILED !!!');
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            } else {
                console.error(error.message);
            }
            throw new Error("Transaction Test Failed");
        }

        console.log('\n!!! INTEGRATION TEST PASSED !!!');

    } catch (error) {
        console.error('\n!!! TEST FAILED !!!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    } finally {
        console.log('Stopping server...');
        server.kill();
        process.exit(0);
    }
}

runTests();
