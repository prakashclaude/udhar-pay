const fs = require('fs');

process.on('uncaughtException', (err) => {
    const msg = `[${new Date().toISOString()}] Uncaught Exception:\n${err.stack}\n`;
    console.error(msg);
    fs.writeFileSync('server-error-full.txt', msg);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = `[${new Date().toISOString()}] Unhandled Rejection at: ${promise}\nReason: ${reason}\n`;
    console.error(msg);
    fs.writeFileSync('server-error-full.txt', msg);
    process.exit(1);
});

console.log('Starting server via debug script...');
try {
    require('./index.js');
} catch (error) {
    const msg = `[${new Date().toISOString()}] Synchronous Error:\n${error.stack}\n`;
    console.error(msg);
    fs.writeFileSync('server-error-full.txt', msg);
    process.exit(1);
}
