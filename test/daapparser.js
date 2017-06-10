const assert = require('assert');
const fs = require('fs');

const Parser = require('../daapparser');

const files = fs.readdirSync('./test')
	.filter(file => file.endsWith('.daap'))
	.map(file => file.split('.')[0])
	.map(file => ({
		name: file,
		json: require(`../test/${file}.json`),
		daap: fs.readFileSync(`./test/${file}.daap`),
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