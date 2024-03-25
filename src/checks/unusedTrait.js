//Imports
const { NODE_TYPES } = require('../analyzer/config');
const { nodeHasType } = require('../analyzer/helpers');

//Internals
const errorType = 'Unused trait';

//Checks
const unusedTrait = (node, errors) => {
	if (!nodeHasType(node, NODE_TYPES.TRAIT_UNUSED))
		return;

	errors.push({
		errorType,
		message: 'Trait is not used by any dashboard',
		severity: 1,
		node
	});
};

module.exports = {
	check: unusedTrait,
	init: () => {}
};
