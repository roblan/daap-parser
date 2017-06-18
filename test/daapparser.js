const assert = require('assert');
const fs = require('fs');

const Parser = require('../daapparser');
const path = './test/data/';

const files = fs.readdirSync(path)
	.filter(file => file.endsWith('.daap'))
	.map(file => file.split('.')[0])
	.map(file => ({
		name: file,
		json: JSON.parse(fs.readFileSync(path + `${file}.json`, 'utf8')),
		daap: fs.readFileSync(path + `${file}.daap`),
	}));

describe('DAAP Parser', () => {
	describe('parsing', () => {
		files.forEach(file => {
			it(file.name, function () {
				const parsed = Parser.parse(file.daap);

				assert.deepEqual(JSON.parse(JSON.stringify(parsed)), file.json);
			});
		});
	});

	describe('encoding', () => {
		files.forEach(file => {
			it(file.name, function () {
				const encoded = Parser.encode(file.json);

				assert.ok(encoded.equals(file.daap));
			});
		});
	});
});