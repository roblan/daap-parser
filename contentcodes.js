/* eslint-disable no-console */
const fs = require('fs');
const contentCodes = require('./contentcodes.json');

const req = JSON.parse(fs.readFileSync('./test/data/content-codes.json', 'utf8'));

const noName = [];
Object.keys(contentCodes).forEach((code) => {
	if (!contentCodes[code].name) {
		noName.push(code);
	}
});

if (noName.length) {
	console.log(
		`- name missing
  ${noName.join(', ')}
`
	);
}

const add = {};
const notInCC = [];
req.mccr.mdcl.forEach((info) => {
	if (info.mcnm === '\u0000\u0000\u0000\u0000') {
		return;
	}
	if (!contentCodes[info.mcnm]) {
		notInCC.push(info.mcnm);

		add[info.mcnm] = {
			name: info.mcna,
			type: info.mcty,
		};
	}
});

if (notInCC.length) {
	console.log(
		`- not in contentcodes.json
  ${notInCC.join(', ')}
`
	);

	let a = Object.assign({}, add, contentCodes);
	a = Object.keys(a).sort().reduce((memo, code) => {
		memo[code] = a[code];
		return memo;
	}, {});

	console.log(JSON.stringify(a, null, '\t'));
}
