const fs = require('fs');
const path = require('path');

const saPath = path.join(__dirname, '..', 'service-account.json');

if (!fs.existsSync(saPath)) {
    console.error('service-account.json not found!');
    console.log('\nSteps:');
    console.log('1. Go to https://console.firebase.google.com');
    console.log('2. Open your project');
    console.log('3. Project Settings > Service Accounts');
    console.log('4. Click "Generate new private key"');
    console.log('5. Save the downloaded file as "service-account.json" in the project root\n');
    process.exit(1);
}

const json = fs.readFileSync(saPath, 'utf8');
const base64 = Buffer.from(json, 'utf8').toString('base64');
console.log('=== Base64-encoded service account (copy this) ===\n');
console.log(base64);
console.log('\n=== Set this as FIREBASE_SERVICE_ACCOUNT env var on Render ===');

// Also show the project_id for confirmation
try {
    const sa = JSON.parse(json);
    console.log(`\nProject ID: ${sa.project_id}`);
    console.log(`Client email: ${sa.client_email}`);
} catch {}
