//Imports
const FuzzyMatcher = require('fuzzy-matching');
const { NODE_TYPES } = require('../analyzer/config');
const { nodeHasType } = require('../analyzer/helpers');

//Internals
const errorType = 'Flows';

//Checks
const flows = (node, errors) => {
	if (!nodeHasType(node, NODE_TYPES.FLOW))
		return;

	//Flows need certain keywords
	const fm = new FuzzyMatcher(['from', 'to', 'fromKey', 'toKey', 'toSubKey', 'fromSubKey', 'mapFunctionString', 'ignoreEmptyString']);
	
	Object.entries(node.value).forEach(([k, v], i) => {
		const match = fm.get(k);
		if (match.distance === 1)
			return;

		if (match.distance > 0) {
			errors.push({
				errorType,
				message: `Incorrect keyword found ${k}, did you mean "${match.value}"?`,
				severity: 2,
				node,
				xpathAppend: `${i}.${k}`
			}); 
		} else {
			errors.push({
				errorType,
				message: `Incorrect keyword found ${k}`,
				severity: 2,
				node,
				xpathAppend: `${i}.${k}`
			}); 
		}
	});
};

module.exports = {
	check: flows,
	init: () => {}
};
