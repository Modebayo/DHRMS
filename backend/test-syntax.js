const fs = require('fs');
const tag = fs.readFileSync('./server.js', 'utf8');
const start = tag.indexOf("XHR_PROXY_TAG");
const content = tag.substring(start);
const s = content.indexOf("'");
const e = content.lastIndexOf("'");
const code = content.substring(s + 1, e);
const decoded = code
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
try {
    new Function(decoded);
    console.log("SYNTAX OK - no errors");
} catch (err) {
    console.log("SYNTAX ERROR:", err.message);
}
