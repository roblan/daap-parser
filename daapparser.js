const contentCodes = require('./contentcodes.json');
const CONTENT_TYPE = {
	'BYTE': 1,
	'SHORT': 3,
	'INT': 5,
	'LONG': 7,
	'STRING': 9,
	'DATE': 10,
	'VERSION': 11,
	'CONTAINER': 12
};
const fnmap = {
	[CONTENT_TYPE.CONTAINER]: 'container',
	[CONTENT_TYPE.BYTE]: 'number',
	[CONTENT_TYPE.SHORT]: 'number',
	[CONTENT_TYPE.INT]: 'number',
	[CONTENT_TYPE.LONG]: 'hex',
	[CONTENT_TYPE.STRING]: 'string',
	[CONTENT_TYPE.DATE]: 'date',
	[CONTENT_TYPE.VERSION]: 'version'
};
const LENGTHS = {
	[CONTENT_TYPE.BYTE]: 1,
	[CONTENT_TYPE.SHORT]: 2,
	[CONTENT_TYPE.INT]: 4,
	[CONTENT_TYPE.LONG]: 16,
	[CONTENT_TYPE.DATE]: 4,
	[CONTENT_TYPE.VERSION]: 4
};

const parse = {
	number: function (part) {
		return part.readUIntBE(0, part.length);
	},
	string: function(part) {
		return part.toString('utf8').replace(/�/, '');
	},
	date: function(part) {
		return new Date(parse.number(part)*1000);
	},
	hex: function(part) {
		return '0x' + (part.toString('hex').replace(/^0+/, '') || '0');
	},
	version: function(part) {
		return [
			parse.number(part.slice(0, 2)),
			parse.number(part.slice(2, 3)),
			parse.number(part.slice(3))
		].join('.');
	},
	container: function (part) {
		var parsed = {},
			content,
			code,
			end;

		while (part.length > 8) {
			code = parse.string(part.slice(0, 4));
			end = parse.number(part.slice(4, 8)) + 8;
			content = parse.tag(code, part.slice(8, end));

			if(!parsed[code]) {
				parsed[code] = content;
				if (contentCodes[code] && contentCodes[code].isArray) {
					parsed[code] = [parsed[code]];
				}
			} else {
				if(!Array.isArray(parsed[code])) {
					parsed[code] = [parsed[code]];
					if (!contentCodes[code] || !contentCodes[code].isArray) {
						console.warn('contentParser: ' + code + ' is array!');
					}
				}
				parsed[code].push(content);
			}

			part = part.slice(end);
		}

		return parsed;
	},
	tag: function (code, part) {
		return parse[fnmap[contentCodes[code] ? contentCodes[code].type : CONTENT_TYPE.LONG] || 'hex'](part);
	},
	translate: function (data, short) {
		var parsed;

		if (Array.isArray(data)) {
			parsed = data.map(function (item) {
				return parse.translate(item, short);
			});
		} else if (Object.prototype.toString.call(data) === '[object Object]') {
			parsed = Object.keys(data).reduce((memo, code) => {
				var value = parse.translate(data[code], short),
					info = contentCodes[code] || { name: [code] },
					preKey = short ? '[' + code + '] ' : '';

				info.name.forEach(name => {
					memo[preKey + name] = value;
				});

				return memo;
			}, {});
		} else {
			parsed = data;
		}
		return parsed;
	}
};

const encode = {
	parse(obj) {
		let buffer = Buffer.alloc(0);
		Object.keys(obj).forEach((code) => {
			const codeInfo = contentCodes[code];
			if (codeInfo.type === CONTENT_TYPE.CONTAINER) {
				if (codeInfo.isArray) {
					const packed = Buffer.concat(obj[code].map(child => encode.parse(child)));
					buffer = Buffer.concat([buffer, encode.wrapTag(code, packed)]);
				} else {
					const packed = encode.parse(obj[code]);
					buffer = Buffer.concat([buffer, encode.wrapTag(code, packed)]);
				}
			} else if (codeInfo.isArray) {
				const packed = Buffer.concat(obj[code].map(child => encode.tag(code, child, codeInfo.type)));
				buffer = Buffer.concat([buffer, packed]);
			} else {
				buffer = Buffer.concat([buffer, encode.tag(code, obj[code], codeInfo.type)]);
			}
		});
		return buffer;
	},
	wrapTag(code, data) {
		return Buffer.concat([encode.string(code), encode.number(data.length, 4), data]);
	},
	tag(code, data, type) {
		const decoded = encode[fnmap[type || CONTENT_TYPE.LONG]](data, LENGTHS[type]);
		return this.wrapTag(code, decoded);
	},
	number(data, length) {
		const buffer = Buffer.alloc(length);
		buffer.writeUIntBE(data, 0, length);
		return buffer;
	},
	string(data) {
		return Buffer.from(data);
	},
	version(data) {
		data = data.split('.');
		return Buffer.concat([2, 1, 1].map(
			(length, index) => encode.number(data[index], length))
		);
	},
	date(data, length) {
		return encode.number(new Date(data)/1000, length);
	},
	hex(data, length) {
		data = data.substr(2);
		data = new Array(length - data.length || data.length%2).fill(0).join('') + data;
		return Buffer.from(data, 'hex');
	}
}

module.exports = {
	parse: parse.container,
	parseTag: parse.tag,
	encode: encode.parse,
	translate: parse.translate
};
