const contentCodes = require('./contentcodes.json');

const CONTENT_TYPE = {
	BYTE: 1,
	SHORT: 3,
	INT: 5,
	LONG: 7,
	STRING: 9,
	DATE: 10,
	VERSION: 11,
	CONTAINER: 12,
};
const fnMap = {
	[CONTENT_TYPE.CONTAINER]: 'container',
	[CONTENT_TYPE.BYTE]: 'number',
	[CONTENT_TYPE.SHORT]: 'number',
	[CONTENT_TYPE.INT]: 'number',
	[CONTENT_TYPE.LONG]: 'hex',
	[CONTENT_TYPE.STRING]: 'string',
	[CONTENT_TYPE.DATE]: 'date',
	[CONTENT_TYPE.VERSION]: 'version',
};
const LENGTHS = {
	[CONTENT_TYPE.BYTE]: 1,
	[CONTENT_TYPE.SHORT]: 2,
	[CONTENT_TYPE.INT]: 4,
	[CONTENT_TYPE.DATE]: 4,
	[CONTENT_TYPE.VERSION]: 4,
};

const parse = {
	number(part) {
		return part.readUIntBE(0, part.length);
	},
	string(part, encoding = 'utf8') {
		return part.toString(encoding);
	},
	date(part) {
		return new Date(parse.number(part) * 1000);
	},
	hex(part) {
		return `0x${part.toString('hex')}`;
	},
	version(part) {
		return [
			parse.number(part.slice(0, 2)),
			parse.number(part.slice(2, 3)),
			parse.number(part.slice(3)),
		].join('.');
	},
	container(part) {
		const parsed = {};
		let subpart = part;

		while (subpart.length > 8) {
			const code = parse.string(subpart.slice(0, 4), 'latin1');
			const end = parse.number(subpart.slice(4, 8)) + 8;
			const content = parse.tag(code, subpart.slice(8, end));

			if (!parsed[code]) {
				parsed[code] = content;
				if (contentCodes[code] && contentCodes[code].isArray) {
					parsed[code] = [parsed[code]];
				}
			} else {
				if (!Array.isArray(parsed[code])) {
					parsed[code] = [parsed[code]];
					if (!contentCodes[code] || !contentCodes[code].isArray) {
						console.warn(`contentParser: ${code} is array!`);
					}
				}
				parsed[code].push(content);
			}

			subpart = subpart.slice(end);
		}

		return parsed;
	},
	tag(code, part) {
		const type = contentCodes[code] ? contentCodes[code].type : CONTENT_TYPE.LONG;
		const encoding = type === CONTENT_TYPE.STRING
			&& contentCodes[code]
			&& contentCodes[code].encoding;
		return parse[fnMap[type] || 'hex'](part, encoding);
	},
	translate(data, short) {
		let parsed;

		if (Array.isArray(data)) {
			parsed = data.map(item => parse.translate(item, short));
		} else if (Object.prototype.toString.call(data) === '[object Object]') {
			parsed = Object.keys(data).reduce((memo, code) => {
				const value = parse.translate(data[code], short);
				const { name } = contentCodes[code] || {};
				const preKey = short || !name ? `[${code}]` : '';

				memo[[preKey, name].filter(Boolean).join(' ')] = value;

				return memo;
			}, {});
		} else {
			parsed = data;
		}
		return parsed;
	},
};

const encode = {
	parse(obj) {
		return Object.keys(obj).reduce((buffer, code) => {
			const codeInfo = contentCodes[code] || { type: CONTENT_TYPE.LONG };
			let part;
			if (codeInfo.type === CONTENT_TYPE.CONTAINER) {
				if (codeInfo.isArray) {
					part = Buffer.concat(obj[code].map(
						child => encode.wrapTag(code, encode.parse(child))
					));
				} else {
					part = encode.wrapTag(code, encode.parse(obj[code]));
				}
			} else if (codeInfo.isArray) {
				part = Buffer.concat(obj[code].map(
					child => encode.tag(code, child, codeInfo.type)
				));
			} else {
				part = encode.tag(code, obj[code], codeInfo.type, codeInfo.encoding);
			}
			return Buffer.concat([buffer, part]);
		}, Buffer.alloc(0));
	},
	wrapTag(code, data) {
		return Buffer.concat([encode.string(code, 'latin1'), encode.number(data.length, 4), data]);
	},
	tag(code, data, type, encoding) {
		const arg = type === CONTENT_TYPE.STRING ? encoding : LENGTHS[type];
		const fn = fnMap[type || CONTENT_TYPE.LONG];
		const decoded = encode[fn](data, arg);
		return this.wrapTag(code, decoded);
	},
	number(data, length) {
		const buffer = Buffer.alloc(length);
		buffer.writeUIntBE(data, 0, length);
		return buffer;
	},
	string(data, encoding = 'utf8') {
		return Buffer.from(data, encoding);
	},
	version(data) {
		const ver = data.split('.');
		return Buffer.concat([2, 1, 1].map(
			(length, index) => encode.number(ver[index], length)
		));
	},
	date(data, length) {
		return encode.number(new Date(data) / 1000, length);
	},
	hex(data) {
		return Buffer.from(data.startsWith('0x') ? data.substr(2) : data, 'hex');
	},
};

module.exports = {
	parse: parse.container,
	parseTag: parse.tag,
	encode: encode.parse,
	translate: parse.translate,
};
