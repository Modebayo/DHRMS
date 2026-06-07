const path = require('path');
const fs = require('fs');

process.env.DB_PATH = process.env.DB_PATH || path.join('/tmp', 'database.sqlite');
process.env.NETLIFY = 'true';

const dir = path.dirname(process.env.DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const serverless = require('serverless-http');
const { seedAdmin } = require('../../database');

try {
    seedAdmin();
} catch (e) {
    console.error('seedAdmin error:', e.message);
}

const app = require('../../server');

exports.handler = serverless(app, {
    requestPath: (event) => {
        const prefix = '/.netlify/functions/api';
        if (event.path && event.path.startsWith(prefix)) {
            return event.path.slice(prefix.length) || '/';
        }
        return event.path || '/';
    }
});
