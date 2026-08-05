process.env.NETLIFY = 'true';

const serverless = require('serverless-http');
const app = require('../../backend/server');

exports.handler = serverless(app, {
    requestPath: (event) => {
        const p = event.path || '';
        const markers = ['/.netlify/functions/api', '/.netlify/functions'];
        for (const marker of markers) {
            if (p.startsWith(marker)) {
                return p.slice(marker.length) || '/';
            }
        }
        return p;
    }
});
