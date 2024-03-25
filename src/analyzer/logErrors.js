//External Imports
/* eslint-disable-next-line no-unused-vars */
const colors = require('colors');

//Imports
const { getNodeFile } = require('./helpers');

//Helpers
const getNodeXpath = node => {
	let path = '';

	while (node && !node.name.includes('.json')) {
		path = node.name + (path ? '.' + path : '');

		node = node.parentNode;
	}

	return path;
};

const getNodeFullFile = node => {
	let path = '';
	let jsonFound = false;

	while (node && node.name !== 'package') {
		if (node.name.includes('.json'))
			jsonFound = true;

		if (jsonFound)
			path = node.name + (path ? '/' + path : '');

		node = node.parentNode;
	}

	if (path[0] === '@')
		path = path.substr(1);

	return path;
};

const logNode = (node, { xpathAppend }) => {
	xpathAppend = xpathAppend ? `.${xpathAppend}` : '';

	console.log('File:'.white, getNodeFile(node).gray);

	const xpath = '.' + getNodeXpath(node) + xpathAppend;
	if (xpath.length > 1) {
		console.log('XPath:'.white, xpath.gray);

		const fixedFile = getNodeFullFile(node)
			.split('/')
			.map(f => {
				if (f.includes('.') || f.includes('@'))
					return `["${f}"]`;

				return f;
			})
			.join('.')
			.replaceAll('.[', '[');

		const fullXpath = `.${fixedFile}${xpath}`;
		console.log('Full XPath:'.white, fullXpath.gray);
	}
};

const logError = ({ errorType, message, severity, node, xpathAppend }) => {
	const color = severity === 2 ? 'red' : 'yellow';

	console.log(`${message}`[color]);
	logNode(node, { xpathAppend });
	console.log('');
};

const logErrors = errors => {
	errors.forEach(e => logError(e));

	console.log(`Errors found: ${errors.length}`.bold.red, '\r\n');
};

module.exports = logErrors;
