const assert = require('assert');
const fs = require('fs');

const Parser = require('../daapparser');

const files = fs.readdirSync('./test')
	.filter(
		file => file.endsWith('.daap')
	).map(
		file => file.split('.')[0]
	);

describe('DAAP Parser', () => {
	describe('parsing', () => {
		files.forEach(name => {
			it(name, function () {
				const file = fs.readFileSync(`./test/${name}.daap`);
				const obj = require(`../test/${name}.json`);
				const parsed = Parser.parse(file);
				assert.deepEqual(JSON.parse(JSON.stringify(parsed)), obj);
			});
		});
	});

	describe('encoding', () => {
		files.forEach(name => {
			it(name, function () {
				const file = fs.readFileSync(`./test/${name}.daap`);
				const obj = require(`../test/${name}.json`);
				const encoded = Parser.encode(obj);
				assert.ok(encoded.equals(file));
			});
		});
	});
});