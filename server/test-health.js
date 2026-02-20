const { spawn } = require('child_process');
const http = require('http');

console.log('Starting server...');
const server = spawn('node', ['index.js'], { stdio: 'pipe', cwd: __dirname });

server.stdout.on('data', (data) => {
    console.log(`SERVER: ${data.toString().trim()}`);
    if (data.toString().includes('running on')) {
        checkHealth();
    }
});

server.stderr.on('data', (data) => console.error(`ERROR: ${data.toString()}`));

function checkHealth() {
    console.log('Checking health...');
    http.get('http://localhost:5000/api/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('HEALTH CHECK RESPONSE:', data);
            server.kill();
            process.exit(0);
        });
    }).on('error', (err) => {
        console.error('Health check failed:', err.message);
        server.kill();
        process.exit(1);
    });
}

// Timeout
setTimeout(() => {
    console.error('Timeout waiting for server');
    server.kill();
    process.exit(1);
}, 10000);
