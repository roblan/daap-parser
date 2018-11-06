#!/usr/bin/env node

const parser = require('./daap-parser');

process.stdin.setEncoding('latin1');

let data = '';

process.stdin.on('readable', () => {
	const chunk = process.stdin.read();
	if (chunk !== null) {
		data += chunk;
	}
});

process.stdin.on('end', () => {
	/* eslint-disable-next-line no-console */
	console.log(JSON.stringify(parser.translate(parser.parse(Buffer.from(data, 'latin1')), true), null, '\t'));
});
