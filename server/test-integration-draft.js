const axios = require('axios');
const { spawn } = require('child_process');

// Constants
const BASE_URL = 'http://localhost:5000/api';
const TEST_USER = {
    mobile: '9876543210',
    name: 'Test User',
    role: 'CUSTOMER',
    address: 'Test Address',
    // Aadhaar etc. optional
};

async function runTests() {
    console.log('Starting server...');
    const server = spawn('node', ['index.js'], { stdio: 'pipe', cwd: __dirname });

    // Wait for server to start
    await new Promise((resolve) => {
        server.stdout.on('data', (data) => {
            const msg = data.toString();
            // console.log(`SERVER: ${msg}`);
            if (msg.includes('running on')) resolve();
        });
    });
    console.log('Server started.');

    try {
        // 1. Send OTP (Simulated)
        console.log('1. Sending OTP...');
        await axios.post(`${BASE_URL}/auth/send-otp`, { mobile: TEST_USER.mobile });
        console.log('   OTP Sent (Mocked).');

        // 2. Register
        // Note: In dev mode, OTP is fixed or logged. But wait, successful OTP verification is needed?
        // In authController.js: verifyOtp is called.
        // In auth.js: verifyOtp checks if otp == storedOtp.
        // In send-otp: it generates random OTP.
        // DEVELOPMENT HACK: I need to know the OTP.
        // But wait! verification of OTP might fail if I don't know it.

        // Actually, in development, I can check logs? OR I can skip OTP for test?
        // Let's check authController.js register function. It DOES NOT require OTP for registration??
        // Wait, usually Register requires Valid OTP.

        // Let's check authRoutes.js
        // router.post('/register', [validator], register);
        // inside register: const { mobile, otp, ... } = req.body;
        // await verifyOtp(mobile, otp);

        // So I need the OTP.
        // Modify `authController.js` or `utils/auth.js` to use fixed OTP '123456' in development?
        // Or simpler: I'll check `smsService.js`.

        // Let's read smsService.js.
    } catch (error) {
        console.error('TEST FAILED:', error.response ? error.response.data : error.message);
    } finally {
        server.kill();
    }
}

// I need to check how to get OTP.
// For now, I'll just write this file to check smsService logic.
