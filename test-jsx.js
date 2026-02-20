const fs = require('fs');
const babel = require('@babel/core');

try {
    const code = fs.readFileSync('index.html', 'utf8');
    // Extract just the script part
    const scriptStart = code.indexOf('<script type="text/babel">') + '<script type="text/babel">'.length;
    const scriptEnd = code.indexOf('</script>', scriptStart);
    const scriptContent = code.substring(scriptStart, scriptEnd);

    babel.transformSync(scriptContent, {
        presets: ['@babel/preset-react'],
        filename: 'index.js'
    });
    console.log("JSX IS VALID!");
} catch (e) {
    console.error(e.message);
}
