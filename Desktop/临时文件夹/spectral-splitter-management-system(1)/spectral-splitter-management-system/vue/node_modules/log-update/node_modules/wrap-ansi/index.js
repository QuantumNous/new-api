'use strict';
const stringWidth = require('string-width');
const stripAnsi = require('strip-ansi');

const ESCAPES = new Set([
	'\u001B',
	'\u009B'
]);

const END_CODE = 39;

const ESCAPE_CODES = new Map([
	[0, 0],
	[1, 22],
	[2, 22],
	[3, 23],
	[4, 24],
	[7, 27],
	[8, 28],
	[9, 29],
	[30, 39],
	[31, 39],
	[32, 39],
	[33, 39],
	[34, 39],
	[35, 39],
	[36, 39],
	[37, 39],
	[90, 39],
	[40, 49],
	[41, 49],
	[42, 49],
	[43, 49],
	[44, 49],
	[45, 49],
	[46, 49],
	[47, 49]
]);

const wrapAnsi = code => `${ESCAPES.values().next().value}[${code}m`;

// Calculate the length of words split on ' ', ignoring
// the extra characters added by ansi escape codes
const wordLengths = str => str.split(' ').map(s => stringWidth(s));

// Wrap a long word across multiple rows
// Ansi escape codes do not count towards length
const wrapWord = (rows, word, cols) => {
	const arr = Array.from(word);

	let insideEscape = false;
	let visible = stringWidth(stripAnsi(rows[rows.length - 1]));

	for (const item of arr.entries()) {
		const i = item[0];
		const char = item[1];
		const charLength = stringWidth(char);

		if (visible + charLength <= cols) {
			rows[rows.length - 1] += char;
		} else {
			rows.push(char);
			visible = 0;
		}

		if (ESCAPES.has(char)) {
			insideEscape = true;
		} else if (insideEscape && char === 'm') {
			insideEscape = false;
			continue;
		}

		if (insideEscape) {
			continue;
		}

		visible += charLength;

		if (visible === cols && i < arr.length - 1) {
			rows.push('');
			visible = 0;
		}
	}

	// It's possible that the last row we copy over is only
	// ansi escape characters, handle this edge-case
	if (!visible && rows[rows.length - 1].length > 0 && rows.length > 1) {
		rows[rows.length - 2] += rows.pop();
	}
};

// The wrap-ansi module can be invoked
// in either 'hard' or 'soft' wrap mode
//
// 'hard' will never allow a string to take up more
// than cols characters
//
// 'soft' allows long words to expand past the column length
const exec = (str, cols, opts) => {
	const options = opts || {};

	if (str.trim() === '') {
		return options.trim === false ? str : str.trim();
	}

	let pre = '';
	let ret = '';
	let escapeCode;

	const lengths = wordLengths(str);
	const words = str.split(' ');
	const rows = [''];

	for (const item of Array.from(words).entries()) {
		const i = item[0];
		const word = item[1];

		rows[rows.length - 1] = options.trim === false ? rows[rows.length - 1] : rows[rows.length - 1].trim();
		let rowLength = stringWidth(rows[rows.length - 1]);

		if (rowLength || word === '') {
			if (rowLength === cols && options.wordWrap === false) {
				// If we start with a new word but the current row length equals the length of the columns, add a new row
				rows.push('');
				rowLength = 0;
			}

			rows[rows.length - 1] += ' ';
			rowLength++;
		}

		// In 'hard' wrap mode, the length of a line is
		// never allowed to extend past 'cols'
		if (lengths[i] > cols && options.hard) {
			if (rowLength) {
				rows.push('');
			}
			wrapWord(rows, word, cols);
			continue;
		}

		if (rowLength + lengths[i] > cols && rowLength > 0) {
			if (options.wordWrap === false && rowLength < cols) {
				wrapWord(rows, word, cols);
				continue;
			}

			rows.push('');
		}

		if (rowLength + lengths[i] > cols && options.wordWrap === false) {
			wrapWord(rows, word, cols);
			continue;
		}

		rows[rows.length - 1] += word;
	}

	pre = rows.map(r => options.trim === false ? r : r.trim()).join('\n');

	for (const item of Array.from(pre).entries()) {
		const i = item[0];
		const char = item[1];

		ret += char;

		if (ESCAPES.has(char)) {
			const code = parseFloat(/\d[^m]*/.exec(pre.slice(i, i + 4)));
			escapeCode = code === END_CODE ? null : code;
		}

		const code = ESCAPE_CODES.get(Number(escapeCode));

		if (escapeCode && code) {
			if (pre[i + 1] === '\n') {
				ret += wrapAnsi(code);
			} else if (char === '\n') {
				ret += wrapAnsi(escapeCode);
			}
		}
	}

	return ret;
};

// For each newline, invoke the method separately
module.exports = (str, cols, opts) => {
	return String(str)
		.normalize()
		.split('\n')
		.map(line => exec(line, cols, opts))
		.join('\n');
};
