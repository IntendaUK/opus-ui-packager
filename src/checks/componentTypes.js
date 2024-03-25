//Imports
const FuzzyMatcher = require('fuzzy-matching');
const { NODE_TYPES } = require('../analyzer/config');
const { nodeHasType } = require('../analyzer/helpers');

//Internals
const errorType = 'Component Type';

//Checks
const componentTypes = (node, errors, mdaPackage) => {
	if (!nodeHasType(node, NODE_TYPES.COMPONENT) || node.value.type === undefined)
		return;

	const fm = new FuzzyMatcher(Object.keys(mdaPackage.theme['components.json']));
	const match = fm.get(node.value.type);

	if (match.distance === 1)
		return;

	errors.push({
		errorType,
		message: `Component type ${node.value.type} does not exist, did you mean "${match.value}"?`,
		severity: 2,
		node
	});
};

module.exports = {
	check: componentTypes,
	init: () => {}
};

