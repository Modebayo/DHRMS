const fs = require('fs');
const c = fs.readFileSync('./server.js', 'utf8');
const startMarker = 'XHR_PROXY_TAG';
const start = c.indexOf(startMarker);
const lineEnd = c.indexOf('\n', start);
const line = c.substring(start, lineEnd);
console.log('Line length:', line.length);

const scriptOpen = line.indexOf('>');
const scriptClose = line.lastIndexOf('<');
const codeRaw = line.substring(scriptOpen + 1, scriptClose);
console.log('Extracted code length:', codeRaw.length);

let decoded = '';
for (let i = 0; i < codeRaw.length; i++) {
    if (codeRaw[i] === '\\' && i + 1 < codeRaw.length) {
        if (codeRaw[i + 1] === "'") {
            decoded += "'";
            i++;
        } else if (codeRaw[i + 1] === '\\') {
            decoded += '\\';
            i++;
        } else {
            decoded += codeRaw[i];
        }
    } else {
        decoded += codeRaw[i];
    }
}

try {
    new Function(decoded);
    console.log('SYNTAX OKAY');
} catch (err) {
    console.log('SYNTAX ERROR:', err.message);
    const posMatch = err.message.match(/position (\d+)/);
    if (posMatch) {
        const pos = parseInt(posMatch[1]);
        console.log('Context:', decoded.substring(Math.max(0, pos - 50), Math.min(decoded.length, pos + 50)));
    }
}

for (let i = 0; i < decoded.length; i++) {
    if (decoded[i] === '<') {
        console.log('Found < at position', i, 'context:', decoded.substring(Math.max(0, i - 20), Math.min(decoded.length, i + 20)));
    }
}
