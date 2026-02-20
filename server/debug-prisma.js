const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
    let log = `\n>>> RUNNING: ${cmd}\n`;
    try {
        const output = execSync(cmd, {
            env: { ...process.env, DATABASE_URL: 'postgresql://postgres:1234@localhost:5432/udhar_pay_db?schema=public' },
            stdio: 'pipe',
            encoding: 'utf8'
        });
        log += `SUCCESS:\n${output}\n`;
    } catch (error) {
        log += `!!! FAILURE !!!\nEXIT CODE: ${error.status}\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}\n`;
    }
    fs.appendFileSync('debug-output.txt', log);
}

fs.writeFileSync('debug-output.txt', '--- DIAGNOSTICS START ---\n');
run('npx prisma --version');
run('npx prisma validate');
run('npx prisma db push --accept-data-loss');
fs.appendFileSync('debug-output.txt', '--- DIAGNOSTICS END ---\n');
