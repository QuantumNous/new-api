// Utility functions for JavaScript runtime

function logWithReq(req, message) {
    let reqPath = req.url || 'unknown path';
    console.log(`[${req.method} ${reqPath}] ${message}`);
}

function safeJsonParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        console.error('JSON parse error:', e.message);
        return defaultValue;
    }
}
