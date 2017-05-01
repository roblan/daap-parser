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

var parse = {
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
	container: function (part, translate) {
		var parsed = {},
			parser,
			content,
			code,
			codes,
			end;

		while (part.length > 8) {
			code = parse.string(part.slice(0, 4));
			end = parse.number(part.slice(4, 8)) + 8;

			content = parse.tag(code, part.slice(8, end));

			codes = [code];
			if (translate && contentCodes[code]) {
				code = contentCodes[code].name[0];
			}

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
		return parse[fnmap[contentCodes[code] ? contentCodes[code].type : CONTENT_TYPE.LONG]](part);
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

module.exports = {
	parse: parse.container,
	parseTag: parse.tag,
	translate: parse.translate
};
