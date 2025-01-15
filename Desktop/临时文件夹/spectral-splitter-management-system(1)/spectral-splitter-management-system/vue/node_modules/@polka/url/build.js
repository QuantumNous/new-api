const qs = require('querystring');

/**
 * @typedef ParsedURL
 * @type {import('.').ParsedURL}
 */

/**
 * @typedef Request
 * @property {string} url
 * @property {ParsedURL} _parsedUrl
 */

/**
 * @param {Request} req
 * @returns {ParsedURL|void}
 */
function parse(req) {
	let raw = req.url;
	if (raw == null) return;

	let prev = req._parsedUrl;
	if (prev && prev.raw === raw) return prev;

	let pathname=raw, search='', query;

	if (raw.length > 1) {
		let idx = raw.indexOf('?', 1);

		if (idx !== -1) {
			search = raw.substring(idx);
			pathname = raw.substring(0, idx);
			if (search.length > 1) {
				query = qs.parse(search.substring(1));
			}
		}
	}

	return req._parsedUrl = { pathname, search, query, raw };
}

exports.parse = parse;